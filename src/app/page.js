'use client';
import { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import SwapBox from '@/components/SwapBox';
import OrderBook from '@/components/OrderBook';
import Balances from '@/components/Balances';
import Earn from '@/components/Earn';
import History from '@/components/History';
import Guide from '@/components/Guide';
import About from '@/components/About';
import Points from '@/components/Points';
import ErrorBoundary from '@/components/ErrorBoundary';
import { TEMPO_TESTNET } from '@/config/web3';
import { ensureUser, awardPoints, checkDailyLogin } from '@/lib/points';

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
  { id: 'points',  label: '🏆 Points' },
  { id: 'guide',   label: '📚 Guide' },
  { id: 'about',   label: 'ℹ️ About' },
];

// Mobile bottom nav — only 5 most important tabs
const MOBILE_TABS = [
  { id: 'swap',    icon: '⇄',  label: 'Swap' },
  { id: 'orders',  icon: '📋', label: 'Orders' },
  { id: 'earn',    icon: '💰', label: 'Earn' },
  { id: 'points',  icon: '🏆', label: 'Points' },
  { id: 'wallet',  icon: '🏦', label: 'Wallet' },
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
  const [dismissedNetworkAlert, setDismissedNetworkAlert] = useState(false);
  // Read chainId directly from window.ethereum — wagmi's useChainId can be stale
  const [liveChainId, setLiveChainId] = useState(null);

  // Fix hydration mismatch — wait for client mount
  useEffect(() => { setMounted(true); }, []);

  // Read live chainId directly from MetaMask and update on change
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    const readChain = async () => {
      try {
        const hex = await window.ethereum.request({ method: 'eth_chainId' });
        setLiveChainId(parseInt(hex, 16));
      } catch {}
    };
    readChain();
    const onChainChange = (hex) => setLiveChainId(parseInt(hex, 16));
    window.ethereum.on('chainChanged', onChainChange);
    return () => window.ethereum.removeListener('chainChanged', onChainChange);
  }, [mounted]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  // Read ?ref= URL param on mount
  const [pendingRef, setPendingRef] = useState('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) setPendingRef(ref);
  }, []);

  // On wallet connect: register user, award points, handle referral
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || !address || initializedRef.current) return;
    initializedRef.current = true;
    (async () => {
      const result = await ensureUser(address, pendingRef);
      if (result?.isNew) {
        await awardPoints(address, 'WALLET_CONNECT');
        showToast('🎉 Welcome! +50 TEMPO Points earned for connecting!');
        if (result.referredBy) {
          await awardPoints(address, 'REFERRAL_SIGNUP');
          await awardPoints(result.referredBy, 'REFERRAL_GIVEN');
        }
      } else {
        const gotDaily = await checkDailyLogin(address);
        if (gotDaily) showToast('🌅 Daily login bonus: +5 TEMPO Points!');
      }
    })();
  }, [isConnected, address, pendingRef]);

  // Reset on disconnect so re-connect works
  useEffect(() => {
    if (!isConnected) initializedRef.current = false;
  }, [isConnected]);

  const switchOrAddNetwork = async (chainIdToConnect) => {
    const targetNetwork = NETWORKS[chainIdToConnect];
    if (!targetNetwork) return;
    const provider = typeof window !== 'undefined' && (window.ethereum || window.web3?.currentProvider);
    if (!provider) { try { switchChain?.({ chainId: chainIdToConnect }); } catch {} return; }
    try {
      await provider.request({ method: 'wallet_addEthereumChain', params: [targetNetwork] });
      showToast(`✅ Switched to ${targetNetwork.chainName}`);
    } catch (addErr) {
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetNetwork.chainId }] });
        showToast(`✅ Switched to ${targetNetwork.chainName}`);
      } catch {
        showToast(`❌ Could not switch. Please change network inside MetaMask manually.`);
      }
    }
  };


  const handleNetworkChange = (e) => {
    const newId = Number(e.target.value);
    setTargetChainId(newId);
    if (isConnected) switchOrAddNetwork(newId);
  };

  // Use live chain from window.ethereum, fallback to wagmi's chainId
  const effectiveChainId = liveChainId || chainId;
  const activeChainId = targetChainId;
  const isTestnet = activeChainId === TEMPO_TESTNET.id;
  const isCorrectNetwork = isConnected ? (effectiveChainId === activeChainId) : true;

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

      {/* Wrong Network — fullscreen blocking overlay (not on guide/about) */}
      {isConnected && !isCorrectNetwork && !dismissedNetworkAlert && !['guide','about'].includes(activeTab) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(9,9,12,0.97)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '24px',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔴</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px', textAlign: 'center' }}>Wrong Network</h2>
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginBottom: '32px', fontSize: '15px', lineHeight: 1.6, maxWidth: '300px' }}>
            TempoSwap runs on <strong style={{ color: 'white' }}>Tempo Testnet</strong>.<br />
            Tap below to switch automatically.
          </p>
          <button
            onClick={() => switchOrAddNetwork(targetChainId)}
            style={{
              background: 'linear-gradient(135deg, var(--brand-primary), #ff6b35)',
              color: 'white', border: 'none', borderRadius: '16px',
              padding: '18px 40px', fontSize: '18px', fontWeight: 800,
              cursor: 'pointer', width: '100%', maxWidth: '320px',
              boxShadow: '0 8px 32px rgba(255,0,122,0.4)',
              letterSpacing: '0.3px',
            }}
          >
            🔀 Switch to Tempo Testnet
          </button>
          <button onClick={() => { setActiveTab('guide'); setDismissedNetworkAlert(true); }}
            style={{ marginTop: '14px', background: 'none', border: 'none', color: '#818cf8', fontSize: '13px', cursor: 'pointer', padding: '8px', fontWeight: 600 }}
          >
            📚 How to add network manually
          </button>
          <button
            onClick={() => disconnect()}
            style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '12px', cursor: 'pointer', padding: '8px' }}
          >
            Disconnect wallet
          </button>
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

          {activeTab === 'swap'    && <ErrorBoundary><SwapBox currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} onSwitch={switchOrAddNetwork} /></ErrorBoundary>}
          {activeTab === 'orders'  && <ErrorBoundary><OrderBook currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} onSwitch={switchOrAddNetwork} /></ErrorBoundary>}
          {activeTab === 'earn'    && <ErrorBoundary><Earn currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} /></ErrorBoundary>}
          {activeTab === 'wallet'  && <ErrorBoundary><Balances currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} onSwitch={switchOrAddNetwork} /></ErrorBoundary>}
          {activeTab === 'history' && <ErrorBoundary><History currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} /></ErrorBoundary>}
          {activeTab === 'points'  && <ErrorBoundary><Points onConnect={() => setShowWalletModal(true)} pendingRef={pendingRef} /></ErrorBoundary>}
          {activeTab === 'guide'   && <ErrorBoundary><Guide /></ErrorBoundary>}
          {activeTab === 'about'   && <ErrorBoundary><About /></ErrorBoundary>}

        </div>
      </main>

      {/* ── Full-Width Professional Footer ── */}
      <footer style={{
        width: '100%',
        marginTop: '48px',
        paddingBottom: '90px', // space for mobile nav
        position: 'relative',
      }}>
        {/* Gradient top border */}
        <div style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--brand-primary), var(--brand-secondary), transparent)',
          marginBottom: '0',
        }} />

        <div style={{
          background: 'rgba(9,9,12,0.95)',
          backdropFilter: 'blur(20px)',
          padding: '48px 32px 0',
        }}>
          {/* Main grid */}
          <div style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '36px 24px',
          }}>

            {/* Brand Column */}
            <div style={{ gridColumn: 'span 1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', boxShadow: '0 0 20px rgba(255,0,122,0.3)',
                }}>🔀</div>
                <span style={{ fontWeight: 900, fontSize: '20px', background: 'linear-gradient(135deg, #fff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TempoSwap</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.7, margin: '0 0 20px', maxWidth: '220px' }}>
                The first full-featured decentralized exchange on Tempo Network. Trade, earn, and manage assets fully on-chain.
              </p>
              {/* Social Icons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  { icon: '𝕏', label: 'Twitter', href: 'https://x.com/bdggts' },
                  { icon: '⌨', label: 'GitHub', href: 'https://github.com/bdggts' },
                  { icon: '💬', label: 'Discord', href: 'https://discord.com' },
                  { icon: '✈️', label: 'Telegram', href: 'https://t.me' },
                ].map(s => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                    title={s.label}
                    style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px', textDecoration: 'none', color: 'var(--text-dim)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.background = 'rgba(255,0,122,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
                  >{s.icon}</a>
                ))}
              </div>
            </div>

            {/* Trade Column */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Trade</div>
              {[
                { label: 'Swap Tokens', tab: 'swap' },
                { label: 'Limit Orders', tab: 'orders' },
                { label: 'Earn Yield', tab: 'earn' },
                { label: 'My Balances', tab: 'wallet' },
              ].map(link => (
                <div key={link.tab} onClick={() => setActiveTab(link.tab)}
                  style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '10px', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.target.style.color = '#fff'; e.target.style.paddingLeft = '4px'; }}
                  onMouseLeave={e => { e.target.style.color = 'var(--text-dim)'; e.target.style.paddingLeft = '0'; }}
                >{link.label}</div>
              ))}
            </div>

            {/* Learn Column */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Learn</div>
              {[
                { label: 'Getting Started', tab: 'guide' },
                { label: 'Trade History', tab: 'history' },
                { label: 'About TempoSwap', tab: 'about' },
                { label: 'Get Test Tokens', tab: 'wallet' },
              ].map(link => (
                <div key={link.label} onClick={() => setActiveTab(link.tab)}
                  style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '10px', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.target.style.color = '#fff'; e.target.style.paddingLeft = '4px'; }}
                  onMouseLeave={e => { e.target.style.color = 'var(--text-dim)'; e.target.style.paddingLeft = '0'; }}
                >{link.label}</div>
              ))}
            </div>

            {/* Network Column */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Network</div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.9 }}>
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontWeight: 600, fontSize: '12px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block', boxShadow: '0 0 6px #f59e0b' }} />
                    Tempo Testnet
                  </span>
                </div>
                <div>Chain ID: <span style={{ color: '#a5b4fc', fontFamily: 'monospace' }}>42431</span></div>
                <div>DEX: <span style={{ color: '#a5b4fc', fontFamily: 'monospace', fontSize: '11px' }}>0xdec0...0000</span></div>
                <div style={{ marginTop: '10px' }}>
                  <a href="https://explore.testnet.tempo.xyz" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: 'var(--brand-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >🔍 Explorer ↗</a>
                </div>
                <div style={{ marginTop: '6px' }}>
                  <a href="https://tempo.xyz" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: 'var(--text-dim)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onMouseEnter={e => e.target.style.color = '#fff'}
                    onMouseLeave={e => e.target.style.color = 'var(--text-dim)'}
                  >🌐 Tempo Network ↗</a>
                </div>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{
            maxWidth: '1100px', margin: '36px auto 0',
            display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center',
            padding: '20px 0',
            borderTop: '1px solid var(--border-light)',
            borderBottom: '1px solid var(--border-light)',
          }}>
            {[
              { value: '< 1s', label: 'Block Time' },
              { value: '0', label: 'Gas Fees' },
              { value: '∞', label: 'Liquidity Depth' },
              { value: '100%', label: 'On-Chain' },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center', flex: '1', minWidth: '100px' }}>
                <div style={{ fontSize: '22px', fontWeight: 900, background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{stat.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Bottom copyright bar */}
          <div style={{
            maxWidth: '1100px', margin: '0 auto',
            padding: '18px 0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: '10px',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              © {new Date().getFullYear()} <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>TempoSwap</span>. All rights reserved. Built on Tempo Network. &nbsp;·&nbsp;
              Made by <a href="https://x.com/bdggts" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)', fontWeight: 700, textDecoration: 'none' }}>@bdggts</a>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { label: '📖 Price-Time Priority Orderbook' },
                { label: '🧪 Testnet — Not Financial Advice' },
              ].map(item => (
                <span key={item.label} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.label}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

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
