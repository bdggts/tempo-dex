import { http, createConfig } from 'wagmi';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';

// ─── Tempo Networks ───────────────────────────────────────────────────────────
export const TEMPO_TESTNET = {
  id: 42431,
  name: 'Tempo Testnet',
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc.moderato.tempo.xyz'] },
    fallback: { http: ['https://rpc.testnet.tempo.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explore.testnet.tempo.xyz' },
  },
};

export const TEMPO_MAINNET = {
  id: 4217,
  name: 'Tempo Mainnet',
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc.tempo.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explore.tempo.xyz' },
  },
};

export const wagmiConfig = createConfig({
  chains: [TEMPO_MAINNET, TEMPO_TESTNET],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'TempoSwap' }),
    walletConnect({ projectId: 'c5e3d79f001c90299e1208d2a6a666e1' }), // Using a public/demo projectId for UI purposes
  ],
  transports: {
    [TEMPO_MAINNET.id]: http(),
    [TEMPO_TESTNET.id]: http(),
  },
});

// ─── Tempo Exchange Singleton (Enshrined DEX) ─────────────────────────────────
// Official predeployed contract address from Tempo spec
export const DEX_ADDRESS = '0xdec0000000000000000000000000000000000000';

// Full ABI matching the Tempo Exchange spec
export const DEX_ABI = [
  // Constants
  { "inputs": [], "name": "PRICE_SCALE", "outputs": [{ "type": "uint32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "TICK_SPACING", "outputs": [{ "type": "int16" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "MIN_TICK", "outputs": [{ "type": "int16" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "MAX_TICK", "outputs": [{ "type": "int16" }], "stateMutability": "view", "type": "function" },

  // Pair management
  { "inputs": [{ "name": "tokenA", "type": "address" }, { "name": "tokenB", "type": "address" }], "name": "pairKey", "outputs": [{ "type": "bytes32" }], "stateMutability": "pure", "type": "function" },
  { "inputs": [{ "name": "base", "type": "address" }], "name": "createPair", "outputs": [{ "type": "bytes32" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "pairKey", "type": "bytes32" }], "name": "books", "outputs": [{ "name": "base", "type": "address" }, { "name": "quote", "type": "address" }, { "name": "bestBidTick", "type": "int16" }, { "name": "bestAskTick", "type": "int16" }], "stateMutability": "view", "type": "function" },

  // Internal balances
  { "inputs": [{ "name": "user", "type": "address" }, { "name": "token", "type": "address" }], "name": "balanceOf", "outputs": [{ "type": "uint128" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "token", "type": "address" }, { "name": "amount", "type": "uint128" }], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" },

  // Order placement
  { "inputs": [{ "name": "token", "type": "address" }, { "name": "amount", "type": "uint128" }, { "name": "isBid", "type": "bool" }, { "name": "tick", "type": "int16" }], "name": "place", "outputs": [{ "name": "orderId", "type": "uint128" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "token", "type": "address" }, { "name": "amount", "type": "uint128" }, { "name": "isBid", "type": "bool" }, { "name": "tick", "type": "int16" }, { "name": "flipTick", "type": "int16" }], "name": "placeFlip", "outputs": [{ "name": "orderId", "type": "uint128" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "orderId", "type": "uint128" }], "name": "cancel", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "nextOrderId", "outputs": [{ "type": "uint128" }], "stateMutability": "view", "type": "function" },

  // Swaps
  { "inputs": [{ "name": "tokenIn", "type": "address" }, { "name": "tokenOut", "type": "address" }, { "name": "amountIn", "type": "uint128" }], "name": "quoteSwapExactAmountIn", "outputs": [{ "name": "amountOut", "type": "uint128" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "tokenIn", "type": "address" }, { "name": "tokenOut", "type": "address" }, { "name": "amountOut", "type": "uint128" }], "name": "quoteSwapExactAmountOut", "outputs": [{ "name": "amountIn", "type": "uint128" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "tokenIn", "type": "address" }, { "name": "tokenOut", "type": "address" }, { "name": "amountIn", "type": "uint128" }, { "name": "minAmountOut", "type": "uint128" }], "name": "swapExactAmountIn", "outputs": [{ "name": "amountOut", "type": "uint128" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "tokenIn", "type": "address" }, { "name": "tokenOut", "type": "address" }, { "name": "amountOut", "type": "uint128" }, { "name": "maxAmountIn", "type": "uint128" }], "name": "swapExactAmountOut", "outputs": [{ "name": "amountIn", "type": "uint128" }], "stateMutability": "nonpayable", "type": "function" },

  // Events
  { "anonymous": false, "inputs": [{ "indexed": true, "name": "key", "type": "bytes32" }, { "indexed": true, "name": "base", "type": "address" }, { "indexed": true, "name": "quote", "type": "address" }], "name": "PairCreated", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "name": "orderId", "type": "uint128" }, { "indexed": true, "name": "maker", "type": "address" }, { "indexed": true, "name": "token", "type": "address" }, { "name": "amount", "type": "uint128" }, { "name": "isBid", "type": "bool" }, { "name": "tick", "type": "int16" }, { "name": "isFlipOrder", "type": "bool" }, { "name": "flipTick", "type": "int16" }], "name": "OrderPlaced", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "name": "orderId", "type": "uint128" }], "name": "OrderCancelled", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "name": "orderId", "type": "uint128" }, { "indexed": true, "name": "maker", "type": "address" }, { "indexed": true, "name": "taker", "type": "address" }, { "name": "amountFilled", "type": "uint128" }, { "name": "partialFill", "type": "bool" }], "name": "OrderFilled", "type": "event" }
];

