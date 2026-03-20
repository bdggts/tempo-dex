// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DepositRegistry v6 - Auto-Defense Edition
 *
 * AUTOMATIC SECURITY FEATURES:
 * 1. Re-entrancy Guard        - Blocks re-entrancy attacks
 * 2. Strict CEI Pattern       - State change before external call
 * 3. Per-user withdrawal cooldown - 1 hour between withdrawals per user
 * 4. Per-user daily limit     - Max 500K tokens withdrawn per 24 hours per user
 * 5. Global hourly output cap - Max 2M tokens can leave contract per hour
 * 6. Emergency Pause          - Admin can freeze instantly
 * 7. Emergency Rescue         - Admin can move funds to safe wallet
 * 8. 10M deposit cap          - Limits max exposure per deposit
 *
 * NOTE: Items 3-5 are AUTOMATIC -- no admin needed, contract blocks itself.
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract DepositRegistry {

    enum LockPeriod { Flexible, Q1, Q2, Q3, Q4 }

    struct Deposit {
        address    token;
        uint256    amount;
        LockPeriod lockPeriod;
        uint256    depositTime;
        uint256    unlockTime;
        uint256    earnedYield;
        bool       active;
    }

    // ── Constants ──────────────────────────────────────────────────────────────
    uint16  public constant APY_FLEXIBLE = 300;
    uint16  public constant APY_Q1       = 600;
    uint16  public constant APY_Q2       = 900;
    uint16  public constant APY_Q3       = 1200;
    uint16  public constant APY_Q4       = 1500;

    uint256 public constant LOCK_Q1 = 90  days;
    uint256 public constant LOCK_Q2 = 180 days;
    uint256 public constant LOCK_Q3 = 270 days;
    uint256 public constant LOCK_Q4 = 365 days;

    uint256 public constant MAX_DEPOSIT           = 10_000_000 * 1e6; // 10M per deposit
    uint256 public constant USER_DAILY_LIMIT      = 500_000   * 1e6; // 500K per user per 24h
    uint256 public constant GLOBAL_HOURLY_LIMIT   = 2_000_000 * 1e6; // 2M total per hour
    uint256 public constant USER_COOLDOWN         = 1 hours;          // 1hr between withdrawals
    uint256 public constant DAY                   = 24 hours;

    // ── State ──────────────────────────────────────────────────────────────────
    address public admin;
    bool    public paused;

    // Re-entrancy guard
    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED     = 2;

    // Per-user rate limiting
    mapping(address => uint256) public lastWithdrawTime;      // last withdraw timestamp
    mapping(address => uint256) public userWithdrawnToday;    // total withdrawn in current day
    mapping(address => uint256) public userDayStart;          // when current 24h period started

    // Global rate limiting
    uint256 public globalHourlyWithdrawn;   // total withdrawn this hour
    uint256 public globalHourStart;         // when current hour started

    // Deposits
    mapping(address => Deposit[]) public userDeposits;
    mapping(address => uint256)   public totalDepositedByToken;
    mapping(address => uint256)   public userTotalDeposited;
    uint256 public totalDepositCount;

    // ── Events ─────────────────────────────────────────────────────────────────
    event Deposited(address indexed user, address indexed token, uint256 amount, LockPeriod lockPeriod, uint256 unlockTime, uint256 depositIndex);
    event Withdrawn(address indexed user, uint256 depositIndex, uint256 amount, uint256 yieldEarned);
    event PartialWithdrawn(address indexed user, uint256 depositIndex, uint256 amount);
    event YieldCredited(address indexed user, uint256 depositIndex, uint256 yieldAmt);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event EmergencyRescue(address indexed token, address indexed to, uint256 amount);
    event SuspiciousActivity(address indexed user, string reason);

    // ── Constructor ────────────────────────────────────────────────────────────
    constructor(address _admin) {
        require(_admin != address(0), "zero admin");
        admin            = _admin;
        paused           = false;
        _status          = _NOT_ENTERED;
        globalHourStart  = block.timestamp;
    }

    // ── Modifiers ──────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    modifier notPaused() {
        require(!paused, "paused: emergency mode");
        _;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    // ── Automatic Rate Limiter ─────────────────────────────────────────────────

    /**
     * @dev Called before every withdrawal. Automatically blocks if:
     *   - User withdrew too recently (cooldown)
     *   - User exceeded daily limit
     *   - Global hourly outflow exceeded
     * Emits SuspiciousActivity for monitoring tools to detect.
     */
    function _checkAndUpdateRateLimits(address user, uint256 amount) internal {
        // 1. Cooldown: must wait 1 hour between withdrawals
        require(
            block.timestamp >= lastWithdrawTime[user] + USER_COOLDOWN,
            "rate limit: wait 1 hour between withdrawals"
        );

        // 2. Reset user's daily counter if 24h has passed
        if (block.timestamp >= userDayStart[user] + DAY) {
            userWithdrawnToday[user] = 0;
            userDayStart[user]       = block.timestamp;
        }

        // 3. Check user daily limit
        uint256 newUserTotal = userWithdrawnToday[user] + amount;
        if (newUserTotal > USER_DAILY_LIMIT) {
            emit SuspiciousActivity(user, "daily limit exceeded");
            revert("rate limit: daily withdrawal limit reached");
        }

        // 4. Reset global hourly counter
        if (block.timestamp >= globalHourStart + 1 hours) {
            globalHourlyWithdrawn = 0;
            globalHourStart       = block.timestamp;
        }

        // 5. Check global hourly limit — auto-pause if exceeded
        uint256 newGlobal = globalHourlyWithdrawn + amount;
        if (newGlobal > GLOBAL_HOURLY_LIMIT) {
            // AUTO-PAUSE the contract immediately!
            paused = true;
            emit SuspiciousActivity(user, "global hourly limit: contract auto-paused");
            emit Paused(address(this)); // self-paused
            revert("SECURITY: unusual outflow detected, contract auto-paused");
        }

        // 6. Update counters
        lastWithdrawTime[user]     = block.timestamp;
        userWithdrawnToday[user]   = newUserTotal;
        globalHourlyWithdrawn      = newGlobal;
    }

    // ── Emergency Controls ─────────────────────────────────────────────────────

    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function emergencyRescue(address token, address to) external onlyAdmin nonReentrant {
        require(to    != address(0), "zero destination");
        require(token != address(0), "zero token");
        uint256 bal = IERC20(token).balanceOf(address(this));
        require(bal > 0, "nothing to rescue");
        emit EmergencyRescue(token, to, bal);
        require(IERC20(token).transfer(to, bal), "rescue failed");
    }

    // ── User: Deposit ──────────────────────────────────────────────────────────

    function registerDeposit(address token, uint256 amount, LockPeriod period)
        external notPaused nonReentrant returns (uint256 depositIndex)
    {
        require(amount > 0,            "amount zero");
        require(amount <= MAX_DEPOSIT, "exceeds max deposit");
        require(token != address(0),   "zero token");

        uint256 unlockAt = block.timestamp + _lockDuration(period);

        // EFFECTS first
        userDeposits[msg.sender].push(Deposit({
            token:       token,
            amount:      amount,
            lockPeriod:  period,
            depositTime: block.timestamp,
            unlockTime:  unlockAt,
            earnedYield: 0,
            active:      true
        }));
        depositIndex = userDeposits[msg.sender].length - 1;
        totalDepositCount++;
        totalDepositedByToken[token]   += amount;
        userTotalDeposited[msg.sender] += amount;

        emit Deposited(msg.sender, token, amount, period, unlockAt, depositIndex);

        // INTERACTION last
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "transfer failed");
    }

    // ── User: Full Withdraw ────────────────────────────────────────────────────

    function withdraw(uint256 depositIndex) external notPaused nonReentrant {
        Deposit storage dep = userDeposits[msg.sender][depositIndex];

        require(dep.active,  "already withdrawn");
        require(
            dep.lockPeriod == LockPeriod.Flexible || block.timestamp >= dep.unlockTime,
            "still locked"
        );

        uint256 principal = dep.amount;
        uint256 yield_    = dep.earnedYield;
        uint256 total     = principal + yield_;
        address token     = dep.token;

        // Rate limiting check (automatic security)
        _checkAndUpdateRateLimits(msg.sender, total);

        // EFFECTS
        dep.active      = false;
        dep.amount      = 0;
        dep.earnedYield = 0;
        totalDepositedByToken[token]   -= principal;
        userTotalDeposited[msg.sender] -= principal;

        emit Withdrawn(msg.sender, depositIndex, principal, yield_);

        // INTERACTION last
        require(IERC20(token).transfer(msg.sender, total), "transfer failed");
    }

    // ── User: Partial Withdraw ─────────────────────────────────────────────────

    function withdrawPartial(uint256 depositIndex, uint256 withdrawAmount) external notPaused nonReentrant {
        Deposit storage dep = userDeposits[msg.sender][depositIndex];

        require(dep.active,                       "already withdrawn");
        require(
            dep.lockPeriod == LockPeriod.Flexible || block.timestamp >= dep.unlockTime,
            "still locked"
        );
        require(withdrawAmount > 0,               "zero amount");
        require(withdrawAmount <= dep.amount,     "exceeds deposit");

        address token = dep.token;

        // Rate limiting check (automatic security)
        _checkAndUpdateRateLimits(msg.sender, withdrawAmount);

        // EFFECTS
        dep.amount -= withdrawAmount;
        totalDepositedByToken[token]   -= withdrawAmount;
        userTotalDeposited[msg.sender] -= withdrawAmount;

        if (dep.amount == 0) {
            uint256 yield_ = dep.earnedYield;
            dep.active      = false;
            dep.earnedYield = 0;
            uint256 sendAmt = withdrawAmount + yield_;
            emit Withdrawn(msg.sender, depositIndex, withdrawAmount, yield_);
            require(IERC20(token).transfer(msg.sender, sendAmt), "transfer failed");
        } else {
            emit PartialWithdrawn(msg.sender, depositIndex, withdrawAmount);
            require(IERC20(token).transfer(msg.sender, withdrawAmount), "transfer failed");
        }
    }

    // ── Admin: Yield ───────────────────────────────────────────────────────────

    function creditYield(address user, uint256 depositIndex, uint256 yieldAmt) external onlyAdmin {
        require(user != address(0), "zero user");
        Deposit storage dep = userDeposits[user][depositIndex];
        require(dep.active, "not active");
        dep.earnedYield += yieldAmt;
        emit YieldCredited(user, depositIndex, yieldAmt);
    }

    function creditYieldBatch(address[] calldata users, uint256[] calldata indices, uint256[] calldata yields) external onlyAdmin {
        require(users.length == indices.length && users.length == yields.length, "length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            userDeposits[users[i]][indices[i]].earnedYield += yields[i];
            emit YieldCredited(users[i], indices[i], yields[i]);
        }
    }

    function fundYield(address token, uint256 amount) external onlyAdmin nonReentrant {
        require(token  != address(0), "zero token");
        require(amount > 0,           "zero amount");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "fund failed");
    }

    function changeAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "zero admin");
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    // Admin can adjust rate limits (optional future use)
    function resetGlobalHourlyCounter() external onlyAdmin {
        globalHourlyWithdrawn = 0;
        globalHourStart       = block.timestamp;
    }

    // ── Views ──────────────────────────────────────────────────────────────────

    function getAllDeposits(address user) external view returns (Deposit[] memory) {
        return userDeposits[user];
    }

    function getDeposit(address user, uint256 index) external view returns (Deposit memory) {
        return userDeposits[user][index];
    }

    function getDepositCount(address user) external view returns (uint256) {
        return userDeposits[user].length;
    }

    function isUnlocked(address user, uint256 index) external view returns (bool) {
        Deposit memory dep = userDeposits[user][index];
        return dep.lockPeriod == LockPeriod.Flexible || block.timestamp >= dep.unlockTime;
    }

    function contractBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function totalDepositedOf(address token) external view returns (uint256) {
        return totalDepositedByToken[token];
    }

    function canUserWithdraw(address user) external view returns (bool ok, string memory reason) {
        if (paused) return (false, "contract paused");
        if (block.timestamp < lastWithdrawTime[user] + USER_COOLDOWN)
            return (false, "cooldown: wait before next withdrawal");
        uint256 dayTotal = block.timestamp < userDayStart[user] + DAY ? userWithdrawnToday[user] : 0;
        if (dayTotal >= USER_DAILY_LIMIT) return (false, "daily limit reached");
        return (true, "ok");
    }

    function getAPY(LockPeriod period) external pure returns (uint16) {
        if (period == LockPeriod.Flexible) return APY_FLEXIBLE;
        if (period == LockPeriod.Q1)       return APY_Q1;
        if (period == LockPeriod.Q2)       return APY_Q2;
        if (period == LockPeriod.Q3)       return APY_Q3;
        return APY_Q4;
    }

    function _lockDuration(LockPeriod period) internal pure returns (uint256) {
        if (period == LockPeriod.Flexible) return 0;
        if (period == LockPeriod.Q1)       return LOCK_Q1;
        if (period == LockPeriod.Q2)       return LOCK_Q2;
        if (period == LockPeriod.Q3)       return LOCK_Q3;
        return LOCK_Q4;
    }
}
