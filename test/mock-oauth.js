const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);

  if (url.hostname === 'oauth2.googleapis.com') {
    const code = new URLSearchParams(init.body).get('code') || 'oauth';
    return Response.json({ access_token: `mock-token-${code}`, token_type: 'Bearer' });
  }

  if (url.hostname === 'openidconnect.googleapis.com') {
    const token =
      String(init.headers?.Authorization || '').replace('Bearer mock-token-', '') || 'oauth';
    return Response.json({
      sub: `google-${token}`,
      email: token === 'unverified' ? 'victim@example.com' : `${token}@example.com`,
      email_verified: token !== 'unverified',
      name: `${token} OAuth User`,
    });
  }

  if (url.hostname === 'discord.com' && url.pathname === '/api/oauth2/token') {
    const code = new URLSearchParams(init.body).get('code') || 'oauth';
    return Response.json({ access_token: `mock-discord-${code}`, token_type: 'Bearer' });
  }

  if (url.hostname === 'discord.com' && url.pathname === '/api/users/@me') {
    const token =
      String(init.headers?.Authorization || '').replace('Bearer mock-discord-', '') || 'oauth';
    return Response.json({
      id: `discord-${token}`,
      email: token === 'unverified' ? 'victim@example.com' : `${token}@example.com`,
      verified: token !== 'unverified',
      username: `${token}-discord`,
      global_name: `${token} Discord User`,
    });
  }

  return originalFetch(input, init);
};
