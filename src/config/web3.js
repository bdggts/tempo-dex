import { http, fallback, createConfig } from 'wagmi';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';

// â”€â”€â”€ Tempo Networks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  chains: [TEMPO_TESTNET],
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: 'TempoSwap', appLogoUrl: 'https://tempo-dex.vercel.app/favicon.ico' }),
    walletConnect({
      projectId: 'c5e3d79f001c90299e1208d2a6a666e1',
      metadata: {
        name: 'TempoSwap',
        description: 'Decentralized exchange on Tempo Network',
        url: 'https://tempo-dex.vercel.app',
        icons: ['https://tempo-dex.vercel.app/favicon.ico'],
      },
      showQrModal: true,
    }),
  ],
  transports: {
    [TEMPO_TESTNET.id]: fallback([
      http('https://rpc.moderato.tempo.xyz', { timeout: 8000, retryCount: 3, retryDelay: 500 }),
      http('https://rpc.testnet.tempo.xyz',  { timeout: 8000, retryCount: 3, retryDelay: 500 }),
      http('https://rpc.tempo.xyz',           { timeout: 10000, retryCount: 2 }),
    ]),
  },
});

// â”€â”€â”€ Tempo Exchange Singleton (Enshrined DEX) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// ERC20/TIP20 ABI (for approve + balanceOf + allowance + transfer)
export const ERC20_ABI = [
  { "inputs": [{ "name": "owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "type": "bool" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "transfer", "outputs": [{ "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }
];

// â”€â”€â”€ Official TIP-20 Stablecoins on Tempo Testnet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// All use 6 decimals. Addresses confirmed from Tempo docs.
// PathUSD is the root quote token (no quote token itself).
// Other stablecoins quote against PathUSD or each other in a tree structure.
export const TOKENS = {
  PATH_USD: {
    address: '0x20c0000000000000000000000000000000000000',
    symbol: 'pUSD',
    name: 'PathUSD',
    logo: '',
    decimals: 6,
    isQuoteToken: true,
    chainId: 42431,
    description: 'Root quote token on Tempo DEX',
  },
  ALPHA_USD: {
    address: '0x20c0000000000000000000000000000000000001',
    symbol: 'AUSD',
    name: 'AlphaUSD',
    logo: '',
    decimals: 6,
    isQuoteToken: false,
    chainId: 42431,
    description: 'Faucet: 1M tokens free',
  },
  BETA_USD: {
    address: '0x20c0000000000000000000000000000000000002',
    symbol: 'BUSD',
    name: 'BetaUSD',
    logo: '',
    decimals: 6,
    isQuoteToken: false,
    chainId: 42431,
    description: 'Faucet: 1M tokens free',
  },
  THETA_USD: {
    address: '0x20c0000000000000000000000000000000000003',
    symbol: 'TUSD',
    name: 'ThetaUSD',
    logo: '',
    decimals: 6,
    isQuoteToken: false,
    chainId: 42431,
    description: 'Faucet: 1M tokens free',
  },
};

// â”€â”€â”€ Tempo Pricing Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Platform Fee â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 0.1% fee on every swap â€” minimal, user-friendly
// Fee is deducted from output and sent to admin's exchange balance
export const PLATFORM_FEE_BPS = 10; // 10 bps = 0.1%
export const FEE_DENOMINATOR = 10000;

// âš ï¸ Admin/Bot wallet â€” deposits go here, bot trades from here
export const ADMIN_WALLET = '0x76fCcFce8Deb1467364a2F5Ae3d62B03c821d524';

// â”€â”€â”€ Network-aware token list helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Returns only tokens that belong to the given chainId
export function getTokensForChain(chainId) {
  return Object.values(TOKENS).filter(t => t.chainId === chainId);
}

// â”€â”€â”€ Deposit Registry Contract â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// âš ï¸ REPLACE after deploying DepositRegistry.sol via Remix or deploy-registry.js
// Deploy instructions: contracts/deploy-registry.js
export const REGISTRY_ADDRESS = {
  42431: '0x1256e663995c6d221C43be1899c140ed6135a641', // Testnet - LIVE (escrow v2)
  4217:  '0x0000000000000000000000000000000000000000', // Mainnet - deploy later
};

export const LOCK_PERIOD = {
  FLEXIBLE: 0,  // Anytime  â†’ 3%
  Q1:       1,  // 3 months â†’ 6%
  Q2:       2,  // 6 months â†’ 9%
  Q3:       3,  // 9 months â†’ 12%
  Q4:       4,  // 12 months â†’ 15% max
};

// Annual APY â€” bank-style quarterly FD, max 15%/year
export const APY_BY_LOCK = {
  [LOCK_PERIOD.FLEXIBLE]: 3,   // 3%  annual (flexible, no lock)
  [LOCK_PERIOD.Q1]:       6,   // 6%  annual (3-month FD)
  [LOCK_PERIOD.Q2]:       9,   // 9%  annual (6-month FD)
  [LOCK_PERIOD.Q3]:       12,  // 12% annual (9-month FD)
  [LOCK_PERIOD.Q4]:       15,  // 15% annual (12-month FD) max
};

// Lock duration in days per tier (quarterly)
export const LOCK_DAYS = {
  [LOCK_PERIOD.FLEXIBLE]: 0,
  [LOCK_PERIOD.Q1]:       90,   // 3 months
  [LOCK_PERIOD.Q2]:       180,  // 6 months
  [LOCK_PERIOD.Q3]:       270,  // 9 months
  [LOCK_PERIOD.Q4]:       365,  // 12 months
};

// Helper: quarterly yield from annual APY
export function weeklyRate(annualApy) { return annualApy / 52; }

// Helper: estimated yield for a given amount, APY, and days
export function estimateYield(amount, annualApy, days) {
  return (amount * (annualApy / 100) * (days / 365));
}

export const REGISTRY_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_admin",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "oldAdmin",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newAdmin",
        "type": "address"
      }
    ],
    "name": "AdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "enum DepositRegistry.LockPeriod",
        "name": "lockPeriod",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "unlockTime",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "depositIndex",
        "type": "uint256"
      }
    ],
    "name": "Deposited",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "EmergencyRescue",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "depositIndex",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "PartialWithdrawn",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "by",
        "type": "address"
      }
    ],
    "name": "Paused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "reason",
        "type": "string"
      }
    ],
    "name": "SuspiciousActivity",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "by",
        "type": "address"
      }
    ],
    "name": "Unpaused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "depositIndex",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "yieldEarned",
        "type": "uint256"
      }
    ],
    "name": "Withdrawn",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "depositIndex",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "yieldAmt",
        "type": "uint256"
      }
    ],
    "name": "YieldClaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "depositIndex",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "yieldAmt",
        "type": "uint256"
      }
    ],
    "name": "YieldCredited",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "APY_FLEXIBLE",
    "outputs": [
      {
        "internalType": "uint16",
        "name": "",
        "type": "uint16"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "APY_Q1",
    "outputs": [
      {
        "internalType": "uint16",
        "name": "",
        "type": "uint16"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "APY_Q2",
    "outputs": [
      {
        "internalType": "uint16",
        "name": "",
        "type": "uint16"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "APY_Q3",
    "outputs": [
      {
        "internalType": "uint16",
        "name": "",
        "type": "uint16"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "APY_Q4",
    "outputs": [
      {
        "internalType": "uint16",
        "name": "",
        "type": "uint16"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "DAY",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "GLOBAL_HOURLY_LIMIT",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "LOCK_Q1",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "LOCK_Q2",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "LOCK_Q3",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "LOCK_Q4",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_DEPOSIT",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "USER_COOLDOWN",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "USER_DAILY_LIMIT",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "admin",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "canUserWithdraw",
    "outputs": [
      {
        "internalType": "bool",
        "name": "ok",
        "type": "bool"
      },
      {
        "internalType": "string",
        "name": "reason",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newAdmin",
        "type": "address"
      }
    ],
    "name": "changeAdmin",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "depositIndex",
        "type": "uint256"
      }
    ],
    "name": "claimYield",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "contractBalance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "depositIndex",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "yieldAmt",
        "type": "uint256"
      }
    ],
    "name": "creditYield",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "users",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "indices",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "yields",
        "type": "uint256[]"
      }
    ],
    "name": "creditYieldBatch",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      }
    ],
    "name": "emergencyRescue",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "fundYield",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "enum DepositRegistry.LockPeriod",
        "name": "period",
        "type": "uint8"
      }
    ],
    "name": "getAPY",
    "outputs": [
      {
        "internalType": "uint16",
        "name": "",
        "type": "uint16"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getAllDeposits",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "enum DepositRegistry.LockPeriod",
            "name": "lockPeriod",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "depositTime",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "unlockTime",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "earnedYield",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "active",
            "type": "bool"
          }
        ],
        "internalType": "struct DepositRegistry.Deposit[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      }
    ],
    "name": "getDeposit",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "enum DepositRegistry.LockPeriod",
            "name": "lockPeriod",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "depositTime",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "unlockTime",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "earnedYield",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "active",
            "type": "bool"
          }
        ],
        "internalType": "struct DepositRegistry.Deposit",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getDepositCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "globalHourStart",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "globalHourlyWithdrawn",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      }
    ],
    "name": "isUnlocked",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "lastClaimedAt",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "lastWithdrawTime",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "depositIndex",
        "type": "uint256"
      }
    ],
    "name": "pendingYield",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "enum DepositRegistry.LockPeriod",
        "name": "period",
        "type": "uint8"
      }
    ],
    "name": "registerDeposit",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "depositIndex",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "resetGlobalHourlyCounter",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalDepositCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "totalDepositedByToken",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "totalDepositedOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "userDayStart",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "userDeposits",
    "outputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "enum DepositRegistry.LockPeriod",
        "name": "lockPeriod",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "depositTime",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "unlockTime",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "earnedYield",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "active",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "userTotalDeposited",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "userWithdrawnToday",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "depositIndex",
        "type": "uint256"
      }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "depositIndex",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "withdrawAmount",
        "type": "uint256"
      }
    ],
    "name": "withdrawPartial",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

