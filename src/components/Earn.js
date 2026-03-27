'use client';
import { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useWriteContract, useReadContract, useReadContracts, useBalance } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import {
  TOKENS, ADMIN_WALLET, ERC20_ABI, REGISTRY_ADDRESS, REGISTRY_ABI,
  LOCK_PERIOD, APY_BY_LOCK, LOCK_DAYS, weeklyRate, estimateYield, getTokensForChain,
} from '@/config/web3';

// ─── Lock Tier Config ─────────────────────────────────────────────────────────
const LOCK_TIERS = [
  {
    id: LOCK_PERIOD.FLEXIBLE,
    label: 'Flexible',
    icon: '🔓',
    days: 'Anytime',
    lockDays: 0,
    period: '—',
    apy: APY_BY_LOCK[LOCK_PERIOD.FLEXIBLE],
    weeklyPct: (APY_BY_LOCK[LOCK_PERIOD.FLEXIBLE] / 4).toFixed(2),
    color: '#94a3b8',
    desc: 'No lock. Withdraw anytime.',
  },
  {
    id: LOCK_PERIOD.Q1,
    label: '1st Quarter',
    icon: '🏆',
    days: '3 months',
    lockDays: 90,
    period: 'Q1',
    apy: APY_BY_LOCK[LOCK_PERIOD.Q1],
    weeklyPct: (APY_BY_LOCK[LOCK_PERIOD.Q1] / 4).toFixed(2),
    color: '#a78bfa',
    desc: '3-month FD. Steady yield.',
  },
  {
    id: LOCK_PERIOD.Q2,
    label: '2nd Quarter',
    icon: '🏆',
    days: '6 months',
    lockDays: 180,
    period: 'Q2',
    apy: APY_BY_LOCK[LOCK_PERIOD.Q2],
    weeklyPct: (APY_BY_LOCK[LOCK_PERIOD.Q2] / 4).toFixed(2),
    color: '#60a5fa',
    desc: '6-month FD. Good return.',
  },
  {
    id: LOCK_PERIOD.Q3,
    label: '3rd Quarter',
    icon: '🏆',
    days: '9 months',
    lockDays: 270,
    period: 'Q3',
    apy: APY_BY_LOCK[LOCK_PERIOD.Q3],
    weeklyPct: (APY_BY_LOCK[LOCK_PERIOD.Q3] / 4).toFixed(2),
    color: '#f59e0b',
    desc: '9-month FD. High yield.',
  },
  {
    id: LOCK_PERIOD.Q4,
    label: '4th Quarter',
    icon: '🏆',
    days: '12 months',
    lockDays: 365,
    period: 'Q4',
    apy: APY_BY_LOCK[LOCK_PERIOD.Q4],
    weeklyPct: (APY_BY_LOCK[LOCK_PERIOD.Q4] / 4).toFixed(2),
    color: '#34d399',
    desc: 'Annual FD. Max 15% rate.',
    recommended: true,
  },
];

// ─── Countdown Timer ──────────────────────────────────────────────────────────
function Countdown({ unlockTime }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const calc = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = Number(unlockTime) - now;
      if (diff <= 0) { setRemaining('Unlocked ✅'); return; }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setRemaining(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [unlockTime]);
  return <span>{remaining}</span>;
}