// ERC20/TIP20 ABI (for approve + balanceOf + allowance)
export const ERC20_ABI = [
  { "inputs": [{ "name": "owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }
];

// ─── Official TIP-20 Stablecoins on Tempo Testnet ────────────────────────────
// All use 6 decimals. Addresses confirmed from Tempo docs.
// PathUSD is the root quote token (no quote token itself).
// Other stablecoins quote against PathUSD or each other in a tree structure.
export const TOKENS = {
  PATH_USD: {
    address: '0x20c0000000000000000000000000000000000000',
    symbol: 'pUSD',
    name: 'PathUSD',
    logo: '🟡',
    decimals: 6,
    isQuoteToken: true,
    description: 'Root quote token on Tempo DEX',
  },
  ALPHA_USD: {
    address: '0x20c0000000000000000000000000000000000001',
    symbol: 'AUSD',
    name: 'AlphaUSD',
    logo: '💵',
    decimals: 6,
    isQuoteToken: false,
    description: 'Faucet: 1M tokens free',
  },
  BETA_USD: {
    address: '0x20c0000000000000000000000000000000000002',
    symbol: 'BUSD',
    name: 'BetaUSD',
    logo: '💴',
    decimals: 6,
    isQuoteToken: false,
    description: 'Faucet: 1M tokens free',
  },
  THETA_USD: {
    address: '0x20c0000000000000000000000000000000000003',
    symbol: 'TUSD',
    name: 'ThetaUSD',
    logo: '💶',
    decimals: 6,
    isQuoteToken: false,
    description: 'Faucet: 1M tokens free',
  },
};

// ─── Tempo Pricing Helpers ────────────────────────────────────────────────────
// From spec: PRICE_SCALE = 100_000, price = PRICE_SCALE + tick
export const PRICE_SCALE = 100_000;
export const TICK_SPACING = 10;
export const MIN_TICK = -2000;
export const MAX_TICK = 2000;

export function tickToPrice(tick) {
  return (PRICE_SCALE + tick) / PRICE_SCALE;
}

export function priceToTick(price) {
  const rawTick = Math.round((price * PRICE_SCALE) - PRICE_SCALE);
  // Round to nearest tick spacing
  return Math.round(rawTick / TICK_SPACING) * TICK_SPACING;
}

export function formatTick(tick) {
  const pricePct = ((tick / PRICE_SCALE) * 100).toFixed(4);
  const sign = tick >= 0 ? '+' : '';
  return `${sign}${pricePct}%`;
}

// ─── Platform Fee ─────────────────────────────────────────────────────────────
// 0.1% fee on every swap — minimal, user-friendly
// Fee is deducted from output and sent to admin's exchange balance
export const PLATFORM_FEE_BPS = 10; // 10 bps = 0.1%
export const FEE_DENOMINATOR = 10000;

// ⚠️ IMPORTANT: Replace with YOUR MetaMask wallet address!
export const ADMIN_WALLET = '0x4c9ad8a2e9b93606205302c4A3789a056fB37008';
