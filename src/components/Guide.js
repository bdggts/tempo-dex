'use client';
import { useState } from 'react';

const STEPS = [
  {
    num: '01',
    title: 'Install MetaMask',
    icon: '🦊',
    desc: 'Download and install MetaMask browser extension from metamask.io',
    detail: 'MetaMask is a crypto wallet that lets you interact with blockchain applications. Install it from the Chrome Web Store or Firefox Add-ons.',
    link: 'https://metamask.io/download/',
    linkText: 'Download MetaMask →',
  },
  {
    num: '02',
    title: 'Add Tempo Testnet',
    icon: '🌐',
    desc: 'Add Tempo Testnet network to your MetaMask wallet',
    detail: 'Open MetaMask → Settings → Networks → Add Network. Enter these details:',
    table: [
      ['Network Name', 'Tempo Testnet'],
      ['RPC URL', 'https://rpc.moderato.tempo.xyz'],
      ['Chain ID', '42431'],
      ['Currency Symbol', 'USD'],
      ['Explorer', 'https://explore.testnet.tempo.xyz'],
    ],
  },
  {
    num: '03',
    title: 'Get Free Testnet Tokens',
    icon: '🚰',
    desc: 'Use the Tempo Faucet to get 1M of each stablecoin — FREE!',
    detail: 'Open your terminal/command prompt and run this command (replace YOUR_ADDRESS with your MetaMask address):',
    code: `curl -X POST https://rpc.moderato.tempo.xyz \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"tempo_fundAddress","params":["YOUR_WALLET_ADDRESS"],"id":1}'`,
    note: 'You will receive: 1M AlphaUSD (AUSD), 1M BetaUSD (BUSD), 1M ThetaUSD (TUSD), and 1M PathUSD (pUSD)',
  },
  {
    num: '04',
    title: 'Connect Wallet',
    icon: '🔗',
    desc: 'Click "Connect Wallet" on TempoSwap to link your MetaMask',
    detail: 'TempoSwap will automatically try to add the Tempo network. If it fails, add it manually (Step 2). Once connected, your address will show in the header.',
  },
  {
    num: '05',
    title: 'Swap Tokens',
    icon: '⇄',
    desc: 'Go to the Swap tab and trade between stablecoins instantly',
    detail: 'Select input/output tokens, enter the amount, and click Swap. The trade executes against Tempo\'s on-chain orderbook with price-time priority. Gas fees are 100% sponsored!',
  },
  {
    num: '06',
    title: 'Place Limit Orders',
    icon: '📋',
    desc: 'Go to Orders tab to place limit orders at your desired price tick',
    detail: 'Choose Buy or Sell, set your price tick using the slider (−2% to +2%), and place your order. Enable Flip Orders to automatically recreate orders on the opposite side when filled — great for passive earning!',
  },
  {
    num: '07',
    title: 'Check Balances & Withdraw',
    icon: '🏦',
    desc: 'View your internal exchange balances and withdraw to wallet',
    detail: 'When your orders fill, proceeds credit to your internal exchange balance. Go to the Balances tab to see your funds and withdraw them to your MetaMask wallet anytime.',
  },
];

export default function Guide() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out', maxWidth: '600px' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '6px' }}>📚 Testnet Guide</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Follow these steps to test TempoSwap on the Tempo Testnet.<br />
          All tokens are <strong style={{ color: 'var(--success)' }}>FREE</strong> — no real money needed!
        </p>
      </div>

      <div style={{ padding: '12px' }}>
        {STEPS.map((step, i) => (
          <div key={step.num}
            onClick={() => setExpanded(expanded === i ? null : i)}
            style={{ cursor: 'pointer', marginBottom: '8px' }}>
            
            {/* Step Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 16px', borderRadius: '12px',
              background: expanded === i ? 'var(--bg-card)' : 'transparent',
              border: `1px solid ${expanded === i ? 'var(--brand-primary)' : 'var(--border-light)'}`,
              transition: '0.2s',
            }}>
              <span style={{ fontSize: '28px' }}>{step.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 700, marginBottom: '2px' }}>STEP {step.num}</div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>{step.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{step.desc}</div>
              </div>
              <span style={{ color: 'var(--text-dim)', fontSize: '14px', transition: '0.2s', transform: expanded === i ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
            </div>

            {/* Expanded Detail */}
            {expanded === i && (
              <div style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', borderTop: 'none', marginTop: '-4px', animation: 'fadeIn 0.2s' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: '12px' }}>{step.detail}</p>
                
                {/* Network Table */}
                {step.table && (
                  <div style={{ background: 'var(--bg-panel)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-light)', marginBottom: '12px' }}>
                    {step.table.map(([key, val]) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--border-light)', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-dim)' }}>{key}</span>
                        <span style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: 600, fontSize: '12px', color: 'var(--text-main)', userSelect: 'all' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Code Block */}
                {step.code && (
                  <div style={{ background: '#0d0d14', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '14px', fontSize: '12px', fontFamily: 'Roboto Mono, monospace', color: 'var(--success)', lineHeight: 1.8, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '12px' }}>
                    {step.code}
                  </div>
                )}

                {/* Note */}
                {step.note && (
                  <div style={{ background: 'rgba(39,174,96,0.1)', border: '1px solid var(--success)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>
                    💰 {step.note}
                  </div>
                )}

                {/* Link */}
                {step.link && (
                  <a href={step.link} target="_blank" rel="noopener"
                    style={{ display: 'inline-block', marginTop: '8px', background: 'var(--brand-primary-dim)', color: 'var(--brand-primary)', padding: '8px 18px', borderRadius: '10px', textDecoration: 'none', fontWeight: 700, fontSize: '13px', border: '1px solid var(--brand-primary)' }}>
                    {step.linkText}
                  </a>
                )}
              </div>
            )}
          </div>
        ))}

        {/* FAQ Section */}
        <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-light)' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>❓ FAQ</h3>
          
          <div style={{ fontSize: '13px', lineHeight: 1.7 }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>What are testnet tokens?</div>
              <div style={{ color: 'var(--text-dim)' }}>Free tokens for testing — they have no real value. You can get unlimited from the faucet.</div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>Why is my swap not executing?</div>
              <div style={{ color: 'var(--text-dim)' }}>The Tempo testnet may be temporarily offline. Try again later or check Tempo's status page.</div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>What are Flip Orders?</div>
              <div style={{ color: 'var(--text-dim)' }}>A Tempo-exclusive feature! When your limit order fills, a new order is automatically placed on the opposite side. Great for passive market making.</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>Is the gas fee really $0?</div>
              <div style={{ color: 'var(--text-dim)' }}>Yes! Tempo sponsors all gas fees on the testnet. Transactions are completely free.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
