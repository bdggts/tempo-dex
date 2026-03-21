'use client';
import { useState, useEffect } from 'react';
import { useAccount, useConnect, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { DEX_ADDRESS, DEX_ABI, ERC20_ABI, TOKENS, TICK_SPACING, MIN_TICK, MAX_TICK, tickToPrice, formatTick, PRICE_SCALE, getTokensForChain } from '@/config/web3';

const MAX_UINT128 = 340282366920938463463374607431768211455n;

export default function OrderBook({ currentNetworkId, onConnect, onSwitch }) {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect } = useConnect();
  const { switchChain } = useSwitchChain();

  // Only non-quote tokens can be BASE tokens in place() — filter out pUSD/quote
  const networkTokens = getTokensForChain(currentNetworkId).filter(t => !t.isQuoteToken);
  const [selectedToken, setSelectedToken] = useState(networkTokens[0] || null);
  const [amount, setAmount] = useState('');
  const [isBid, setIsBid] = useState(true); // true = buy, false = sell
  const [tick, setTick] = useState(0);
  const [isFlip, setIsFlip] = useState(false);
  const [flipTick, setFlipTick] = useState(-10); // flip at -10 ticks for bid by default
  const [orderId, setOrderId] = useState('');
  const [cancelId, setCancelId] = useState('');

  // Reset token when network changes
  useEffect(() => {
    const tokens = getTokensForChain(currentNetworkId).filter(t => !t.isQuoteToken);
    setSelectedToken(tokens[0] || null);
    setAmount('');
  }, [currentNetworkId]);

  const [txError, setTxError] = useState('');
  const { writeContract, data: txHash, isPending, reset } = useWriteContract({
    mutation: {
      onError: (err) => {
        const msg = err?.shortMessage || err?.message || 'Transaction failed';
        setTxError(msg);
        setTimeout(() => setTxError(''), 8000);
      }
    }
  });
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Read BOTH selectedToken balance AND pUSD balance separately
  const quoteToken = getTokensForChain(currentNetworkId).find(t => t.isQuoteToken);

  // Selected token balance (always read — shown in both BUY and SELL)
  const { data: rawSelectedBal } = useReadContract({
    address: selectedToken?.address, abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!selectedToken, refetchInterval: 5000 },
    chainId: currentNetworkId,
  });

  // pUSD balance (for BUY mode — this is what user spends)
  const { data: rawPusdBal } = useReadContract({
    address: quoteToken?.address, abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!quoteToken, refetchInterval: 5000 },
    chainId: currentNetworkId,
  });

  // For % buttons: use pUSD in BUY, selectedToken in SELL
  const rawBalData = isBid ? rawPusdBal : rawSelectedBal;
  const balanceToken = isBid ? (quoteToken || selectedToken) : selectedToken;

  const formatBal = (raw, token) => {
    if (raw == null || !token) return '0';
    try {
      const decimals = token.decimals ?? 6;
      const val = parseFloat(formatUnits(raw, decimals));
      if (!isFinite(val)) return '0';
      if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
      if (val >= 1e9)  return (val / 1e9).toFixed(2)  + 'B';
      if (val >= 1e6)  return (val / 1e6).toFixed(2)  + 'M';
      if (val >= 1e3)  return (val / 1e3).toFixed(2)  + 'K';
      return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
    } catch { return '0'; }
  };


  // Show empty state when no tokens for this network
  if (!selectedToken) {
    return (
      <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <h3 style={{ marginBottom: '8px', fontSize: '18px' }}>No Tokens on {currentNetworkId === 4217 ? 'Mainnet' : 'Testnet'}</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto' }}>
            {currentNetworkId === 4217
              ? 'Mainnet tokens have not been configured yet. Switch to Testnet to place orders.'
              : 'No tokens available on this network.'}
          </p>
        </div>
      </div>
    );
  }

  const safeParseUnits = (value, decimals) => {
    try {
      let str = String(value);
      if (str.includes('e') || str.includes('E')) {
        str = Number(str).toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: decimals });
      }
      if (str.includes('.')) { const p = str.split('.'); str = p[1].slice(0, decimals) ? `${p[0]}.${p[1].slice(0, decimals)}` : p[0]; }
      return parseUnits(str, decimals);
    } catch { return 0n; }
  };
  const parsedAmount = amount && !isNaN(amount) ? safeParseUnits(amount, selectedToken.decimals) : 0n;

  const spendToken = isBid ? TOKENS.PATH_USD : selectedToken;
  
  let parsedSpendAmount = 0n;
  if (parsedAmount > 0n) {
    if (isBid) {
      const priceNumerator = BigInt(PRICE_SCALE + tick);
      const priceDenominator = BigInt(PRICE_SCALE);
      parsedSpendAmount = (parsedAmount * priceNumerator) / priceDenominator;
    } else {
      parsedSpendAmount = parsedAmount;
    }
  }

  // Read Allowance — place() does transferFrom internally, so DEX needs allowance
  const { data: allowance } = useReadContract({
    address: spendToken.address, abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, DEX_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
    chainId: currentNetworkId,
  });

  const needsApproval = allowance !== undefined && parsedSpendAmount > 0n && allowance < parsedSpendAmount;

  const { writeContract: writeApprove, data: approveTxHash, isPending: isApproveSigning } = useWriteContract();
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const isApprovePending = isApproveSigning || isApproveConfirming;

  const handleApprove = () => {
    writeApprove({
      address: spendToken.address, abi: ERC20_ABI, chainId: currentNetworkId,
      functionName: 'approve',
      args: [DEX_ADDRESS, 115792089237316195423570985008687907853269984665640564039457584007913129639935n],
    });
  };

  /* ─── Place Order ──────────────────────────────────────────────────────── */
  const MIN_ORDER_AMOUNT = 100_000n; // 0.1 tokens (6 decimals) — Tempo DEX minimum

  const handlePlaceOrder = () => {
    if (!isConnected) { onConnect(); return; }
    if (!amount || parsedAmount === 0n) return;
    setTxError('');

    if (parsedAmount < MIN_ORDER_AMOUNT) {
      setTxError('⚠️ Minimum order size is 0.1 tokens. Please enter a larger amount.');
      setTimeout(() => setTxError(''), 6000);
      return;
    }

    if (isFlip) {
      writeContract({
        address: DEX_ADDRESS, abi: DEX_ABI, chainId: currentNetworkId,
        functionName: 'placeFlip',
        args: [selectedToken.address, parsedAmount, isBid, tick, flipTick],
      });
    } else {
      writeContract({
        address: DEX_ADDRESS, abi: DEX_ABI, chainId: currentNetworkId,
        functionName: 'place',
        args: [selectedToken.address, parsedAmount, isBid, tick],
      });
    }
  };

  const handleCancelOrder = () => {
    if (!isConnected || !cancelId) return;
    writeContract({
      address: DEX_ADDRESS, abi: DEX_ABI, chainId: currentNetworkId,
      functionName: 'cancel',
      args: [BigInt(cancelId)],
    });
  };

  // Enforce tick spacing
  const snapTick = (rawTick) => {
    const snapped = Math.round(rawTick / TICK_SPACING) * TICK_SPACING;
    return Math.max(MIN_TICK, Math.min(MAX_TICK, snapped));
  };

  const handleTickChange = (val) => setTick(snapTick(Number(val)));
  const handleFlipChange = (val) => setFlipTick(snapTick(Number(val)));

  return (
    <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out', maxWidth: '600px' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-light)' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>📋 Limit Orders</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          Place orders directly on the Tempo price-time priority orderbook.<br />
          <strong>Flip orders</strong> automatically recreate on the opposite side when fully filled.
        </p>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Token + Side Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Token</label>
            <select
              value={selectedToken.symbol}
              onChange={(e) => setSelectedToken(networkTokens.find(t => t.symbol === e.target.value))}
              style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-main)', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}
            >
              {networkTokens.map(t => <option key={t.symbol} value={t.symbol}>{t.logo} {t.symbol}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Side</label>
            <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
              <button onClick={() => setIsBid(true)} style={{ flex: 1, padding: '10px', background: isBid ? 'rgba(39,174,96,0.2)' : 'var(--bg-card)', color: isBid ? 'var(--success)' : 'var(--text-dim)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
                BUY
              </button>
              <button onClick={() => setIsBid(false)} style={{ flex: 1, padding: '10px', background: !isBid ? 'rgba(255,71,87,0.2)' : 'var(--bg-card)', color: !isBid ? 'var(--danger)' : 'var(--text-dim)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
                SELL
              </button>
            </div>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Amount ({selectedToken.symbol})</label>
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-main)', padding: '12px 16px', borderRadius: '10px', fontSize: '20px', fontWeight: 600 }}
          />
          <div className="balance-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', overflow: 'hidden', gap: '6px' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              {selectedToken.symbol}: <strong style={{ color: 'var(--text-main)' }}>{formatBal(rawSelectedBal, selectedToken)}</strong>
              {isBid && quoteToken && (
                <span style={{ marginLeft: '8px' }}>| pUSD: <strong style={{ color: '#f59e0b' }}>{formatBal(rawPusdBal, quoteToken)}</strong></span>
              )}
            </span>
            {rawBalData != null && rawBalData > 0n && (
              <div style={{ display: 'flex', gap: '4px' }}>
                {[25, 50, 75, 100].map(pct => (
                  <button key={pct}
                    onClick={() => {
                      if (isBid) {
                        const pUsdBalance = rawBalData || 0n;
                        if (pUsdBalance > 0n) {
                          let amountBigInt = (pUsdBalance * BigInt(PRICE_SCALE)) / BigInt(PRICE_SCALE + tick);
                          if (amountBigInt > MAX_UINT128) amountBigInt = MAX_UINT128;
                          const portion = amountBigInt * BigInt(pct) / 100n;
                          const val = parseFloat(formatUnits(portion, selectedToken.decimals));
                          setAmount(val % 1 === 0 ? val.toString() : val.toFixed(2));
                        }
                      } else {
                        let bal = rawBalData || 0n;
                        if (bal > MAX_UINT128) bal = MAX_UINT128;
                        const portion = bal * BigInt(pct) / 100n;
                        const val = parseFloat(formatUnits(portion, selectedToken.decimals));
                        setAmount(val % 1 === 0 ? val.toString() : val.toFixed(2));
                      }
                    }}
                    style={{ background: 'var(--brand-primary-dim)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)', borderRadius: '6px', padding: '2px 6px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                  >{pct}%</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tick Slider */}
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
            Price Tick: <strong style={{ color: 'var(--text-main)' }}>{tick}</strong>
            <span style={{ marginLeft: '8px', color: tick >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '12px' }}>{formatTick(tick)}</span>
          </label>
          <input type="range" min={MIN_TICK} max={MAX_TICK} step={TICK_SPACING} value={tick}
            onChange={(e) => handleTickChange(e.target.value)}
            style={{ width: '100%', accentColor: 'var(--brand-primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            <span>{MIN_TICK} (-2%)</span><span>0 (peg)</span><span>{MAX_TICK} (+2%)</span>
          </div>
        </div>

        {/* Flip Order Toggle */}
        <div style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isFlip ? '12px' : '0' }}>
            <div>
              <div style={{ fontWeight: 600 }}>🔁 Flip Order</div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Auto-recreate on opposite side when filled</div>
            </div>
            <button onClick={() => setIsFlip(!isFlip)} style={{ background: isFlip ? 'var(--brand-primary)' : 'var(--bg-panel)', border: '1px solid var(--border-light)', color: 'white', padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              {isFlip ? 'ON' : 'OFF'}
            </button>
          </div>
          {isFlip && (
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
                Flip Tick: <strong>{flipTick}</strong>
                <span style={{ marginLeft: '8px', color: flipTick >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '12px' }}>{formatTick(flipTick)}</span>
              </label>
              <input type="range" min={MIN_TICK} max={MAX_TICK} step={TICK_SPACING} value={flipTick}
                onChange={(e) => handleFlipChange(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--brand-secondary)' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {isBid ? 'Flip tick must be > order tick for bids' : 'Flip tick must be < order tick for asks'}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons: Approve → Place Order */}
        {isConnected && chainId !== currentNetworkId ? (
          <button className="btn-primary" onClick={() => onSwitch ? onSwitch(currentNetworkId) : handlePlaceOrder()} style={{ background: 'var(--brand-secondary)', borderColor: 'var(--brand-secondary)' }}>
            Switch to {currentNetworkId === 4217 ? 'Tempo Mainnet' : 'Tempo Testnet'}
          </button>
        ) : needsApproval ? (
          <button className="btn-primary" onClick={handleApprove} disabled={isApprovePending || (isConnected && !amount)} style={{ background: 'var(--brand-primary)', opacity: (!amount || isApprovePending) ? 0.6 : 1 }}>
            {isApprovePending ? '⏳ Approving...' : `Approve ${spendToken.symbol}`}
          </button>
        ) : (
          <button className="btn-primary" onClick={handlePlaceOrder}
            disabled={isPending || (isConnected && !amount)}>
            {!isConnected ? 'Connect Wallet' : isPending ? 'Placing order...' : `Place ${isBid ? 'Buy' : 'Sell'} ${isFlip ? 'Flip ' : ''}Order`}
          </button>
        )}

        {/* TX Status */}
        {txError && (
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,71,87,0.1)', border: '1px solid var(--danger)', fontSize: '13px', textAlign: 'center', color: 'var(--danger)' }}>
            ❌ {txError}
          </div>
        )}
        {txHash && (
          <div style={{ padding: '12px', borderRadius: '12px', background: isSuccess ? 'rgba(39,174,96,0.1)' : 'var(--bg-card)', border: `1px solid ${isSuccess ? 'var(--success)' : 'var(--border-light)'}`, fontSize: '14px', textAlign: 'center' }}>
            {!isSuccess && (
              <div>
                <div style={{ marginBottom: '4px' }}>📡 Transaction Sent!</div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px' }}>⏳ Submitting to Tempo orderbook...</div>
                <a
                  href={`${currentNetworkId === 4217 ? 'https://explore.tempo.xyz' : 'https://explore.testnet.tempo.xyz'}/tx/${txHash}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: '12px', color: 'var(--brand-primary)', textDecoration: 'none', fontWeight: 600 }}
                >
                  🔍 View on Explorer ↗
                </a>
              </div>
            )}
            {isSuccess && (
              <div style={{ color: 'var(--success)', fontWeight: 600 }}>
                ✅ Order Confirmed! <a href={`${currentNetworkId === 4217 ? 'https://explore.tempo.xyz' : 'https://explore.testnet.tempo.xyz'}/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)', textDecoration: 'none', marginLeft: '8px' }}>View ↗</a>
              </div>
            )}
          </div>
        )}

        {/* Cancel Order */}
        <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '8px' }}>Cancel Order by ID</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" value={cancelId} onChange={(e) => setCancelId(e.target.value)} placeholder="Order ID..."
              style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-main)', padding: '10px 14px', borderRadius: '10px', fontSize: '14px' }}
            />
            <button onClick={handleCancelOrder} disabled={!cancelId || isPending}
              style={{ background: 'rgba(255,71,87,0.15)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 20px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>
              Cancel
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
