import { NextResponse } from 'next/server';
import { beginOAuth, oauthCookieName } from '@/src/oauth.js';
import { brandIcon, escapeHtml } from '@/src/html.js';
import { htmlResponse } from '@/src/server/html.jsx';
import { formRedirect, readForm } from '@/src/server/responses.js';
import { checkSameOrigin } from '@/src/server/request-security.js';

const providers = ['google', 'github', 'discord'];
const providerLabel = { google: 'Google', github: 'GitHub', discord: 'Discord' };

export async function POST(request, context) {
  const originError = checkSameOrigin(request);
  if (originError) return originError;
  const { body, error } = await readForm(request);
  if (error) return error;
  if (body.get('consent') !== 'accepted') return formRedirect(request, '/login?error=consent');
  return GET(request, context);
}

export async function GET(request, { params }) {
  const { provider } = await params;
  if (!providers.includes(provider)) return new Response('Not found', { status: 404 });
  const oauth = beginOAuth(provider);
  if (!oauth) {
    const error = `${providerLabel[provider]} sign-in is not configured on this server.`;
    const content = `<section class="auth-shell">
    <div class="auth-aside">
      <a href="/" class="auth-back">← Back to MindLarp</a>
      <div><span class="section-kicker">YOUR WORKSPACE</span><h1>A place for<br>your next idea<span class="accent-dot">.</span></h1></div>
      <p>One account. Every model.<br>Chat, API, usage, and billing.</p>
    </div>
    <div class="auth-form-wrap"><div class="auth-form">
      <span class="section-kicker">WELCOME BACK</span>
      <h2>Sign in to MindLarp</h2>
      <p>Continue securely with a connected account.</p>
      <div class="alert error" role="alert">${escapeHtml(error)}</div>
      <div class="oauth-buttons">
        <a class="oauth-button" href="/auth/google">${brandIcon('google')}Google</a>
        <a class="oauth-button" href="/auth/github">${brandIcon('github')}GitHub</a>
        <a class="oauth-button" href="/auth/discord">${brandIcon('discord')}Discord</a>
      </div>
      <p class="auth-hint">Email and password sign-in are no longer available.</p>
    </div></div>
  </section>`;
    return htmlResponse(content, 'Sign in', 503, { bodyClass: 'auth-page', path: '/console' });
  }
  const response = NextResponse.redirect(oauth.authorizationUrl, 302);
  response.cookies.set(oauthCookieName(provider), oauth.payload, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
  });
  return response;
}
