// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITIP20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title TempoSwapPair
 * @dev Uniswap V2-style AMM for Tempo blockchain stablecoin pairs.
 *      Implements constant product formula: x * y = k
 *      0.3% swap fee distributed to LPs proportionally.
 *
 * Usage: Deploy one pair per trading pair (e.g., pUSD/AUSD, pUSD/BUSD, pUSD/TUSD)
 *        Users add liquidity → receive LP shares → earn 0.3% of all swaps.
 *        Swaps pull from pool reserves instantly (no orderbook needed).
 */
contract TempoSwapPair {
    ITIP20 public immutable token0;  // e.g., pUSD
    ITIP20 public immutable token1;  // e.g., AUSD

    // Reserves
    uint256 public reserve0;
    uint256 public reserve1;

    // LP Token tracking
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    uint256 private constant MINIMUM_LIQUIDITY = 1000;
    uint256 private constant FEE_NUMERATOR = 997;   // 0.3% fee → multiply by 997/1000
    uint256 private constant FEE_DENOMINATOR = 1000;

    // Admin (for emergency only)
    address public admin;
    bool public paused;

    // Events
    event Mint(address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Burn(address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Swap(
        address indexed sender,
        uint256 amount0In, uint256 amount1In,
        uint256 amount0Out, uint256 amount1Out,
        address indexed to
    );
    event Sync(uint256 reserve0, uint256 reserve1);

    modifier whenNotPaused() {
        require(!paused, "Pair is paused");
        _;
    }

    constructor(address _token0, address _token1, address _admin) {
        require(_token0 != address(0) && _token1 != address(0), "Invalid tokens");
        require(_token0 != _token1, "Identical tokens");
        token0 = ITIP20(_token0);
        token1 = ITIP20(_token1);
        admin = _admin;
    }

    // ─── Math ──────────────────────────────────────────────────────────────────
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) { z = x; x = (y / x + x) / 2; }
        } else if (y != 0) { z = 1; }
    }

    function _min(uint256 x, uint256 y) internal pure returns (uint256) {
        return x < y ? x : y;
    }

    // ─── View: Quote output for a given input ──────────────────────────────────
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Insufficient input");
        require(reserveIn > 0 && reserveOut > 0, "No liquidity");
        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    // Quote: how much token1 you get for amountIn of token0
    function quoteSwap0to1(uint256 amountIn) external view returns (uint256) {
        return getAmountOut(amountIn, reserve0, reserve1);
    }

    // Quote: how much token0 you get for amountIn of token1
    function quoteSwap1to0(uint256 amountIn) external view returns (uint256) {
        return getAmountOut(amountIn, reserve1, reserve0);
    }

    // ─── Add Liquidity ─────────────────────────────────────────────────────────
    function addLiquidity(uint256 amount0Desired, uint256 amount1Desired, address to) external whenNotPaused returns (uint256 liquidity) {
        require(amount0Desired > 0 && amount1Desired > 0, "Amounts must be > 0");

        // Transfer tokens from user
        require(token0.transferFrom(msg.sender, address(this), amount0Desired), "T0 transfer failed");
        require(token1.transferFrom(msg.sender, address(this), amount1Desired), "T1 transfer failed");

        uint256 balance0 = token0.balanceOf(address(this));
        uint256 balance1 = token1.balanceOf(address(this));
        uint256 amount0 = balance0 - reserve0;
        uint256 amount1 = balance1 - reserve1;

        if (totalSupply == 0) {
            liquidity = _sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            totalSupply = MINIMUM_LIQUIDITY; // permanently lock first tokens
        } else {
            liquidity = _min(
                (amount0 * totalSupply) / reserve0,
                (amount1 * totalSupply) / reserve1
            );
        }

        require(liquidity > 0, "Insufficient liquidity minted");
        totalSupply += liquidity;
        balanceOf[to] += liquidity;

        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1, liquidity);
    }

    // ─── Remove Liquidity ──────────────────────────────────────────────────────
    function removeLiquidity(uint256 liquidity, address to) external whenNotPaused returns (uint256 amount0, uint256 amount1) {
        require(liquidity > 0, "Amount must be > 0");
        require(balanceOf[msg.sender] >= liquidity, "Insufficient LP balance");

        // Calculate pro-rata share
        amount0 = (liquidity * reserve0) / totalSupply;
        amount1 = (liquidity * reserve1) / totalSupply;
        require(amount0 > 0 && amount1 > 0, "Insufficient liquidity burned");

        // Burn LP tokens
        balanceOf[msg.sender] -= liquidity;
        totalSupply -= liquidity;

        // Transfer tokens back
        require(token0.transfer(to, amount0), "T0 transfer failed");
        require(token1.transfer(to, amount1), "T1 transfer failed");

        _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));
        emit Burn(msg.sender, amount0, amount1, liquidity);
    }

    // ─── Swap (direct — user sends tokenIn first, then calls swap) ─────────────
    function swap(uint256 amount0Out, uint256 amount1Out, address to) external whenNotPaused {
        require(amount0Out > 0 || amount1Out > 0, "Insufficient output");
        require(amount0Out < reserve0 && amount1Out < reserve1, "Insufficient liquidity");

        uint256 balance0 = token0.balanceOf(address(this));
        uint256 balance1 = token1.balanceOf(address(this));

        uint256 amount0In = balance0 > reserve0 - amount0Out ? balance0 - (reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > reserve1 - amount1Out ? balance1 - (reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "Insufficient input");

        // K constant check with 0.3% fee
        uint256 balance0Adjusted = (balance0 * 1000) - (amount0In * 3);
        uint256 balance1Adjusted = (balance1 * 1000) - (amount1In * 3);
        require(
            balance0Adjusted * balance1Adjusted >= reserve0 * reserve1 * (1000 ** 2),
            "K constant broken"
        );

        if (amount0Out > 0) require(token0.transfer(to, amount0Out), "T0 out failed");
        if (amount1Out > 0) require(token1.transfer(to, amount1Out), "T1 out failed");

        _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    // ─── Easy Swap (approve + swap in one call) ────────────────────────────────
    // Simpler interface: user specifies input amount and direction, gets output
    function swapExactToken0ForToken1(uint256 amountIn, uint256 minAmountOut, address to) external whenNotPaused returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be > 0");
        amountOut = getAmountOut(amountIn, reserve0, reserve1);
        require(amountOut >= minAmountOut, "Slippage exceeded");

        require(token0.transferFrom(msg.sender, address(this), amountIn), "Transfer in failed");
        require(token1.transfer(to, amountOut), "Transfer out failed");

        _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));
        emit Swap(msg.sender, amountIn, 0, 0, amountOut, to);
    }

    function swapExactToken1ForToken0(uint256 amountIn, uint256 minAmountOut, address to) external whenNotPaused returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be > 0");
        amountOut = getAmountOut(amountIn, reserve1, reserve0);
        require(amountOut >= minAmountOut, "Slippage exceeded");

        require(token1.transferFrom(msg.sender, address(this), amountIn), "Transfer in failed");
        require(token0.transfer(to, amountOut), "Transfer out failed");

        _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));
        emit Swap(msg.sender, 0, amountIn, amountOut, 0, to);
    }

    // ─── Admin ─────────────────────────────────────────────────────────────────
    function pause() external { require(msg.sender == admin); paused = true; }
    function unpause() external { require(msg.sender == admin); paused = false; }
    function changeAdmin(address newAdmin) external { require(msg.sender == admin); admin = newAdmin; }

    // ─── Internal ──────────────────────────────────────────────────────────────
    function _update(uint256 balance0, uint256 balance1) private {
        reserve0 = balance0;
        reserve1 = balance1;
        emit Sync(reserve0, reserve1);
    }
}
