import { createHash } from 'node:crypto';
import { randomToken } from './security.js';

const providers = {
  google: {
    clientId: 'GOOGLE_CLIENT_ID',
    clientSecret: 'GOOGLE_CLIENT_SECRET',
    redirect: 'https://oauth2.googleapis.com/token',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    profile: 'https://openidconnect.googleapis.com/v1/userinfo',
  },
  github: {
    clientId: 'GITHUB_CLIENT_ID',
    clientSecret: 'GITHUB_CLIENT_SECRET',
    redirect: 'https://github.com/login/oauth/access_token',
    authorize: 'https://github.com/login/oauth/authorize',
  },
  discord: {
    clientId: 'DISCORD_CLIENT_ID',
    clientSecret: 'DISCORD_CLIENT_SECRET',
    redirect: 'https://discord.com/api/oauth2/token',
    authorize: 'https://discord.com/oauth2/authorize',
    profile: 'https://discord.com/api/users/@me',
  },
};

function providerConfig(provider) {
  const config = providers[provider];
  if (!config) return null;
  return {
    ...config,
    id: process.env[config.clientId],
    secret: process.env[config.clientSecret],
  };
}

export function oauthCookieName(provider) {
  return `ml_oauth_${provider}`;
}

export function beginOAuth(provider) {
  const config = providerConfig(provider);
  if (!config?.id || !config.secret) return null;
  const state = randomToken(24);
  const verifier = randomToken(32);
  const redirectUri = `${process.env.PUBLIC_URL || 'http://localhost:5173'}/auth/${provider}/callback`;
  const payload = Buffer.from(JSON.stringify({ state, verifier })).toString('base64url');
  const params = new URLSearchParams({
    client_id: config.id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: provider === 'google' ? 'openid email profile' : provider === 'discord' ? 'identify email' : 'read:user user:email',
    state,
  });
  if (provider === 'google') {
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    params.set('code_challenge', challenge);
    params.set('code_challenge_method', 'S256');
  }
  return { authorizationUrl: `${config.authorize}?${params}`, payload };
}

export async function completeOAuth(provider, url, encoded) {
  if (!encoded) throw new Error('The sign-in attempt expired. Please try again.');
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!url.searchParams.get('code') || url.searchParams.get('state') !== payload.state) throw new Error('OAuth state validation failed. Please try again.');
  const config = providerConfig(provider);
  if (!config?.id || !config.secret) throw new Error('This sign-in provider is not configured.');
  const redirectUri = `${process.env.PUBLIC_URL || 'http://localhost:5173'}/auth/${provider}/callback`;
  const tokenParams = new URLSearchParams({
    client_id: config.id,
    client_secret: config.secret,
    code: url.searchParams.get('code'),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  if (provider === 'google') tokenParams.set('code_verifier', payload.verifier);
  const tokenResponse = await fetch(config.redirect, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: tokenParams,
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenResponse.ok) throw new Error('The provider did not accept the sign-in code.');
  const tokens = await tokenResponse.json();
  if (!tokens.access_token) throw new Error('The provider returned no access token.');
  const headers = { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json', 'User-Agent': 'MindLarp' };

  if (provider === 'google') {
    const response = await fetch(config.profile, { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Could not read the Google profile.');
    const profile = await response.json();
    if (!profile.email_verified || !profile.email) throw new Error('A verified Google email is required.');
    return { provider, providerId: String(profile.sub), email: profile.email.toLowerCase(), displayName: profile.name || profile.email.split('@')[0] };
  }

  if (provider === 'discord') {
    const response = await fetch(config.profile, { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Could not read the Discord profile.');
    const profile = await response.json();
    if (profile.verified !== true || !profile.email) throw new Error('A verified Discord email is required.');
    return {
      provider,
      providerId: String(profile.id),
      email: profile.email.toLowerCase(),
      displayName: profile.global_name || profile.username || profile.email.split('@')[0],
    };
  }

  const [userResponse, emailResponse] = await Promise.all([
    fetch('https://api.github.com/user', { headers, signal: AbortSignal.timeout(15000) }),
    fetch('https://api.github.com/user/emails', { headers, signal: AbortSignal.timeout(15000) }),
  ]);
  if (!userResponse.ok || !emailResponse.ok) throw new Error('Could not read the GitHub profile.');
  const profile = await userResponse.json();
  const emails = await emailResponse.json();
  const email = emails.find((item) => item.primary && item.verified) || emails.find((item) => item.verified);
  if (!email) throw new Error('A verified GitHub email is required.');
  return { provider, providerId: String(profile.id), email: email.email.toLowerCase(), displayName: profile.name || profile.login };
}
