'use client';
import { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance, useChainId, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { DEX_ADDRESS, DEX_ABI, ERC20_ABI, TOKENS, PLATFORM_FEE_BPS, FEE_DENOMINATOR } from '@/config/web3';

const TOKEN_LIST = Object.values(TOKENS);
const MAX_UINT128 = 340282366920938463463374607431768211455n;

// ── Token Selector Modal ──────────────────────────────────────────────────────
function TokenModal({ onSelect, excludeToken, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = TOKEN_LIST.filter(t =>
    t.symbol !== excludeToken?.symbol &&
    (t.symbol.toLowerCase().includes(search.toLowerCase()) ||
     t.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: '20px', width: '360px', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', animation: 'fadeInUp 0.2s ease' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '16px' }}>Select Token</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '12px 16px' }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or symbol..."
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-main)', padding: '10px 14px', borderRadius: '12px', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '0 8px 12px' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-dim)' }}>No tokens found</div>
          )}
          {filtered.map(token => (
            <button key={token.symbol}
              onClick={() => { onSelect(token); onClose(); }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', padding: '12px 14px', borderRadius: '12px', border: 'none', background: 'none', color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', transition: '0.15s' }}
            >
              <span style={{ fontSize: '28px', width: '36px', textAlign: 'center' }}>{token.logo}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{token.symbol}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{token.name}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                {token.isQuoteToken && <span style={{ background: 'var(--brand-primary-dim)', color: 'var(--brand-primary)', fontSize: '10px', padding: '2px 8px', borderRadius: '8px', fontWeight: 700 }}>QUOTE</span>}
                {token.description?.includes('Faucet') && <span style={{ background: 'rgba(39,174,96,0.15)', color: 'var(--success)', fontSize: '10px', padding: '2px 8px', borderRadius: '8px', fontWeight: 700 }}>FREE</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main SwapBox ──────────────────────────────────────────────────────────────
export default function SwapBox({ currentNetworkId, onConnect, onSwitch }) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect } = useConnect();
  const { switchChain } = useSwitchChain();

  const [modal, setModal] = useState(null); // 'in' or 'out'
  const [showSettings, setShowSettings] = useState(false);

  const [tokenIn, setTokenIn] = useState(TOKENS.BETA_USD);
  const [tokenOut, setTokenOut] = useState(TOKENS.PATH_USD);
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState(0.5);

  // Read Wallet Balances
  const { data: balanceIn } = useBalance({ address, token: tokenIn.address, chainId: currentNetworkId, query: { enabled: !!address, refetchInterval: 5000 } });
  const { data: balanceOut } = useBalance({ address, token: tokenOut.address, chainId: currentNetworkId, query: { enabled: !!address, refetchInterval: 5000 } });
  
  const formatBal = (balData) => {
    if (!balData) return '0';
    const val = parseFloat(formatUnits(balData.value, balData.decimals));
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
    if (val >= 1_000) return (val / 1_000).toFixed(2) + 'K';
    return val.toFixed(2);
  };

  const parsedAmountIn = amountIn && !isNaN(amountIn)
    ? parseUnits(amountIn, tokenIn.decimals) : 0n;

  // Read Allowance
  const { data: allowance } = useReadContract({
    address: tokenIn.address, abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, DEX_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
    chainId: currentNetworkId,
  });

  const needsApproval = allowance !== undefined && allowance < parsedAmountIn;

  const { writeContract: writeApprove, data: approveTxHash, isPending: isApproveSigning } = useWriteContract();
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const isApprovePending = isApproveSigning || isApproveConfirming;

  const handleApprove = () => {
    writeApprove({
      address: tokenIn.address, abi: ERC20_ABI, chainId: currentNetworkId,
      functionName: 'approve',
      args: [DEX_ADDRESS, 115792089237316195423570985008687907853269984665640564039457584007913129639935n], // max uint256
    });
  };

  const { data: quotedOut, isError: quoteError } = useReadContract({
    address: DEX_ADDRESS, abi: DEX_ABI,
    functionName: 'quoteSwapExactAmountIn',
    args: parsedAmountIn && parsedAmountIn > 0n ? [tokenIn.address, tokenOut.address, parsedAmountIn] : undefined,
    query: { enabled: !!parsedAmountIn && parsedAmountIn > 0n },
    chainId: currentNetworkId,
  });

  // Smart Swap: use direct swap if liquidity exists, otherwise auto-place market order
  const hasLiquidity = !quoteError && quotedOut != null && quotedOut > 0n;
  const swapMode = hasLiquidity ? 'direct' : 'market-order';

  const lastSwapRef = useRef(null);

  // Calculate fee and net output using BigInt to avoid precision/notation errors
  const feeBigInt = (quotedOut != null) ? (quotedOut * BigInt(PLATFORM_FEE_BPS)) / BigInt(FEE_DENOMINATOR) : 0n;
  const netOutBigInt = (quotedOut != null) ? quotedOut - feeBigInt : 0n;

  const feeDisplay = quotedOut != null ? parseFloat(formatUnits(feeBigInt, tokenOut.decimals)) : 0;
  const netOutDisplay = quotedOut != null ? formatUnits(netOutBigInt, tokenOut.decimals) : '0';

  const [txError, setTxError] = useState('');
  const { writeContract, data: txHash, isPending } = useWriteContract({
    mutation: {
      onError: (err) => {
        const msg = err?.shortMessage || err?.message || 'Transaction failed';
        setTxError(msg);
        setTimeout(() => setTxError(''), 6000);
      }
    }
  });
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleSwap = () => {
    if (!isConnected) { onConnect(); return; }
    if (!parsedAmountIn || parsedAmountIn === 0n) return;
    setTxError('');

    if (swapMode === 'direct') {
      // ─── Direct Swap (liquidity available in orderbook) ───────────────────
      const slipBps = BigInt(Math.floor(slippage * 100));
      const totalDeductBps = slipBps + BigInt(PLATFORM_FEE_BPS);
      const minOut = (quotedOut * (10000n - totalDeductBps)) / 10000n;
      writeContract({
        address: DEX_ADDRESS, abi: DEX_ABI, chainId: currentNetworkId,
        functionName: 'swapExactAmountIn',
        args: [tokenIn.address, tokenOut.address, parsedAmountIn, minOut],
      });
    } else {
      // ─── Auto Market Order fallback (no liquidity) ────────────────────────
      // Determine base token and direction
      const baseToken = tokenIn.isQuoteToken ? tokenOut : tokenIn;
      const isBid = tokenIn.isQuoteToken; // buying base with pUSD = bid; selling base for pUSD = ask

      let orderAmount = parsedAmountIn;
      if (isBid) {
        // pUSD → base: amount of base at tick=0 (1:1 ratio)
        // price at tick=0 = 1.0, so base amount = pUSD amount
        orderAmount = parsedAmountIn;
      }
      if (orderAmount > MAX_UINT128) orderAmount = MAX_UINT128;

      writeContract({
        address: DEX_ADDRESS, abi: DEX_ABI, chainId: currentNetworkId,
        functionName: 'place',
        args: [baseToken.address, orderAmount, isBid, 0], // tick = 0 = market price
      });
    }

    lastSwapRef.current = {
      tokenIn: tokenIn.symbol,
      tokenOut: tokenOut.symbol,
      amountIn: amountIn,
      amountOut: parseFloat(netOutDisplay).toFixed(4),
      time: Date.now(),
      networkId: currentNetworkId,
      user: address
    };
  };

  useEffect(() => {
    if (isSuccess && txHash && lastSwapRef.current) {
      const history = JSON.parse(localStorage.getItem('tempo_swaps') || '[]');
      if (!history.find(s => s.txHash === txHash)) {
        history.unshift({ ...lastSwapRef.current, txHash });
        localStorage.setItem('tempo_swaps', JSON.stringify(history));
      }
    }
  }, [isSuccess, txHash]);

  const switchTokens = () => {
    setTokenIn(tokenOut); setTokenOut(tokenIn);
    setAmountIn('');
  };

  const amountOut = quotedOut && !quoteError && amountIn ? formatUnits(quotedOut, tokenOut.decimals) : '';
  const priceDisplay = amountIn && amountOut && !isNaN(amountOut)
    ? `1 ${tokenIn.symbol} ≈ ${(parseFloat(amountOut) / parseFloat(amountIn)).toFixed(6)} ${tokenOut.symbol}` : null;

  return (
    <>
      {modal === 'in'  && <TokenModal excludeToken={tokenOut} onSelect={t => { setTokenIn(t); }}  onClose={() => setModal(null)} />}
      {modal === 'out' && <TokenModal excludeToken={tokenIn}  onSelect={t => { setTokenOut(t); }} onClose={() => setModal(null)} />}

      <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div className="swap-header">
          <div className="swap-nav">
            <button className="active">Swap</button>
            <button>Limit</button>
          </div>
          <button onClick={() => setShowSettings(!showSettings)}
            style={{ background: 'none', border: 'none', color: showSettings ? 'var(--brand-primary)' : 'var(--text-dim)', fontSize: '18px', cursor: 'pointer' }}>⚙️</button>
        </div>

        {showSettings && (
          <div style={{ padding: '12px 16px', background: 'var(--bg-card)', margin: '0 8px', borderRadius: '12px', fontSize: '13px', border: '1px solid var(--border-light)' }}>
            <div style={{ marginBottom: '8px', fontWeight: 600 }}>Slippage Tolerance</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[0.1, 0.5, 1.0].map(s => (
                <button key={s} onClick={() => setSlippage(s)} style={{ flex: 1, padding: '6px', borderRadius: '8px', border: '1px solid', borderColor: slippage === s ? 'var(--brand-primary)' : 'var(--border-light)', background: slippage === s ? 'var(--brand-primary-dim)' : 'none', color: slippage === s ? 'var(--brand-primary)' : 'var(--text-dim)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  {s}%
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: '8px' }}>
          {/* Token In */}
          <div className="token-input-container">
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>You pay</div>
            <div className="input-row">
              <input type="number" className="token-input" placeholder="0" value={amountIn} onChange={e => setAmountIn(e.target.value)} />
              <button className="token-selector" onClick={() => setModal('in')}>
                <span className="token-logo">{tokenIn.logo}</span>
                <span style={{ marginLeft: '6px', fontWeight: 700 }}>{tokenIn.symbol}</span>
                <span style={{ opacity: 0.5, fontSize: '12px', marginLeft: '4px' }}>▼</span>
              </button>
            </div>
            <div className="balance-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Balance: <strong style={{ color: 'var(--text-main)' }}>{formatBal(balanceIn)}</strong> {tokenIn.symbol}</span>
              {balanceIn && parseFloat(formatUnits(balanceIn.value, balanceIn.decimals)) > 0 && (
                <button
                onClick={() => {
                  let bal = balanceIn?.value || 0n;
                  if (bal > MAX_UINT128) bal = MAX_UINT128;
                  setAmountIn(formatUnits(bal, tokenIn.decimals));
                }}
                style={{ background: 'var(--brand-primary-dim)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.5px' }}
              >MAX</button>
              )}
            </div>
          </div>

          <div className="switch-wrapper">
            <button className="switch-btn" onClick={switchTokens}>↓</button>
          </div>

          {/* Token Out */}
          <div className="token-input-container">
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              You receive {quoteError && <span style={{ color: 'var(--danger)' }}> (no liquidity on this pair)</span>}
            </div>
            <div className="input-row">
              <input type="number" className="token-input" placeholder="0" value={amountOut} readOnly
                style={{ color: amountOut ? 'var(--text-main)' : 'var(--text-muted)' }} />
              <button className="token-selector" onClick={() => setModal('out')}>
                <span className="token-logo" style={{ background: 'var(--brand-primary-dim)', color: 'var(--brand-primary)' }}>{tokenOut.logo}</span>
                <span style={{ marginLeft: '6px', fontWeight: 700 }}>{tokenOut.symbol}</span>
                <span style={{ opacity: 0.5, fontSize: '12px', marginLeft: '4px' }}>▼</span>
              </button>
            </div>
            <div className="balance-row">
              <span>Balance: <strong style={{ color: 'var(--text-main)' }}>{formatBal(balanceOut)}</strong> {tokenOut.symbol}</span>
            </div>
          </div>

          {amountIn && !hasLiquidity && (
            <div style={{ padding: '10px 12px', marginTop: '4px', background: 'rgba(255,171,0,0.1)', border: '1px solid rgba(255,171,0,0.25)', borderRadius: '10px', fontSize: '12px', color: 'var(--warning)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '14px' }}>⚡</span>
              <span><strong>Smart Swap Active:</strong> No direct liquidity found. Your swap will auto-place a <strong>Market Order at best price</strong> — it fills the moment a matching trade appears!</span>
            </div>
          )}
          {priceDisplay && (
            <div className="tx-details" style={{ animation: 'fadeInUp 0.2s', marginTop: '4px' }}>
              <div className="tx-row"><span>Rate</span><span style={{ fontSize: '13px' }}>{priceDisplay}</span></div>
              <div className="tx-row"><span>Slippage</span><span>{slippage}%</span></div>
              <div className="tx-row">
                <span>Platform Fee (0.1%)</span>
                <span style={{ color: 'var(--text-dim)' }}>{feeDisplay > 0 ? (feeDisplay < 0.000001 ? '< 0.000001' : feeDisplay.toFixed(6)) : '0.00'} {tokenOut.symbol}</span>
              </div>
              <div className="tx-row"><span>You Receive (net)</span><span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{netOutDisplay} {tokenOut.symbol}</span></div>
              <div className="tx-row"><span>Min Received</span><span>{netOutDisplay !== '0' ? (parseFloat(netOutDisplay) * (1 - slippage / 100)).toFixed(6) : '0'} {tokenOut.symbol}</span></div>
              <div className="tx-row"><span>Execution</span><span style={{ color: 'var(--success)' }}>Price-Time Orderbook</span></div>
              <div className="tx-row"><span>Network Fee</span><span style={{ color: 'var(--success)', fontWeight: 700 }}>$0.00 (Sponsored)</span></div>
            </div>
          )}

          {isConnected && chainId !== currentNetworkId ? (
            <button className="btn-primary" onClick={() => onSwitch ? onSwitch(currentNetworkId) : handleSwap()} style={{ background: 'var(--brand-secondary)', borderColor: 'var(--brand-secondary)' }}>
              Switch to {currentNetworkId === 4217 ? 'Tempo Mainnet' : 'Tempo Testnet'}
            </button>
          ) : needsApproval ? (
            <button className="btn-primary" onClick={handleApprove} disabled={isApprovePending || (isConnected && (!amountIn || parseFloat(amountIn) <= 0))} style={{ background: 'var(--brand-primary)', opacity: (!amountIn || parseFloat(amountIn) <= 0 || isApprovePending) ? 0.6 : 1 }}>
              {isApprovePending ? 'Approving...' : `Approve ${tokenIn.symbol}`}
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSwap}
              disabled={isPending || (isConnected && (!amountIn || parseFloat(amountIn) <= 0))}
              style={!hasLiquidity && amountIn ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)' } : {}}>
              {!isConnected
                ? 'Connect Wallet'
                : isPending
                ? (swapMode === 'market-order' ? 'Placing Market Order...' : 'Swapping...')
                : !amountIn
                ? 'Enter an amount'
                : swapMode === 'market-order'
                ? `⚡ Smart Swap: Place Market Order`
                : `Swap ${tokenIn.symbol} → ${tokenOut.symbol}`
              }
            </button>
          )}

          {txError && (
            <div style={{ marginTop: '12px', padding: '12px', borderRadius: '12px', background: 'rgba(255,71,87,0.1)', border: '1px solid var(--danger)', fontSize: '13px', textAlign: 'center', color: 'var(--danger)' }}>
              ❌ {txError}
            </div>
          )}
          {txHash && (
            <div style={{ marginTop: '12px', padding: '12px', borderRadius: '12px', background: isSuccess ? 'rgba(39,174,96,0.1)' : 'var(--bg-card)', border: `1px solid ${isSuccess ? 'var(--success)' : 'var(--border-light)'}`, fontSize: '14px', textAlign: 'center' }}>
              {!isSuccess && (
                <div>
                  <div style={{ marginBottom: '4px' }}>📡 Transaction Sent!</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>⏳ Executing on Tempo orderbook...</div>
                </div>
              )}
              {isSuccess && (
                <div style={{ color: 'var(--success)', fontWeight: 600 }}>
                  ✅ Swap Confirmed! <a href={`${currentNetworkId === 4217 ? 'https://explore.tempo.xyz' : 'https://explore.testnet.tempo.xyz'}/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)', textDecoration: 'none', marginLeft: '8px' }}>View ↗</a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
