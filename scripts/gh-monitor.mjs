/**
 * GitHub Actions Security Check Script
 * Runs every 10 minutes via GitHub Actions (free, no laptop needed).
 * Auto-pauses contract if suspicious activity detected.
 */

import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import { readFileSync } from 'fs';

const RPC_URL  = 'https://rpc.testnet.tempo.xyz';
const CHAIN_ID = 42431;

// Read contract address from web3.js
const web3src   = readFileSync('./src/config/web3.js', 'utf8');
const addrMatch = web3src.match(/42431:\s*'(0x[0-9a-fA-F]{40})'/);
const CONTRACT  = addrMatch ? addrMatch[1] : null;

const TOKENS = [
  '0x20c0000000000000000000000000000000000000', // pUSD
  '0x20c0000000000000000000000000000000000001', // AUSD
  '0x20c0000000000000000000000000000000000002', // BUSD
  '0x20c0000000000000000000000000000000000003', // TUSD
];

const ABI = [
  { inputs: [], name: 'paused', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'pause',  outputs: [],                            stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'globalHourlyWithdrawn', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'token', type: 'address' }], name: 'contractBalance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
];

// Thresholds
const HOURLY_ALERT = BigInt(1_500_000 * 1e6); // Alert at 1.5M (contract auto-pauses at 2M)

const log   = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const alert = (m) => console.error(`[${new Date().toISOString()}] 🚨 ALERT: ${m}`);

if (!CONTRACT)                       { log('Cannot find contract address'); process.exit(1); }
if (!process.env.DEPLOY_PRIVATE_KEY) { log('DEPLOY_PRIVATE_KEY not set'); process.exit(1); }

const provider  = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
const wallet    = new Wallet(process.env.DEPLOY_PRIVATE_KEY, provider);
const contract  = new Contract(CONTRACT, ABI, wallet);
const contractR = new Contract(CONTRACT, ABI, provider);

async function main() {
  log(`Checking contract: ${CONTRACT}`);
  let shouldPause = false;
  let pauseReason = '';

  // Check 1: Is already paused?
  const isPaused = await contractR.paused();
  log(`Contract paused: ${isPaused}`);
  if (isPaused) { log('Contract is paused — no action needed.'); process.exit(0); }

  // Check 2: Global hourly withdrawn
  try {
    const hourly = await contractR.globalHourlyWithdrawn();
    const hourlyM = Number(hourly) / 1e6;
    log(`Hourly withdrawn: ${hourlyM.toFixed(2)} tokens`);
    if (hourly > HOURLY_ALERT) {
      shouldPause = true;
      pauseReason = `Hourly withdrawn ${hourlyM.toFixed(0)} tokens (threshold: 1.5M)`;
    }
  } catch (e) { log(`hourly check skipped: ${e.message}`); }

  // Check 3: Contract balances
  let totalBal = 0;
  for (const token of TOKENS) {
    try {
      const bal = await contractR.contractBalance(token);
      totalBal += Number(bal) / 1e6;
    } catch {}
  }
  log(`Total contract balance: ${totalBal.toFixed(2)} tokens`);

  // Auto-pause if needed
  if (shouldPause) {
    alert(pauseReason);
    log('Calling pause()...');
    const tx = await contract.pause();
    await tx.wait();
    log(`✅ CONTRACT PAUSED. TX: ${tx.hash}`);
    process.exit(1); // Exit with error so GitHub shows it as failed run (you get email alert)
  }

  log('✅ All checks passed. Contract is healthy.');
  process.exit(0);
}

main().catch(err => {
  console.error('Check failed:', err.message);
  process.exit(1);
});
