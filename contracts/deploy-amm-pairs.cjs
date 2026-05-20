/**
 * deploy-amm-pairs.js
 * Deploys 3 TempoSwapPair AMM contracts to Tempo Testnet.
 * Each pair = pUSD + one base token (AUSD, BUSD, TUSD)
 *
 * Usage:
 *   cd contracts && node deploy-amm-pairs.js
 *
 * Requirements:
 *   npm install ethers solc dotenv
 */

const { ethers } = require('ethers');
const solc = require('solc');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'market-maker', '.env') });

// ─── Config ───────────────────────────────────────────────────────────────────
const RPC_URL = process.env.RPC_URL || 'https://rpc.moderato.tempo.xyz';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '42431');

// Token addresses on Tempo Testnet
const TOKENS = {
  pUSD: '0x20c0000000000000000000000000000000000000',
  AUSD: '0x20c0000000000000000000000000000000000001',
  BUSD: '0x20c0000000000000000000000000000000000002',
  TUSD: '0x20c0000000000000000000000000000000000003',
};

const PAIRS_TO_DEPLOY = [
  { name: 'pUSD/AUSD', token0: TOKENS.pUSD, token1: TOKENS.AUSD },
  { name: 'pUSD/BUSD', token0: TOKENS.pUSD, token1: TOKENS.BUSD },
  { name: 'pUSD/TUSD', token0: TOKENS.pUSD, token1: TOKENS.TUSD },
];

// ─── Compile Solidity ─────────────────────────────────────────────────────────
function compilePair() {
  console.log('📦 Compiling TempoSwapPair.sol...');
  const source = fs.readFileSync(path.join(__dirname, 'TempoSwapPair.sol'), 'utf8');

  const input = {
    language: 'Solidity',
    sources: { 'TempoSwapPair.sol': { content: source } },
    settings: {
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
      optimizer: { enabled: true, runs: 200 },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      console.error('❌ Compilation errors:');
      errors.forEach(e => console.error(e.formattedMessage));
      process.exit(1);
    }
    // Show warnings
    output.errors.filter(e => e.severity === 'warning').forEach(w => console.log('⚠️', w.message));
  }

  const contract = output.contracts['TempoSwapPair.sol']['TempoSwapPair'];
  console.log('✅ Compilation successful!\n');
  return {
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object,
  };
}

// ─── Deploy ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 TempoSwapPair AMM Deployer');
  console.log('═'.repeat(50));

  if (!PRIVATE_KEY) {
    console.error('❌ No PRIVATE_KEY found. Set it in market-maker/.env');
    process.exit(1);
  }

  // Compile
  const { abi, bytecode } = compilePair();

  // Connect
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const adminAddr = wallet.address;

  console.log(`👤 Deployer: ${adminAddr}`);
  console.log(`🌐 Network:  Tempo ${CHAIN_ID === 4217 ? 'Mainnet' : 'Testnet'} (${CHAIN_ID})`);
  console.log(`📡 RPC:      ${RPC_URL}\n`);

  const results = {};

  for (const pair of PAIRS_TO_DEPLOY) {
    console.log(`\n─── Deploying ${pair.name} ───`);
    console.log(`  token0: ${pair.token0}`);
    console.log(`  token1: ${pair.token1}`);
    console.log(`  admin:  ${adminAddr}`);

    try {
      const factory = new ethers.ContractFactory(abi, bytecode, wallet);
      const contract = await factory.deploy(pair.token0, pair.token1, adminAddr);
      console.log(`  ⏳ Tx sent: ${contract.deploymentTransaction().hash}`);

      await contract.waitForDeployment();
      const address = await contract.getAddress();

      results[pair.name] = address;
      console.log(`  ✅ Deployed: ${address}`);
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
      results[pair.name] = 'FAILED';
    }
  }

  // Summary
  console.log('\n\n' + '═'.repeat(50));
  console.log('📋 DEPLOYMENT SUMMARY');
  console.log('═'.repeat(50));
  for (const [name, addr] of Object.entries(results)) {
    console.log(`  ${name}: ${addr}`);
  }

  // Generate config
  console.log('\n\n📝 Paste this into src/config/web3.js → AMM_PAIRS:');
  console.log(`export const AMM_PAIRS = {`);
  console.log(`  ${CHAIN_ID}: {`);
  for (const [name, addr] of Object.entries(results)) {
    console.log(`    '${name}': '${addr}',`);
  }
  console.log(`  }`);
  console.log(`};`);

  // Save to file for reference
  fs.writeFileSync(
    path.join(__dirname, 'deployed-pairs.json'),
    JSON.stringify({ chainId: CHAIN_ID, network: CHAIN_ID === 4217 ? 'mainnet' : 'testnet', pairs: results, deployer: adminAddr, timestamp: new Date().toISOString() }, null, 2)
  );
  console.log('\n💾 Saved to contracts/deployed-pairs.json');
}

main().catch(console.error);
