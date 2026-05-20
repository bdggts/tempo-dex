// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITIP20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title LiquidityVault
 * @dev Single-sided liquidity vault for TempoSwap DEX.
 *      Users deposit pUSD → Bot uses pooled funds for market-making on the orderbook.
 *      Spread revenue is distributed proportionally to LPs based on boosted shares.
 *
 * Lock Tiers:
 *   Flexible (0 days)  → 1.0x boost
 *   Silver   (30 days) → 1.2x boost
 *   Gold     (90 days) → 1.5x boost
 *   Diamond  (180 days)→ 2.0x boost
 */
contract LiquidityVault {

    // ─── Lock Tiers ────────────────────────────────────────────────────────────
    enum LockTier { FLEXIBLE, SILVER, GOLD, DIAMOND }

    uint256 public constant LOCK_FLEXIBLE = 0;
    uint256 public constant LOCK_SILVER   = 30 days;
    uint256 public constant LOCK_GOLD     = 90 days;
    uint256 public constant LOCK_DIAMOND  = 180 days;

    // Boost multipliers (basis points: 10000 = 1.0x)
    uint256 public constant BOOST_FLEXIBLE = 10000; // 1.0x
    uint256 public constant BOOST_SILVER   = 12000; // 1.2x
    uint256 public constant BOOST_GOLD     = 15000; // 1.5x
    uint256 public constant BOOST_DIAMOND  = 20000; // 2.0x

    // ─── State ─────────────────────────────────────────────────────────────────
    address public admin;
    bool public paused;

    // Supported tokens (pUSD and other stablecoins)
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;

    // Global pool cap (0 = unlimited)
    uint256 public maxPoolCap;

    // Per-user daily deposit limit
    uint256 public constant USER_DAILY_LIMIT = 100_000 * 1e6; // 100K tokens
    uint256 public constant USER_COOLDOWN = 60; // 60 seconds between deposits

    // Total boosted shares across all users
    uint256 public totalBoostedShares;

    // Accumulated rewards per boosted share (scaled by 1e18 for precision)
    uint256 public rewardPerShare;

    // Total deposits tracked per token
    mapping(address => uint256) public totalDeposited;

    // ─── User Data ─────────────────────────────────────────────────────────────
    struct Deposit {
        address token;
        uint256 amount;         // principal deposited
        uint256 boostedShares;  // shares with boost multiplier
        LockTier lockTier;
        uint256 depositTime;
        uint256 unlockTime;
        uint256 rewardDebt;     // for reward accounting
        uint256 claimedRewards; // total rewards claimed so far
        bool active;
    }

    mapping(address => Deposit[]) public userDeposits;
    mapping(address => uint256) public lastDepositTime;
    mapping(address => uint256) public dailyDepositAmount;
    mapping(address => uint256) public dailyDepositDay;

    // ─── Events ────────────────────────────────────────────────────────────────
    event Deposited(address indexed user, address indexed token, uint256 amount, LockTier lockTier, uint256 unlockTime, uint256 depositIndex);
    event Withdrawn(address indexed user, uint256 depositIndex, uint256 amount, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 depositIndex, uint256 rewards);
    event RevenueDistributed(uint256 amount, uint256 newRewardPerShare);
    event EmergencyWithdrawn(address indexed user, uint256 depositIndex, uint256 amount);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);
    event PoolCapUpdated(uint256 newCap);

    // ─── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Vault is paused");
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(address _admin, address[] memory _tokens) {
        require(_admin != address(0), "Invalid admin");
        admin = _admin;

        for (uint256 i = 0; i < _tokens.length; i++) {
            supportedTokens[_tokens[i]] = true;
            tokenList.push(_tokens[i]);
            emit TokenAdded(_tokens[i]);
        }
    }

    // ─── Core: Deposit ─────────────────────────────────────────────────────────
    function deposit(address token, uint256 amount, LockTier lockTier) external whenNotPaused returns (uint256 depositIndex) {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be > 0");
        require(amount <= 1_000_000 * 1e6, "Max single deposit: 1M");

        // Cooldown check
        require(block.timestamp >= lastDepositTime[msg.sender] + USER_COOLDOWN, "Cooldown active");

        // Daily limit check
        uint256 today = block.timestamp / 1 days;
        if (dailyDepositDay[msg.sender] != today) {
            dailyDepositDay[msg.sender] = today;
            dailyDepositAmount[msg.sender] = 0;
        }
        require(dailyDepositAmount[msg.sender] + amount <= USER_DAILY_LIMIT, "Daily limit exceeded");

        // Pool cap check
        if (maxPoolCap > 0) {
            require(totalDeposited[token] + amount <= maxPoolCap, "Pool cap reached");
        }

        // Transfer tokens from user
        require(ITIP20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // Calculate boosted shares
        uint256 boost = _getBoost(lockTier);
        uint256 boostedShares = (amount * boost) / 10000;

        // Calculate lock duration
        uint256 lockDuration = _getLockDuration(lockTier);
        uint256 unlockTime = lockDuration > 0 ? block.timestamp + lockDuration : 0;

        // Create deposit record
        depositIndex = userDeposits[msg.sender].length;
        userDeposits[msg.sender].push(Deposit({
            token: token,
            amount: amount,
            boostedShares: boostedShares,
            lockTier: lockTier,
            depositTime: block.timestamp,
            unlockTime: unlockTime,
            rewardDebt: (boostedShares * rewardPerShare) / 1e18,
            claimedRewards: 0,
            active: true
        }));

        // Update global state
        totalBoostedShares += boostedShares;
        totalDeposited[token] += amount;
        lastDepositTime[msg.sender] = block.timestamp;
        dailyDepositAmount[msg.sender] += amount;

        emit Deposited(msg.sender, token, amount, lockTier, unlockTime, depositIndex);
    }

    // ─── Core: Withdraw ────────────────────────────────────────────────────────
    function withdraw(uint256 depositIndex) external whenNotPaused {
        require(depositIndex < userDeposits[msg.sender].length, "Invalid index");
        Deposit storage dep = userDeposits[msg.sender][depositIndex];
        require(dep.active, "Already withdrawn");

        // Check lock period
        if (dep.unlockTime > 0) {
            require(block.timestamp >= dep.unlockTime, "Still locked");
        }

        // Calculate pending rewards
        uint256 pending = _pendingRewards(dep);

        // Mark as withdrawn
        dep.active = false;
        totalBoostedShares -= dep.boostedShares;
        totalDeposited[dep.token] -= dep.amount;

        // Transfer principal + rewards
        uint256 totalPayout = dep.amount + pending;
        uint256 contractBal = ITIP20(dep.token).balanceOf(address(this));
        if (totalPayout > contractBal) {
            totalPayout = contractBal; // safety cap
        }

        require(ITIP20(dep.token).transfer(msg.sender, totalPayout), "Transfer failed");

        emit Withdrawn(msg.sender, depositIndex, dep.amount, pending);
    }

    // ─── Core: Claim Rewards (without withdrawing principal) ────────────────────
    function claimRewards(uint256 depositIndex) external whenNotPaused {
        require(depositIndex < userDeposits[msg.sender].length, "Invalid index");
        Deposit storage dep = userDeposits[msg.sender][depositIndex];
        require(dep.active, "Deposit not active");

        uint256 pending = _pendingRewards(dep);
        require(pending > 0, "No rewards");

        dep.rewardDebt = (dep.boostedShares * rewardPerShare) / 1e18;
        dep.claimedRewards += pending;

        require(ITIP20(dep.token).transfer(msg.sender, pending), "Transfer failed");

        emit RewardsClaimed(msg.sender, depositIndex, pending);
    }

    // ─── Core: Emergency Withdraw (forfeit rewards, ignore lock) ────────────────
    function emergencyWithdraw(uint256 depositIndex) external {
        require(depositIndex < userDeposits[msg.sender].length, "Invalid index");
        Deposit storage dep = userDeposits[msg.sender][depositIndex];
        require(dep.active, "Already withdrawn");

        dep.active = false;
        totalBoostedShares -= dep.boostedShares;
        totalDeposited[dep.token] -= dep.amount;

        // Return only principal, NO rewards
        uint256 contractBal = ITIP20(dep.token).balanceOf(address(this));
        uint256 payout = dep.amount > contractBal ? contractBal : dep.amount;

        require(ITIP20(dep.token).transfer(msg.sender, payout), "Transfer failed");

        emit EmergencyWithdrawn(msg.sender, depositIndex, payout);
    }

    // ─── Admin: Distribute Revenue ─────────────────────────────────────────────
    // Bot calls this after earning spread profit from market making
    function distributeRevenue(address token, uint256 amount) external onlyAdmin {
        require(amount > 0, "Amount must be > 0");
        require(totalBoostedShares > 0, "No LPs");

        // Transfer revenue from admin into vault
        require(ITIP20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // Update reward per share
        rewardPerShare += (amount * 1e18) / totalBoostedShares;

        emit RevenueDistributed(amount, rewardPerShare);
    }

    // ─── Views ─────────────────────────────────────────────────────────────────
    function pendingRewards(address user, uint256 depositIndex) external view returns (uint256) {
        if (depositIndex >= userDeposits[user].length) return 0;
        Deposit storage dep = userDeposits[user][depositIndex];
        if (!dep.active) return 0;
        return _pendingRewards(dep);
    }

    function getUserDepositCount(address user) external view returns (uint256) {
        return userDeposits[user].length;
    }

    function getUserDeposit(address user, uint256 index) external view returns (
        address token, uint256 amount, uint256 boostedShares,
        LockTier lockTier, uint256 depositTime, uint256 unlockTime,
        uint256 claimedRewards, bool active
    ) {
        Deposit storage dep = userDeposits[user][index];
        return (dep.token, dep.amount, dep.boostedShares, dep.lockTier,
                dep.depositTime, dep.unlockTime, dep.claimedRewards, dep.active);
    }

    function getPoolTVL(address token) external view returns (uint256) {
        return totalDeposited[token];
    }

    function getTokenCount() external view returns (uint256) {
        return tokenList.length;
    }

    function getContractBalance(address token) external view returns (uint256) {
        return ITIP20(token).balanceOf(address(this));
    }

    // ─── Admin Functions ───────────────────────────────────────────────────────
    function addToken(address token) external onlyAdmin {
        require(!supportedTokens[token], "Already supported");
        supportedTokens[token] = true;
        tokenList.push(token);
        emit TokenAdded(token);
    }

    function removeToken(address token) external onlyAdmin {
        require(supportedTokens[token], "Not supported");
        require(totalDeposited[token] == 0, "Token has deposits");
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    function setPoolCap(uint256 cap) external onlyAdmin {
        maxPoolCap = cap;
        emit PoolCapUpdated(cap);
    }

    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function changeAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin");
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    // Emergency: rescue stuck tokens (not user deposits)
    function rescueTokens(address token, address to, uint256 amount) external onlyAdmin {
        require(amount <= ITIP20(token).balanceOf(address(this)) - totalDeposited[token], "Cannot touch user funds");
        ITIP20(token).transfer(to, amount);
    }

    // ─── Internal Helpers ──────────────────────────────────────────────────────
    function _pendingRewards(Deposit storage dep) internal view returns (uint256) {
        return ((dep.boostedShares * rewardPerShare) / 1e18) - dep.rewardDebt;
    }

    function _getBoost(LockTier tier) internal pure returns (uint256) {
        if (tier == LockTier.DIAMOND)  return BOOST_DIAMOND;
        if (tier == LockTier.GOLD)     return BOOST_GOLD;
        if (tier == LockTier.SILVER)   return BOOST_SILVER;
        return BOOST_FLEXIBLE;
    }

    function _getLockDuration(LockTier tier) internal pure returns (uint256) {
        if (tier == LockTier.DIAMOND)  return LOCK_DIAMOND;
        if (tier == LockTier.GOLD)     return LOCK_GOLD;
        if (tier == LockTier.SILVER)   return LOCK_SILVER;
        return LOCK_FLEXIBLE;
    }
}
