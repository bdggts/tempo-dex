/**
 * seed-liquidity.cjs
 * Seeds initial liquidity into all 3 AMM pairs.
 * Approves tokens + calls addLiquidity() for each pair.
 *
 * Usage: cd contracts && node seed-liquidity.cjs
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', 'market-maker', '.env') });

const RPC_URL = process.env.RPC_URL || 'https://rpc.moderato.tempo.xyz';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const TOKENS = {
  pUSD: '0x20c0000000000000000000000000000000000000',
  AUSD: '0x20c0000000000000000000000000000000000001',
  BUSD: '0x20c0000000000000000000000000000000000002',
  TUSD: '0x20c0000000000000000000000000000000000003',
};

const PAIRS = [
  { name: 'pUSD/AUSD', address: '0x61077aE61659F092b48405f47ce7583D7Df085dA', token0: TOKENS.pUSD, token1: TOKENS.AUSD },
  { name: 'pUSD/BUSD', address: '0x7acAb6Df2dF51c13480A6a27D264AC3314beac0a', token0: TOKENS.pUSD, token1: TOKENS.BUSD },
  { name: 'pUSD/TUSD', address: '0xe0d4820c973B4ee99f5903D78274c7E056623ac0', token0: TOKENS.pUSD, token1: TOKENS.TUSD },
];

// Seed 5,000 of each token per pair (all stablecoins = 6 decimals)
const SEED_AMOUNT = ethers.parseUnits('5000', 6);
const MAX_UINT = ethers.MaxUint256;

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function symbol() view returns (string)',
];

const PAIR_ABI = [
  'function addLiquidity(uint256 amount0, uint256 amount1, address to) returns (uint256)',
  'function reserve0() view returns (uint256)',
  'function reserve1() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

async function main() {
  console.log('\n💧 TempoSwap Liquidity Seeder');
  console.log('═'.repeat(50));

  if (!PRIVATE_KEY) { console.error('❌ No PRIVATE_KEY'); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log(`👤 Wallet: ${wallet.address}`);
  console.log(`💰 Seed per pair: ${ethers.formatUnits(SEED_AMOUNT, 6)} tokens each side\n`);

  // Check balances first
  for (const [sym, addr] of Object.entries(TOKENS)) {
    const token = new ethers.Contract(addr, ERC20_ABI, wallet);
    const bal = await token.balanceOf(wallet.address);
    console.log(`  ${sym}: ${ethers.formatUnits(bal, 6)}`);
  }

  for (const pair of PAIRS) {
    console.log(`\n─── Seeding ${pair.name} ───`);

    const token0 = new ethers.Contract(pair.token0, ERC20_ABI, wallet);
    const token1 = new ethers.Contract(pair.token1, ERC20_ABI, wallet);
    const pool = new ethers.Contract(pair.address, PAIR_ABI, wallet);

    try {
      // Check current reserves
      const r0 = await pool.reserve0();
      const r1 = await pool.reserve1();
      if (r0 > 0n) {
        console.log(`  ⚡ Already has liquidity (${ethers.formatUnits(r0, 6)} / ${ethers.formatUnits(r1, 6)}). Skipping.`);
        continue;
      }

      // Approve token0
      const a0 = await token0.allowance(wallet.address, pair.address);
      if (a0 < SEED_AMOUNT) {
        console.log(`  📝 Approving token0...`);
        const tx0 = await token0.approve(pair.address, MAX_UINT);
        await tx0.wait();
        console.log(`  ✅ token0 approved`);
      }

      // Approve token1
      const a1 = await token1.allowance(wallet.address, pair.address);
      if (a1 < SEED_AMOUNT) {
        console.log(`  📝 Approving token1...`);
        const tx1 = await token1.approve(pair.address, MAX_UINT);
        await tx1.wait();
        console.log(`  ✅ token1 approved`);
      }

      // Add liquidity
      console.log(`  💧 Adding ${ethers.formatUnits(SEED_AMOUNT, 6)} + ${ethers.formatUnits(SEED_AMOUNT, 6)}...`);
      const tx = await pool.addLiquidity(SEED_AMOUNT, SEED_AMOUNT, wallet.address);
      const receipt = await tx.wait();
      console.log(`  ✅ Liquidity added! tx: ${receipt.hash}`);

      // Verify
      const newR0 = await pool.reserve0();
      const newR1 = await pool.reserve1();
      const lpBal = await pool.balanceOf(wallet.address);
      console.log(`  📊 Reserves: ${ethers.formatUnits(newR0, 6)} / ${ethers.formatUnits(newR1, 6)}`);
      console.log(`  🎫 LP tokens: ${ethers.formatUnits(lpBal, 6)}`);

    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
    }
  }

  console.log('\n\n' + '═'.repeat(50));
  console.log('✅ Liquidity seeding complete!');
  console.log('Swaps will now execute instantly from pool reserves.');
}

main().catch(console.error);
