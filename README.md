# 🚀 TempoSwap - The Native DEX built for Tempo

TempoSwap is a next-generation Automated Market Maker (AMM) protocol built specifically for the **Tempo blockchain** ecosystem. It leverages Tempo's sub-second finality and EVM compatibility to deliver the most seamless, instant token trading experience in DeFi.

## 🌟 Hackathon Highlights

This project is not just a UI; it implements the core mathematics of a real Decentralized Exchange. 
1. **AMM Math Engine**: Implements the constant product formula ($x \cdot y = k$) to automatically set dynamic token prices based on the ratio of active liquidity reserves.
2. **Tempo Native Integration**: Uses Wagmi to configure custom connections to the **Tempo Moderato testnet**.
3. **Advanced Architecture**: Designed keeping Smart Contracts in mind (`TempoSwapPair.sol` is included in the `/contracts` folder) 
4. **Professional UI Design**: A sleek, dark-themed interface built pixel-perfectly using Vanilla CSS (no bloated frameworks) to emulate industry standards like Uniswap or 1inch.

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend Framework** | Next.js 14 (App Router) |
| **Blockchain Config** | Wagmi, viem, TanStack Query |
| **Smart Contracts** | Solidity (`^0.8.24`) |
| **Styling** | Vanilla CSS (Dark Premium Mode) |
| **Network** | Tempo Testnet (Moderato, Chain ID 42431) |

## 📦 Running the Project Locally

```bash
# 1. Clone the project and enter the directory
cd tempo-dex

# 2. Install Wagmi and NextJS dependencies
npm install

# 3. Start the development server
npm run dev
```

Open your browser to `http://localhost:3000`.

## 🧮 How to Demo the Features

### 1. The Swap Engine
* Navigate to the **Swap** tab.
* In the `AUSD` input, type an amount (e.g., `50`).
* The system will instantly utilize the $x \cdot y = k$ formula to calculate the output of `tETH`, taking a `0.3%` simulated fee.
* Try entering a massive number like `100,000` to see the **Price Impact** warning turn red, mimicking real-world liquidity slippage!

### 2. The Liquidity Engine
* Navigate to the **Pools** tab.
* Enter `1` tETH.
* The system will automatically calculate the required ratio of AUSD to deposit ($2,000).

*(Note: If you have configured a wallet like MetaMask to the Tempo testnet, pressing the action buttons will prompt a real transaction using Wagmi hooks).*

## 📄 Smart Contracts

The core AMM `swap` and `addLiquidity` functions are written in `contracts/TempoSwapPair.sol`. 
They track exact integer reserves and ensure the constant product invariant ($k$) is never violated after the 0.3% fee is deducted.
