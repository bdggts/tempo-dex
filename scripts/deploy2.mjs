// deploy2.mjs — deploy and save address
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { JsonRpcProvider, Wallet, ContractFactory } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();
const require = createRequire(import.meta.url);
const solc = require('solc');
const source = readFileSync('./contracts/DepositRegistry.sol', 'utf8');
const input = { language: 'Solidity', sources: { 'DepositRegistry.sol': { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } } };
const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = (compiled.errors||[]).filter(e=>e.severity==='error');
if(errs.length){errs.forEach(e=>console.error(e.message));process.exit(1);}
console.log('Compiled OK');
const c = compiled.contracts['DepositRegistry.sol']['DepositRegistry'];
const provider = new JsonRpcProvider('https://rpc.testnet.tempo.xyz', 42431, { staticNetwork: true });
const wallet = new Wallet(process.env.DEPLOY_PRIVATE_KEY, provider);
console.log('Deployer:', wallet.address);
const factory = new ContractFactory(c.abi, '0x'+c.evm.bytecode.object, wallet);
const deployed = await factory.deploy(wallet.address);
console.log('Waiting...');
await deployed.waitForDeployment();
const addr = await deployed.getAddress();
console.log('CONTRACT_ADDRESS=' + addr);
writeFileSync('C:/tmp/deployed_addr.txt', addr, 'utf8');
