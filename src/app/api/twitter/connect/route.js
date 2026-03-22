import { NextResponse } from 'next/server';
import crypto from 'crypto';

const CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/twitter/callback`
  : 'https://tempo-dex.vercel.app/api/twitter/callback';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet required' }, { status: 400 });
  }

  if (!CLIENT_ID) {
    return NextResponse.json({ error: 'Twitter not configured' }, { status: 500 });
  }

  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // State encodes wallet + verifier (simple base64 — not secret, just needs to survive redirect)
  const state = Buffer.from(JSON.stringify({ wallet, codeVerifier })).toString('base64url');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'users.read tweet.read',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
