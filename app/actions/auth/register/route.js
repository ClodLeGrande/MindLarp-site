import { createPasswordUser, createSession, normalizeEmail, setSessionCookie, validEmail } from '@/src/server/auth.js';
import { consumeRateLimit } from '@/src/server/rate-limit.js';
import { formRedirect, readForm } from '@/src/server/responses.js';
import { getStore } from '@/src/server/store.js';

export async function POST(request) {
  const rate = consumeRateLimit(request, 'register', { limit: 5, windowMs: 60 * 60_000 });
  if (!rate.allowed) return formRedirect(request, '/register?error=limit');
  const { body, error } = await readForm(request);
  if (error) return error;
  const store = await getStore();
  if (!store.data.users.length) return formRedirect(request, '/setup');
  const displayName = String(body.get('displayName') || '').trim();
  const email = normalizeEmail(body.get('email'));
  const password = body.get('password');
  const returnTo = `/register?displayName=${encodeURIComponent(displayName)}&email=${encodeURIComponent(email)}`;
  if (!displayName || displayName.length > 80 || !validEmail(email) || typeof password !== 'string' || password.length < 12 || password.length > 1024 || password !== body.get('confirmPassword')) return formRedirect(request, `${returnTo}&error=invalid`);
  if (store.data.users.some((item) => item.email === email)) return formRedirect(request, `${returnTo}&error=exists`);
  const user = await createPasswordUser({ displayName, email, password });
  const session = await createSession(user.id);
  return setSessionCookie(formRedirect(request, '/console'), session.token);
}
