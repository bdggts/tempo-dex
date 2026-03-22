import { supabase } from '@/config/supabase';

// ─── Point values ────────────────────────────────────────────────────────────
export const POINT_ACTIONS = {
  WALLET_CONNECT:   { points: 50,  label: 'First wallet connect'   },
  SWAP:             { points: 10,  label: 'Swap transaction'        },
  ORDER:            { points: 15,  label: 'Limit order placed'      },
  EARN:             { points: 20,  label: 'Liquidity / earn action' },
  REFERRAL_SIGNUP:  { points: 25,  label: 'Signed up via referral'  },
  REFERRAL_GIVEN:   { points: 50,  label: 'Referred a new user'     },
  TWITTER_FOLLOW:   { points: 30,  label: 'Followed @bdggts on X'   },
  DAILY_LOGIN:      { points: 5,   label: 'Daily login bonus'       },
};

// ─── Generate referral code from wallet ──────────────────────────────────────
export function walletToRefCode(wallet) {
  return wallet?.slice(2, 10).toUpperCase() || '';
}

// ─── Ensure user exists in DB ────────────────────────────────────────────────
export async function ensureUser(wallet, referredByCode = null) {
  if (!wallet) return null;
  const ref_code = walletToRefCode(wallet);

  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('wallet', wallet.toLowerCase())
    .single();

  if (existing) {
    // Update last_seen
    await supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('wallet', wallet.toLowerCase());
    return { user: existing, isNew: false };
  }

  // New user
  let referred_by = null;
  if (referredByCode) {
    const { data: referrer } = await supabase
      .from('users')
      .select('wallet')
      .eq('referral_code', referredByCode.toUpperCase())
      .single();
    if (referrer) referred_by = referrer.wallet;
  }

  const { data: newUser } = await supabase
    .from('users')
    .insert({ wallet: wallet.toLowerCase(), referral_code: ref_code, referred_by })
    .select()
    .single();

  return { user: newUser, isNew: true, referredBy: referred_by };
}

// ─── Award points ─────────────────────────────────────────────────────────────
export async function awardPoints(wallet, actionKey, txHash = null) {
  if (!wallet) return;
  const action = POINT_ACTIONS[actionKey];
  if (!action) return;

  // Prevent duplicate tx rewards
  if (txHash) {
    const { data: dup } = await supabase
      .from('points_history')
      .select('id')
      .eq('tx_hash', txHash)
      .single();
    if (dup) return;
  }

  // Insert history row
  await supabase.from('points_history').insert({
    wallet: wallet.toLowerCase(),
    action: actionKey,
    points: action.points,
    tx_hash: txHash,
  });

  // Add to user total
  await supabase.rpc('increment_points', { user_wallet: wallet.toLowerCase(), pts: action.points });
}

// ─── Get user data ────────────────────────────────────────────────────────────
export async function getUserData(wallet) {
  if (!wallet) return null;
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('wallet', wallet.toLowerCase())
    .single();
  return data;
}

// ─── Get points history ───────────────────────────────────────────────────────
export async function getHistory(wallet, limit = 10) {
  if (!wallet) return [];
  const { data } = await supabase
    .from('points_history')
    .select('*')
    .eq('wallet', wallet.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

// ─── Get leaderboard ─────────────────────────────────────────────────────────
export async function getLeaderboard(limit = 10) {
  const { data } = await supabase
    .from('users')
    .select('wallet, points, referral_code')
    .order('points', { ascending: false })
    .limit(limit);
  return data || [];
}

// ─── Claim Twitter follow ─────────────────────────────────────────────────────
export async function claimTwitterFollow(wallet) {
  if (!wallet) return false;
  const user = await getUserData(wallet);
  if (!user || user.twitter_followed) return false;

  await supabase
    .from('users')
    .update({ twitter_followed: true })
    .eq('wallet', wallet.toLowerCase());

  await awardPoints(wallet, 'TWITTER_FOLLOW');
  return true;
}

// ─── Check daily login ────────────────────────────────────────────────────────
export async function checkDailyLogin(wallet) {
  if (!wallet) return false;
  const user = await getUserData(wallet);
  if (!user) return false;

  const lastSeen = new Date(user.last_seen);
  const now = new Date();
  const diffHours = (now - lastSeen) / (1000 * 60 * 60);

  if (diffHours >= 20) {
    await awardPoints(wallet, 'DAILY_LOGIN');
    return true;
  }
  return false;
}

// ─── Get referral stats ───────────────────────────────────────────────────────
export async function getReferralCount(wallet) {
  if (!wallet) return 0;
  const { count } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('referred_by', wallet.toLowerCase());
  return count || 0;
}
