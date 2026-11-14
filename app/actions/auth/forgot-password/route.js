import { randomUUID } from 'node:crypto';
import { createMailer } from '@/src/mailer.js';
import { hashToken, normalizeEmail, randomToken, validEmail } from '@/src/server/auth.js';
import { publicUrl, smtpConfig } from '@/src/server/config.js';
import { formRedirect } from '@/src/server/responses.js';
import { getStore } from '@/src/server/store.js';

export async function POST(request) {
  const smtp = smtpConfig();
  if (!smtp.host) return formRedirect(request, '/forgot-password?error=smtp');
  const body = await request.formData();
  const email = normalizeEmail(body.get('email'));
  if (!validEmail(email)) return formRedirect(request, '/forgot-password?error=email');
  const store = await getStore();
  const user = store.data.users.find((item) => item.email === email);
  if (user) {
    const token = randomToken();
    await store.update((data) => {
      data.passwordResets = data.passwordResets.filter((item) => item.userId !== user.id && Date.parse(item.expiresAt) > Date.now());
      data.passwordResets.push({ id: randomUUID(), userId: user.id, tokenHash: hashToken(token), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 60000).toISOString() });
    });
    try {
      await createMailer(smtp).sendPasswordReset({ email, url: `${publicUrl(new URL(request.url).origin)}/reset-password?token=${encodeURIComponent(token)}` });
    } catch (error) {
      console.error(`Password recovery email: ${error.message}`);
    }
  }
  return formRedirect(request, '/forgot-password?sent=1');
}
