// deploy.mjs — ESM-compatible compile + deploy script
// Usage: node scripts/deploy.mjs
// Requires: DEPLOY_PRIVATE_KEY in .env

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { JsonRpcProvider, Wallet, ContractFactory } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();
const require = createRequire(import.meta.url);
const solc = require('solc');

// ─── Config ───────────────────────────────────────────────────────────────────
const NETWORK = process.argv[2] === 'mainnet'
  ? { name: 'Tempo Mainnet', rpc: 'https://rpc.tempo.xyz', chainId: 4217 }
  : { name: 'Tempo Testnet', rpc: 'https://rpc.testnet.tempo.xyz', chainId: 42431 };

// ─── Compile ──────────────────────────────────────────────────────────────────
console.log('\n🔨 Compiling DepositRegistry.sol...');
const source = readFileSync('./contracts/DepositRegistry.sol', 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'DepositRegistry.sol': { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } },
};

const compiled = JSON.parse(solc.compile(JSON.stringify(input)));

// Check for errors
if (compiled.errors) {
  const errors = compiled.errors.filter(e => e.severity === 'error');
  if (errors.length > 0) {
    console.error('❌ Compilation errors:');
    errors.forEach(e => console.error(e.formattedMessage));
    process.exit(1);
  }
  compiled.errors.forEach(e => console.warn('⚠️', e.formattedMessage));
}

const contract = compiled.contracts['DepositRegistry.sol']['DepositRegistry'];
const ABI      = contract.abi;
const BYTECODE = '0x' + contract.evm.bytecode.object;
console.log('✅ Compiled! Bytecode size:', (BYTECODE.length / 2 - 1), 'bytes');

// ─── Deploy ───────────────────────────────────────────────────────────────────
if (!process.env.DEPLOY_PRIVATE_KEY) {
  console.error('\n❌ DEPLOY_PRIVATE_KEY not found in .env!');
  console.log('   Add this to your .env file:');
  console.log('   DEPLOY_PRIVATE_KEY=0xYOUR_METAMASK_PRIVATE_KEY\n');
  process.exit(1);
}

console.log(`\n🚀 Deploying to ${NETWORK.name}...`);
const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId, { staticNetwork: true, polling: true });
const wallet   = new Wallet(process.env.DEPLOY_PRIVATE_KEY, provider);
console.log('   Admin/Deployer:', wallet.address);

const factory  = new ContractFactory(ABI, BYTECODE, wallet);
const deployed = await factory.deploy(wallet.address); // wallet = admin
await deployed.waitForDeployment();

const address  = await deployed.getAddress();
const explorer = NETWORK.chainId === 4217
  ? `https://explore.tempo.xyz/address/${address}`
  : `https://explore.testnet.tempo.xyz/address/${address}`;

console.log('\n✅ DepositRegistry Deployed!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('   Contract Address:', address);
console.log('   Network:         ', NETWORK.name);
console.log('   Explorer:        ', explorer);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📝 Now paste this into src/config/web3.js → REGISTRY_ADDRESS:');
console.log(`   ${NETWORK.chainId}: '${address}',  // ${NETWORK.name}`);
console.log('\n🎉 Done! Your Earn tab will be fully live after this change.\n');
