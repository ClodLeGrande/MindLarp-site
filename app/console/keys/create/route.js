import { randomUUID } from 'node:crypto';
import { requireUser, requireCsrf, randomToken, hashToken } from '@/src/server/auth.js';
import { htmlResponse } from '@/src/server/html.jsx';
import { keysContent } from '@/src/views/console.js';
import { notFoundContent } from '@/src/views/public.js';
import { getStore } from '@/src/server/store.js';

export async function POST(request) {
  const auth = await requireUser();
  const body = await request.formData();
  if (!requireCsrf(Object.fromEntries(body), auth)) return htmlResponse(notFoundContent(), 'Forbidden', 403);
  const { user, session } = auth;
  const store = await getStore();
  const name = String(body.get('name') || '').trim();
  const scopes = body.getAll('scopes').filter((scope) => ['models:read', 'inference:write'].includes(scope));
  const expires = body.get('expires');
  let error = '';
  if (!name || name.length > 60) error = 'Key name must contain between 1 and 60 characters.';
  else if (!scopes.length) error = 'Select at least one permission.';
  else if (!['never', '30', '90', '365'].includes(expires)) error = 'Choose a valid expiration period.';
  const keys = store.data.keys.filter((key) => key.userId === user.id);
  if (error) return htmlResponse(keysContent({ user, csrf: session.csrf, keys, error, openCreate: true }), 'API keys', 400, { user, csrf: session.csrf, path: '/console/keys' });
  const secret = `ml_sk_live_${randomToken(32)}`;
  const key = { id: randomUUID(), userId: user.id, name, hash: hashToken(secret), prefix: secret.slice(0, 15), lastFour: secret.slice(-4), scopes, expiresAt: expires === 'never' ? null : new Date(Date.now() + Number(expires) * 86400000).toISOString(), createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null };
  await store.update((data) => { data.keys.push(key); });
  return htmlResponse(keysContent({ user, csrf: session.csrf, keys: [key, ...keys], createdKey: { ...key, secret } }), 'API keys', 201, { user, csrf: session.csrf, path: '/console/keys' });
}
