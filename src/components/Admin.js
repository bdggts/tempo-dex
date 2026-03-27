'use client';
import { useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { TOKENS, ADMIN_WALLET, ERC20_ABI, PLATFORM_FEE_BPS } from '@/config/web3';

const TOKEN_LIST = Object.values(TOKENS);

export default function Admin({ isConnected, address }) {
  const isAdmin = address?.toLowerCase() === ADMIN_WALLET.toLowerCase();

  // Read ADMIN_WALLET balance for each token
  const { data: balances, isLoading } = useReadContracts({
    contracts: TOKEN_LIST.map(t => ({
      address: t.address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [ADMIN_WALLET],
    })),
    query: { enabled: true, refetchInterval: 10000 },
  });

  const tokenBalances = TOKEN_LIST.map((t, i) => ({
    ...t,
    balance: balances?.[i]?.result ?? 0n,
    balanceFormatted: balances?.[i]?.result
      ? parseFloat(formatUnits(balances[i].result, t.decimals))
      : 0,
  }));

  const totalRevenue = tokenBalances.reduce((sum, t) => sum + t.balanceFormatted, 0);

  const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '18px',
    padding: '24px',
    marginBottom: '16px',
  };

  const statStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  if (!isConnected) {
    return (
      <div className="swap-container" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
        <h3 style={{ marginBottom: '8px' }}>Admin Only</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
          Connect your admin wallet to view the dashboard.
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="swap-container" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
        <h3 style={{ marginBottom: '8px' }}>Access Denied</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
          This page is only accessible to the admin wallet.
        </p>
        <p style={{ color: 'var(--text-dim)', fontSize: '12px', marginTop: '8px', fontFamily: 'monospace' }}>
          Admin: {ADMIN_WALLET.slice(0, 10)}...{ADMIN_WALLET.slice(-6)}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeInUp 0.4s ease-out' }}>

      {/* Header */}
      <div className="swap-container" style={{
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(255,0,122,0.1))',
        border: '1px solid rgba(124,58,237,0.3)',
      }}>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
          Admin Revenue Dashboard
        </div>
        <div style={{ fontSize: '42px', fontWeight: 900, background: 'linear-gradient(135deg, #7c3aed, #ff007a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {isLoading ? '...' : `${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD`}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '6px' }}>
          Total collected across all fee streams
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', borderRadius: '8px', padding: '4px 12px', fontSize: '12px', fontWeight: 700 }}>
            ⚡ Swap: {PLATFORM_FEE_BPS / 100}%
          </span>
          <span style={{ background: 'rgba(255,0,122,0.15)', color: '#fb7185', borderRadius: '8px', padding: '4px 12px', fontSize: '12px', fontWeight: 700 }}>
            🌾 Yield Claim: 1%
          </span>
          <span style={{ background: 'rgba(6,182,212,0.15)', color: '#67e8f9', borderRadius: '8px', padding: '4px 12px', fontSize: '12px', fontWeight: 700 }}>
            💳 Withdrawal: 0.5%
          </span>
        </div>
      </div>

      {/* Token Balances */}
      <div className="swap-container" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 700, marginBottom: '16px', fontSize: '15px' }}>💰 Token Balances (Admin Wallet)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tokenBalances.map(t => (
            <div key={t.symbol} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: '12px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #ff007a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                  {t.symbol[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{t.symbol}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{t.name}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '16px', color: t.balanceFormatted > 0 ? '#10b981' : 'var(--text-dim)' }}>
                  {isLoading ? '...' : t.balanceFormatted.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{t.symbol}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fee Structure Info */}
      <div className="swap-container" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 700, marginBottom: '16px', fontSize: '15px' }}>📊 Fee Structure</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { icon: '⚡', label: 'Swap Fee', rate: '0.1%', desc: 'On every token swap — auto-transferred to admin' },
            { icon: '🌾', label: 'Yield Claim Fee', rate: '1%', desc: '1% of yield when user claims — auto-transferred' },
            { icon: '💳', label: 'Withdrawal Fee', rate: '0.5%', desc: '0.5% of withdrawn amount — auto-transferred' },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', borderRadius: '12px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '20px' }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{item.desc}</div>
              </div>
              <div style={{ fontWeight: 800, fontSize: '18px', color: '#a78bfa' }}>{item.rate}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Wallet Info */}
      <div className="swap-container" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 700, marginBottom: '12px', fontSize: '15px' }}>🔑 Admin Wallet</div>
        <div style={{
          fontFamily: 'monospace', fontSize: '13px', color: '#a78bfa',
          background: 'rgba(124,58,237,0.1)', padding: '12px 16px',
          borderRadius: '10px', border: '1px solid rgba(124,58,237,0.2)',
          wordBreak: 'break-all',
        }}>
          {ADMIN_WALLET}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px' }}>
          ✅ Connected as admin · All fees auto-route here
        </div>
      </div>

    </div>
  );
}
