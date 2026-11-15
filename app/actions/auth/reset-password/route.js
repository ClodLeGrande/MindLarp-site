import { hashPassword, hashToken, safeEqual, setSessionCookie } from '@/src/server/auth.js';
import { consumeRateLimit } from '@/src/server/rate-limit.js';
import { formRedirect, readForm } from '@/src/server/responses.js';
import { getStore } from '@/src/server/store.js';

export async function POST(request) {
  const rate = consumeRateLimit(request, 'password-reset', { limit: 10, windowMs: 15 * 60_000 });
  if (!rate.allowed) return formRedirect(request, '/reset-password?error=limit');
  const { body, error } = await readForm(request);
  if (error) return error;
  const token = String(body.get('token') || '');
  const store = await getStore();
  const reset = token && store.data.passwordResets.find((item) => Date.parse(item.expiresAt) > Date.now() && safeEqual(item.tokenHash, hashToken(token)));
  const user = reset && store.data.users.find((item) => item.id === reset.userId);
  if (!reset || !user) return formRedirect(request, '/reset-password?error=invalid');
  const password = body.get('password');
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024 || password !== body.get('confirmPassword')) return formRedirect(request, `/reset-password?token=${encodeURIComponent(token)}&error=invalid`);
  const passwordRecord = await hashPassword(password);
  await store.update((data) => {
    const stored = data.users.find((item) => item.id === user.id);
    stored.passwordSalt = passwordRecord.salt;
    stored.passwordHash = passwordRecord.hash;
    stored.updatedAt = new Date().toISOString();
    data.passwordResets = data.passwordResets.filter((item) => item.userId !== user.id);
    data.sessions = data.sessions.filter((item) => item.userId !== user.id);
  });
  return setSessionCookie(formRedirect(request, '/login?reset=success'), '', 0);
}
