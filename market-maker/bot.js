/**
 * TempoSwap Market Maker Bot
 * ───────────────────────────────────────────────────────────────
 * Automatically places buy/sell limit orders on both sides of
 * every trading pair so that user swaps instantly fill.
 *
 * Setup:
 *   1.  cd market-maker && npm install
 *   2.  Copy .env.example to .env and fill in your values
 *   3.  node bot.js
 *
 * Deploy Free 24/7:  https://railway.app  or  https://render.com
 * ───────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const { createWalletClient, createPublicClient, http, parseUnits, formatUnits } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

// ─── Config ────────────────────────────────────────────────────────────────────
const PRIVATE_KEY        = process.env.PRIVATE_KEY;         // Your wallet private key (0x...)
const RPC_URL            = process.env.RPC_URL || 'https://rpc.moderato.tempo.xyz';
const DEX_ADDRESS        = '0xdec0000000000000000000000000000000000000';
const CHAIN_ID           = parseInt(process.env.CHAIN_ID || '42431'); // 42431 = testnet, 4217 = mainnet

// How much liquidity to seed per side, per pair (in smallest unit = 6 decimals)
const SEED_AMOUNT        = parseUnits(process.env.SEED_AMOUNT || '1000', 6); // 1,000 tokens per side
const REFRESH_INTERVAL   = parseInt(process.env.REFRESH_INTERVAL || '30000'); // 30 seconds
const SPREAD_TICK        = parseInt(process.env.SPREAD_TICK || '10');         // ±10 ticks spread

// ─── Trading Pairs (base token → quotes against pUSD) ──────────────────────────
const TOKENS = {
  pUSD: { address: '0x20c0000000000000000000000000000000000000', symbol: 'pUSD', decimals: 6, isQuote: true },
  AUSD: { address: '0x20c0000000000000000000000000000000000001', symbol: 'AUSD', decimals: 6 },
  BUSD: { address: '0x20c0000000000000000000000000000000000002', symbol: 'BUSD', decimals: 6 },
  TUSD: { address: '0x20c0000000000000000000000000000000000003', symbol: 'TUSD', decimals: 6 },
};

const PAIRS = [
  { base: TOKENS.AUSD, quote: TOKENS.pUSD },
  { base: TOKENS.BUSD, quote: TOKENS.pUSD },
  { base: TOKENS.TUSD, quote: TOKENS.pUSD },
];

// ─── ABI (minimal) ─────────────────────────────────────────────────────────────
const DEX_ABI = [
  { name: 'place', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'token',  type: 'address' },
      { name: 'amount', type: 'uint128' },
      { name: 'isBid',  type: 'bool'    },
      { name: 'tick',   type: 'int16'   },
    ], outputs: [{ name: 'orderId', type: 'uint128' }] },
  { name: 'cancel', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'orderId', type: 'uint128' }], outputs: [] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }, { name: 'token', type: 'address' }],
    outputs: [{ type: 'uint128' }] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint128' }], outputs: [] },
];

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
];

const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// ─── Setup clients ──────────────────────────────────────────────────────────────
const tempoChain = {
  id: CHAIN_ID,
  name: CHAIN_ID === 4217 ? 'Tempo Mainnet' : 'Tempo Testnet',
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 6 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({ chain: tempoChain, transport: http(RPC_URL) });
const walletClient = createWalletClient({ chain: tempoChain, transport: http(RPC_URL), account });

// ─── Track open orders (to cancel old ones before refreshing) ──────────────────
const openOrderIds = [];

// ─── Approve all tokens once ───────────────────────────────────────────────────
async function approveAll() {
  console.log('🔐 Approving all tokens for DEX...');
  for (const token of Object.values(TOKENS)) {
    const allowance = await publicClient.readContract({
      address: token.address, abi: ERC20_ABI, functionName: 'allowance',
      args: [account.address, DEX_ADDRESS],
    });
    if (allowance < SEED_AMOUNT * 1000n) {
      console.log(`  ✅ Approving ${token.symbol}...`);
      const hash = await walletClient.writeContract({
        address: token.address, abi: ERC20_ABI, functionName: 'approve',
        args: [DEX_ADDRESS, MAX_UINT256],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    } else {
      console.log(`  ✓  ${token.symbol} already approved`);
    }
  }
}

// ─── Cancel all open orders ────────────────────────────────────────────────────
async function cancelAll() {
  if (openOrderIds.length === 0) return;
  console.log(`🚫 Cancelling ${openOrderIds.length} stale order(s)...`);
  for (const id of openOrderIds) {
    try {
      const hash = await walletClient.writeContract({
        address: DEX_ADDRESS, abi: DEX_ABI, functionName: 'cancel', args: [id],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      // Order may have already been filled — that's fine!
    }
  }
  openOrderIds.length = 0;
}

// ─── Withdraw filled amounts back to wallet ────────────────────────────────────
async function withdrawBalance() {
  console.log('💸 Checking DEX internal balances to withdraw...');
  for (const token of Object.values(TOKENS)) {
    const bal = await publicClient.readContract({
      address: DEX_ADDRESS, abi: DEX_ABI, functionName: 'balanceOf',
      args: [account.address, token.address],
    });
    if (bal > 0n) {
      console.log(`  💰 Withdrawing ${formatUnits(bal, token.decimals)} ${token.symbol}...`);
      const hash = await walletClient.writeContract({
        address: DEX_ADDRESS, abi: DEX_ABI, functionName: 'withdraw',
        args: [token.address, bal],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }
  }
}

// ─── Place orders for one pair ─────────────────────────────────────────────────
async function seedPair(pair) {
  const { base } = pair;
  
  // Place BID (buy) at -SPREAD_TICK
  const bidTick = -SPREAD_TICK;
  // Place ASK (sell) at +SPREAD_TICK
  const askTick = SPREAD_TICK;

  console.log(`  📈 Placing BID  (${base.symbol} @tick ${bidTick})...`);
  const bidHash = await walletClient.writeContract({
    address: DEX_ADDRESS, abi: DEX_ABI, functionName: 'place',
    args: [base.address, SEED_AMOUNT, true, bidTick],
  });
  const bidReceipt = await publicClient.waitForTransactionReceipt({ hash: bidHash });
  // Parse orderId from logs (first topic of OrderPlaced)
  if (bidReceipt.logs?.[0]) {
    const orderId = BigInt(bidReceipt.logs[0].topics[1] || '0');
    if (orderId > 0n) openOrderIds.push(orderId);
  }

  console.log(`  📉 Placing ASK  (${base.symbol} @tick ${askTick})...`);
  const askHash = await walletClient.writeContract({
    address: DEX_ADDRESS, abi: DEX_ABI, functionName: 'place',
    args: [base.address, SEED_AMOUNT, false, askTick],
  });
  const askReceipt = await publicClient.waitForTransactionReceipt({ hash: askHash });
  if (askReceipt.logs?.[0]) {
    const orderId = BigInt(askReceipt.logs[0].topics[1] || '0');
    if (orderId > 0n) openOrderIds.push(orderId);
  }
}

// ─── Main loop ─────────────────────────────────────────────────────────────────
async function marketMakerCycle() {
  console.log('\n──────────────────────────────────────────');
  console.log(`🤖 Market Maker Cycle  [${new Date().toLocaleTimeString()}]`);
  console.log(`   Wallet: ${account.address}`);
  console.log('──────────────────────────────────────────');

  try {
    // 1. Withdraw any filled order proceeds first
    await withdrawBalance();

    // 2. Cancel stale open orders
    await cancelAll();

    // 3. Re-seed all pairs fresh
    for (const pair of PAIRS) {
      console.log(`\n🔄 Seeding ${pair.base.symbol}/${pair.quote.symbol}...`);
      await seedPair(pair);
    }

    console.log(`\n✅ All pairs seeded. Next cycle in ${REFRESH_INTERVAL / 1000}s...\n`);
  } catch (err) {
    console.error('❌ Error in market maker cycle:', err.message || err);
  }
}

// ─── Start ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('🚀 TempoSwap Market Maker Bot Starting...');
  console.log(`   Network : ${tempoChain.name} (Chain ID: ${CHAIN_ID})`);
  console.log(`   RPC     : ${RPC_URL}`);
  console.log(`   Seed    : ${formatUnits(SEED_AMOUNT, 6)} tokens/side/pair`);
  console.log(`   Spread  : ±${SPREAD_TICK} ticks`);
  console.log(`   Refresh : every ${REFRESH_INTERVAL / 1000}s`);

  await approveAll();
  await marketMakerCycle();
  setInterval(marketMakerCycle, REFRESH_INTERVAL);
})();
