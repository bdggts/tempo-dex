const fs = require('fs');
const addr = fs.readFileSync('C:/tmp/deployed_addr.txt','utf8').trim();
let c = fs.readFileSync('src/config/web3.js','utf8');

// Update address
c = c.replace(/42431: '[^']+',/, "42431: '" + addr + "',");

// Add withdrawPartial to ABI if not already there
if (!c.includes('withdrawPartial')) {
  c = c.replace(
    "{ inputs: [{ name: 'depositIndex', type: 'uint256' }], name: 'withdraw', outputs: [], stateMutability: 'nonpayable', type: 'function' },",
    "{ inputs: [{ name: 'depositIndex', type: 'uint256' }], name: 'withdraw', outputs: [], stateMutability: 'nonpayable', type: 'function' },\n  { inputs: [{ name: 'depositIndex', type: 'uint256' }, { name: 'withdrawAmount', type: 'uint256' }], name: 'withdrawPartial', outputs: [], stateMutability: 'nonpayable', type: 'function' },"
  );
}

fs.writeFileSync('src/config/web3.js', c, 'utf8');
console.log('Done! Address:', addr);
const lines = c.split('\n').filter(l => l.includes('42431') || l.includes('withdrawPartial'));
lines.forEach(l => console.log(l.trim()));
