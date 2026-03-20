/**
 * DepositRegistry 24/7 Security Watchdog (Simple Poll Version)
 * =============================================================
 * Uses simple contract state polling — works on any RPC.
 *
 * What it checks every 15 seconds:
 *   - Is contract paused?
 *   - Is globalHourlyWithdrawn increasing fast?
 *   - Is contract balance dropping fast?
 *   - Calls pause() automatically if suspicious
 *
 * Run: node scripts/monitor.mjs
 * Or double-click: START_MONITOR.bat
 */

import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import { appendFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import dotenv from 'dotenv';
dotenv.config();

const require = createRequire(import.meta.url);

// ─── Config ───────────────────────────────────────────────────────────────────
const RPC_URL  = 'https://rpc.testnet.tempo.xyz';
const CHAIN_ID = 42431;
const LOG_FILE = './monitor.log';
const POLL_MS  = 15_000; // check every 15 seconds

// Read contract address from web3.js
const web3src   = require('fs').readFileSync('./src/config/web3.js', 'utf8');
const addrMatch = web3src.match(/42431:\s*'(0x[0-9a-fA-F]{40})'/);
const CONTRACT  = addrMatch ? addrMatch[1] : null;

const TOKENS = {
  pUSD: '0x20c0000000000000000000000000000000000000',
  AUSD: '0x20c0000000000000000000000000000000000001',
  BUSD: '0x20c0000000000000000000000000000000000002',
  TUSD: '0x20c0000000000000000000000000000000000003',
};

// Alert thresholds
const BALANCE_DROP_ALERT_PCT  = 20;  // Alert if contract balance drops > 20% in one check
const POLL_HOURLY_LIMIT       = 1_500_000 * 1e6; // Alert if hourly withdrawn > 1.5M (contract will auto-pause at 2M)

// ─── ABI ──────────────────────────────────────────────────────────────────────
const ABI = [
  { inputs: [], name: 'paused',                outputs: [{ name: '', type: 'bool'    }], stateMutability: 'view',        type: 'function' },
  { inputs: [], name: 'globalHourlyWithdrawn', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',        type: 'function' },
  { inputs: [], name: 'admin',                 outputs: [{ name: '', type: 'address' }], stateMutability: 'view',        type: 'function' },
  { inputs: [], name: 'pause',                 outputs: [],                               stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'token', type: 'address' }], name: 'contractBalance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
];

// ─── Setup ────────────────────────────────────────────────────────────────────
if (!CONTRACT) { console.error('Cannot read contract address from web3.js'); process.exit(1); }
if (!process.env.DEPLOY_PRIVATE_KEY) { console.error('DEPLOY_PRIVATE_KEY missing in .env'); process.exit(1); }

const provider   = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
const wallet     = new Wallet(process.env.DEPLOY_PRIVATE_KEY, provider);
const contract   = new Contract(CONTRACT, ABI, wallet);
const contractRO = new Contract(CONTRACT, ABI, provider);

// ─── Logger ───────────────────────────────────────────────────────────────────
const ts  = () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
const log = (msg) => {
  const line = `[${ts()}] ${msg}`;
  console.log(line);
  try { appendFileSync(LOG_FILE, line + '\n'); } catch {}
};
const alert = (msg) => {
  const line = `[${ts()}] 🚨 ALERT: ${msg}`;
  console.error('\x1b[31m' + line + '\x1b[0m'); // red text
  try { appendFileSync(LOG_FILE, line + '\n'); } catch {}
};

// ─── Auto Pause ───────────────────────────────────────────────────────────────
let pauseAttempted = false;
async function autoPause(reason) {
  if (pauseAttempted) return;
  pauseAttempted = true;
  alert(`AUTO-PAUSING: ${reason}`);
  try {
    const isPaused = await contractRO.paused().catch(() => false);
    if (isPaused) { log('Already paused. OK.'); pauseAttempted = false; return; }
    const tx = await contract.pause();
    log(`Pause TX: ${tx.hash}`);
    await tx.wait();
    log('✅ CONTRACT PAUSED SUCCESSFULLY.');
  } catch (err) {
    alert(`PAUSE FAILED: ${err.message} — Run manually: node scripts/admin.mjs pause`);
  }
  pauseAttempted = false;
}

// ─── State ────────────────────────────────────────────────────────────────────
let prevBalances = {};
let tickCount    = 0;

// ─── Main Poll ────────────────────────────────────────────────────────────────
async function poll() {
  tickCount++;
  try {
    // 1. Check if paused
    const isPaused = await contractRO.paused();
    if (isPaused && tickCount === 1) {
      log('ℹ️  Contract is currently PAUSED (emergency mode).');
    }

    // 2. Check globalHourlyWithdrawn
    let hourlyWithdrawn = 0n;
    try {
      hourlyWithdrawn = await contractRO.globalHourlyWithdrawn();
      const hwNum = Number(hourlyWithdrawn) / 1e6;
      if (hwNum > POLL_HOURLY_LIMIT / 1e6 && !isPaused) {
        alert(`Hourly withdrawn = ${hwNum.toFixed(0)} tokens — approaching 2M auto-pause limit!`);
      }
    } catch {}

    // 3. Check contract token balances for sudden drop
    let totalBal = 0;
    for (const [sym, addr] of Object.entries(TOKENS)) {
      try {
        const bal    = await contractRO.contractBalance(addr);
        const balNum = Number(bal) / 1e6;
        totalBal    += balNum;

        const prev = prevBalances[sym];
        if (prev !== undefined && prev > 0) {
          const dropPct = ((prev - balNum) / prev) * 100;
          if (dropPct > BALANCE_DROP_ALERT_PCT && !isPaused) {
            alert(`${sym} balance dropped ${dropPct.toFixed(1)}%! Was ${prev.toFixed(0)}, now ${balNum.toFixed(0)}`);
            await autoPause(`${sym} balance sudden drop of ${dropPct.toFixed(1)}%`);
          }
        }
        prevBalances[sym] = balNum;
      } catch {}
    }

    // 4. Heartbeat every 10 ticks (2.5 min)
    if (tickCount % 10 === 0) {
      const hourNum = Number(hourlyWithdrawn) / 1e6;
      log(`Heartbeat | paused=${isPaused} | total_bal=${totalBal.toFixed(2)} | hourly_out=${hourNum.toFixed(2)}`);
    }

  } catch (err) {
    // RPC error — don't crash, just log
    if (tickCount % 20 === 0) log(`RPC poll error: ${err.message}`);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
console.log('\x1b[32m');
console.log('  ╔══════════════════════════════════════╗');
console.log('  ║   DepositRegistry Security Monitor   ║');
console.log('  ╠══════════════════════════════════════╣');
console.log(`  ║ Contract : ${CONTRACT.slice(0,20)}...  ║`);
console.log(`  ║ Interval : ${POLL_MS/1000}s                        ║`);
console.log('  ║ Press Ctrl+C to stop                 ║');
console.log('  ╚══════════════════════════════════════╝');
console.log('\x1b[0m');

log(`Monitor started. Contract: ${CONTRACT}`);
await poll(); // immediate first check
setInterval(poll, POLL_MS);
