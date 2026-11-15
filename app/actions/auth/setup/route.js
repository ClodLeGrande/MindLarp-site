import { createPasswordUser, createSession, normalizeEmail, setSessionCookie, validEmail } from '@/src/server/auth.js';
import { consumeRateLimit } from '@/src/server/rate-limit.js';
import { formRedirect, readForm } from '@/src/server/responses.js';
import { getStore } from '@/src/server/store.js';

export async function POST(request) {
  const rate = consumeRateLimit(request, 'setup', { limit: 5, windowMs: 15 * 60_000 });
  if (!rate.allowed) return formRedirect(request, '/setup?error=limit');
  const { body, error } = await readForm(request);
  if (error) return error;
  const store = await getStore();
  if (store.data.users.length) return formRedirect(request, '/login');
  const displayName = String(body.get('displayName') || '').trim();
  const email = normalizeEmail(body.get('email'));
  const password = body.get('password');
  const valid = displayName && displayName.length <= 80 && validEmail(email) && typeof password === 'string' && password.length >= 12 && password.length <= 1024 && password === body.get('confirmPassword');
  if (!valid) return formRedirect(request, '/setup?error=invalid');
  const user = await createPasswordUser({ displayName, email, password });
  const session = await createSession(user.id);
  return setSessionCookie(formRedirect(request, '/console'), session.token);
}
