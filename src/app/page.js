'use client';
import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import SwapBox from '@/components/SwapBox';
import OrderBook from '@/components/OrderBook';
import Balances from '@/components/Balances';
import Earn from '@/components/Earn';
import History from '@/components/History';
import Guide from '@/components/Guide';
import About from '@/components/About';
import { TEMPO_TESTNET } from '@/config/web3';

// Format networks for MetaMask
const NETWORKS = {
  [TEMPO_TESTNET.id]: {
    chainId: `0x${TEMPO_TESTNET.id.toString(16)}`,
    chainName: TEMPO_TESTNET.name,
    nativeCurrency: TEMPO_TESTNET.nativeCurrency,
    rpcUrls: TEMPO_TESTNET.rpcUrls.default.http,
    blockExplorerUrls: [TEMPO_TESTNET.blockExplorers.default.url],
  }
};

const TABS = [
  { id: 'swap',    label: '⇄ Swap' },
  { id: 'orders',  label: '📋 Orders' },
  { id: 'earn',    label: '💰 Earn' },
  { id: 'wallet',  label: '🏦 Balances' },
  { id: 'history', label: '📜 History' },
  { id: 'guide',   label: '📚 Guide' },
  { id: 'about',   label: 'ℹ️ About' },
];

// Mobile bottom nav — only 5 most important tabs
const MOBILE_TABS = [
  { id: 'swap',    icon: '⇄', label: 'Swap' },
  { id: 'orders',  icon: '📋', label: 'Orders' },
  { id: 'earn',    icon: '💰', label: 'Earn' },
  { id: 'wallet',  icon: '🏦', label: 'Wallet' },
  { id: 'history', icon: '📜', label: 'History' },
  { id: 'guide',   icon: '📚', label: 'Guide' },
];

