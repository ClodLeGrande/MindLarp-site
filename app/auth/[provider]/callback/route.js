import { completeOAuth, oauthCookieName } from '@/src/oauth.js';
import { createSession, findOrCreateOAuthUser, setSessionCookie } from '@/src/server/auth.js';
import { formRedirect } from '@/src/server/responses.js';

export async function GET(request, { params }) {
  const { provider } = await params;
  if (!['google', 'github'].includes(provider)) return new Response('Not found', { status: 404 });
  const response = formRedirect(request, '/console');
  response.cookies.set(oauthCookieName(provider), '', { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 0 });
  try {
    const identity = await completeOAuth(provider, new URL(request.url), request.cookies.get(oauthCookieName(provider))?.value);
    const user = await findOrCreateOAuthUser(identity);
    const session = await createSession(user.id);
    return setSessionCookie(response, session.token);
  } catch (error) {
    console.error(`OAuth ${provider}: ${error.message}`);
    // request.url carries the bind address (0.0.0.0) under `next dev -H 0.0.0.0`;
    // redirect to the public origin instead.
    const requestUrl = new URL(request.url);
    const origin = process.env.PUBLIC_URL
      || `${request.headers.get('x-forwarded-proto') || requestUrl.protocol.replace(':', '')}://${request.headers.get('host') || requestUrl.host}`;
    const code = /already exists/.test(error.message) ? 'account-exists' : 'oauth';
    response.headers.set('Location', `${origin.replace(/\/$/, '')}/login?error=${code}`);
    return response;
  }
}
