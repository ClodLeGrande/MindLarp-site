import {
  createSession,
  normalizeEmail,
  setSessionCookie,
  verifyPassword,
} from '@/src/server/auth.js';
import {
  clearRateLimit,
  consumeRateLimit,
} from '@/src/server/rate-limit.js';
import {
  formRedirect,
  readForm,
} from '@/src/server/responses.js';
import { getStore } from '@/src/server/store.js';
import { checkSameOrigin } from '@/src/server/request-security.js';

export async function POST(request) {
  const originError = checkSameOrigin(request);
if (originError) return originError;
  const rate = consumeRateLimit(request, 'login', {
    limit: 10,
    windowMs: 5 * 60_000,
  });

  if (!rate.allowed) {
    return formRedirect(request, '/login?error=limit');
  }

  const { body, error } = await readForm(request);

  if (error) return error;

  const store = await getStore();

  const email = normalizeEmail(body.get('email'));
  const password = body.get('password');

  const user = store.data.users.find(
    (item) => normalizeEmail(item.email) === email
  );

  const valid =
    Boolean(user?.passwordHash) &&
    typeof password === 'string' &&
    password.length <= 1024 &&
    await verifyPassword(
      password,
      user.passwordSalt,
      user.passwordHash
    );

  if (!valid) {
    return formRedirect(
  request,
  '/login?error=credentials&email=' + encodeURIComponent(email)
);
  }

  clearRateLimit(request, 'login');

  const session = await createSession(user.id);

  return setSessionCookie(
    formRedirect(request, '/console'),
    session.token
  );
}

