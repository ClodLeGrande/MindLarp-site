import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hashPassword, hashToken, randomToken, safeEqual, verifyPassword } from '../security.js';
import { getStore } from './store.js';

const sessionDuration = 12 * 60 * 60 * 1000;

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function getCurrentAuth() {
  const token = (await cookies()).get('ml_session')?.value;
  if (!token) return null;
  const store = await getStore();
  const session = store.data.sessions.find((item) => safeEqual(item.tokenHash, hashToken(token)));
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
  const user = store.data.users.find((item) => item.id === session.userId);
  return user ? { session, user, token } : null;
}

export async function requireUser() {
  const auth = await getCurrentAuth();
  if (auth) return auth;
  const store = await getStore();
  redirect(store.data.users.length ? '/login' : '/setup');
}

export function requireCsrf(body, auth) {
  return auth && typeof body.csrf === 'string' && safeEqual(body.csrf, auth.session.csrf);
}

export async function createSession(userId) {
  const store = await getStore();
  const token = randomToken();
  const session = { id: randomUUID(), userId, tokenHash: hashToken(token), csrf: randomToken(24), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + sessionDuration).toISOString() };
  await store.update((data) => { data.sessions.push(session); });
  return { token, session };
}

export function setSessionCookie(response, token, maxAge = 43200) {
  response.cookies.set('ml_session', token, {
    path: '/', httpOnly: true, sameSite: 'lax', maxAge,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

export async function createPasswordUser({ displayName, email, password }) {
  const store = await getStore();
  const passwordRecord = await hashPassword(password);
  const user = { id: randomUUID(), displayName, email, role: store.data.users.length ? 'member' : 'owner', identities: [], passwordSalt: passwordRecord.salt, passwordHash: passwordRecord.hash, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await store.update((data) => { data.users.push(user); });
  return user;
}

export async function findOrCreateOAuthUser(identity) {
  const store = await getStore();
  let user = store.data.users.find((item) => item.identities?.some((linked) => linked.provider === identity.provider && linked.providerId === identity.providerId));
  if (!user) user = store.data.users.find((item) => item.email === identity.email);
  if (user) {
    if (!user.identities?.some((linked) => linked.provider === identity.provider && linked.providerId === identity.providerId)) {
      await store.update((data) => {
        const stored = data.users.find((item) => item.id === user.id);
        stored.identities = stored.identities || [];
        stored.identities.push({ provider: identity.provider, providerId: identity.providerId });
        stored.updatedAt = new Date().toISOString();
      });
    }
  } else {
    user = { id: randomUUID(), displayName: identity.displayName.slice(0, 80), email: identity.email, role: store.data.users.length ? 'member' : 'owner', identities: [{ provider: identity.provider, providerId: identity.providerId }], passwordSalt: null, passwordHash: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await store.update((data) => { data.users.push(user); });
  }
  return user;
}

export { hashPassword, hashToken, randomToken, safeEqual, verifyPassword };
