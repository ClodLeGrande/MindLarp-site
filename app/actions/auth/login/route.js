import { createSession, normalizeEmail, setSessionCookie, verifyPassword } from '@/src/server/auth.js';
import { formRedirect } from '@/src/server/responses.js';
import { getStore } from '@/src/server/store.js';

export async function POST(request) {
  const store = await getStore();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  globalThis.__mindLarpLoginAttempts ||= new Map();
  const attempt = globalThis.__mindLarpLoginAttempts.get(ip) || { count: 0, resetAt: Date.now() + 60000 };
  if (attempt.resetAt <= Date.now()) { attempt.count = 0; attempt.resetAt = Date.now() + 60000; }
  if (attempt.count >= 10) return formRedirect(request, '/login?error=limit');
  const body = await request.formData();
  const email = normalizeEmail(body.get('email'));
  const password = body.get('password');
  const user = store.data.users.find((item) => item.email === email);
  const valid = user?.passwordHash && typeof password === 'string' && await verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!valid) {
    attempt.count += 1;
    globalThis.__mindLarpLoginAttempts.set(ip, attempt);
    return formRedirect(request, `/login?error=credentials&email=${encodeURIComponent(email)}`);
  }
  globalThis.__mindLarpLoginAttempts.delete(ip);
  const session = await createSession(user.id);
  return setSessionCookie(formRedirect(request, '/console'), session.token);
}