// ─── Position Card ────────────────────────────────────────────────────────────
function PositionCard({ dep, index, address, currentNetworkId, onWithdraw, onClaimYield }) {
  const tier = LOCK_TIERS[dep.lockPeriod] || LOCK_TIERS[0];
  const token = Object.values(TOKENS).find(t => t.address.toLowerCase() === dep.token.toLowerCase());
  const now = Math.floor(Date.now() / 1000);
  const unlocked = dep.lockPeriod === LOCK_PERIOD.FLEXIBLE || Number(dep.unlockTime) <= now;
  const principalFloat = parseFloat(formatUnits(dep.amount, token?.decimals || 6));
  const decimals = token?.decimals || 6;

  // Read live auto-yield from contract (updates on each block)
  const registryAddr = REGISTRY_ADDRESS[currentNetworkId];
  const { data: liveAutoYield, refetch: refetchAutoYield } = useReadContract({
    address: registryAddr,
    abi: REGISTRY_ABI,
    functionName: 'pendingYield',
    args: [address, BigInt(index)],
    chainId: currentNetworkId,
    watch: true,
  });

  // Total claimable = auto-yield (live from contract) + admin-credited earnedYield
  const autoYieldFloat  = liveAutoYield ? parseFloat(formatUnits(liveAutoYield, decimals)) : 0;
  const earnedYieldFloat = parseFloat(formatUnits(dep.earnedYield, decimals));

  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const claimRef = useRef(false); // tracks if we actually submitted a claim tx

  // Reset justClaimed once liveAutoYield returns 0 from contract (pendingYield resets after claimYield)
  useEffect(() => {
    if (justClaimed && claimRef.current && liveAutoYield === 0n) {
      setJustClaimed(false);
      claimRef.current = false;
    }
  }, [justClaimed, liveAutoYield]);

  // After claim: show 0 immediately (optimistic) while blockchain state catches up
  const totalYieldFloat  = justClaimed ? 0 : (autoYieldFloat + earnedYieldFloat);
  const hasYield = !justClaimed && totalYieldFloat > 0.000001;

  const handlePct = (pct) => {
    const val = principalFloat * pct / 100;
    setWithdrawAmt(val % 1 === 0 ? val.toString() : val.toFixed(4));
  };

  const handleClick = () => {
    const amt = parseFloat(withdrawAmt);
    if (!amt || amt <= 0) return;
    setIsWithdrawing(true);
    onWithdraw(index, withdrawAmt, decimals, amt >= principalFloat)
      .finally(() => setIsWithdrawing(false));
  };

  const handleClaim = () => {
    if (!hasYield || isClaiming || justClaimed) return;
    setIsClaiming(true);
    setJustClaimed(true);      // show 0 immediately
    claimRef.current = true;   // guard: a real claim was submitted
    onClaimYield(index)
      .then(() => {
        // Force refetch live yield — contract should return 0 now
        refetchAutoYield();
        setTimeout(() => refetchAutoYield(), 2000);
        setTimeout(() => refetchAutoYield(), 5000);
      })
      .catch(() => {
        // Claim failed — revert justClaimed so yield shows again
        setJustClaimed(false);
      })
      .finally(() => {
        setIsClaiming(false);
        // Safety fallback: clear justClaimed after 60s even if contract never updates
        setTimeout(() => setJustClaimed(false), 60000);
      });
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '16px',
      padding: '20px',
      border: `1px solid ${tier.color}30`,
      boxShadow: `0 4px 20px ${tier.color}10`,
      transition: 'all 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>{tier.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{token?.symbol || 'Token'}</div>
            <div style={{ fontSize: '12px', color: tier.color, fontWeight: 600 }}>{tier.label} · {tier.apy}% APY</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>{principalFloat.toLocaleString()}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{token?.symbol}</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        <div style={{ background: 'var(--bg-panel)', borderRadius: '10px', padding: '10px 12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '3px' }}>Earned Yield 🔄</div>
          <div style={{ fontWeight: 700, color: '#34d399', fontSize: '14px' }}>
            +{totalYieldFloat.toFixed(6)} {token?.symbol}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
            Auto-accruing · {(tier.apy / 365).toFixed(4)}%/day
          </div>
        </div>
        <div style={{ background: 'var(--bg-panel)', borderRadius: '10px', padding: '10px 12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '3px' }}>
            {dep.lockPeriod === 0 ? 'Flexible' : unlocked ? 'Status' : 'Unlocks in'}
          </div>
          <div style={{ fontWeight: 700, fontSize: '13px', color: unlocked ? '#34d399' : tier.color }}>
            {dep.lockPeriod === 0 ? '🔓 Anytime' : unlocked ? '✅ Ready' : <Countdown unlockTime={dep.unlockTime} />}
          </div>
        </div>
      </div>

      {/* Claim Yield button — always visible when yield > 0 (even when locked!) */}
      {(hasYield || justClaimed) && (
        <button
          onClick={handleClaim}
          disabled={isClaiming || justClaimed}
          style={{
            width: '100%', padding: '11px', borderRadius: '10px', border: 'none',
            background: (isClaiming || justClaimed)
              ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
              : 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#fff', fontWeight: 700, fontSize: '13px',
            cursor: (isClaiming || justClaimed) ? 'not-allowed' : 'pointer',
            marginBottom: '8px',
            boxShadow: '0 4px 15px rgba(245,158,11,0.3)',
            transition: 'all 0.2s',
            opacity: justClaimed && !isClaiming ? 0.7 : 1,
          }}
        >
          {isClaiming
            ? '⏳ Claiming — Confirm in MetaMask...'
            : justClaimed
            ? '✅ Yield Claimed!'
            : `🌾 Claim Yield: +${totalYieldFloat.toFixed(6)} ${token?.symbol}`}
        </button>
      )}

      {/* Withdraw section — only when unlocked */}
      {unlocked && (
        <div style={{ marginTop: '4px' }}>
          {/* % quick buttons */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            {[25, 50, 75, 100].map(pct => (
              <button key={pct}
                onClick={() => handlePct(pct)}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                  border: `1px solid ${tier.color}50`,
                  background: withdrawAmt && parseFloat(withdrawAmt) === principalFloat * pct / 100 ? `${tier.color}25` : 'transparent',
                  color: tier.color, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >{pct}%</button>
            ))}
          </div>

          {/* Amount input */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input
              type="number"
              placeholder={`Amount (max ${principalFloat.toLocaleString()})`}
              value={withdrawAmt}
              onChange={e => setWithdrawAmt(e.target.value)}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-panel)', color: 'var(--text-main)',
                fontSize: '14px', outline: 'none',
              }}
            />
          </div>

          {/* Withdraw button */}
          <button
            onClick={handleClick}
            disabled={isWithdrawing || !withdrawAmt || parseFloat(withdrawAmt) <= 0 || parseFloat(withdrawAmt) > principalFloat}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: isWithdrawing
                ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                : (!withdrawAmt || parseFloat(withdrawAmt) <= 0)
                ? 'var(--bg-panel)'
                : 'linear-gradient(135deg, #10b981, #059669)',
              color: (!withdrawAmt || parseFloat(withdrawAmt) <= 0) && !isWithdrawing ? 'var(--text-dim)' : '#fff',
              fontWeight: 700, fontSize: '13px',
              cursor: isWithdrawing ? 'wait' : (!withdrawAmt || parseFloat(withdrawAmt) <= 0) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: isWithdrawing ? '0 4px 15px rgba(99,102,241,0.3)' : (!withdrawAmt || parseFloat(withdrawAmt) <= 0) ? 'none' : '0 4px 15px rgba(16,185,129,0.25)',
            }}
          >
            {isWithdrawing
              ? '⏳ Withdrawing — Confirm in MetaMask...'
              : (!withdrawAmt || parseFloat(withdrawAmt) <= 0)
              ? 'Enter Amount to Withdraw'
              : parseFloat(withdrawAmt) >= principalFloat
              ? `✅ Withdraw All ${principalFloat.toLocaleString()} ${token?.symbol}`
              : `↑ Withdraw ${parseFloat(withdrawAmt).toLocaleString()} ${token?.symbol}`
            }
          </button>
        </div>
      )}

      {/* Locked — no withdraw UI */}
      {!unlocked && (
        <button disabled style={{
          width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-light)',
          background: 'transparent', color: 'var(--text-dim)', fontWeight: 700, fontSize: '13px', cursor: 'not-allowed', opacity: 0.5,
        }}>
          🔒 Locked until {new Date(Number(dep.unlockTime) * 1000).toLocaleDateString()}
        </button>
      )}
    </div>
  );
}

