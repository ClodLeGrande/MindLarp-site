import { redirect } from 'next/navigation';
import { authPage } from '@/src/views/public.js';
import { getStore } from '@/src/server/store.js';

export const metadata = { title: 'Set up workspace', robots: { index: false, follow: false } };

export default async function Page({ searchParams }) {
  const store = await getStore();
  if (store.data.users.length) redirect('/login');
  const error = (await searchParams).error === 'invalid' ? 'Check your name and email. Passwords must match and contain at least 12 characters.' : '';
  return authPage({ mode: 'setup', error });
}
