const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('\n🚀 Deploying DepositRegistry...');
  console.log('   Deployer/Admin:', deployer.address);
  console.log('   Network:', hre.network.name, '| ChainId:', hre.network.config.chainId);

  const Registry = await hre.ethers.getContractFactory('DepositRegistry');
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  const chainId = hre.network.config.chainId;
  const explorer = chainId === 4217
    ? `https://explore.tempo.xyz/address/${address}`
    : `https://explore.testnet.tempo.xyz/address/${address}`;

  console.log('\n✅ Deployed!');
  console.log('   Address:', address);
  console.log('   Explorer:', explorer);
  console.log('\n📝 Paste into src/config/web3.js → REGISTRY_ADDRESS:');
  console.log(`   ${chainId}: '${address}',`);
}

main().catch(e => { console.error(e); process.exit(1); });
