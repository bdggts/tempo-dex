'use client';
import { useState, useEffect } from 'react';
import { useAccount, useConnect, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import {
  TOKENS, ERC20_ABI, AMM_PAIRS, AMM_PAIR_ABI, getTokensForChain,
} from '@/config/web3';
import { DropletIcon, LockIcon, UnlockIcon, CheckCircleIcon, XCircleIcon, WarningIcon, ZapIcon, CoinsIcon } from '@/components/Icons';

// ─── Pool Pair Configs ─────────────────────────────────────────────────────────
const PAIR_KEYS = ['pUSD/AUSD', 'pUSD/BUSD', 'pUSD/TUSD'];

export default function Pools({ currentNetworkId, onConnect }) {
  const { address, isConnected } = useAccount();
  const pairs = AMM_PAIRS[currentNetworkId] || {};

  const [selectedPair, setSelectedPair] = useState(PAIR_KEYS[0]);
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [activeView, setActiveView] = useState('add'); // 'add' | 'remove'
  const [removeLPAmount, setRemoveLPAmount] = useState('');
  const [txError, setTxError] = useState('');

  const pairAddress = pairs[selectedPair];
  const isLive = pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000';
  const [sym0, sym1] = selectedPair.split('/');
  const networkTokens = getTokensForChain(currentNetworkId);
  const token0 = networkTokens.find(t => t.symbol === sym0);
  const token1 = networkTokens.find(t => t.symbol === sym1);

  // ─── Read pool reserves ──────────────────────────────────────────────────
  const { data: reserve0 } = useReadContract({
    address: pairAddress, abi: AMM_PAIR_ABI, functionName: 'reserve0',
    query: { enabled: isLive, refetchInterval: 8000 }, chainId: currentNetworkId,
  });
  const { data: reserve1 } = useReadContract({
    address: pairAddress, abi: AMM_PAIR_ABI, functionName: 'reserve1',
    query: { enabled: isLive, refetchInterval: 8000 }, chainId: currentNetworkId,
  });
  const { data: totalLP } = useReadContract({
    address: pairAddress, abi: AMM_PAIR_ABI, functionName: 'totalSupply',
    query: { enabled: isLive, refetchInterval: 8000 }, chainId: currentNetworkId,
  });
  const { data: userLP } = useReadContract({
    address: pairAddress, abi: AMM_PAIR_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: isLive && !!address, refetchInterval: 8000 }, chainId: currentNetworkId,
  });

  // User token balances
  const { data: bal0 } = useReadContract({
    address: token0?.address, abi: ERC20_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!token0, refetchInterval: 5000 }, chainId: currentNetworkId,
  });
  const { data: bal1 } = useReadContract({
    address: token1?.address, abi: ERC20_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!token1, refetchInterval: 5000 }, chainId: currentNetworkId,
  });

  // Allowances
  const { data: allow0 } = useReadContract({
    address: token0?.address, abi: ERC20_ABI, functionName: 'allowance',
    args: address && pairAddress ? [address, pairAddress] : undefined,
    query: { enabled: !!address && !!token0 && isLive, refetchInterval: 5000 }, chainId: currentNetworkId,
  });
  const { data: allow1 } = useReadContract({
    address: token1?.address, abi: ERC20_ABI, functionName: 'allowance',
    args: address && pairAddress ? [address, pairAddress] : undefined,
    query: { enabled: !!address && !!token1 && isLive, refetchInterval: 5000 }, chainId: currentNetworkId,
  });

  const d0 = token0?.decimals || 6;
  const d1 = token1?.decimals || 6;
  const parsed0 = amount0 ? parseUnits(amount0, d0) : 0n;
  const parsed1 = amount1 ? parseUnits(amount1, d1) : 0n;
  const needs0 = allow0 !== undefined && parsed0 > 0n && allow0 < parsed0;
  const needs1 = allow1 !== undefined && parsed1 > 0n && allow1 < parsed1;
  const MAX_UINT = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

  // Write hooks
  const { writeContract, data: txHash, isPending } = useWriteContract({
    mutation: { onError: (err) => { setTxError(err?.shortMessage || 'Transaction failed'); setTimeout(() => setTxError(''), 6000); } }
  });
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Auto-calculate paired amount based on reserves ratio
  const handleAmount0 = (val) => {
    setAmount0(val);
    if (val && !isNaN(val) && reserve0 && reserve1 && reserve0 > 0n) {
      const ratio = Number(formatUnits(reserve1, d1)) / Number(formatUnits(reserve0, d0));
      setAmount1((parseFloat(val) * ratio).toFixed(d1 > 6 ? 6 : 2));
    } else if (!val) setAmount1('');
  };

  const handleAmount1 = (val) => {
    setAmount1(val);
    if (val && !isNaN(val) && reserve0 && reserve1 && reserve1 > 0n) {
      const ratio = Number(formatUnits(reserve0, d0)) / Number(formatUnits(reserve1, d1));
      setAmount0((parseFloat(val) * ratio).toFixed(d0 > 6 ? 6 : 2));
    } else if (!val) setAmount0('');
  };

  const fmt = (raw, dec = 6) => {
    if (raw == null) return '0';
    return parseFloat(formatUnits(raw, dec)).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const poolShare = (totalLP && totalLP > 0n && userLP) ? ((Number(userLP) / Number(totalLP)) * 100) : 0;

  // Actions
  const approve = (tokenAddr) => {
    writeContract({ address: tokenAddr, abi: ERC20_ABI, functionName: 'approve', args: [pairAddress, MAX_UINT], chainId: currentNetworkId });
  };

  const addLiquidity = () => {
    if (!isConnected) { onConnect(); return; }
    setTxError('');
    writeContract({
      address: pairAddress, abi: AMM_PAIR_ABI, functionName: 'addLiquidity',
      args: [parsed0, parsed1, address], chainId: currentNetworkId,
    });
  };

  const removeLiquidity = () => {
    if (!removeLPAmount) return;
    const lpParsed = parseUnits(removeLPAmount, 6); // LP tokens use 6 decimals
    setTxError('');
    writeContract({
      address: pairAddress, abi: AMM_PAIR_ABI, functionName: 'removeLiquidity',
      args: [lpParsed, address], chainId: currentNetworkId,
    });
  };

  return (
    <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out', maxWidth: '600px' }}>

      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-glass)' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DropletIcon size={20}/> Liquidity Pools
        </h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '13px', lineHeight: 1.6 }}>
          Provide both tokens to earn <strong>0.3%</strong> of every swap. Works like Uniswap — instant, permissionless.
        </p>
      </div>

      {/* Pool Selector */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-glass)', overflowX: 'auto' }}>
        {PAIR_KEYS.map(key => {
          const addr = pairs[key];
          const live = addr && addr !== '0x0000000000000000000000000000000000000000';
          return (
            <button key={key} onClick={() => { setSelectedPair(key); setAmount0(''); setAmount1(''); }}
              style={{
                padding: '10px 16px', borderRadius: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
                background: selectedPair === key ? 'rgba(255,0,122,0.12)' : 'var(--bg-input)',
                border: `1px solid ${selectedPair === key ? 'rgba(255,0,122,0.4)' : 'var(--border-glass)'}`,
                color: selectedPair === key ? 'var(--brand-primary)' : 'var(--text-dim)',
                fontWeight: 700, fontSize: '13px', transition: 'all 0.2s',
              }}>
              {key} {live ? '🟢' : '⚪'}
            </button>
          );
        })}
      </div>

      {/* Pool Stats */}
      <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', borderBottom: '1px solid var(--border-glass)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{sym0} Reserve</div>
          <div style={{ fontSize: '18px', fontWeight: 800, background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {isLive ? fmt(reserve0, d0) : '—'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{sym1} Reserve</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--brand-secondary)' }}>
            {isLive ? fmt(reserve1, d1) : '—'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Your Share</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--success)' }}>
            {isLive && userLP ? `${poolShare.toFixed(2)}%` : '—'}
          </div>
        </div>
      </div>

      {/* Add / Remove Toggle */}
      <div style={{ padding: '16px 20px 0', display: 'flex', gap: '4px' }}>
        {['add', 'remove'].map(v => (
          <button key={v} onClick={() => setActiveView(v)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: activeView === v ? 'rgba(255,0,122,0.12)' : 'var(--bg-input)',
              color: activeView === v ? 'var(--brand-primary)' : 'var(--text-dim)',
              fontWeight: 700, fontSize: '13px', transition: 'all 0.2s',
            }}>
            {v === 'add' ? '➕ Add Liquidity' : '➖ Remove Liquidity'}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {!isLive && (
          <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <WarningIcon size={18} color="#fbbf24"/>
            <span style={{ fontSize: '13px', color: '#fbbf24', fontWeight: 600 }}>Pool not deployed for this pair yet.</span>
          </div>
        )}

        {/* ─── ADD LIQUIDITY ─── */}
        {activeView === 'add' && (
          <>
            {/* Token 0 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{sym0}</label>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Balance: <strong>{fmt(bal0, d0)}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="number" value={amount0} onChange={(e) => handleAmount0(e.target.value)} placeholder="0.00"
                  style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', padding: '14px', borderRadius: '14px', fontSize: '20px', fontWeight: 700, outline: 'none' }}/>
                <div style={{ padding: '10px 14px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>
                  {token0?.logo} {sym0}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '20px' }}>+</div>

            {/* Token 1 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{sym1}</label>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Balance: <strong>{fmt(bal1, d1)}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="number" value={amount1} onChange={(e) => handleAmount1(e.target.value)} placeholder="0.00"
                  style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', padding: '14px', borderRadius: '14px', fontSize: '20px', fontWeight: 700, outline: 'none' }}/>
                <div style={{ padding: '10px 14px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>
                  {token1?.logo} {sym1}
                </div>
              </div>
            </div>

            {/* Pool Info */}
            {reserve0 && reserve1 && reserve0 > 0n && (
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,0,122,0.05)', border: '1px solid rgba(255,0,122,0.12)', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Rate</span>
                  <span style={{ fontWeight: 700 }}>1 {sym0} = {(Number(formatUnits(reserve1, d1)) / Number(formatUnits(reserve0, d0))).toFixed(4)} {sym1}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>LP Fee</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>0.3% per swap</span>
                </div>
              </div>
            )}

            {/* Action */}
            {!isConnected ? (
              <button className="btn-primary" onClick={onConnect}>Connect Wallet</button>
            ) : !isLive ? (
              <button className="btn-primary" disabled style={{ opacity: 0.5 }}>Pool Not Deployed</button>
            ) : needs0 ? (
              <button className="btn-primary" onClick={() => approve(token0.address)} disabled={isPending || isConfirming}>
                {isPending ? 'Confirming...' : `Approve ${sym0}`}
              </button>
            ) : needs1 ? (
              <button className="btn-primary" onClick={() => approve(token1.address)} disabled={isPending || isConfirming}>
                {isPending ? 'Confirming...' : `Approve ${sym1}`}
              </button>
            ) : (
              <button className="btn-primary" onClick={addLiquidity} disabled={isPending || isConfirming || !parsed0 || !parsed1}>
                {isPending ? 'Confirm in wallet...' : isConfirming ? 'Adding liquidity...' : !amount0 ? 'Enter Amounts' : `Add Liquidity (${sym0} + ${sym1})`}
              </button>
            )}
          </>
        )}

        {/* ─── REMOVE LIQUIDITY ─── */}
        {activeView === 'remove' && (
          <>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-dim)' }}>LP Tokens to Burn</label>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Your LP: <strong>{userLP ? fmt(userLP, 6) : '0'}</strong></span>
              </div>
              <input type="number" value={removeLPAmount} onChange={(e) => setRemoveLPAmount(e.target.value)} placeholder="0.00"
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', padding: '14px', borderRadius: '14px', fontSize: '20px', fontWeight: 700, outline: 'none' }}/>
              {userLP && userLP > 0n && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                  {[25, 50, 75, 100].map(pct => (
                    <button key={pct} onClick={() => {
                      const portion = (userLP * BigInt(pct)) / 100n;
                      setRemoveLPAmount(formatUnits(portion, 6));
                    }}
                      style={{ background: 'rgba(255,0,122,0.08)', color: 'var(--brand-primary)', border: '1px solid rgba(255,0,122,0.2)', borderRadius: '8px', padding: '3px 8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                      {pct}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* What you'll receive */}
            {removeLPAmount && totalLP && totalLP > 0n && reserve0 && reserve1 && (
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', fontSize: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '8px' }}>You'll receive:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>{sym0}</span>
                  <strong>{fmt((parseUnits(removeLPAmount, 6) * reserve0) / totalLP, d0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{sym1}</span>
                  <strong>{fmt((parseUnits(removeLPAmount, 6) * reserve1) / totalLP, d1)}</strong>
                </div>
              </div>
            )}

            <button className="btn-primary" onClick={removeLiquidity}
              disabled={!isConnected || !isLive || isPending || isConfirming || !removeLPAmount}
              style={{ background: isConnected && isLive ? 'linear-gradient(135deg, #f43f5e, #e11d48)' : undefined }}>
              {!isConnected ? 'Connect Wallet' : isPending ? 'Confirming...' : isConfirming ? 'Removing...' : 'Remove Liquidity'}
            </button>
          </>
        )}

        {/* Error / Success */}
        {txError && (
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', fontSize: '13px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <XCircleIcon size={16} color="var(--danger)"/> {txError}
          </div>
        )}
        {isSuccess && (
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', fontSize: '13px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircleIcon size={16} color="var(--success)"/> Transaction successful!
          </div>
        )}
      </div>

      {/* Your Position */}
      {isConnected && isLive && userLP && userLP > 0n && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-glass)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CoinsIcon size={16}/> Your Position
          </h3>
          <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>LP Tokens</span>
              <strong style={{ fontSize: '14px' }}>{fmt(userLP, 6)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Pool Share</span>
              <strong style={{ fontSize: '14px', color: 'var(--success)' }}>{poolShare.toFixed(4)}%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Pooled {sym0}</span>
              <strong style={{ fontSize: '13px' }}>{totalLP && totalLP > 0n ? fmt((userLP * reserve0) / totalLP, d0) : '0'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Pooled {sym1}</span>
              <strong style={{ fontSize: '13px' }}>{totalLP && totalLP > 0n ? fmt((userLP * reserve1) / totalLP, d1) : '0'}</strong>
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-glass)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ZapIcon size={16}/> How It Works
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { n: '1', t: 'Deposit BOTH tokens in equal value to the pool' },
            { n: '2', t: 'Receive LP tokens representing your pool share' },
            { n: '3', t: 'When anyone swaps, 0.3% fee goes to the pool' },
            { n: '4', t: 'Withdraw anytime — get your tokens + earned fees' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,0,122,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', flexShrink: 0 }}>{s.n}</div>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{s.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
