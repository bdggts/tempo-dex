'use client';
import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import SwapBox from '@/components/SwapBox';
import OrderBook from '@/components/OrderBook';
import Balances from '@/components/Balances';
import History from '@/components/History';
import Guide from '@/components/Guide';
import About from '@/components/About';
import { TEMPO_MAINNET, TEMPO_TESTNET } from '@/config/web3';

// Format networks for MetaMask
const NETWORKS = {
  [TEMPO_MAINNET.id]: {
    chainId: `0x${TEMPO_MAINNET.id.toString(16)}`,
    chainName: TEMPO_MAINNET.name,
    nativeCurrency: TEMPO_MAINNET.nativeCurrency,
    rpcUrls: TEMPO_MAINNET.rpcUrls.default.http,
    blockExplorerUrls: [TEMPO_MAINNET.blockExplorers.default.url],
  },
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
  { id: 'wallet',  label: '🏦 Balances' },
  { id: 'history', label: '📜 History' },
  { id: 'guide',   label: '📚 Guide' },
  { id: 'about',   label: 'ℹ️ About' },
];

// ── Wallet Selector Modal ──────────────────────────────────────────────────
function WalletModal({ connectors, connect, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: '24px', width: '380px', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.8)', animation: 'fadeInUp 0.3s ease' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '18px' }}>Connect a Wallet</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                   connector.name.toLowerCase().includes('walletconnect') ? 'Scan with your mobile wallet' : 'Standard Web3 Wallet'}
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
  
  const [targetChainId, setTargetChainId] = useState(TEMPO_MAINNET.id);

  const [activeTab, setActiveTab] = useState('swap');
  const [toast, setToast] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Fix hydration mismatch — wait for client mount
  useEffect(() => { setMounted(true); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const switchOrAddNetwork = async (chainIdToConnect) => {
    const targetNetwork = NETWORKS[chainIdToConnect];
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetNetwork.chainId }] });
        showToast(`✅ Switched to ${targetNetwork.chainName}`);
      } catch (err) {
        if (err.code === 4902 || err.code === -32603) {
          try {
            await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [targetNetwork] });
            showToast(`✅ ${targetNetwork.chainName} added!`);
          } catch {
            showToast(`⚠️ Add ${targetNetwork.chainName} manually (Chain ID: ${chainIdToConnect})`);
            if (switchChain) switchChain({ chainId: chainIdToConnect });
          }
        } else {
            if (switchChain) switchChain({ chainId: chainIdToConnect });
        }
      }
    } else if (switchChain) {
      switchChain({ chainId: chainIdToConnect });
    }
  };

  const handleNetworkChange = (e) => {
    const newId = Number(e.target.value);
    setTargetChainId(newId);
    if (isConnected) switchOrAddNetwork(newId);
  };

  // The network we WANT the app to show and trade on
  const activeChainId = targetChainId;
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
              <select value={activeChainId} onChange={handleNetworkChange} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontWeight: 600, outline: 'none', padding: '7px 0', cursor: 'pointer' }}>
                <option value={TEMPO_MAINNET.id} style={{ background: 'var(--bg-card)', color: 'white' }}>Tempo Mainnet</option>
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
              <option value={TEMPO_MAINNET.id} style={{ background: 'var(--bg-card)', color: 'white' }}>Tempo Mainnet</option>
              <option value={TEMPO_TESTNET.id} style={{ background: 'var(--bg-card)', color: 'white' }}>Tempo Testnet</option>
            </select>
          </div>

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
          {activeTab === 'swap'    && <SwapBox currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} onSwitch={switchOrAddNetwork} />}
          {activeTab === 'orders'  && <OrderBook currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} onSwitch={switchOrAddNetwork} />}
          {activeTab === 'wallet'  && <Balances currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} onSwitch={switchOrAddNetwork} />}
          {activeTab === 'history' && <History currentNetworkId={activeChainId} onConnect={() => setShowWalletModal(true)} />}
          {activeTab === 'guide'   && <Guide />}
          {activeTab === 'about'   && <About />}

          {/* Footer */}
          <div style={{ padding: '14px 18px', background: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid var(--border-light)', fontSize: '12px', color: 'var(--text-dim)', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '20px' }}>
            <span>📖 Price-Time Priority Orderbook</span>
            <span>⚡ Sub-second Finality</span>
            <span style={{ color: 'var(--success)' }}>✅ 100% Gas Sponsored</span>
          </div>
        </div>
      </main>
    </>
  );
}
