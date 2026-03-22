import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CLIENT_ID     = process.env.TWITTER_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const REDIRECT_URI  = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/twitter/callback`
  : 'https://tempo-dex.vercel.app/api/twitter/callback';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tempo-dex.vercel.app';

const supabase = createClient(
  'https://wsczprzbpkjcloxlvfaz.supabase.co',
  'sb_publishable_HGchuOQPhbS0MvT43ahVvw_Q3yRHzG6'
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Twitter OAuth denied
  if (error || !code || !state) {
    return NextResponse.redirect(`${SITE_URL}/?tab=points&twitter=error`);
  }

  // Decode state
  let wallet, codeVerifier;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    wallet = decoded.wallet;
    codeVerifier = decoded.codeVerifier;
  } catch {
    return NextResponse.redirect(`${SITE_URL}/?tab=points&twitter=error`);
  }

  if (!wallet || !codeVerifier) {
    return NextResponse.redirect(`${SITE_URL}/?tab=points&twitter=error`);
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${SITE_URL}/?tab=points&twitter=error`);
  }

  // Get Twitter user info
  const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const userData = await userRes.json();
  const twitterUser = userData?.data;

  if (!twitterUser?.username) {
    return NextResponse.redirect(`${SITE_URL}/?tab=points&twitter=error`);
  }

  // Check if this Twitter account is already linked to another wallet (anti-sybil)
  const { data: existingLink } = await supabase
    .from('users')
    .select('wallet')
    .eq('twitter_username', twitterUser.username.toLowerCase())
    .neq('wallet', wallet.toLowerCase())
    .single();

  if (existingLink) {
    // Already linked to another wallet — block
    return NextResponse.redirect(`${SITE_URL}/?tab=points&twitter=duplicate`);
  }

  // Save Twitter info and mark as followed
  const { data: user } = await supabase
    .from('users')
    .select('twitter_followed')
    .eq('wallet', wallet.toLowerCase())
    .single();

  const alreadyFollowed = user?.twitter_followed === true;

  await supabase
    .from('users')
    .update({
      twitter_username:   twitterUser.username.toLowerCase(),
      twitter_name:       twitterUser.name,
      twitter_avatar:     twitterUser.profile_image_url,
      twitter_followed:   true,
    })
    .eq('wallet', wallet.toLowerCase());

  // Award points only if not already claimed
  if (!alreadyFollowed) {
    const TWITTER_POINTS = 30;
    await supabase.from('points_history').insert({
      wallet: wallet.toLowerCase(),
      action: 'TWITTER_FOLLOW',
      points: TWITTER_POINTS,
    });
    await supabase.rpc('increment_points', {
      user_wallet: wallet.toLowerCase(),
      pts: TWITTER_POINTS,
    });

    // Try referral unlock now that Twitter is done
    const { data: fullUser } = await supabase
      .from('users')
      .select('*')
      .eq('wallet', wallet.toLowerCase())
      .single();

    if (fullUser?.referred_by && !fullUser?.referral_unlocked) {
      const { data: txs } = await supabase
        .from('points_history')
        .select('id')
        .eq('wallet', wallet.toLowerCase())
        .in('action', ['SWAP', 'ORDER', 'EARN'])
        .limit(1);

      if (txs && txs.length > 0) {
        await supabase.from('users').update({ referral_unlocked: true }).eq('wallet', wallet.toLowerCase());
        await supabase.from('points_history').insert({ wallet: wallet.toLowerCase(), action: 'REFERRAL_SIGNUP', points: 25 });
        await supabase.rpc('increment_points', { user_wallet: wallet.toLowerCase(), pts: 25 });
        await supabase.from('points_history').insert({ wallet: fullUser.referred_by, action: 'REFERRAL_GIVEN', points: 50 });
        await supabase.rpc('increment_points', { user_wallet: fullUser.referred_by, pts: 50 });
      }
    }
  }

  return NextResponse.redirect(`${SITE_URL}/?tab=points&twitter=success&username=@${twitterUser.username}`);
}
