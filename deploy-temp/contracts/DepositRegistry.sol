// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DepositRegistry
 * @notice Permanent on-chain record of user deposits into the TempoSwap liquidity pool.
 * @dev Actual tokens are transferred to the admin/bot wallet separately (ERC20 transfer).
 *      This contract only stores the RECORD: amount, lock period, timestamps.
 *      Tempo network sponsors all gas — users pay nothing!
 */
contract DepositRegistry {

    // ─── Enums ────────────────────────────────────────────────────────────────
    enum LockPeriod { Flexible, Week, Month }

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct Deposit {
        address token;        // which token was deposited (pUSD, AUSD, etc.)
        uint256 amount;       // amount in token's base units
        LockPeriod lockPeriod;// 0=Flexible, 1=7days, 2=30days
        uint256 depositTime;  // block.timestamp when deposited
        uint256 unlockTime;   // block.timestamp when can withdraw
        uint256 earnedYield;  // yield credited by admin (updated off-chain by bot)
        bool    active;       // false = user has exited this position
    }

    // ─── APY Basis Points (out of 10000) ─────────────────────────────────────
    // Flexible = 8% annual, Week = 11% annual, Month = 15% annual (max)
    // Weekly rate = annual / 52. Longer lock = higher weekly rate.
    uint16 public constant APY_FLEXIBLE = 800;   // 8%
    uint16 public constant APY_WEEK     = 1100;  // 11%
    uint16 public constant APY_MONTH    = 1500;  // 15%

    // ─── Lock durations ───────────────────────────────────────────────────────
    uint256 public constant LOCK_FLEXIBLE = 0;
    uint256 public constant LOCK_WEEK     = 7 days;
    uint256 public constant LOCK_MONTH    = 30 days;

    // ─── State ────────────────────────────────────────────────────────────────
    address public admin;
    mapping(address => Deposit[]) public userDeposits;
    uint256 public totalDepositCount;
    mapping(address => uint256) public totalDepositedByToken; // token → total amount

    // ─── Events ───────────────────────────────────────────────────────────────
    event Deposited(
        address indexed user,
        address indexed token,
        uint256 amount,
        LockPeriod lockPeriod,
        uint256 unlockTime,
        uint256 depositIndex
    );
    event Withdrawn(
        address indexed user,
        uint256 depositIndex,
        uint256 amount,
        uint256 yieldEarned
    );
    event YieldCredited(address indexed user, uint256 depositIndex, uint256 yield);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address _admin) {
        admin = _admin;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(msg.sender == admin, "DepositRegistry: not admin");
        _;
    }

    // ─── User Functions ───────────────────────────────────────────────────────

    /**
     * @notice Register a deposit on-chain. Call AFTER sending tokens to admin wallet.
     * @param token     ERC20 token address that was deposited
     * @param amount    Amount of tokens deposited (in token base units)
     * @param period    Lock period: 0=Flexible, 1=Week (7d), 2=Month (30d)
     */
    function registerDeposit(
        address token,
        uint256 amount,
        LockPeriod period
    ) external returns (uint256 depositIndex) {
        require(amount > 0, "DepositRegistry: amount must be > 0");
        require(token != address(0), "DepositRegistry: invalid token");

        uint256 lockDuration = _lockDuration(period);
        uint256 unlockAt = block.timestamp + lockDuration;

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
        totalDepositedByToken[token] += amount;

        emit Deposited(msg.sender, token, amount, period, unlockAt, depositIndex);
    }

    /**
     * @notice Mark a deposit as exited (after admin sends back principal + yield).
     *         Only callable by user themselves once unlock time has passed.
     * @param depositIndex Index in userDeposits[msg.sender]
     */
    function markWithdrawn(uint256 depositIndex) external {
        Deposit storage dep = userDeposits[msg.sender][depositIndex];
        require(dep.active, "DepositRegistry: already withdrawn");
        require(
            dep.lockPeriod == LockPeriod.Flexible || block.timestamp >= dep.unlockTime,
            "DepositRegistry: still locked"
        );

        dep.active = false;
        totalDepositedByToken[dep.token] -= dep.amount;

        emit Withdrawn(msg.sender, depositIndex, dep.amount, dep.earnedYield);
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────

    /**
     * @notice Admin credits yield to a specific deposit (called by bot after earning).
     */
    function creditYield(address user, uint256 depositIndex, uint256 yield) external onlyAdmin {
        Deposit storage dep = userDeposits[user][depositIndex];
        require(dep.active, "DepositRegistry: deposit not active");
        dep.earnedYield += yield;
        emit YieldCredited(user, depositIndex, yield);
    }

    /**
     * @notice Batch credit yield to multiple users at once (efficient for bot).
     */
    function creditYieldBatch(
        address[] calldata users,
        uint256[] calldata indices,
        uint256[] calldata yields
    ) external onlyAdmin {
        require(users.length == indices.length && users.length == yields.length, "length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            userDeposits[users[i]][indices[i]].earnedYield += yields[i];
            emit YieldCredited(users[i], indices[i], yields[i]);
        }
    }

    function changeAdmin(address newAdmin) external onlyAdmin {
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getDepositCount(address user) external view returns (uint256) {
        return userDeposits[user].length;
    }

    function getDeposit(address user, uint256 index) external view returns (Deposit memory) {
        return userDeposits[user][index];
    }

    function getAllDeposits(address user) external view returns (Deposit[] memory) {
        return userDeposits[user];
    }

    function isUnlocked(address user, uint256 index) external view returns (bool) {
        Deposit memory dep = userDeposits[user][index];
        return dep.lockPeriod == LockPeriod.Flexible || block.timestamp >= dep.unlockTime;
    }

    function getAPY(LockPeriod period) external pure returns (uint16) {
        if (period == LockPeriod.Flexible) return APY_FLEXIBLE;
        if (period == LockPeriod.Week)     return APY_WEEK;
        return APY_MONTH;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────
    function _lockDuration(LockPeriod period) internal pure returns (uint256) {
        if (period == LockPeriod.Flexible) return LOCK_FLEXIBLE;
        if (period == LockPeriod.Week)     return LOCK_WEEK;
        return LOCK_MONTH;
    }
}
