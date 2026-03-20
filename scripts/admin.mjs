/**
 * DepositRegistry Emergency Admin CLI
 * Usage: node scripts/admin.mjs <command> [args]
 *
 * Commands:
 *   status                          - Check if contract is paused
 *   pause                           - EMERGENCY: Pause all deposits/withdrawals
 *   unpause                         - Resume normal operations
 *   rescue <tokenSymbol> <safeAddr> - Move all tokens to safe wallet
 *   balance <tokenSymbol>           - Check contract token balance
 *
 * Examples:
 *   node scripts/admin.mjs status
 *   node scripts/admin.mjs pause
 *   node scripts/admin.mjs rescue pUSD 0xYourColdWalletAddress
 *   node scripts/admin.mjs rescue AUSD 0xYourColdWalletAddress
 *   node scripts/admin.mjs unpause
 */

import { createRequire } from 'module';
import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const require = createRequire(import.meta.url);

// ─── Config ───────────────────────────────────────────────────────────────────
const RPC      = 'https://rpc.testnet.tempo.xyz';
const CHAIN_ID = 42431;

const CONTRACT_ADDRESS = '0x0F935A3'; // Will be replaced by full addr below
// Read full address from web3.js
const web3src = require('fs').readFileSync('./src/config/web3.js', 'utf8');
const addrMatch = web3src.match(/42431:\s*'(0x[0-9a-fA-F]{40})'/);
const REGISTRY_ADDRESS = addrMatch ? addrMatch[1] : null;

const TOKENS = {
  pUSD: '0x20c0000000000000000000000000000000000000',
  AUSD: '0x20c0000000000000000000000000000000000001',
  BUSD: '0x20c0000000000000000000000000000000000002',
  TUSD: '0x20c0000000000000000000000000000000000003',
};

const ABI = [
  { inputs: [], name: 'pause',   outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'unpause', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'token', type: 'address' }, { name: 'to', type: 'address' }], name: 'emergencyRescue', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'paused',  outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'admin',   outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'token', type: 'address' }], name: 'contractBalance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
];

const ERC20_ABI = [
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
];

// ─── Setup ────────────────────────────────────────────────────────────────────
if (!REGISTRY_ADDRESS) { console.error('Could not read contract address from web3.js'); process.exit(1); }
if (!process.env.DEPLOY_PRIVATE_KEY) { console.error('DEPLOY_PRIVATE_KEY missing in .env'); process.exit(1); }

const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const wallet   = new Wallet(process.env.DEPLOY_PRIVATE_KEY, provider);
const contract = new Contract(REGISTRY_ADDRESS, ABI, wallet);

const fmt = (n, dec = 6) => (Number(n) / 10**dec).toLocaleString('en', { maximumFractionDigits: 2 });

// ─── Commands ─────────────────────────────────────────────────────────────────
const [,, cmd, arg1, arg2] = process.argv;

console.log(`\n🔐 DepositRegistry Admin CLI`);
console.log(`   Contract : ${REGISTRY_ADDRESS}`);
console.log(`   Admin    : ${wallet.address}`);
console.log(`   Command  : ${cmd || 'status'}\n`);

async function run() {
  switch ((cmd || 'status').toLowerCase()) {

    case 'status': {
      const isPaused = await contract.paused();
      const admin    = await contract.admin();
      console.log(`📊 Contract Status:`);
      console.log(`   Paused  : ${isPaused ? '🔴 YES (emergency mode)' : '🟢 NO (normal)'}`);
      console.log(`   Admin   : ${admin}`);
      console.log(`\n💰 Token Balances in Contract:`);
      for (const [sym, addr] of Object.entries(TOKENS)) {
        try {
          const bal = await contract.contractBalance(addr);
          console.log(`   ${sym.padEnd(6)}: ${fmt(bal)} tokens`);
        } catch {
          console.log(`   ${sym.padEnd(6)}: (not available)`);
        }
      }
      break;
    }

    case 'pause': {
      console.log('⚠️  PAUSING contract — all deposits/withdrawals will stop!');
      const tx = await contract.pause();
      console.log(`   TX: ${tx.hash}`);
      await tx.wait();
      console.log('🔴 Contract PAUSED. Users cannot deposit or withdraw.');
      break;
    }

    case 'unpause': {
      console.log('▶️  Resuming contract operations...');
      const tx = await contract.unpause();
      console.log(`   TX: ${tx.hash}`);
      await tx.wait();
      console.log('🟢 Contract UNPAUSED. Normal operations resumed.');
      break;
    }

    case 'rescue': {
      const sym     = arg1?.toUpperCase();
      const safeAddr = arg2;
      if (!sym || !TOKENS[sym]) {
        console.error(`❌ Unknown token: ${arg1}`);
        console.error(`   Available: ${Object.keys(TOKENS).join(', ')}`);
        process.exit(1);
      }
      if (!safeAddr || !safeAddr.startsWith('0x') || safeAddr.length !== 42) {
        console.error(`❌ Invalid safe address: ${safeAddr}`);
        process.exit(1);
      }
      const tokenAddr = TOKENS[sym];
      const bal = await contract.contractBalance(tokenAddr);
      console.log(`🚨 EMERGENCY RESCUE`);
      console.log(`   Token    : ${sym} (${tokenAddr})`);
      console.log(`   Amount   : ${fmt(bal)} ${sym}`);
      console.log(`   Send to  : ${safeAddr}`);
      console.log(`\n   Sending transaction...`);
      const tx = await contract.emergencyRescue(tokenAddr, safeAddr);
      console.log(`   TX: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ RESCUED! ${fmt(bal)} ${sym} sent to ${safeAddr}`);
      break;
    }

    case 'balance': {
      const sym = arg1?.toUpperCase();
      if (!sym || !TOKENS[sym]) {
        // Show all balances
        console.log('💰 All Token Balances in Contract:');
        for (const [s, addr] of Object.entries(TOKENS)) {
          const bal = await contract.contractBalance(addr);
          console.log(`   ${s.padEnd(6)}: ${fmt(bal)} tokens`);
        }
      } else {
        const bal = await contract.contractBalance(TOKENS[sym]);
        console.log(`💰 ${sym}: ${fmt(bal)} tokens in contract`);
      }
      break;
    }

    default:
      console.log(`❓ Unknown command: ${cmd}`);
      console.log(`   Available: status | pause | unpause | rescue | balance`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error:', err.shortMessage || err.message);
  process.exit(1);
});
