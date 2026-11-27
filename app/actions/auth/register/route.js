import {
  createPasswordUser,
  createSession,
  normalizeEmail,
  setSessionCookie,
  validEmail,
} from '@/src/server/auth.js';
import { getStore } from '@/src/server/store.js';
import { consumeRateLimit } from '@/src/server/rate-limit.js';
import { formRedirect, readForm } from '@/src/server/responses.js';
import { checkSameOrigin } from '@/src/server/request-security.js';

export async function POST(request) {
  const originError = checkSameOrigin(request);
  if (originError) return originError;

  const rate = consumeRateLimit(request, 'register', { limit: 5, windowMs: 15 * 60_000 });
  if (!rate.allowed) return formRedirect(request, '/register?error=limit');

  const { body, error } = await readForm(request);
  if (error) return error;

  const displayName = String(body.get('displayName') || '').trim();
  const email = normalizeEmail(body.get('email'));
  const password = body.get('password');
  const valid = displayName && displayName.length <= 80 && validEmail(email)
    && typeof password === 'string' && password.length >= 12 && password.length <= 1024
    && password === body.get('confirmPassword');

  if (!valid) return formRedirect(request, '/register?error=invalid');
  if (body.get('consent') !== 'accepted') return formRedirect(request, '/register?error=consent');

  const store = await getStore();
  if (!store.data.users.length) return formRedirect(request, '/setup');

  const user = await createPasswordUser({ displayName, email, password, requireExistingUser: true });
  if (!user) return formRedirect(request, '/register?error=exists');

  const session = await createSession(user.id);
  return setSessionCookie(formRedirect(request, '/console'), session.token);
}
