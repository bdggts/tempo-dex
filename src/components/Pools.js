'use client';
import { useState, useEffect } from 'react';
import { useAccount, useConnect, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import {
  TOKENS, ERC20_ABI, VAULT_ADDRESS, VAULT_ABI, VAULT_LOCK_TIER,
  VAULT_LOCK_DAYS, VAULT_BOOST, getTokensForChain,
} from '@/config/web3';
import { DropletIcon, LockIcon, UnlockIcon, TrophyIcon, ZapIcon, CheckCircleIcon, XCircleIcon, WarningIcon, CoinsIcon } from '@/components/Icons';

// ─── Lock Tier UI Config ───────────────────────────────────────────────────────
const LOCK_TIERS = [
  { id: VAULT_LOCK_TIER.FLEXIBLE, label: 'Flexible',  days: 'No lock',  boost: '1.0x', color: '#94a3b8', desc: 'Withdraw anytime' },
  { id: VAULT_LOCK_TIER.SILVER,   label: 'Silver',    days: '30 days',  boost: '1.2x', color: '#cbd5e1', desc: '+20% reward boost' },
  { id: VAULT_LOCK_TIER.GOLD,     label: 'Gold',      days: '90 days',  boost: '1.5x', color: '#fbbf24', desc: '+50% reward boost' },
  { id: VAULT_LOCK_TIER.DIAMOND,  label: 'Diamond',   days: '180 days', boost: '2.0x', color: '#818cf8', desc: 'Double rewards' },
];

export default function Pools({ currentNetworkId, onConnect }) {
  const { address, isConnected } = useAccount();
  const vaultAddr = VAULT_ADDRESS[currentNetworkId];
  const quoteToken = getTokensForChain(currentNetworkId).find(t => t.isQuoteToken);

  const [selectedToken, setSelectedToken] = useState(quoteToken || null);
  const [amount, setAmount] = useState('');
  const [lockTier, setLockTier] = useState(VAULT_LOCK_TIER.FLEXIBLE);
  const [txError, setTxError] = useState('');

  // Read pool stats
  const { data: poolTVL } = useReadContract({
    address: vaultAddr, abi: VAULT_ABI, functionName: 'getPoolTVL',
    args: selectedToken ? [selectedToken.address] : undefined,
    query: { enabled: !!selectedToken && !!vaultAddr, refetchInterval: 10000 },
    chainId: currentNetworkId,
  });

  const { data: totalShares } = useReadContract({
    address: vaultAddr, abi: VAULT_ABI, functionName: 'totalBoostedShares',
    query: { enabled: !!vaultAddr, refetchInterval: 10000 },
    chainId: currentNetworkId,
  });

  const { data: isPaused } = useReadContract({
    address: vaultAddr, abi: VAULT_ABI, functionName: 'paused',
    query: { enabled: !!vaultAddr },
    chainId: currentNetworkId,
  });

  // User deposit count
  const { data: depositCount } = useReadContract({
    address: vaultAddr, abi: VAULT_ABI, functionName: 'getUserDepositCount',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!vaultAddr, refetchInterval: 10000 },
    chainId: currentNetworkId,
  });

  // User token balance
  const { data: userBalance } = useReadContract({
    address: selectedToken?.address, abi: ERC20_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!selectedToken, refetchInterval: 5000 },
    chainId: currentNetworkId,
  });

  // Allowance
  const { data: allowance } = useReadContract({
    address: selectedToken?.address, abi: ERC20_ABI, functionName: 'allowance',
    args: address && vaultAddr ? [address, vaultAddr] : undefined,
    query: { enabled: !!address && !!selectedToken && !!vaultAddr, refetchInterval: 5000 },
    chainId: currentNetworkId,
  });

  const parsedAmount = amount ? parseUnits(amount, selectedToken?.decimals || 6) : 0n;
  const needsApproval = allowance !== undefined && parsedAmount > 0n && allowance < parsedAmount;

  // Write hooks
  const { writeContract, data: txHash, isPending } = useWriteContract({
    mutation: { onError: (err) => { setTxError(err?.shortMessage || 'Transaction failed'); setTimeout(() => setTxError(''), 6000); } }
  });
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { writeContract: writeApprove, data: approveTxHash, isPending: isApproving } = useWriteContract();
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const handleApprove = () => {
    writeApprove({
      address: selectedToken.address, abi: ERC20_ABI, chainId: currentNetworkId,
      functionName: 'approve',
      args: [vaultAddr, 115792089237316195423570985008687907853269984665640564039457584007913129639935n],
    });
  };

  const handleDeposit = () => {
    if (!isConnected) { onConnect(); return; }
    if (!parsedAmount || parsedAmount === 0n) return;
    setTxError('');
    writeContract({
      address: vaultAddr, abi: VAULT_ABI, chainId: currentNetworkId,
      functionName: 'deposit',
      args: [selectedToken.address, parsedAmount, lockTier],
    });
  };

  const formatBal = (raw, decimals = 6) => {
    if (raw == null) return '0';
    const val = parseFloat(formatUnits(raw, decimals));
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const handlePct = (pct) => {
    if (!userBalance) return;
    const portion = (userBalance * BigInt(pct)) / 100n;
    const val = parseFloat(formatUnits(portion, selectedToken?.decimals || 6));
    setAmount(val % 1 === 0 ? val.toString() : val.toFixed(2));
  };

  const selectedTier = LOCK_TIERS.find(t => t.id === lockTier);
  const isVaultLive = vaultAddr && vaultAddr !== '0x0000000000000000000000000000000000000000';

  return (
    <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out', maxWidth: '600px' }}>

      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-glass)' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.02em' }}>
          <DropletIcon size={20}/> Liquidity Pools
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Provide liquidity to the TempoSwap orderbook. Your funds are deployed as market-making orders by our automated bot.
          Earn spread revenue proportional to your share.
        </p>
      </div>

      {/* Pool Stats Banner */}
      <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', borderBottom: '1px solid var(--border-glass)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Total Locked</div>
          <div style={{ fontSize: '20px', fontWeight: 800, background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ${isVaultLive ? formatBal(poolTVL) : '—'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Pool APY</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)' }}>
            ~4.2%
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Active LPs</div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>
            {isVaultLive && totalShares ? (totalShares > 0n ? '•' : '0') : '—'}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Vault Not Deployed Notice */}
        {!isVaultLive && (
          <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <WarningIcon size={18} color="#fbbf24"/>
            <span style={{ fontSize: '13px', color: '#fbbf24', fontWeight: 600 }}>
              Liquidity Vault contract is not yet deployed on this network. Coming soon!
            </span>
          </div>
        )}

        {/* Lock Tier Selector */}
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lock Period & Boost</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {LOCK_TIERS.map(tier => (
              <button
                key={tier.id}
                onClick={() => setLockTier(tier.id)}
                style={{
                  padding: '12px 8px', borderRadius: '14px', cursor: 'pointer',
                  background: lockTier === tier.id ? `${tier.color}15` : 'var(--bg-input)',
                  border: `1px solid ${lockTier === tier.id ? `${tier.color}60` : 'var(--border-glass)'}`,
                  color: lockTier === tier.id ? tier.color : 'var(--text-dim)',
                  transition: 'all 0.2s', textAlign: 'center',
                  boxShadow: lockTier === tier.id ? `0 0 12px ${tier.color}20` : 'none',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '2px' }}>{tier.boost}</div>
                <div style={{ fontSize: '10px', fontWeight: 600 }}>{tier.label}</div>
                <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>{tier.days}</div>
              </button>
            ))}
          </div>
          {selectedTier && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: selectedTier.color, fontWeight: 600, textAlign: 'center' }}>
              {selectedTier.desc}
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
            Deposit Amount ({selectedToken?.symbol || 'pUSD'})
          </label>
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
            disabled={!isVaultLive}
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', padding: '14px 16px', borderRadius: '14px', fontSize: '22px', fontWeight: 700, outline: 'none', transition: 'border-color 0.2s' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
              Balance: <strong>{formatBal(userBalance, selectedToken?.decimals || 6)}</strong> {selectedToken?.symbol}
            </span>
            {userBalance && userBalance > 0n && (
              <div style={{ display: 'flex', gap: '4px' }}>
                {[25, 50, 75, 100].map(pct => (
                  <button key={pct} onClick={() => handlePct(pct)}
                    style={{ background: 'rgba(255,0,122,0.08)', color: 'var(--brand-primary)', border: '1px solid rgba(255,0,122,0.2)', borderRadius: '8px', padding: '2px 7px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                  >{pct}%</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Estimated Yield Info */}
        {parsedAmount > 0n && (
          <div style={{ padding: '12px 16px', borderRadius: '14px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Boost Multiplier</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: selectedTier?.color }}>{selectedTier?.boost}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Lock Period</span>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>{selectedTier?.days}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Estimated APY (with boost)</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--success)' }}>
                ~{(4.2 * VAULT_BOOST[lockTier]).toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {txError && (
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', fontSize: '13px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <XCircleIcon size={16} color="var(--danger)"/> {txError}
          </div>
        )}

        {/* Success */}
        {isSuccess && (
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', fontSize: '13px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircleIcon size={16} color="var(--success)"/> Liquidity added successfully!
          </div>
        )}

        {/* Action Button */}
        {!isConnected ? (
          <button className="btn-primary" onClick={onConnect}>Connect Wallet</button>
        ) : !isVaultLive ? (
          <button className="btn-primary" disabled style={{ opacity: 0.5 }}>Vault Not Deployed Yet</button>
        ) : isPaused ? (
          <button className="btn-primary" disabled style={{ opacity: 0.5 }}>Vault Paused</button>
        ) : needsApproval ? (
          <button className="btn-primary" onClick={handleApprove} disabled={isApproving || isApproveConfirming}>
            {isApproving ? 'Confirm in wallet...' : isApproveConfirming ? 'Approving...' : `Approve ${selectedToken?.symbol}`}
          </button>
        ) : (
          <button className="btn-primary" onClick={handleDeposit} disabled={isPending || isConfirming || !parsedAmount || parsedAmount === 0n}>
            {isPending ? 'Confirm in wallet...' : isConfirming ? 'Depositing...' : !amount ? 'Enter Amount' : `Add Liquidity (${selectedTier?.boost} boost)`}
          </button>
        )}
      </div>

      {/* Your Positions */}
      {isConnected && isVaultLive && depositCount && depositCount > 0n && (
        <div style={{ padding: '20px', borderTop: '1px solid var(--border-glass)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CoinsIcon size={16}/> Your Positions
            <span style={{ fontSize: '11px', background: 'rgba(255,0,122,0.1)', color: 'var(--brand-primary)', padding: '2px 8px', borderRadius: '20px', fontWeight: 700, marginLeft: 'auto' }}>
              {depositCount.toString()} Active
            </span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Array.from({ length: Number(depositCount) }, (_, i) => (
              <PositionCard key={i} index={i} vaultAddr={vaultAddr} address={address} currentNetworkId={currentNetworkId} />
            ))}
          </div>
        </div>
      )}

      {/* How It Works */}
      <div style={{ padding: '20px', borderTop: '1px solid var(--border-glass)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ZapIcon size={16}/> How It Works
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { step: '1', text: 'Deposit pUSD into the Liquidity Vault', icon: '💰' },
            { step: '2', text: 'Our bot places buy & sell orders on the Tempo orderbook', icon: '🤖' },
            { step: '3', text: 'When traders swap, your orders fill — earning the bid-ask spread', icon: '📈' },
            { step: '4', text: 'Spread revenue is distributed proportional to your boosted share', icon: '💎' },
          ].map(item => (
            <div key={item.step} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,0,122,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: 'var(--brand-primary)', flexShrink: 0 }}>{item.step}</div>
              <span style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.4 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Position Card Sub-Component ───────────────────────────────────────────────
function PositionCard({ index, vaultAddr, address, currentNetworkId }) {
  const { data: deposit } = useReadContract({
    address: vaultAddr, abi: VAULT_ABI, functionName: 'getUserDeposit',
    args: [address, BigInt(index)],
    query: { enabled: !!address, refetchInterval: 10000 },
    chainId: currentNetworkId,
  });

  const { data: pendingRewards } = useReadContract({
    address: vaultAddr, abi: VAULT_ABI, functionName: 'pendingRewards',
    args: [address, BigInt(index)],
    query: { enabled: !!address, refetchInterval: 10000 },
    chainId: currentNetworkId,
  });

  const { writeContract, isPending } = useWriteContract();

  if (!deposit || !deposit[7]) return null; // not active

  const token = Object.values(TOKENS).find(t => t.address.toLowerCase() === deposit[0].toLowerCase());
  const amount = deposit[1];
  const tier = LOCK_TIERS[deposit[3]] || LOCK_TIERS[0];
  const unlockTime = Number(deposit[5]);
  const now = Math.floor(Date.now() / 1000);
  const isLocked = unlockTime > 0 && unlockTime > now;
  const daysLeft = isLocked ? Math.ceil((unlockTime - now) / 86400) : 0;
  const rewardsFloat = pendingRewards ? parseFloat(formatUnits(pendingRewards, token?.decimals || 6)) : 0;

  return (
    <div style={{
      padding: '14px', borderRadius: '14px',
      background: 'var(--bg-card)', border: `1px solid ${tier.color}25`,
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLocked ? <LockIcon size={16} color={tier.color}/> : <UnlockIcon size={16} color={tier.color}/>}
          <span style={{ fontWeight: 700, fontSize: '14px' }}>{parseFloat(formatUnits(amount, token?.decimals || 6)).toLocaleString()} {token?.symbol}</span>
        </div>
        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: `${tier.color}15`, color: tier.color, fontWeight: 700 }}>
          {tier.label} · {tier.boost}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '10px' }}>
        <span>Earned: <strong style={{ color: 'var(--success)' }}>+{rewardsFloat.toFixed(4)} {token?.symbol}</strong></span>
        {isLocked && <span>Unlocks in <strong style={{ color: tier.color }}>{daysLeft}d</strong></span>}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => writeContract({ address: vaultAddr, abi: VAULT_ABI, functionName: 'claimRewards', args: [BigInt(index)], chainId: currentNetworkId })}
          disabled={isPending || rewardsFloat < 0.0001}
          style={{ flex: 1, padding: '8px', borderRadius: '10px', border: '1px solid var(--border-glass)', background: 'var(--bg-input)', color: rewardsFloat >= 0.0001 ? 'var(--success)' : 'var(--text-dim)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
        >Claim</button>
        <button
          onClick={() => writeContract({ address: vaultAddr, abi: VAULT_ABI, functionName: isLocked ? 'emergencyWithdraw' : 'withdraw', args: [BigInt(index)], chainId: currentNetworkId })}
          disabled={isPending}
          style={{ flex: 1, padding: '8px', borderRadius: '10px', border: `1px solid ${isLocked ? 'rgba(244,63,94,0.3)' : 'var(--border-glass)'}`, background: isLocked ? 'rgba(244,63,94,0.06)' : 'var(--bg-input)', color: isLocked ? 'var(--danger)' : 'var(--text-main)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
        >{isLocked ? 'Emergency Exit' : 'Withdraw'}</button>
      </div>
    </div>
  );
}
