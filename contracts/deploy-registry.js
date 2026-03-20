/**
 * deploy-registry.js
 * Deploys the DepositRegistry contract to Tempo Testnet (or Mainnet).
 *
 * Usage:
 *   node contracts/deploy-registry.js
 *
 * Requirements:
 *   npm install ethers  (already installed as part of viem/wagmi stack)
 *
 * Set your private key in .env:
 *   DEPLOY_PRIVATE_KEY=0x...
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: '.env' });

// ─── Config ───────────────────────────────────────────────────────────────────
const NETWORKS = {
  testnet: {
    name: 'Tempo Testnet',
    rpc: 'https://rpc.moderato.tempo.xyz',
    chainId: 42431,
  },
  mainnet: {
    name: 'Tempo Mainnet',
    rpc: 'https://rpc.tempo.xyz',
    chainId: 4217,
  },
};

const TARGET = process.argv[2] === 'mainnet' ? 'mainnet' : 'testnet';
const NETWORK = NETWORKS[TARGET];

// ─── ABI + Bytecode ───────────────────────────────────────────────────────────
// Compiled ABI for DepositRegistry
const ABI = [
  "constructor(address _admin)",
  "function registerDeposit(address token, uint256 amount, uint8 period) returns (uint256)",
  "function markWithdrawn(uint256 depositIndex)",
  "function creditYield(address user, uint256 depositIndex, uint256 yield)",
  "function creditYieldBatch(address[] users, uint256[] indices, uint256[] yields)",
  "function getAllDeposits(address user) view returns (tuple(address token, uint256 amount, uint8 lockPeriod, uint256 depositTime, uint256 unlockTime, uint256 earnedYield, bool active)[])",
  "function getDeposit(address user, uint256 index) view returns (tuple(address token, uint256 amount, uint8 lockPeriod, uint256 depositTime, uint256 unlockTime, uint256 earnedYield, bool active))",
  "function getDepositCount(address user) view returns (uint256)",
  "function isUnlocked(address user, uint256 index) view returns (bool)",
  "function getAPY(uint8 period) view returns (uint16)",
  "function admin() view returns (address)",
  "function totalDepositCount() view returns (uint256)",
  "function totalDepositedByToken(address token) view returns (uint256)",
  "event Deposited(address indexed user, address indexed token, uint256 amount, uint8 lockPeriod, uint256 unlockTime, uint256 depositIndex)",
  "event Withdrawn(address indexed user, uint256 depositIndex, uint256 amount, uint256 yieldEarned)",
  "event YieldCredited(address indexed user, uint256 depositIndex, uint256 yield)",
];

// NOTE: You need to compile the Solidity first to get bytecode.
// Option 1: Use Remix IDE → compile → copy bytecode below
// Option 2: Use hardhat: npx hardhat compile
// Option 3: Use solc directly
//
// For quick deployment, paste the compiled bytecode here:
const BYTECODE = process.env.DEPLOY_BYTECODE || '';

async function main() {
  console.log(`\n🚀 Deploying DepositRegistry to ${NETWORK.name}...`);

  if (!process.env.DEPLOY_PRIVATE_KEY) {
    console.error('\n❌ Error: Set DEPLOY_PRIVATE_KEY in your .env file');
    console.log('   Example: DEPLOY_PRIVATE_KEY=0xYOUR_PRIVATE_KEY\n');
    process.exit(1);
  }

  if (!BYTECODE) {
    console.log('\n📋 No bytecode found. Using Remix IDE to deploy instead...');
    console.log('\nSteps to deploy via Remix:');
    console.log('1. Go to https://remix.ethereum.org');
    console.log('2. Create new file: DepositRegistry.sol');
    console.log('3. Paste the contract code');
    console.log('4. Compile (Solidity 0.8.20)');
    console.log('5. Deploy & Run:');
    console.log('   - Environment: Injected Provider (MetaMask)');
    console.log('   - Network: Tempo Testnet (42431)');
    console.log(`   - Constructor arg _admin: YOUR_ADMIN_WALLET_ADDRESS`);
    console.log('6. Copy deployed address → paste in web3.js as REGISTRY_ADDRESS\n');
    return;
  }

  const provider = new ethers.JsonRpcProvider(NETWORK.rpc);
  const wallet = new ethers.Wallet(process.env.DEPLOY_PRIVATE_KEY, provider);
  const adminAddr = wallet.address;

  console.log(`   Deployer/Admin: ${adminAddr}`);
  console.log(`   Network:        ${NETWORK.name} (chainId: ${NETWORK.chainId})`);

  const factory = new ethers.ContractFactory(ABI, BYTECODE, wallet);
  const contract = await factory.deploy(adminAddr);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\n✅ DepositRegistry deployed!`);
  console.log(`   Contract Address: ${address}`);
  console.log(`   Explorer: ${TARGET === 'mainnet' ? 'https://explore.tempo.xyz' : 'https://explore.testnet.tempo.xyz'}/address/${address}`);
  console.log(`\n📝 Add this to src/config/web3.js:`);
  console.log(`   export const REGISTRY_ADDRESS = '${address}';`);
  console.log(`   // ChainId: ${NETWORK.chainId}`);
}

main().catch(console.error);
