'use client';
import { useState } from 'react';
import { useAccount, useConnect, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance, useChainId, useSwitchChain } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { DEX_ADDRESS, DEX_ABI, TOKENS } from '@/config/web3';

const TOKEN_LIST = Object.values(TOKENS);

function TokenBalance({ token, address, currentNetworkId, chainId, onSwitch }) {
  const { data: balance } = useReadContract({
    address: DEX_ADDRESS,
    abi: DEX_ABI,
    functionName: 'balanceOf',
    args: address ? [address, token.address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
    chainId: currentNetworkId,
  });

  const { data: walletBalance } = useBalance({ 
    address, 
    token: token.address, 
    chainId: currentNetworkId, 
    query: { enabled: !!address, refetchInterval: 5000 } 
  });

  const fmtNum = (val) => {
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
    if (val >= 1_000) return (val / 1_000).toFixed(2) + 'K';
    return val.toFixed(2);
  };

  const formattedExchange = balance !== undefined
    ? fmtNum(parseFloat(formatUnits(balance, token.decimals)))
    : '0';

  const formattedWallet = walletBalance !== undefined
    ? fmtNum(parseFloat(formatUnits(walletBalance.value, walletBalance.decimals)))
    : '0';

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [withdrawAmt, setWithdrawAmt] = useState('');

  const handleWithdraw = () => {
    if (!withdrawAmt) return;
    writeContract({
      address: DEX_ADDRESS,
      abi: DEX_ABI,
      functionName: 'withdraw',
      args: [token.address, parseUnits(withdrawAmt, token.decimals)],
    });
  };

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>{token.logo}</span>
          <div>
            <div style={{ fontWeight: 700 }}>{token.symbol}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{token.name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Roboto Mono, monospace', color: 'var(--text-main)' }}>{formattedWallet}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Wallet</div>
          </div>
          <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '24px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Roboto Mono, monospace', color: 'var(--brand-primary)' }}>{formattedExchange}</div>
            <div style={{ fontSize: '11px', color: 'var(--brand-primary)', textTransform: 'uppercase', opacity: 0.8, letterSpacing: '0.5px' }}>Exchange</div>
          </div>
        </div>
      </div>

      {/* Withdraw row */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <input
          type="number" value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)}
          placeholder={`Amount to withdraw…`}
          style={{ flex: 1, background: 'var(--bg-panel)', border: '1px solid var(--border-light)', color: 'var(--text-main)', padding: '8px 12px', borderRadius: '8px', fontSize: '14px' }}
        />
        {chainId !== currentNetworkId ? (
          <button onClick={() => onSwitch && onSwitch(currentNetworkId)}
            style={{ background: 'var(--brand-secondary)', border: '1px solid var(--brand-secondary)', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            Switch Network
          </button>
        ) : (
          <button onClick={handleWithdraw} disabled={isPending || !withdrawAmt}
            style={{ background: 'var(--brand-primary-dim)', border: '1px solid var(--brand-primary)', color: 'var(--brand-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            {isPending ? '...' : 'Withdraw'}
          </button>
        )}
      </div>

      {isSuccess && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--success)' }}>✅ Withdrawn to wallet!</div>
      )}
    </div>
  );
}

export default function Balances({ currentNetworkId, onConnect, onSwitch }) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect } = useConnect();

  if (!isConnected) {
    return (
      <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏦</div>
          <h3 style={{ marginBottom: '8px' }}>Internal Exchange Balances</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
            The Tempo Exchange maintains per-user balances on-chain.<br />
            When your orders are filled, proceeds credit here automatically.
          </p>
          <button className="btn-connect" onClick={onConnect}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out', maxWidth: '600px' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-light)' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>🏦 Exchange Balances</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
          Funds escrowed in Tempo's singleton DEX. Withdraw anytime to your wallet.
        </p>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {TOKEN_LIST.map(token => (
          <TokenBalance key={token.symbol} token={token} address={address} currentNetworkId={currentNetworkId} chainId={chainId} onSwitch={onSwitch} />
        ))}
      </div>

      <div style={{ padding: '16px', borderTop: '1px solid var(--border-light)', fontSize: '12px', color: 'var(--text-muted)' }}>
        Connected: <span style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>{address?.slice(0, 8)}...{address?.slice(-6)}</span>
      </div>
    </div>
  );
}
