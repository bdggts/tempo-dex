'use client';

export default function About() {
  return (
    <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out', maxWidth: '600px' }}>
      {/* Hero */}
      <div style={{ padding: '28px 24px', textAlign: 'center', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔀</div>
        <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>TempoSwap</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1.7, maxWidth: '400px', margin: '0 auto' }}>
          A decentralized exchange built on <strong style={{ color: 'var(--brand-primary)' }}>Tempo Blockchain</strong> — the world's fastest stablecoin payment network.
        </p>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Key Features */}
        <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>⚡ Key Features</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
          {[
            { icon: '📖', title: 'On-Chain Orderbook', desc: 'Price-time priority matching' },
            { icon: '🔁', title: 'Flip Orders', desc: 'Auto-recreate on opposite side' },
            { icon: '💸', title: 'Zero Gas Fees', desc: '100% sponsored transactions' },
            { icon: '⚡', title: 'Sub-second Finality', desc: 'Instant trade settlement' },
            { icon: '🏦', title: 'Internal Balances', desc: 'On-chain escrow & withdraw' },
            { icon: '🔐', title: 'Non-Custodial', desc: 'Your keys, your tokens' },
          ].map(f => (
            <div key={f.title} style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '22px', marginBottom: '6px' }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>{f.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>🔄 How It Works</h3>
        <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '18px', border: '1px solid var(--border-light)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ background: 'var(--brand-primary)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>1</span>
              <div><strong>Makers</strong> place limit orders at specific price ticks on the on-chain orderbook, providing liquidity.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ background: 'var(--brand-primary)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>2</span>
              <div><strong>Takers</strong> execute swaps against the best available orders, getting instant fills at the best price.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ background: 'var(--brand-primary)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>3</span>
              <div><strong>Flip Orders</strong> automatically recreate on the opposite side when filled — enabling passive market making with zero effort.</div>
            </div>
          </div>
        </div>

        {/* Token Info */}
        <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>💰 Supported Tokens</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {[
            { logo: '🟡', symbol: 'pUSD', name: 'PathUSD', role: 'Root quote token', addr: '0x20c0...0000' },
            { logo: '💵', symbol: 'AUSD', name: 'AlphaUSD', role: 'Primary stablecoin', addr: '0x20c0...0001' },
            { logo: '💴', symbol: 'BUSD', name: 'BetaUSD', role: 'USD stablecoin', addr: '0x20c0...0002' },
            { logo: '💶', symbol: 'TUSD', name: 'ThetaUSD', role: 'USD stablecoin', addr: '0x20c0...0003' },
          ].map(t => (
            <div key={t.symbol} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '24px' }}>{t.logo}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{t.symbol} <span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: '12px' }}>({t.name})</span></div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{t.role}</div>
              </div>
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '11px', color: 'var(--text-muted)' }}>{t.addr}</span>
            </div>
          ))}
        </div>

        {/* Contract Info */}
        <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>📜 Smart Contract</h3>
        <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '18px', border: '1px solid var(--border-light)', marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px' }}>Tempo Exchange Singleton (Enshrined DEX)</div>
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '13px', color: 'var(--brand-primary)', userSelect: 'all', wordBreak: 'break-all' }}>
            0xdec0000000000000000000000000000000000000
          </div>
          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-dim)' }}>
            Predeployed by Tempo protocol — no admin keys, fully decentralized.
          </div>
        </div>

        {/* Stats */}
        <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>📊 Protocol Stats</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          {[
            { label: 'Tick Spacing', value: '10 (1bp)' },
            { label: 'Price Range', value: '±2%' },
            { label: 'Gas Fees', value: '$0.00' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Links */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { label: '📖 Tempo Docs', url: 'https://docs.tempo.xyz' },
            { label: '🔍 Explorer', url: 'https://explore.tempo.xyz' },
            { label: '📋 DEX Spec', url: 'https://docs.tempo.xyz/protocol/exchange/spec' },
          ].map(l => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-main)', textDecoration: 'none', fontSize: '13px', fontWeight: 600, transition: '0.15s' }}>
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
