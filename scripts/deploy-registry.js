// scripts/deploy-registry.js
const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('\n🚀 Deploying DepositRegistry...');
  console.log('   Deployer/Admin:', deployer.address);
  console.log('   Network:', hre.network.name, '(chainId:', hre.network.config.chainId + ')');

  const Registry = await hre.ethers.getContractFactory('DepositRegistry');
  const registry = await Registry.deploy(deployer.address); // deployer = admin
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log('\n✅ DepositRegistry deployed!');
  console.log('   Contract Address:', address);

  const chainId = hre.network.config.chainId;
  const explorer = chainId === 4217
    ? `https://explore.tempo.xyz/address/${address}`
    : `https://explore.testnet.tempo.xyz/address/${address}`;
  console.log('   Explorer:', explorer);

  console.log('\n📝 Now paste this into src/config/web3.js → REGISTRY_ADDRESS:');
  console.log(`   ${chainId}: '${address}',`);
}

main().catch((err) => { console.error(err); process.exit(1); });
