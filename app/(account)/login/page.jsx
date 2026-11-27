import { redirect } from 'next/navigation';
import { authPage } from '@/src/views/public.js';
import { getCurrentAuth } from '@/src/server/auth.js';
import { getStore } from '@/src/server/store.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in', robots: { index: false, follow: false } };

export default async function Page({ searchParams }) {
  const store = await getStore();
  if (!store.data.users.length) redirect('/setup');
  if (await getCurrentAuth()) redirect('/console');

  const query = await searchParams;
  const errors = {
    credentials: 'Email or password is incorrect.',
    invalid: 'Enter a valid email address and password.',
    limit: 'Too many sign-in attempts. Try again later.',
    consent: 'You must accept the Terms of Service and Privacy Policy to continue.',
    oauth: 'Social sign-in could not be completed. Try again.',
    'account-exists': 'An account with this email already exists. Sign in with its original method or contact support.',
    google: 'Google sign-in is not configured on this server.',
    github: 'GitHub sign-in is not configured on this server.',
    discord: 'Discord sign-in is not configured on this server.',
  };
  return authPage({ mode: 'login', error: errors[query.error] || '' });
}