// ── Wallet Selector Modal ──────────────────────────────────────────────────
function WalletModal({ connectors, connect, onClose }) {
  // Detect mobile without MetaMask injected
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent);
  const hasEthereum = typeof window !== 'undefined' && !!window.ethereum;
  const showDeepLink = isMobile && !hasEthereum;

  const siteUrl = typeof window !== 'undefined' ? window.location.host : 'tempo-dex.vercel.app';
  const metamaskDeepLink = `https://metamask.app.link/dapp/${siteUrl}`;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} className="wallet-modal-inner" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: '24px', width: '380px', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.8)', animation: 'fadeInUp 0.3s ease' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '18px' }}>Connect a Wallet</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Mobile Chrome — show MetaMask deep link first */}
          {showDeepLink && (
            <a
              href={metamaskDeepLink}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px', width: '100%',
                padding: '16px', borderRadius: '16px', textDecoration: 'none',
                background: 'rgba(255, 107, 0, 0.12)',
                border: '1px solid rgba(255, 107, 0, 0.4)',
                color: 'var(--text-main)', transition: '0.2s',
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,107,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                🦊
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>Open in MetaMask</div>
                <div style={{ fontSize: '12px', color: '#f97316' }}>Tap to open & connect MetaMask app</div>
              </div>
              <span style={{ fontSize: '18px', color: '#f97316' }}>→</span>
            </a>
          )}

          {/* Regular connectors */}
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => { connect({ connector }); onClose(); }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-light)', background: 'none', color: 'var(--text-main)', cursor: 'pointer', transition: '0.2s', textAlign: 'left' }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                {connector.name.toLowerCase().includes('metamask') ? '🦊' :
                 connector.name.toLowerCase().includes('coinbase') ? '🛡️' :
                 connector.name.toLowerCase().includes('walletconnect') ? '🌐' : '🔌'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>{connector.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  {connector.name.toLowerCase().includes('metamask') ? 'Connect to your MetaMask Wallet' :
                   connector.name.toLowerCase().includes('coinbase') ? 'Connect to Coinbase Wallet' :
                   connector.name.toLowerCase().includes('walletconnect') ? 'Scan QR with your mobile wallet' : 'Standard Web3 Wallet'}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: '16px 24px', background: 'var(--bg-card)', fontSize: '12px', color: 'var(--text-dim)', textAlign: 'center', borderTop: '1px solid var(--border-light)' }}>
          By connecting a wallet, you agree to Tempo's Terms of Service.
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  
  const [targetChainId, setTargetChainId] = useState(TEMPO_TESTNET.id);

  const [activeTab, setActiveTab] = useState('swap');
  const [toast, setToast] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Fix hydration mismatch — wait for client mount
  useEffect(() => { setMounted(true); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const switchOrAddNetwork = async (chainIdToConnect) => {
    const targetNetwork = NETWORKS[chainIdToConnect];
    if (!targetNetwork) return;
    const provider = typeof window !== 'undefined' && (window.ethereum || window.web3?.currentProvider);
    if (!provider) { if (switchChain) switchChain({ chainId: chainIdToConnect }); return; }
    try {
      // wallet_addEthereumChain handles BOTH add AND switch in one call
      // MetaMask: if network already added, it just switches; if new, it adds then switches
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [targetNetwork],
      });
      showToast(`✅ Switched to ${targetNetwork.chainName}`);
    } catch (err) {
      // Fallback: try switch only
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetNetwork.chainId }],
        });
        showToast(`✅ Switched to ${targetNetwork.chainName}`);
      } catch {
        showToast(`⚠️ Please add Tempo Testnet (Chain ID: ${chainIdToConnect}) manually in MetaMask`);
      }
    }
  };

  // Auto-switch to Tempo Testnet as soon as wallet is connected on wrong network
  useEffect(() => {
    if (isConnected && chainId !== targetChainId) {
      switchOrAddNetwork(targetChainId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);


  const handleNetworkChange = (e) => {
    const newId = Number(e.target.value);
    setTargetChainId(newId);
    if (isConnected) switchOrAddNetwork(newId);
  };

  // The network we WANT the app to show and trade on
  const activeChainId = targetChainId;
  const isTestnet = activeChainId === TEMPO_TESTNET.id;
  const isCorrectNetwork = isConnected ? (chainId === activeChainId) : true;

  // Don't render wallet-dependent UI until client is ready (prevents hydration error)
  if (!mounted) {
    return (
      <>
        <header>
          <div className="logo">
            <div className="logo-icon">🔀</div>
            <div>TempoSwap</div>
          </div>
          <nav style={{ display: 'flex', gap: '4px', background: 'var(--bg-panel)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            {TABS.map(tab => (
              <button key={tab.id} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '13px', background: tab.id === 'swap' ? 'var(--brand-primary)' : 'transparent', color: tab.id === 'swap' ? 'white' : 'var(--text-dim)' }}>
                {tab.label}
              </button>
            ))}
          </nav>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ background: 'var(--bg-panel)', padding: '0px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }} />
              <select defaultValue={TEMPO_TESTNET.id} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontWeight: 600, outline: 'none', padding: '7px 0', cursor: 'pointer' }}>
                <option value={TEMPO_TESTNET.id} style={{ background: 'var(--bg-card)', color: 'white' }}>Tempo Testnet</option>
              </select>
            </div>
            <button className="btn-connect" onClick={() => setShowWalletModal(true)}>Connect Wallet</button>
          </div>
        </header>
        <main>
          <div style={{ width: '100%', maxWidth: '520px', textAlign: 'center', color: 'var(--text-dim)', padding: '80px 0' }}>
            Loading TempoSwap...
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {showWalletModal && <WalletModal connectors={connectors} connect={connect} onClose={() => setShowWalletModal(null)} />}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-panel)', border: '1px solid var(--border-light)', padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', animation: 'fadeInUp 0.3s ease', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <header>
        <div className="logo">
          <div className="logo-icon">🔀</div>
          <div>TempoSwap</div>
        </div>

        <nav style={{ display: 'flex', gap: '4px', background: 'var(--bg-panel)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              title={tab.desc}
              style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: '0.15s', background: activeTab === tab.id ? 'var(--brand-primary)' : 'transparent', color: activeTab === tab.id ? 'white' : 'var(--text-dim)' }}>
              {tab.label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: 'var(--bg-panel)', padding: '0px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: isCorrectNetwork ? 'var(--success)' : 'var(--danger)', boxShadow: `0 0 6px ${isCorrectNetwork ? 'var(--success)' : 'var(--danger)'}` }} />
            <select value={activeChainId} onChange={handleNetworkChange} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontWeight: 600, outline: 'none', padding: '7px 0', cursor: 'pointer' }}>
              <option value={TEMPO_TESTNET.id} style={{ background: 'var(--bg-card)', color: 'white' }}>Tempo Testnet</option>
            </select>
          </div>

          {/* Faucet shortcut — only on testnet */}
          {isTestnet && (
            <button
              onClick={() => setActiveTab('wallet')}
              title="Get free testnet tokens"
              className="mobile-hide"
              style={{
                padding: '7px 12px', borderRadius: '20px', border: '1px solid #f59e0b50',
                background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              🚰 Get Tokens
            </button>
          )}

          {isConnected ? (
            <button className="btn-connect"
              onClick={() => disconnect()}
              style={{ background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-light)' }}>
              {address.slice(0, 6)}…{address.slice(-4)}
            </button>
          ) : (
            <button className="btn-connect" onClick={() => setShowWalletModal(true)}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main>
        <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Wrong Network Banner — tap to switch */}
          {isConnected && !isCorrectNetwork && (
            <div style={{
              background: 'rgba(255,71,87,0.12)',
              border: '1px solid rgba(255,71,87,0.4)',
              borderRadius: '16px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}>
              <span style={{ fontSize: '14px', color: '#ff4757', fontWeight: 600 }}>
                ⚠️ Wrong Network
              </span>
              <button
                onClick={() => switchOrAddNetwork(targetChainId)}
                style={{
                  background: '#ff4757',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Switch to Tempo Testnet →
              </button>
            </div>
          )}

          {activeTab === 'swap'    && <SwapBox currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} onSwitch={switchOrAddNetwork} />}
          {activeTab === 'orders'  && <OrderBook currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} onSwitch={switchOrAddNetwork} />}
          {activeTab === 'earn'    && <Earn currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} />}
          {activeTab === 'wallet'  && <Balances currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} onSwitch={switchOrAddNetwork} />}
          {activeTab === 'history' && <History currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} />}
          {activeTab === 'guide'   && <Guide />}
          {activeTab === 'about'   && <About />}

          {/* ── Professional Footer ── */}
          <div className="mobile-footer" style={{
            background: 'var(--bg-panel)',
            borderRadius: '20px',
            border: '1px solid var(--border-light)',
            overflow: 'hidden',
            marginTop: '8px',
          }}>
            {/* Top section */}
            <div style={{
              padding: '28px 28px 20px',
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1.2fr',
              gap: '24px',
            }}>
              {/* Brand */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '22px' }}>🔀</span>
                  <span style={{ fontWeight: 800, fontSize: '16px', background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TempoSwap</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
                  Decentralized exchange built on Tempo Network. Trade, earn yield, and manage assets — fully on-chain.
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid #34d39930' }}>✅ Gas Sponsored</span>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid #818cf830' }}>⚡ Sub-second</span>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid #f59e0b30' }}>🔒 Secured</span>
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Quick Links</div>
                {[
                  { label: '⇄ Swap Tokens', tab: 'swap' },
                  { label: '📋 Order Book', tab: 'orders' },
                  { label: '💰 Earn Yield', tab: 'earn' },
                  { label: '🏦 My Balances', tab: 'wallet' },
                  { label: '📜 History', tab: 'history' },
                  { label: '📚 Guide', tab: 'guide' },
                ].map(link => (
                  <div key={link.tab}
                    onClick={() => setActiveTab(link.tab)}
                    style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '7px', cursor: 'pointer', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.target.style.color = 'var(--text-main)'}
                    onMouseLeave={e => e.target.style.color = 'var(--text-dim)'}
                  >{link.label}</div>
                ))}
              </div>

              {/* Network Info */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Network</div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 2 }}>
                  <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>🟡 Tempo Testnet</div>
                  <div>Chain ID: <span style={{ color: 'var(--text-main)' }}>42431</span></div>
                  <div>DEX: <span style={{ fontFamily: 'monospace', color: '#818cf8', fontSize: '11px' }}>0xdec0...0000</span></div>
                  <div>Registry: <span style={{ fontFamily: 'monospace', color: '#818cf8', fontSize: '11px' }}>0x1256...a641</span></div>
                  <div style={{ marginTop: '8px' }}>
                    <span onClick={() => setActiveTab('wallet')} style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', cursor: 'pointer', padding: '4px 10px', borderRadius: '20px', border: '1px solid #f59e0b40', background: 'rgba(245,158,11,0.08)' }}>
                      🚰 Get Test Tokens
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div style={{
              padding: '14px 28px',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                © {new Date().getFullYear()} TempoSwap — Built on <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Tempo Network</span>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>📖 Price-Time Priority Orderbook</span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>🧪 Testnet — For Testing Only</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        {MOBILE_TABS.map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
