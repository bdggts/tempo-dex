'use client';
import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { ERC20_ABI, TOKENS, getTokensForChain } from '@/config/web3';




// Color palette per token for visual variety
const TOKEN_COLORS = {
  pUSD:  { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', shadow: 'rgba(102,126,234,0.25)' },
  AUSD:  { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', shadow: 'rgba(245,87,108,0.25)' },
  BUSD:  { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', shadow: 'rgba(79,172,254,0.25)' },
  TUSD:  { gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', shadow: 'rgba(67,233,123,0.25)' },
};

function TokenBalance({ token, address, currentNetworkId, index }) {

  const { data: rawBalance } = useReadContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: currentNetworkId,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const fmtNum = (val) => {
    if (!isFinite(val) || isNaN(val)) return '0';
    if (val >= 1e15) return (val / 1e15).toFixed(2) + 'Q';
    if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
    if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
    return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const decimals = token.decimals ?? 6;
  const numericBalance = rawBalance != null ? parseFloat(formatUnits(rawBalance, decimals)) : null;
  const formattedWallet = numericBalance != null ? fmtNum(numericBalance) : '—';
  const hasBalance = rawBalance != null && rawBalance > 0n;

  return (
    <div style={{ 
      background: 'var(--bg-card)', 
      borderRadius: '16px', 
      padding: '16px 20px', 
      border: '1px solid var(--border-light)', 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      overflow: 'hidden',
      transition: 'all 0.25s ease',
      animation: `fadeInUp 0.4s ease-out ${index * 0.08}s both`,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--bg-card-hover)';
      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'var(--bg-card)';
      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
    }}>
      
      {/* Left: Icon + Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        <div style={{ 
          width: '48px', height: '48px', 
          borderRadius: '14px', 
          background: colors.gradient,
          boxShadow: `0 4px 12px ${colors.shadow}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          fontSize: '24px',
          flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: '18px', fontFamily: 'monospace' }}>
            {token.symbol[0]}
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '16px', color: '#fff' }}>{token.symbol}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{token.name}</div>
        </div>
      </div>

      {/* Right: Balance */}
      <div style={{ textAlign: 'right', flexShrink: 0, maxWidth: '45%', overflow: 'hidden' }}>
        <div style={{ 
          fontSize: '18px', 
          fontWeight: 700, 
          fontFamily: 'Roboto Mono, monospace', 
          color: hasBalance ? '#fff' : 'var(--text-muted)',
          letterSpacing: '-0.5px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {formattedWallet}
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: hasBalance ? 'var(--text-dim)' : 'var(--text-muted)', 
          fontWeight: 500, 
          marginTop: '2px' 
        }}>
          {token.symbol}
        </div>
      </div>
    </div>
  );
}

export default function Balances({ currentNetworkId, onConnect }) {
  const { address, isConnected } = useAccount();
  const [faucetStatus, setFaucetStatus] = useState('idle'); // idle | loading | success | error
  const [faucetMsg, setFaucetMsg] = useState('');

  // Always respect the UI network selector
  const TOKEN_LIST = getTokensForChain(currentNetworkId);
  const networkName = currentNetworkId === 4217 ? 'Mainnet' : 'Testnet';
  const networkColor = currentNetworkId === 4217 ? '#2ecc71' : '#f39c12';
  const isTestnet = currentNetworkId === 42431;

  const handleFaucet = async () => {
    if (!address) return;
    if (!isTestnet) {
      setFaucetStatus('error');
      setFaucetMsg('Faucet only works on Testnet! Switch network first.');
      setTimeout(() => { setFaucetStatus('idle'); setFaucetMsg(''); }, 3000);
      return;
    }
    setFaucetStatus('loading');
    setFaucetMsg('Requesting tokens...');
    try {
      const res = await fetch('https://rpc.moderato.tempo.xyz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tempo_fundAddress',
          params: [address],
          id: 1,
        }),
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error.message || 'Faucet request failed');
      }
      setFaucetStatus('success');
      setFaucetMsg('🎉 1M of each token sent! Balances will update shortly.');
      setTimeout(() => { setFaucetStatus('idle'); setFaucetMsg(''); }, 5000);
    } catch (err) {
      setFaucetStatus('error');
      setFaucetMsg(err.message || 'Failed to get tokens');
      setTimeout(() => { setFaucetStatus('idle'); setFaucetMsg(''); }, 4000);
    }
  };

  if (!isConnected) {
    return (
      <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ 
            width: '80px', height: '80px', 
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))', 
            borderRadius: '24px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontSize: '36px', 
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(255, 0, 122, 0.2)',
          }}>💳</div>
          <h3 style={{ marginBottom: '8px', fontSize: '20px', fontWeight: 700 }}>Wallet Balances</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1.6, marginBottom: '28px', maxWidth: '320px', margin: '0 auto 28px' }}>
            Connect your wallet to view your token balances on the Tempo network.
          </p>
          <button className="btn-connect" onClick={onConnect}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  // Calculate total balance (rough estimate in USD terms since all stablecoins)
  return (
    <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out', maxWidth: '520px' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>Your Assets</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Tempo Network
            </p>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            background: `${networkColor}15`, 
            borderRadius: '20px', 
            padding: '6px 12px',
            border: `1px solid ${networkColor}33`,
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: networkColor, boxShadow: `0 0 6px ${networkColor}` }}></span>
            <span style={{ fontSize: '12px', color: networkColor, fontWeight: 600 }}>{networkName}</span>
          </div>
        </div>
        
        {/* Wallet address pill */}
        <div style={{ 
          marginTop: '14px', 
          background: 'var(--bg-panel)', 
          borderRadius: '10px', 
          padding: '8px 14px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid var(--border-light)',
        }}>
          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'linear-gradient(135deg, #f093fb, #f5576c)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '13px', color: 'var(--text-dim)', fontWeight: 500 }}>
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </div>
      </div>

      {/* Faucet Button */}
      {isConnected && (
        <div style={{ padding: '0 24px 8px' }}>
          <button
            onClick={handleFaucet}
            disabled={faucetStatus === 'loading'}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: isTestnet ? '1px solid rgba(39,174,96,0.4)' : '1px solid var(--border-light)',
              background: isTestnet ? 'rgba(39,174,96,0.1)' : 'var(--bg-panel)',
              color: isTestnet ? '#2ecc71' : 'var(--text-dim)',
              fontWeight: 700,
              fontSize: '14px',
              cursor: faucetStatus === 'loading' ? 'wait' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => { if (isTestnet && faucetStatus !== 'loading') e.currentTarget.style.background = 'rgba(39,174,96,0.2)'; }}
            onMouseLeave={(e) => { if (isTestnet) e.currentTarget.style.background = 'rgba(39,174,96,0.1)'; }}
          >
            {faucetStatus === 'loading' ? '⏳' : '🚰'}
            {faucetStatus === 'loading'
              ? 'Requesting Tokens...'
              : isTestnet
              ? '🚰 Claim Free Testnet Tokens'
              : '🔒 Faucet (Testnet Only)'}
          </button>

          {faucetMsg && (
            <div style={{
              marginTop: '8px',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              textAlign: 'center',
              animation: 'fadeInUp 0.2s ease',
              background: faucetStatus === 'success' ? 'rgba(39,174,96,0.1)' : 'rgba(255,71,87,0.1)',
              border: `1px solid ${faucetStatus === 'success' ? 'var(--success)' : 'var(--danger)'}`,
              color: faucetStatus === 'success' ? 'var(--success)' : 'var(--danger)',
            }}>
              {faucetMsg}
            </div>
          )}
        </div>
      )}

      {/* Token List */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {TOKEN_LIST.length > 0 ? (
          TOKEN_LIST.map((token, i) => (
            <TokenBalance key={token.symbol} token={token} address={address} currentNetworkId={currentNetworkId} index={i} />
          ))
        ) : (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>No tokens on this network</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Switch to <strong style={{ color: networkColor === '#f39c12' ? '#2ecc71' : '#f39c12' }}>{currentNetworkId === 4217 ? 'Testnet' : 'Mainnet'}</strong> to see your tokens,<br/>or the tokens for this network haven't been configured yet.
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 24px 16px', borderTop: '1px solid var(--border-light)', textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Balances auto-refresh every 5 seconds
        </span>
      </div>
    </div>
  );
}
