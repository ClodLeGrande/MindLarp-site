import {
  createSession,
  normalizeEmail,
  setSessionCookie,
  validEmail,
  verifyPassword,
} from '@/src/server/auth.js';
import { getStore } from '@/src/server/store.js';
import { consumeRateLimit } from '@/src/server/rate-limit.js';
import { formRedirect, readForm } from '@/src/server/responses.js';
import { checkSameOrigin } from '@/src/server/request-security.js';

export async function POST(request) {
  const originError = checkSameOrigin(request);
  if (originError) return originError;

  const rate = consumeRateLimit(request, 'login', { limit: 10, windowMs: 15 * 60_000 });
  if (!rate.allowed) return formRedirect(request, '/login?error=limit');

  const { body, error } = await readForm(request);
  if (error) return error;

  const email = normalizeEmail(body.get('email'));
  const password = body.get('password');
  if (!validEmail(email) || typeof password !== 'string' || !password || password.length > 1024) {
    return formRedirect(request, '/login?error=invalid');
  }

  const store = await getStore();
  const user = store.data.users.find((item) => normalizeEmail(item.email) === email);
  const valid = user?.passwordHash && user?.passwordSalt
    ? await verifyPassword(password, { hash: user.passwordHash, salt: user.passwordSalt })
    : false;

  if (!valid) return formRedirect(request, '/login?error=credentials');

  const session = await createSession(user.id);
  return setSessionCookie(formRedirect(request, '/console'), session.token);
}
