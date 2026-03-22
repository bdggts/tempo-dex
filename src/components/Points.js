'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import {
  ensureUser, getUserData, getHistory, getLeaderboard,
  claimTwitterFollow, getReferralCount, walletToRefCode, POINT_ACTIONS
} from '@/lib/points';

const SITE_URL = 'https://tempo-dex.vercel.app';

function shortAddr(addr) {
  if (!addr) return '—';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function Points({ onConnect, pendingRef }) {
  const { address, isConnected } = useAccount();
  const [userData, setUserData]       = useState(null);
  const [history, setHistory]         = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading]         = useState(false);
  const [copied, setCopied]           = useState(false);
  const [twitterClaiming, setTwitterClaiming] = useState(false);
  const [twitterMsg, setTwitterMsg]   = useState('');

  const referralLink = address
    ? `${SITE_URL}?ref=${walletToRefCode(address)}`
    : '';

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    const [u, h, lb, rc] = await Promise.all([
      getUserData(address),
      getHistory(address, 12),
      getLeaderboard(10),
      getReferralCount(address),
    ]);
    setUserData(u);
    setHistory(h || []);
    setLeaderboard(lb || []);
    setReferralCount(rc);
    setLoading(false);
  }, [address]);

  useEffect(() => { if (isConnected) load(); }, [isConnected, load]);

  const copyRef = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitterClaim = async () => {
    if (!address) return;
    setTwitterClaiming(true);
    window.open('https://x.com/bdggts', '_blank');
    await new Promise(r => setTimeout(r, 2000));
    const ok = await claimTwitterFollow(address);
    if (ok) {
      setTwitterMsg('🎉 +30 points claimed!');
      load();
    } else {
      setTwitterMsg('Already claimed or error.');
    }
    setTwitterClaiming(false);
    setTimeout(() => setTwitterMsg(''), 4000);
  };

  const myRank = leaderboard.findIndex(u => u.wallet === address?.toLowerCase()) + 1;

  const RANK_EMOJI = ['🥇','🥈','🥉'];

  if (!isConnected) {
    return (
      <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out', textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>🏆</div>
        <h2 style={{ fontSize: '22px', marginBottom: '8px' }}>TEMPO Points</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1.6, maxWidth: '300px', margin: '0 auto 24px' }}>
          Earn points for every action. Points convert to <strong style={{ color: 'var(--brand-primary)' }}>TempoSwap tokens</strong> at TGE.
        </p>
        <button onClick={onConnect} style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: '14px', padding: '13px 28px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
          Connect Wallet to Start
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeInUp 0.4s ease-out' }}>

      {/* Header card */}
      <div className="swap-container" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(255,0,122,0.12), rgba(124,58,237,0.12))', border: '1px solid rgba(255,0,122,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Your TEMPO Points</div>
            <div style={{ fontSize: '48px', fontWeight: 900, background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
              {loading ? '...' : (userData?.points ?? 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '6px' }}>
              {myRank > 0 ? `Rank #${myRank}` : 'Unranked'} · Wallet: {shortAddr(address)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>Future Value</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#f59e0b' }}>→ $TEMPO</div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>At TGE Airdrop</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px' }}>
            <span>Progress to next tier</span>
            <span>{userData?.points ?? 0} / 500 pts</span>
          </div>
          <div style={{ height: '6px', borderRadius: '99px', background: 'var(--bg-card)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '99px', width: `${Math.min(100, ((userData?.points ?? 0) / 500) * 100)}%`, background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-secondary))', transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      {/* Earn Points Cards */}
      <div className="swap-container" style={{ padding: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>How to Earn</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {Object.entries(POINT_ACTIONS).map(([key, val]) => (
            <div key={key} style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '12px', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{val.label}</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--brand-primary)', marginLeft: '8px', whiteSpace: 'nowrap' }}>+{val.points}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Referral */}
      <div className="swap-container" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>🔗 Referral</div>
          <div style={{ fontSize: '13px', color: 'var(--brand-primary)', fontWeight: 700 }}>{referralCount} referred · +{referralCount * 50} pts</div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '10px' }}>
          Share your link — you get <strong style={{ color: '#fff' }}>50 pts</strong> per referral, they get <strong style={{ color: '#fff' }}>25 pts</strong> on signup.
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input readOnly value={referralLink}
            style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-dim)', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          />
          <button onClick={copyRef}
            style={{ background: copied ? 'var(--success)' : 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap', transition: 'background 0.2s' }}>
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Twitter Follow */}
      <div className="swap-container" style={{ padding: '16px', border: userData?.twitter_followed ? '1px solid var(--success)40' : '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>𝕏 Follow @bdggts</div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Follow on X (Twitter) and earn <strong style={{ color: '#f59e0b' }}>+30 points</strong></div>
            {twitterMsg && <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>{twitterMsg}</div>}
          </div>
          {userData?.twitter_followed
            ? <div style={{ padding: '8px 16px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', fontWeight: 700, fontSize: '13px', border: '1px solid var(--success)40' }}>✓ Claimed</div>
            : <button onClick={handleTwitterClaim} disabled={twitterClaiming}
                style={{ background: '#000', color: '#fff', border: '1px solid #333', borderRadius: '10px', padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', opacity: twitterClaiming ? 0.7 : 1 }}>
                {twitterClaiming ? 'Opening...' : '𝕏 Follow & Claim 30 pts'}
              </button>
          }
        </div>
      </div>

      {/* Leaderboard */}
      <div className="swap-container" style={{ padding: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>🏆 Leaderboard</div>
        {leaderboard.length === 0
          ? <div style={{ color: 'var(--text-dim)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>Be the first! Connect & start earning.</div>
          : leaderboard.map((u, i) => {
            const isMe = u.wallet === address?.toLowerCase();
            return (
              <div key={u.wallet} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: i < leaderboard.length - 1 ? '1px solid var(--border-light)' : 'none', background: isMe ? 'rgba(255,0,122,0.05)' : 'transparent', borderRadius: isMe ? '8px' : '0', paddingLeft: isMe ? '8px' : '0' }}>
                <div style={{ width: '28px', textAlign: 'center', fontSize: '18px' }}>{RANK_EMOJI[i] || `#${i + 1}`}</div>
                <div style={{ flex: 1, fontFamily: 'monospace', fontSize: '13px', color: isMe ? 'var(--brand-primary)' : 'var(--text-main)', fontWeight: isMe ? 700 : 400 }}>{shortAddr(u.wallet)}{isMe ? ' (you)' : ''}</div>
                <div style={{ fontWeight: 800, fontSize: '14px', color: '#fff' }}>{u.points?.toLocaleString()} <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 400 }}>pts</span></div>
              </div>
            );
          })
        }
      </div>

      {/* Recent activity */}
      {history.length > 0 && (
        <div className="swap-container" style={{ padding: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>Recent Activity</div>
          {history.map((h, i) => {
            const action = POINT_ACTIONS[h.action];
            return (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < history.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>{action?.label || h.action}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{new Date(h.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ fontWeight: 800, color: 'var(--success)', fontSize: '14px' }}>+{h.points}</div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
