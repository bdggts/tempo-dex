'use client';
import { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { DEX_ADDRESS, DEX_ABI, ERC20_ABI, TOKENS, PLATFORM_FEE_BPS, FEE_DENOMINATOR, ADMIN_WALLET, getTokensForChain, AMM_PAIRS, AMM_PAIR_ABI, getPairAddress } from '@/config/web3';
import { awardPoints, checkReferralUnlock } from '@/lib/points';
import { SearchIcon, SettingsIcon, ZapIcon, XCircleIcon, CheckCircleIcon, ExternalLinkIcon, WarningIcon, ActivityIcon } from '@/components/Icons';

const MAX_UINT128 = 340282366920938463463374607431768211455n;

// ── Token Selector Modal ──────────────────────────────────────────────────────
function TokenModal({ onSelect, excludeToken, onClose, chainId }) {
  const [search, setSearch] = useState('');
  const tokenList = getTokensForChain(chainId);
  const filtered = tokenList.filter(t =>
    t.symbol !== excludeToken?.symbol &&
    (t.symbol.toLowerCase().includes(search.toLowerCase()) ||
     t.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(16,17,24,0.95)', backdropFilter: 'blur(24px)', border: '1px solid var(--border-glass)', borderRadius: '20px', width: '380px', overflow: 'hidden', boxShadow: 'var(--shadow-xl)', animation: 'scaleIn 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '16px' }}>Select Token</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '12px 16px' }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or symbol..."
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', padding: '11px 14px', borderRadius: '12px', fontSize: '14px', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }}
            onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-glass)'}  
          />
        </div>
        <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '0 8px 12px' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-dim)' }}>No tokens found</div>
          )}
          {filtered.map(token => (
            <button key={token.symbol}
              onClick={() => { onSelect(token); onClose(); }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', padding: '12px 14px', borderRadius: '12px', border: 'none', background: 'none', color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
            >
              <div style={{ width: '36px', height: '36px' }}></div>
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

  const networkTokens = getTokensForChain(currentNetworkId);
  const [tokenIn, setTokenIn] = useState(networkTokens[0] || null);
  const [tokenOut, setTokenOut] = useState(networkTokens[1] || null);
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState(0.5);

  // Reset tokens when network changes
  useEffect(() => {
    const tokens = getTokensForChain(currentNetworkId);
    setTokenIn(tokens[0] || null);
    setTokenOut(tokens[1] || null);
    setAmountIn('');
  }, [currentNetworkId]);

  // Read Wallet Balances directly via balanceOf — same as Earn.js (useBalance gives wrong decimals on Tempo)
  const { data: rawBalIn } = useReadContract({
    address: tokenIn?.address, abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenIn, refetchInterval: 5000 },
    chainId: currentNetworkId,
  });
  const { data: rawBalOut } = useReadContract({
    address: tokenOut?.address, abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenOut, refetchInterval: 5000 },
    chainId: currentNetworkId,
  });

  // Format balance using known decimals from TOKENS config (not from chain response)
  const formatBal = (raw, token) => {
    if (raw == null || !token) return '0';
    try {
      const decimals = token.decimals ?? 6;
      const fullStr = formatUnits(raw, decimals);
      const val = parseFloat(fullStr);
      if (!isFinite(val)) return '0';
      if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
      if (val >= 1e9)  return (val / 1e9).toFixed(2)  + 'B';
      if (val >= 1e6)  return (val / 1e6).toFixed(2)  + 'M';
      if (val >= 1e3)  return (val / 1e3).toFixed(2)  + 'K';
      return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
    } catch { return '0'; }
  };


  // Safe parseUnits — handles scientific notation like 8.5e+31
  const safeParseUnits = (value, decimals) => {
    try {
      // Convert scientific notation to plain decimal string
      let str = String(value);
      if (str.includes('e') || str.includes('E')) {
        str = Number(str).toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: decimals });
      }
      // Remove trailing zeros after decimal, but keep at least the integer
      if (str.includes('.')) {
        const parts = str.split('.');
        const frac = parts[1].slice(0, decimals); // truncate to max decimals
        str = frac ? `${parts[0]}.${frac}` : parts[0];
      }
      return parseUnits(str, decimals);
    } catch {
      return 0n;
    }
  };

  const parsedAmountIn = amountIn && !isNaN(amountIn) && tokenIn
    ? safeParseUnits(amountIn, tokenIn.decimals) : 0n;

  // ─── AMM Pool lookup ─────────────────────────────────────────────────────
  const ammPairAddress = (() => {
    if (!tokenIn || !tokenOut) return null;
    return getPairAddress(currentNetworkId, tokenIn.symbol, tokenOut.symbol);
  })();
  const ammLive = ammPairAddress && ammPairAddress !== '0x0000000000000000000000000000000000000000';

  // Determine token order in AMM pair (token0 = first in pair name)
  const ammPairName = ammPairAddress ? Object.entries(AMM_PAIRS[currentNetworkId] || {}).find(([,v]) => v === ammPairAddress)?.[0] : null;
  const ammToken0Symbol = ammPairName ? ammPairName.split('/')[0] : null;
  const isToken0In = tokenIn?.symbol === ammToken0Symbol; // true = swap token0→token1

  // Read AMM quote
  const { data: ammQuote } = useReadContract({
    address: ammPairAddress, abi: AMM_PAIR_ABI,
    functionName: isToken0In ? 'quoteSwap0to1' : 'quoteSwap1to0',
    args: parsedAmountIn > 0n ? [parsedAmountIn] : undefined,
    query: { enabled: ammLive && parsedAmountIn > 0n && !!tokenIn && !!tokenOut, refetchInterval: 8000 },
    chainId: currentNetworkId,
  });

  // Read Allowance for DEX (orderbook)
  const { data: allowanceDex } = useReadContract({
    address: tokenIn?.address, abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && tokenIn ? [address, DEX_ADDRESS] : undefined,
    query: { enabled: !!address && !!tokenIn, refetchInterval: 5000 },
    chainId: currentNetworkId,
  });
  // Read Allowance for AMM pair
  const { data: allowanceAmm } = useReadContract({
    address: tokenIn?.address, abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && tokenIn && ammPairAddress ? [address, ammPairAddress] : undefined,
    query: { enabled: !!address && !!tokenIn && ammLive, refetchInterval: 5000 },
    chainId: currentNetworkId,
  });

  const { writeContract: writeApprove, data: approveTxHash, isPending: isApproveSigning } = useWriteContract();
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const isApprovePending = isApproveSigning || isApproveConfirming;

  const handleApprove = (spender) => {
    writeApprove({
      address: tokenIn.address, abi: ERC20_ABI, chainId: currentNetworkId,
      functionName: 'approve',
      args: [spender, 115792089237316195423570985008687907853269984665640564039457584007913129639935n],
    });
  };

  const { data: quotedOut, isError: quoteError } = useReadContract({
    address: DEX_ADDRESS, abi: DEX_ABI,
    functionName: 'quoteSwapExactAmountIn',
    args: parsedAmountIn && parsedAmountIn > 0n && tokenIn && tokenOut ? [tokenIn.address, tokenOut.address, parsedAmountIn] : undefined,
    query: { enabled: !!parsedAmountIn && parsedAmountIn > 0n && !!tokenIn && !!tokenOut },
    chainId: currentNetworkId,
  });

  // Read pair's best ticks for correct market order placement
  const baseToken_ = tokenIn?.isQuoteToken ? tokenOut : tokenIn; // base = non-pUSD token
  const { data: pairKeyData } = useReadContract({
    address: DEX_ADDRESS, abi: DEX_ABI,
    functionName: 'pairKey',
    args: baseToken_ ? [tokenIn.address, tokenOut.address] : undefined,
    query: { enabled: !!tokenIn && !!tokenOut },
    chainId: currentNetworkId,
  });
  const { data: booksData } = useReadContract({
    address: DEX_ADDRESS, abi: DEX_ABI,
    functionName: 'books',
    args: pairKeyData ? [pairKeyData] : undefined,
    query: { enabled: !!pairKeyData },
    chainId: currentNetworkId,
  });
  const bestBidTick = booksData ? Number(booksData.bestBidTick) : 0;
  const bestAskTick = booksData ? Number(booksData.bestAskTick) : 0;
  const pairHasOrders = bestBidTick !== 0 || bestAskTick !== 0;

  // Smart Routing: Orderbook first → AMM Pool fallback
  const hasOrderbookLiquidity = !quoteError && quotedOut != null && quotedOut > 0n;
  const hasAmmLiquidity = ammLive && ammQuote != null && ammQuote > 0n;
  const swapMode = hasOrderbookLiquidity ? 'direct' : hasAmmLiquidity ? 'amm-pool' : pairHasOrders ? 'market-order' : 'no-liquidity';

  // Use the best quote (orderbook or AMM)
  const effectiveQuote = swapMode === 'amm-pool' ? ammQuote : quotedOut;
  const needsApproval = swapMode === 'amm-pool'
    ? (allowanceAmm !== undefined && allowanceAmm < parsedAmountIn)
    : (allowanceDex !== undefined && allowanceDex < parsedAmountIn);
  const approveTarget = swapMode === 'amm-pool' ? ammPairAddress : DEX_ADDRESS;

  const lastSwapRef = useRef(null);

  // Calculate fee and net output using BigInt to avoid precision/notation errors
  const feeBigInt = (effectiveQuote != null) ? (effectiveQuote * BigInt(PLATFORM_FEE_BPS)) / BigInt(FEE_DENOMINATOR) : 0n;
  const netOutBigInt = (effectiveQuote != null) ? effectiveQuote - feeBigInt : 0n;

  const feeDisplay = effectiveQuote != null && tokenOut ? parseFloat(formatUnits(feeBigInt, tokenOut.decimals)) : 0;
  const netOutDisplay = effectiveQuote != null && tokenOut ? formatUnits(netOutBigInt, tokenOut.decimals) : '0';

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

  // Separate hook for fee transfer (so it doesn't block the swap)
  const { writeContract: writeFee } = useWriteContract();
  const feeChargedRef = useRef(null); // tracks last txHash we charged fee for

  // After swap confirms: collect 0.1% fee + award points
  useEffect(() => {
    if (isSuccess && txHash && address && tokenOut && feeBigInt > 0n) {
      // Prevent charging fee twice for same tx
      if (feeChargedRef.current === txHash) return;
      feeChargedRef.current = txHash;

      // Collect 0.1% platform fee from user's output token
      writeFee({
        address: tokenOut.address,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [ADMIN_WALLET, feeBigInt],
        chainId: currentNetworkId,
      });

      // Award TSWAP Points
      awardPoints(address, 'SWAP', txHash).catch(() => {});
      checkReferralUnlock(address).catch(() => {});
    }
  }, [isSuccess, txHash, address, tokenOut, feeBigInt, currentNetworkId]);

  const handleSwap = () => {
    if (!isConnected) { onConnect(); return; }
    if (!parsedAmountIn || parsedAmountIn === 0n) return;
    setTxError('');

    if (swapMode === 'direct') {
      // ─── Direct Swap via Orderbook ────────────────────────────────────────
      const slipBps = BigInt(Math.floor(slippage * 100));
      const totalDeductBps = slipBps + BigInt(PLATFORM_FEE_BPS);
      const minOut = (quotedOut * (10000n - totalDeductBps)) / 10000n;
      writeContract({
        address: DEX_ADDRESS, abi: DEX_ABI, chainId: currentNetworkId,
        functionName: 'swapExactAmountIn',
        args: [tokenIn.address, tokenOut.address, parsedAmountIn, minOut],
      });
    } else if (swapMode === 'amm-pool') {
      // ─── AMM Pool Swap (Uniswap-style) ────────────────────────────────────
      const slipBps = BigInt(Math.floor(slippage * 100));
      const totalDeductBps = slipBps + BigInt(PLATFORM_FEE_BPS);
      const minOut = (ammQuote * (10000n - totalDeductBps)) / 10000n;
      writeContract({
        address: ammPairAddress, abi: AMM_PAIR_ABI, chainId: currentNetworkId,
        functionName: isToken0In ? 'swapExactToken0ForToken1' : 'swapExactToken1ForToken0',
        args: [parsedAmountIn, minOut, address],
      });
    } else if (swapMode === 'market-order') {
      // ─── Market Order fallback ────────────────────────────────────────────
      const baseToken = tokenIn.isQuoteToken ? tokenOut : tokenIn;
      const isBid = tokenIn.isQuoteToken;
      const rawTick = isBid
        ? (bestAskTick !== 0 ? bestAskTick : bestBidTick)
        : (bestBidTick !== 0 ? bestBidTick : bestAskTick);
      const marketTick = (Number.isFinite(rawTick) && Number.isInteger(rawTick)) ? rawTick : 0;
      let orderAmount = parsedAmountIn;
      if (!orderAmount || orderAmount <= 0n) return;
      if (orderAmount > MAX_UINT128) orderAmount = MAX_UINT128;
      writeContract({
        address: DEX_ADDRESS, abi: DEX_ABI, chainId: currentNetworkId,
        functionName: 'place',
        args: [baseToken.address, orderAmount, isBid, marketTick],
      });
    } else {
      setTxError('No liquidity available for this pair right now.');
      setTimeout(() => setTxError(''), 6000);
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

  const amountOut = effectiveQuote && amountIn && tokenOut ? formatUnits(effectiveQuote, tokenOut.decimals) : '';
  const priceDisplay = amountIn && amountOut && !isNaN(amountOut) && tokenIn && tokenOut
    ? `1 ${tokenIn.symbol} ≈ ${(parseFloat(amountOut) / parseFloat(amountIn)).toFixed(6)} ${tokenOut.symbol}` : null;
  const routeLabel = swapMode === 'direct' ? '📒 Orderbook' : swapMode === 'amm-pool' ? '🌊 AMM Pool' : swapMode === 'market-order' ? '📒 Market Order' : null;

  // Show empty state when no tokens for this network (AFTER all hooks)
  if (!tokenIn || !tokenOut) {
    return (
      <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ marginBottom: '16px' }}><SearchIcon size={48} color="var(--text-dim)"/></div>
          <h3 style={{ marginBottom: '8px', fontSize: '18px' }}>No Tokens on {currentNetworkId === 4217 ? 'Mainnet' : 'Testnet'}</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto' }}>
            {currentNetworkId === 4217
              ? 'Mainnet tokens have not been configured yet. Switch to Testnet to start trading.'
              : 'No tokens available on this network.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {modal === 'in'  && <TokenModal excludeToken={tokenOut} onSelect={t => { setTokenIn(t); }}  onClose={() => setModal(null)} chainId={currentNetworkId} />}
      {modal === 'out' && <TokenModal excludeToken={tokenIn}  onSelect={t => { setTokenOut(t); }} onClose={() => setModal(null)} chainId={currentNetworkId} />}

      <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div className="swap-header">
          <div className="swap-nav">
            <button className="active">Swap</button>
          </div>
          <button onClick={() => setShowSettings(!showSettings)}
            style={{ background: 'none', border: 'none', color: showSettings ? 'var(--brand-primary)' : 'var(--text-dim)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><SettingsIcon size={18}/></button>
        </div>

        {showSettings && (
          <div style={{ padding: '14px 16px', background: 'var(--bg-input)', margin: '0 6px', borderRadius: '14px', fontSize: '13px', border: '1px solid var(--border-glass)', animation: 'scaleIn 0.2s ease' }}>
            <div style={{ marginBottom: '8px', fontWeight: 600 }}>Slippage Tolerance</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[0.1, 0.5, 1.0].map(s => (
                <button key={s} onClick={() => setSlippage(s)} style={{ flex: 1, padding: '7px', borderRadius: '10px', border: '1px solid', borderColor: slippage === s ? 'var(--brand-primary)' : 'var(--border-glass)', background: slippage === s ? 'var(--brand-primary-dim)' : 'transparent', color: slippage === s ? 'var(--brand-primary)' : 'var(--text-dim)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s' }}>
                  {s}%
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: '6px' }}>
          {/* Token In */}
          <div className="token-input-container">
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 500 }}>You pay</div>
            <div className="input-row">
              <input type="number" className="token-input" placeholder="0" value={amountIn} onChange={e => setAmountIn(e.target.value)} />
              <button className="token-selector" onClick={() => setModal('in')}>

                <span style={{ marginLeft: '6px', fontWeight: 700 }}>{tokenIn.symbol}</span>
                <span style={{ opacity: 0.5, fontSize: '12px', marginLeft: '4px' }}>▼</span>
              </button>
            </div>
            <div className="balance-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden', gap: '6px' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>Balance: <strong style={{ color: 'var(--text-main)' }}>{formatBal(rawBalIn, tokenIn)}</strong> {tokenIn.symbol}</span>
              {rawBalIn != null && rawBalIn > 0n && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[25, 50, 75, 100].map(pct => (
                    <button key={pct}
                      onClick={() => {
                        let bal = rawBalIn || 0n;
                        if (bal > MAX_UINT128) bal = MAX_UINT128;
                        const portion = bal * BigInt(pct) / 100n;
                        const val = parseFloat(formatUnits(portion, tokenIn.decimals));
                        setAmountIn(val % 1 === 0 ? val.toString() : val.toFixed(2));
                      }}
                      style={{ background: 'rgba(255,0,122,0.08)', color: 'var(--brand-primary)', border: '1px solid rgba(255,0,122,0.2)', borderRadius: '8px', padding: '2px 7px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,0,122,0.15)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,0,122,0.08)'; }}
                    >{pct}%</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="switch-wrapper">
            <button className="switch-btn" onClick={switchTokens}>↓</button>
          </div>

          {/* Token Out */}
          <div className="token-input-container">
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 500 }}>
              You receive {quoteError && <span style={{ color: 'var(--danger)' }}> (no liquidity on this pair)</span>}
            </div>
            <div className="input-row">
              <input type="number" className="token-input" placeholder="0" value={amountOut} readOnly
                style={{ color: amountOut ? 'var(--text-main)' : 'var(--text-muted)' }} />
              <button className="token-selector" onClick={() => setModal('out')}>

                <span style={{ marginLeft: '6px', fontWeight: 700 }}>{tokenOut.symbol}</span>
                <span style={{ opacity: 0.5, fontSize: '12px', marginLeft: '4px' }}>▼</span>
              </button>
            </div>
            <div className="balance-row" style={{ overflow: 'hidden' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>Balance: <strong style={{ color: 'var(--text-main)' }}>{formatBal(rawBalOut, tokenOut)}</strong> {tokenOut.symbol}</span>
            </div>
          </div>

          {amountIn && !hasLiquidity && (
            <div style={{ padding: '10px 12px', marginTop: '4px', background: 'rgba(255,171,0,0.1)', border: '1px solid rgba(255,171,0,0.25)', borderRadius: '10px', fontSize: '12px', color: 'var(--warning)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ display: 'flex', alignItems: 'center' }}><ZapIcon size={14} color="var(--warning)"/></span>
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
              <div className="tx-row"><span>Execution</span><span style={{ color: 'var(--success)' }}>{routeLabel || 'Orderbook'}</span></div>
              <div className="tx-row"><span>Network Fee</span><span style={{ color: 'var(--success)', fontWeight: 700 }}>$0.00 (Sponsored)</span></div>
            </div>
          )}

          {isConnected && chainId !== currentNetworkId ? (
            <button className="btn-primary" onClick={() => onSwitch ? onSwitch(currentNetworkId) : handleSwap()} style={{ background: 'var(--brand-secondary)', borderColor: 'var(--brand-secondary)' }}>
              Switch to {currentNetworkId === 4217 ? 'Tempo Mainnet' : 'Tempo Testnet'}
            </button>
          ) : needsApproval ? (
            <button className="btn-primary" onClick={() => handleApprove(approveTarget)} disabled={isApprovePending || (isConnected && (!amountIn || parseFloat(amountIn) <= 0))} style={{ background: 'var(--brand-primary)', opacity: (!amountIn || parseFloat(amountIn) <= 0 || isApprovePending) ? 0.6 : 1 }}>
              {isApprovePending ? 'Approving...' : `Approve ${tokenIn.symbol}`}
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSwap}
              disabled={isPending || (isConnected && (!amountIn || parseFloat(amountIn) <= 0))}
              style={swapMode === 'amm-pool' && amountIn ? { background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' } : swapMode === 'market-order' && amountIn ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)' } : {}}>
              {!isConnected
                ? 'Connect Wallet'
                : isPending
                ? (swapMode === 'market-order' ? 'Placing Order...' : 'Swapping...')
                : !amountIn
                ? 'Enter an amount'
                : swapMode === 'market-order'
                ? 'Smart Swap: Place Market Order'
                : `Swap ${tokenIn?.symbol} → ${tokenOut?.symbol}`
              }
            </button>
          )}

          {txError && (
            <div style={{ marginTop: '12px', padding: '12px', borderRadius: '12px', background: 'rgba(255,71,87,0.1)', border: '1px solid var(--danger)', fontSize: '13px', textAlign: 'center', color: 'var(--danger)' }}>
              <span style={{display:'flex',alignItems:'center',gap:'6px',justifyContent:'center'}}><XCircleIcon size={14}/> {txError}</span>
            </div>
          )}
          {txHash && (
            <div style={{ marginTop: '12px', padding: '14px', borderRadius: '14px', background: isSuccess ? 'var(--success-dim)' : 'var(--bg-input)', border: `1px solid ${isSuccess ? 'var(--success)' : 'var(--border-glass)'}`, fontSize: '14px', textAlign: 'center', animation: 'scaleIn 0.25s ease' }}>
              {!isSuccess && (
                <div>
                  <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}><ActivityIcon size={14}/> Transaction Sent!</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Executing on Tempo orderbook...</div>
                </div>
              )}
              {isSuccess && (
                <div style={{ color: 'var(--success)', fontWeight: 600 }}>
                  <span style={{display:'flex',alignItems:'center',gap:'6px',justifyContent:'center'}}><CheckCircleIcon size={14}/> Swap Confirmed! <a href={`${currentNetworkId === 4217 ? 'https://explore.tempo.xyz' : 'https://explore.testnet.tempo.xyz'}/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)', textDecoration: 'none', marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>View <ExternalLinkIcon size={11}/></a></span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