// ─── Tier Card ────────────────────────────────────────────────────────────────
function TierCard({ tier, selected, onSelect }) {
  const isSelected = selected === tier.id;
  return (
    <div
      onClick={() => onSelect(tier.id)}
      style={{
        borderRadius: '12px',
        padding: '12px 8px',
        border: `2px solid ${isSelected ? tier.color : 'var(--border-light)'}`,
        background: isSelected ? `${tier.color}18` : 'var(--bg-card)',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.2s',
        position: 'relative',
      }}
    >
      {tier.recommended && (
        <div style={{ position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)', background: tier.color, color: '#000', fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
          BEST
        </div>
      )}
      <div style={{ fontSize: '18px', marginBottom: '3px' }}>{tier.icon}</div>
      <div style={{ fontWeight: 700, fontSize: '12px', color: isSelected ? tier.color : 'var(--text-main)' }}>{tier.label}</div>
      <div style={{ fontSize: '15px', fontWeight: 800, color: tier.color, marginTop: '2px' }}>{tier.apy}%</div>
      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>annual</div>
    </div>
  );
}

// ─── Main Earn Component ──────────────────────────────────────────────────────
export default function Earn({ currentNetworkId, onConnect }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();

  const [selectedTier, setSelectedTier] = useState(LOCK_PERIOD.FLEXIBLE);
  const [selectedToken, setSelectedToken] = useState(null);
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState('idle'); // idle | approving | approved | registering | done | error
  const [statusMsg, setStatusMsg] = useState('');

  const networkTokens = getTokensForChain(currentNetworkId);
  const registryAddr = REGISTRY_ADDRESS[currentNetworkId] || '0x0000000000000000000000000000000000000000';
  const isRegistryDeployed = registryAddr !== '0x0000000000000000000000000000000000000000';

  const safeParseUnits = (value, decimals) => {
    try {
      if (value === undefined || value === null || decimals === undefined) return 0n;
      let str = String(value);
      if (!str || str === 'NaN' || str === 'undefined') return 0n;
      if (str.includes('e') || str.includes('E')) {
        str = Number(str).toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: decimals });
      }
      if (str.includes('.')) { const p = str.split('.'); str = p[1].slice(0, decimals) ? `${p[0]}.${p[1].slice(0, decimals)}` : p[0]; }
      return parseUnits(str, decimals);
    } catch { return 0n; }
  };

  useEffect(() => {
    if (networkTokens.length > 0 && !selectedToken) {
      setSelectedToken(networkTokens[0]);
    }
  }, [currentNetworkId]);

  // Read user's token balance for % buttons
  const { data: tokenBalance } = useReadContract({
    address: selectedToken?.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && !!selectedToken },
  });

  // Read user's deposits from contract
  const { data: deposits = [], refetch: refetchDeposits } = useReadContract({
    address: registryAddr,
    abi: REGISTRY_ABI,
    functionName: 'getAllDeposits',
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && isRegistryDeployed },
  });

  // Read total pooled for selected token
  const { data: totalPooled } = useReadContract({
    address: registryAddr,
    abi: REGISTRY_ABI,
    functionName: 'totalDepositedByToken',
    args: selectedToken ? [selectedToken.address] : undefined,
    query: { enabled: isRegistryDeployed && !!selectedToken },
  });

  // Single write hook for all contract writes
  const { writeContractAsync } = useWriteContract();

  // Write — markWithdrawn (unused now, kept for compatibility)
  // const { writeContract: writeWithdraw } = useWriteContract();

  // Check existing allowance — skip approve if already approved for contract
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: selectedToken?.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && selectedToken ? [address, registryAddr] : undefined,
    query: { enabled: isConnected && !!address && !!selectedToken && isRegistryDeployed },
  });

  const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
  const parsedAmount = (amount && selectedToken?.decimals !== undefined) ? safeParseUnits(amount, selectedToken.decimals) : 0n;
  const isAlreadyApproved = typeof currentAllowance === 'bigint' && parsedAmount > 0n && currentAllowance >= parsedAmount;

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0 || !selectedToken) return;
    const parsedAmt = safeParseUnits(amount, selectedToken.decimals);
    if (parsedAmt === 0n) return;

    try {
      // Step 1: Approve if needed
      if (!isAlreadyApproved) {
        setStep('approving');
        setStatusMsg('⏳ Step 1: Approve tokens — confirm in MetaMask...');
        await writeContractAsync({
          address: selectedToken.address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [registryAddr, MAX_UINT256],
          chainId: currentNetworkId,
          gas: 2_000_000n,
        });
        // No need to wait for approve mining — deposit uses explicit gas (no estimation needed)
        setStatusMsg('✅ Approved! Now registering deposit...');
      }

      // Step 2: Register deposit on-chain (with explicit gas to avoid estimation issues)
      setStep('registering');
      setStatusMsg('⏳ Registering deposit — confirm in MetaMask...');
      await writeContractAsync({
        address: registryAddr,
        abi: REGISTRY_ABI,
        functionName: 'registerDeposit',
        args: [selectedToken.address, parsedAmt, selectedTier],
        chainId: currentNetworkId,
        gas: 4_000_000n, // v8 auto-yield needs ~3.1M gas for first deposit (new storage slots)
      });

      // Done!
      setStep('done');
      setStatusMsg('🎉 Deposit registered on-chain! Funds are working for you.');
      setAmount('');
      refetchDeposits();
      refetchAllowance();
    } catch (err) {
      console.error('Deposit error:', err);
      setStep('error');
      setStatusMsg(`❌ ${err.shortMessage || err.message || 'Transaction failed. Please try again.'}`);
      setTimeout(() => { setStep('idle'); setStatusMsg(''); }, 5000);
    }
  };

  const [withdrawMsg, setWithdrawMsg] = useState('');
  const [withdrawingIdx, setWithdrawingIdx] = useState(null);

  const handleWithdraw = async (index, amountStr, decimals, isFull) => {
    const dep = deposits[index];
    if (!dep) return Promise.resolve();
    setWithdrawMsg('');
    const token = Object.values(TOKENS).find(t => t.address.toLowerCase() === dep.token.toLowerCase());
    const tokenDecimals = token?.decimals || 6;
    try {
      if (isFull) {
        // Full withdraw — returns principal + yield
        await writeContractAsync({
          address: registryAddr,
          abi: REGISTRY_ABI,
          functionName: 'withdraw',
          args: [BigInt(index)],
          chainId: currentNetworkId,
          gas: 4_000_000n,
        });
        // 0.5% platform fee on principal
        try {
          const feeBig = dep.amount / 200n; // 0.5% = 1/200
          if (feeBig > 0n) {
            await writeContractAsync({
              address: dep.token,
              abi: ERC20_ABI,
              functionName: 'transfer',
              args: [ADMIN_WALLET, feeBig],
              chainId: currentNetworkId,
              gas: 100_000n,
            });
            const feeFormatted = parseFloat(formatUnits(feeBig, tokenDecimals)).toFixed(4);
            setWithdrawMsg(`✅ Withdrawn! 0.5% platform fee (${feeFormatted} ${token?.symbol || ''}) applied.`);
          } else {
            setWithdrawMsg('✅ Withdrawn! Principal + yield sent to your wallet.');
          }
        } catch {
          setWithdrawMsg('✅ Withdrawn! Principal + yield sent to your wallet.');
        }
      } else {
        // Partial withdraw — returns specified amount only
        const safeStr = parseFloat(amountStr).toFixed(tokenDecimals);
        const amountBig = parseUnits(safeStr, tokenDecimals);
        await writeContractAsync({
          address: registryAddr,
          abi: REGISTRY_ABI,
          functionName: 'withdrawPartial',
          args: [BigInt(index), amountBig],
          chainId: currentNetworkId,
          gas: 4_000_000n,
        });
        // 0.5% platform fee on partial amount
        try {
          const feeBig = amountBig / 200n;
          if (feeBig > 0n) {
            await writeContractAsync({
              address: dep.token,
              abi: ERC20_ABI,
              functionName: 'transfer',
              args: [ADMIN_WALLET, feeBig],
              chainId: currentNetworkId,
              gas: 100_000n,
            });
            const feeFormatted = parseFloat(formatUnits(feeBig, tokenDecimals)).toFixed(4);
            setWithdrawMsg(`✅ Withdrawn! 0.5% fee (${feeFormatted} ${token?.symbol || ''}) applied.`);
          } else {
            setWithdrawMsg(`✅ Withdrawn ${parseFloat(amountStr).toLocaleString()} tokens to your wallet!`);
          }
        } catch {
          setWithdrawMsg(`✅ Withdrawn ${parseFloat(amountStr).toLocaleString()} tokens to your wallet!`);
        }
      }
      setTimeout(() => { refetchDeposits(); setWithdrawMsg(''); }, 6000);
    } catch (err) {
      const msg = err.shortMessage || err.message || '';
      const friendly = msg.includes('wait 1 hour') ? '⏳ Please wait 1 hour between withdrawals (rate limit).'
        : msg.includes('daily') ? '⏳ Daily withdrawal limit reached. Try again tomorrow.'
        : msg.includes('paused') ? '🔴 Contract is paused. Contact admin.'
        : `❌ ${msg || 'Withdrawal failed. Try again.'}`;
      setWithdrawMsg(friendly);
      setTimeout(() => setWithdrawMsg(''), 6000);
      throw err;
    }
  };

  const handleClaimYield = async (index) => {
    const dep = deposits[index];
    if (!dep) return Promise.resolve();
    setWithdrawMsg('');
    try {
      // Read pending yield BEFORE claiming (to calculate 1% fee)
      const token = Object.values(TOKENS).find(t => t.address.toLowerCase() === dep.token.toLowerCase());
      const decimals = token?.decimals || 6;

      // Step 1: Claim yield from contract → tokens go to user's wallet
      await writeContractAsync({
        address: registryAddr,
        abi: REGISTRY_ABI,
        functionName: 'claimYield',
        args: [BigInt(index)],
        chainId: currentNetworkId,
        gas: 4_000_000n,
      });

      // Step 2: Calculate 1% platform fee from earned yield
      try {
        const autoYield = dep.earnedYield || 0n;
        if (autoYield > 0n) {
          const feeBig = autoYield / 100n; // 1% fee
          if (feeBig > 0n) {
            // Auto-transfer 1% fee to ADMIN_WALLET
            await writeContractAsync({
              address: dep.token,
              abi: ERC20_ABI,
              functionName: 'transfer',
              args: [ADMIN_WALLET, feeBig],
              chainId: currentNetworkId,
              gas: 100_000n,
            });
            const feeFormatted = parseFloat(formatUnits(feeBig, decimals)).toFixed(4);
            setWithdrawMsg(`🌾 Yield claimed! 1% platform fee (${feeFormatted} ${token?.symbol || ''}) applied.`);
          } else {
            setWithdrawMsg('🌾 Yield claimed! Tokens sent to your wallet.');
          }
        } else {
          setWithdrawMsg('🌾 Yield claimed! Tokens sent to your wallet.');
        }
      } catch {
        // Fee transfer failed (e.g. insufficient balance) — still show success for main claim
        setWithdrawMsg('🌾 Yield claimed! Tokens sent to your wallet.');
      }

      // Refetch IMMEDIATELY so yield resets to 0 — prevents double-claim
      refetchDeposits();
      setTimeout(() => { refetchDeposits(); setWithdrawMsg(''); }, 3000);
    } catch (err) {
      const msg = err.shortMessage || err.message || '';
      setWithdrawMsg(msg.includes('no yield') ? '⚠️ No yield to claim yet.' : `❌ ${msg || 'Claim failed. Try again.'}`);
      setTimeout(() => setWithdrawMsg(''), 5000);
      throw err;
    }
  };

  const activeDeposits = Array.isArray(deposits) ? deposits.filter(d => d.active) : [];
  const totalDeposited = activeDeposits.reduce((sum, d) => {
    const tok = Object.values(TOKENS).find(t => t.address.toLowerCase() === d.token.toLowerCase());
    return sum + parseFloat(formatUnits(d.amount, tok?.decimals || 6));
  }, 0);

  // Batch-read pendingYield for ALL active deposits to show correct total in header
  const { data: allPendingYields } = useReadContracts({
    contracts: activeDeposits.map((_, i) => ({
      address: registryAddr,
      abi: REGISTRY_ABI,
      functionName: 'pendingYield',
      args: [address, BigInt(i)],
      chainId: currentNetworkId,
    })),
    query: { enabled: !!address && activeDeposits.length > 0, refetchInterval: 5000 },
  });

  const totalYield = activeDeposits.reduce((sum, d, i) => {
    const tok = Object.values(TOKENS).find(t => t.address.toLowerCase() === d.token.toLowerCase());
    const decimals = tok?.decimals || 6;
    const earned = parseFloat(formatUnits(d.earnedYield, decimals));
    const pending = allPendingYields?.[i]?.result
      ? parseFloat(formatUnits(allPendingYields[i].result, decimals))
      : 0;
    return sum + earned + pending;
  }, 0);

  if (!isConnected) {
    return (
      <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>💰</div>
          <h3 style={{ marginBottom: '8px', fontSize: '20px' }}>Liquidity Pool Earning</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto 28px' }}>
            Deposit your tokens, choose a lock period, and earn up to <strong style={{ color: '#34d399' }}>15% APY</strong> while providing swap liquidity.
          </p>
          <button className="btn-connect" onClick={onConnect}>Connect Wallet</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease-out', maxWidth: '520px', width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Pool Stats ── */}
      <div className="swap-container" style={{ padding: '0' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>💰 Liquidity Pool</h2>
            {!isRegistryDeployed && (
              <span style={{ fontSize: '11px', background: 'rgba(255,193,7,0.15)', color: '#fbbf24', padding: '3px 10px', borderRadius: '8px', border: '1px solid #fbbf2430', fontWeight: 700 }}>
                ⚠️ Contract Not Deployed
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '16px 20px' }}>
          {[
            { label: 'Your Deposits', value: `$${totalDeposited.toLocaleString()}`, color: '#60a5fa' },
            { label: 'Earned Yield', value: `+$${totalYield.toFixed(4)}`, color: '#34d399' },
            { label: 'Max APY', value: '15%', color: '#a78bfa' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Deposit Form ── */}
      <div className="swap-container" style={{ padding: '20px 24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Deposit & Lock</h3>

        {/* Lock Tier Selector — 5 tiers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {LOCK_TIERS.slice(0, 3).map(tier => (
            <TierCard key={tier.id} tier={tier} selected={selectedTier} onSelect={setSelectedTier} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {LOCK_TIERS.slice(3).map(tier => (
            <TierCard key={tier.id} tier={tier} selected={selectedTier} onSelect={setSelectedTier} />
          ))}
        </div>

        {/* Token Selector */}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Token</label>
          <select
            value={selectedToken?.symbol || ''}
            onChange={e => setSelectedToken(networkTokens.find(t => t.symbol === e.target.value))}
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-main)', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}
          >
            {networkTokens.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol} - {t.name}</option>)}
          </select>
        </div>

        {/* Amount Input */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Amount</label>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-main)', padding: '12px 14px', borderRadius: '10px', fontSize: '18px', fontWeight: 700, boxSizing: 'border-box' }}
          />
          {selectedToken && tokenBalance && parseFloat(formatUnits(tokenBalance, selectedToken.decimals)) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Balance: <strong style={{ color: 'var(--text-main)' }}>{parseFloat(formatUnits(tokenBalance, selectedToken.decimals)).toLocaleString()}</strong> {selectedToken.symbol}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[25, 50, 75, 100].map(pct => (
                  <button key={pct}
                    onClick={() => {
                      const portion = tokenBalance * BigInt(pct) / 100n;
                      const val = parseFloat(formatUnits(portion, selectedToken.decimals));
                      setAmount(val % 1 === 0 ? val.toString() : val.toFixed(2));
                    }}
                    style={{ background: 'var(--brand-primary-dim)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)', borderRadius: '6px', padding: '2px 6px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                  >{pct}%</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Row */}
        {amount && parseFloat(amount) > 0 && (() => {
          const tier = LOCK_TIERS.find(t => t.id === selectedTier) || LOCK_TIERS[LOCK_TIERS.length - 1];
          const days = Math.max(tier.lockDays || 30, 7);
          const estYield = estimateYield(parseFloat(amount), tier.apy, days);
          return (
            <div style={{ background: 'var(--bg-panel)', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Annual APY</span>
                <span style={{ fontWeight: 700, color: tier.color }}>{tier.apy}% / year</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Quarterly Yield</span>
                <span style={{ fontWeight: 700, color: tier.color }}>{tier.weeklyPct}% / quarter</span>
              </div>
              <div style={{ height: '1px', background: 'var(--border-light)', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Lock Period</span>
                <span style={{ fontWeight: 600 }}>{tier.days}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Est. Yield{tier.id === LOCK_PERIOD.FLEXIBLE ? ' (30d)' : ''}</span>
                <span style={{ fontWeight: 700, color: '#34d399' }}>+{estYield.toFixed(4)} {selectedToken?.symbol}</span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.5, borderTop: '1px dashed var(--border-light)', paddingTop: '8px' }}>
                💡 Fixed Deposit style: Longer lock period = higher annual return. Max 15%/year on the 12-month (Q4) plan.
              </div>
            </div>
          );
        })()}

        {/* Status Message */}
        {/* Status Message — always rendered to avoid layout shift & delay */}
        <div style={{
          padding: statusMsg ? '14px 16px' : '0',
          maxHeight: statusMsg ? '80px' : '0',
          overflow: 'hidden',
          borderRadius: '12px',
          marginBottom: statusMsg ? '12px' : '0',
          fontSize: '14px',
          fontWeight: 700,
          textAlign: 'center',
          background: step === 'done'
            ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(52,211,153,0.1))'
            : step === 'error'
            ? 'rgba(255,71,87,0.1)'
            : 'rgba(96,165,250,0.1)',
          border: statusMsg ? `1px solid ${step === 'done' ? '#10b981' : step === 'error' ? 'var(--danger)' : '#60a5fa'}` : 'none',
          color: step === 'done' ? '#10b981' : step === 'error' ? 'var(--danger)' : '#60a5fa',
          boxShadow: step === 'done' ? '0 4px 15px rgba(16,185,129,0.15)' : 'none',
          transition: 'all 0.25s ease',
        }}>
          {statusMsg}
        </div>

        {/* Deposit Button */}
        {!isRegistryDeployed ? (
          <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,193,7,0.08)', border: '1px solid #fbbf2440', fontSize: '13px', color: '#fbbf24', textAlign: 'center', lineHeight: 1.6 }}>
            ⚠️ Deploy the <strong>DepositRegistry</strong> contract first<br/>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>See <code>contracts/deploy-registry.js</code> for instructions</span>
          </div>
        ) : (
          <button
            onClick={step === 'done' ? () => { setStep('idle'); setStatusMsg(''); } : handleDeposit}
            disabled={step !== 'done' && (!amount || parseFloat(amount) <= 0 || step === 'approving' || step === 'registering')}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: step === 'done'
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : step === 'approving' || step === 'registering'
                ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                : (!amount || parseFloat(amount) <= 0)
                ? 'var(--bg-panel)'
                : 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: (!amount || parseFloat(amount) <= 0) && step !== 'done' ? 'var(--text-dim)' : '#fff',
              fontWeight: 800,
              fontSize: '15px',
              cursor: step === 'done' ? 'pointer' : (step === 'approving' || step === 'registering') ? 'wait' : (!amount || parseFloat(amount) <= 0) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: step === 'done' ? '0 4px 20px rgba(16,185,129,0.3)' : (!amount || parseFloat(amount) <= 0) ? 'none' : '0 4px 20px rgba(99,102,241,0.3)',
              letterSpacing: step === 'done' ? '0.5px' : '0',
            }}
          >
            {step === 'approving' ? '⏳ Approving — Confirm in MetaMask...' :
             step === 'registering' ? '⏳ Registering — Confirm in MetaMask...' :
             step === 'done' ? '🎉 Successfully Deposited! — Tap to deposit more' :
             isAlreadyApproved
             ? `⚡ Instant Deposit — ${(LOCK_TIERS.find(t => t.id === selectedTier) || LOCK_TIERS[0]).label}`
             : `${(LOCK_TIERS.find(t => t.id === selectedTier) || LOCK_TIERS[0]).icon} Deposit & Lock ${(LOCK_TIERS.find(t => t.id === selectedTier) || LOCK_TIERS[0]).label}`}
          </button>
        )}
      </div>

      {/* ── My Positions ── */}
      {activeDeposits.length > 0 && (
        <div className="swap-container" style={{ padding: '20px 24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>📊 My Positions ({activeDeposits.length})</h3>

          {/* Withdraw result message */}
          {withdrawMsg && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '14px',
              fontSize: '13px',
              fontWeight: 600,
              textAlign: 'center',
              background: withdrawMsg.startsWith('✅') ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(52,211,153,0.08))' : 'rgba(255,71,87,0.08)',
              border: `1px solid ${withdrawMsg.startsWith('✅') ? '#10b981' : 'var(--danger)'}`,
              color: withdrawMsg.startsWith('✅') ? '#10b981' : 'var(--danger)',
            }}>
              {withdrawMsg}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {deposits.map((dep, i) => dep.active && (
              <PositionCard
                key={i}
                dep={dep}
                index={i}
                address={address}
                currentNetworkId={currentNetworkId}
                onWithdraw={handleWithdraw}
                onClaimYield={handleClaimYield}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── How It Works ── */}
      <div className="swap-container" style={{ padding: '20px 24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-dim)' }}>ℹ️ How It Works</h3>
        {[
          { step: '1', text: 'Deposit any stablecoin and choose your lock period', icon: '💰' },
          { step: '2', text: 'Your funds power the market maker bot — providing swap liquidity and earning spread profits', icon: '🤖' },
          { step: '3', text: 'Bot shares 70% of trading profits as yield. Withdraw after lock expires — principal + yield returned to your wallet', icon: '💸' },
        ].map(s => (
          <div key={s.step} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{s.icon}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.6, paddingTop: '6px' }}>{s.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
