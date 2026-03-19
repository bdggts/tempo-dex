// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITIP20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title TempoSwapPair
 * @dev A core Automated Market Maker (AMM) contract for the Tempo blockchain.
 * Implements the standard constant product formula: x * y = k
 */
contract TempoSwapPair {
    ITIP20 public immutable token0;
    ITIP20 public immutable token1;

    // Reserves
    uint256 public reserve0;
    uint256 public reserve1;

    // LP Token logic (simplified for hackathon)
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    uint256 private constant MINIMUM_LIQUIDITY = 10**3;
    
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    constructor(address _token0, address _token1) {
        token0 = ITIP20(_token0);
        token1 = ITIP20(_token1);
    }

    // --- Math Utilities --- //
    // Custom square root function for initial liquidity math
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function _min(uint256 x, uint256 y) internal pure returns (uint256) {
        return x < y ? x : y;
    }

    // --- Core Logic --- //
    
    /**
     * @dev Add liquidity to the pool. Mints LP tokens to the provider.
     */
    function addLiquidity(uint256 amount0Desired, uint256 amount1Desired, address to) external returns (uint256 liquidity) {
        // In a real DEX, users transfer tokens to the contract first via router.
        // For simplicity, we assume they approved this contract.
        require(token0.transferFrom(msg.sender, address(this), amount0Desired), "T0 transfer failed");
        require(token1.transferFrom(msg.sender, address(this), amount1Desired), "T1 transfer failed");

        uint256 balance0 = token0.balanceOf(address(this));
        uint256 balance1 = token1.balanceOf(address(this));
        
        uint256 amount0 = balance0 - reserve0;
        uint256 amount1 = balance1 - reserve1;

        if (totalSupply == 0) {
            liquidity = _sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            totalSupply = MINIMUM_LIQUIDITY; // permanently lock the first MINIMUM_LIQUIDITY tokens
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
        emit Mint(msg.sender, amount0, amount1);
    }

    /**
     * @dev Swap tokens using the x * y = k algorithm with a 0.3% fee.
     */
    function swap(uint256 amount0Out, uint256 amount1Out, address to) external {
        require(amount0Out > 0 || amount1Out > 0, "Insufficient output amount");
        require(amount0Out < reserve0 && amount1Out < reserve1, "Insufficient liquidity");

        uint256 balance0 = token0.balanceOf(address(this));
        uint256 balance1 = token1.balanceOf(address(this));

        // Determine how much was sent in
        uint256 amount0In = balance0 > reserve0 - amount0Out ? balance0 - (reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > reserve1 - amount1Out ? balance1 - (reserve1 - amount1Out) : 0;
        
        require(amount0In > 0 || amount1In > 0, "Insufficient input amount");

        // Flash loan checks and fee math (0.3% fee = 3 / 1000)
        uint256 balance0Adjusted = (balance0 * 1000) - (amount0In * 3);
        uint256 balance1Adjusted = (balance1 * 1000) - (amount1In * 3);
        
        require(
            balance0Adjusted * balance1Adjusted >= reserve0 * reserve1 * (1000**2),
            "K constant broken"
        );

        if (amount0Out > 0) token0.transfer(to, amount0Out);
        if (amount1Out > 0) token1.transfer(to, amount1Out);

        _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));
        
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    function _update(uint256 balance0, uint256 balance1) private {
        reserve0 = balance0;
        reserve1 = balance1;
        emit Sync(uint112(reserve0), uint112(reserve1));
    }
}
