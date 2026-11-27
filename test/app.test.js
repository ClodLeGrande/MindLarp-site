import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';

const password = 'a-very-good-password';
const root = resolve(import.meta.dirname, '..');
const configurationKeys = [
  'MINDLARP_UPSTREAM_URL', 'MINDLARP_UPSTREAM_KEY', 'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET',
  'STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_REQUIRE_TLS', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
  'ALLOW_INFERENCE_WITHOUT_SUBSCRIPTION', 'INFERENCE_DAILY_REQUEST_LIMIT', 'ALLOW_HTTP_UPSTREAM',
  'OPENWEBUI_URL', 'OPENWEBUI_API_BASE_URL', 'OPENWEBUI_PORT', 'MINDLARP_OPENWEBUI_API_KEY',
  'DATABASE_URL', 'DIRECT_URL', 'DATABASE_SSL', 'DATABASE_SSL_REJECT_UNAUTHORIZED', 'DATABASE_POOL_SIZE',
];

async function listen(server) {
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  return server.address().port;
}

async function close(server) {
  if (!server.listening) return;
  await new Promise((resolveClose) => server.close(resolveClose));
}

async function startApp(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'mindlarp-next-test-'));
  const dataFile = join(directory, 'store.json');
  const probe = createServer();
  const port = await listen(probe);
  await close(probe);
  const origin = `http://127.0.0.1:${port}`;
  const blankConfiguration = Object.fromEntries(configurationKeys.map((key) => [key, '']));
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: root,
    env: {
      ...process.env,
      ...blankConfiguration,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      ALLOW_JSON_PRODUCTION: 'true',
      ALLOW_INFERENCE_WITHOUT_SUBSCRIPTION: 'false',
      INFERENCE_DAILY_REQUEST_LIMIT: '1000',
      DATA_FILE: dataFile,
      PUBLIC_URL: origin,
      MINDLARP_UPSTREAM_URL: options.upstreamUrl || '',
      ...Object.fromEntries(Object.entries(options.env || {}).map(([key, value]) => [key, String(value)])),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const cleanup = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await Promise.race([exited, delay(3000).then(() => child.kill('SIGKILL'))]);
    }
    await rm(directory, { recursive: true, force: true });
  };
  t.after(cleanup);
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Next.js stopped during startup:\n${output}`);
    try {
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
       return {
  origin,
  dataFile,
  readData: async () => {
    try {
      return JSON.parse(await readFile(dataFile, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;

      return {
        version: 1,
        users: [],
        sessions: [],
        keys: [],
        usage: [],
        conversations: [],
        passwordResets: [],
      };
    }
  },
};
      }
    } catch {}
    await delay(100);
  }
  throw new Error(`Next.js did not become ready:\n${output}`);
}

async function post(origin, path, body, cookie = '', requestOrigin = origin) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(body)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(key, item);
    }
  }

  return fetch(`${origin}${path}`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: requestOrigin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: params,
  });
}

async function setupOwner(origin) {
  const response = await post(origin, '/actions/auth/setup', { displayName: 'Ada Lovelace', email: 'ada@example.com', password, confirmPassword: password, consent: 'accepted' });
  assert.equal(response.status, 303);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.match(cookie, /^ml_session=/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  return cookie;
}

async function createKey(origin, cookie, name = 'Production', scopes = ['models:read', 'inference:write']) {
  const consoleResponse = await fetch(`${origin}/console/keys`, { headers: { Cookie: cookie } });
  assert.equal(consoleResponse.status, 200);
  const html = await consoleResponse.text();
  const csrf = html.match(/name="csrf" value="([^"]+)"/)[1];
  const response = await post(origin, '/console/keys/create', { name, scopes, expires: 'never', csrf }, cookie);
  const responseHtml = await response.text();
  const secret = responseHtml.match(/id="new-secret">([^<]+)</)?.[1];
  return { response, html: responseHtml, secret, csrf };
}

async function startUpstream(t, responseText = 'A clear answer.') {
  const requests = [];
  const upstream = createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const payload = JSON.parse(body);
      requests.push({ url: req.url, authorization: req.headers.authorization, payload });
      if (payload.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end(`data: ${JSON.stringify({ id: 'chat_stream', choices: [{ delta: { content: responseText } }] })}\n\ndata: [DONE]\n\n`);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'chat_test', choices: [{ message: { role: 'assistant', content: responseText } }], usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 } }));
      }
    });
  });
  const port = await listen(upstream);
  t.after(() => close(upstream));
  return { url: `http://127.0.0.1:${port}/v1`, requests };
}

test('public pages, assets, SEO, trust strip, and health work on Next.js', async (t) => {
  const { origin } = await startApp(t);
  for (const path of ['/', '/models', '/models/larp-1', '/models/larp-1-code', '/pricing', '/docs', '/docs/getting-started', '/docs/api-reference', '/changelog', '/legal', '/privacy', '/terms', '/ru/privacy', '/ru/terms', '/status']) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /MindLarp/);
  }
  assert.equal((await fetch(`${origin}/models/unknown`)).status, 404);
  assert.equal((await fetch(`${origin}/missing`)).status, 404);
  assert.deepEqual(await (await fetch(`${origin}/health`)).json(), { status: 'ok', service: 'mindlarp-site', database: 'json' });
  const response = await fetch(`${origin}/`);
  const html = await response.text();
  assert.match(html, /rel="canonical"/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /name="twitter:card"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(response.headers.get('content-security-policy'), /nonce-/);
  assert.match(response.headers.get('content-security-policy'), /strict-dynamic/);
  assert.match(response.headers.get('content-security-policy'), /form-action 'self' https:\/\/checkout\.stripe\.com https:\/\/billing\.stripe\.com/);
  assert.match(html, /\u00A9 2026 ClodLeGrande/);
  for (const name of ['GitHub', 'YouTube', 'Hugging Face', 'Telegram', 'Discord']) assert.match(html, new RegExp(`aria-label="MindLarp on ${name}"`));
  assert.match(html, /Start chat/);
  assert.match(html, /have not been released yet/);
  assert.match(await (await fetch(`${origin}/models/larp-1`)).text(), /has not been released yet/);
  const pricingHtml = await (await fetch(`${origin}/pricing`)).text();
  for (const text of ['>Pro<', '>Plus<', '>Studio<', '\\$19', '\\$79', '\\$199']) assert.match(pricingHtml, new RegExp(text));
  assert.match(pricingHtml, /Payment link coming soon/);
  assert.match(html, /Trusted by 22M\+ developers/);
  const renderedMarkup = html.split('<script type="application/ld+json"')[0];
  assert.equal((renderedMarkup.match(/data-trusted-set/g) || []).length, 3);
  for (const name of ['Salesforce', 'Intel', 'Cisco', 'Red Hat', 'Revolut']) assert.match(html, new RegExp(`aria-label="${name}"`));
  assert.match(html, /aria-live="off"/);
  assert.ok(html.indexOf('id="trusted-strip-title"') < html.indexOf('What is MindLarp?'));
  assert.ok(html.indexOf('What is MindLarp?') < html.indexOf('[ 02 ]'));
  for (const path of ['/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/assets/og.svg', '/assets/logo.png', '/assets/style.css', '/bootstrap.js', '/vendor/gsap.min.js', '/vendor/ScrollTrigger.min.js', '/vendor/lenis.min.js']) {
    assert.equal((await fetch(`${origin}${path}`)).status, 200, path);
  }
  assert.match(await (await fetch(`${origin}/robots.txt`)).text(), new RegExp(`Sitemap: ${origin}/sitemap\\.xml`));
  assert.match(await (await fetch(`${origin}/sitemap.xml`)).text(), new RegExp(`<loc>${origin}/</loc>`));
  for (const path of ['/assets/login', '/assets/docs', '/assets/health']) assert.equal((await fetch(`${origin}${path}`)).status, 404, path);
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('owner setup validates input and establishes a persistent session', async (t) => {
  const { origin, readData } = await startApp(t);
  let response = await fetch(`${origin}/console`, { redirect: 'manual' });
  assert.equal(response.headers.get('location'), '/setup');
  response = await post(origin, '/actions/auth/setup', { displayName: 'Ada', email: 'bad', password: 'short', confirmPassword: 'short' });
  assert.equal(response.status, 303);
  assert.match(await (await fetch(`${origin}${response.headers.get('location')}`)).text(), /Passwords must match and contain at least 12 characters/);
  const cookie = await setupOwner(origin);
  response = await fetch(`${origin}/console`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Good to see you, Ada/);
  assert.equal((await readData()).users.length, 1);
  assert.equal((await fetch(`${origin}/setup`, { redirect: 'manual' })).headers.get('location'), '/login');
});

test('password auth rejects cross-origin requests and keeps recovery endpoints disabled', async (t) => {
  const { origin, readData } = await startApp(t);
  const cookie = await setupOwner(origin);
  for (const [path, body] of [
    ['/actions/auth/login', { email: 'ada@example.com', password }],
    ['/actions/auth/register', { displayName: 'Grace Hopper', email: 'grace@example.com', password, confirmPassword: password, consent: 'accepted' }],
  ]) {
    const response = await post(origin, path, body, cookie, 'https://evil.example');
    assert.equal(response.status, 403, path);
  }
  assert.equal((await post(origin, '/actions/auth/forgot-password', { email: 'ada@example.com' })).status, 410);
  assert.equal((await post(origin, '/actions/auth/reset-password', { token: 'not-a-real-token', password, confirmPassword: password })).status, 410);
  assert.equal((await readData()).users.length, 1);
  const emptyApp = await startApp(t);
  const setupResponse = await post(emptyApp.origin, '/actions/auth/setup', { displayName: 'Attacker', email: 'attacker@example.com', password, confirmPassword: password }, '', 'https://evil.example');
  assert.equal(setupResponse.status, 403);
  assert.equal((await emptyApp.readData()).users.length, 0);
});
test('API keys are scoped, hashed, validated, protected by CSRF, and revocable', async (t) => {
  const { origin, readData } = await startApp(t);
  const cookie = await setupOwner(origin);
  let response = await post(origin, '/console/keys/create', { name: 'No CSRF', scopes: 'models:read', expires: 'never' }, cookie);
  assert.equal(response.status, 403);
  const consoleHtml = await (await fetch(`${origin}/console/keys`, { headers: { Cookie: cookie } })).text();
  const csrf = consoleHtml.match(/name="csrf" value="([^"]+)"/)[1];
  response = await post(origin, '/console/keys/create', { name: '', scopes: 'models:read', expires: 'never', csrf }, cookie);
  assert.equal(response.status, 400);
  response = await post(origin, '/console/keys/create', { name: 'No scopes', expires: 'never', csrf }, cookie);
  assert.equal(response.status, 400);
  const { response: created, html: createdHtml, secret } = await createKey(origin, cookie);
  assert.equal(created.status, 201);
  assert.match(secret, /^ml_sk_live_[\w-]{40,}$/);
  const nonce = created.headers.get('content-security-policy').match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce);
  assert.ok(createdHtml.includes(`src="/bootstrap.js" nonce="${nonce}"`));
  let data = await readData();
  assert.equal(data.keys[0].scopes.length, 2);
  assert.equal(JSON.stringify(data).includes(secret), false);
  const modelsResponse = await fetch(`${origin}/v1/models`, { headers: { Authorization: `Bearer ${secret}` } });
  assert.equal(modelsResponse.status, 200);
  const catalog = await modelsResponse.json();
  assert.deepEqual(catalog.data.map((model) => model.id), ['MindLarp-Larp-1', 'MindLarp-Larp-1-Code']);
  assert.equal((await fetch(`${origin}/v1/models`, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  const keyId = data.keys[0].id;
  response = await post(origin, `/console/keys/${keyId}/revoke`, { csrf }, cookie);
  assert.equal(response.status, 303);
  data = await readData();
  assert.ok(data.keys[0].revokedAt);
  assert.equal((await fetch(`${origin}/v1/models`, { headers: { Authorization: `Bearer ${secret}` } })).status, 401);
});

test('unconfigured inference returns truthful errors and records request activity', async (t) => {
  const { origin, readData } = await startApp(t);
  const cookie = await setupOwner(origin);
  const { secret } = await createKey(origin, cookie);
  const response = await fetch(`${origin}/v1/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'MindLarp-Larp-1', messages: [{ role: 'user', content: 'Hello' }] }),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'inference_not_configured');
  assert.equal((await readData()).usage[0].status, 503);
  assert.equal((await fetch(`${origin}/chat`, { headers: { Cookie: cookie } })).status, 404);
  assert.equal((await fetch(`${origin}/chat/messages`, { method: 'POST' })).status, 404);
  const overview = await (await fetch(`${origin}/console`, { headers: { Cookie: cookie } })).text();
  assert.match(overview, /Latest API requests/);
  assert.match(overview, /Chat<span class="nav-arrow"/);
});

test('configured upstream completions proxy JSON and streams with usage accounting', async (t) => {
  const upstream = await startUpstream(t);
  const { origin, readData } = await startApp(t, { upstreamUrl: upstream.url, env: { ALLOW_INFERENCE_WITHOUT_SUBSCRIPTION: 'true' } });
  const cookie = await setupOwner(origin);
  const { secret } = await createKey(origin, cookie);
  let response = await fetch(`${origin}/v1/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'MindLarp-Larp-1', messages: [{ role: 'user', content: 'Hello' }] }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).choices[0].message.content, 'A clear answer.');
  response = await fetch(`${origin}/v1/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'MindLarp-Larp-1-Code', messages: [{ role: 'user', content: 'Hello' }], stream: true }),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  assert.match(await response.text(), /data: \[DONE\]/);
  assert.equal(upstream.requests[0].url, '/v1/chat/completions');
  const data = await readData();
  const completionUsage = data.usage.find((event) => event.model === 'MindLarp-Larp-1');
  assert.equal(completionUsage.totalTokens, 10);
  assert.equal(completionUsage.promptTokens, 7);
  assert.equal(data.usage.find((event) => event.model === 'MindLarp-Larp-1-Code').status, 200);
});

test('billing setup reports missing Stripe and shows subscription plans', async (t) => {
  const { origin } = await startApp(t);
  const cookie = await setupOwner(origin);
  const html = await (await fetch(`${origin}/console`, { headers: { Cookie: cookie } })).text();
  const csrf = html.match(/name="csrf" value="([^"]+)"/)[1];
  const billingHtml = await (await fetch(`${origin}/console/billing`, { headers: { Cookie: cookie } })).text();
  for (const text of ['>Pro<', '>Plus<', '>Studio<', '\\$19', '\\$79', '\\$199']) assert.match(billingHtml, new RegExp(text));
  assert.match(billingHtml, /Payment link coming soon/);
  assert.equal((await post(origin, '/console/billing/checkout', { csrf }, cookie)).status, 503);
  assert.equal((await post(origin, '/webhooks/stripe', {})).status, 503);
});

test('email/password registration and login work without email confirmation while logout works', async (t) => {
  const { origin, readData } = await startApp(t);
  const cookie = await setupOwner(origin);
  const registration = await post(origin, '/actions/auth/register', { displayName: 'Grace Hopper', email: 'grace@example.com', password, confirmPassword: password, consent: 'accepted' });
  assert.equal(registration.status, 303);
  assert.equal(registration.headers.get('location'), '/console');
  assert.match(registration.headers.get('set-cookie'), /^ml_session=/);
  const login = await post(origin, '/actions/auth/login', { email: 'ada@example.com', password });
  assert.equal(login.status, 303);
  assert.equal(login.headers.get('location'), '/console');
  assert.match(login.headers.get('set-cookie'), /^ml_session=/);
  assert.equal((await readData()).users.length, 2);
  const consoleHtml = await (await fetch(`${origin}/console`, { headers: { Cookie: cookie } })).text();
  const csrf = consoleHtml.match(/name="csrf" value="([^"]+)"/)[1];
  const logout = await post(origin, '/console/logout', { csrf }, cookie);
  assert.equal(logout.status, 303);
  assert.equal((await fetch(`${origin}/console`, { headers: { Cookie: cookie }, redirect: 'manual' })).status, 307);
});
test('repeated password-login requests cannot bypass the OAuth-only sign-in policy', async (t) => {
  const { origin, readData } = await startApp(t);
  await setupOwner(origin);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await post(origin, '/actions/auth/login', {
      email: 'ada@example.com',
      password,
    });
    assert.equal(response.status, 410);
  }

  const data = await readData();
  assert.equal(data.users.length, 1);
  assert.equal(data.sessions.length, 1);
});

test('legal pages serve full RU and EN documents with support contacts and plan appendix', async (t) => {
  const { origin } = await startApp(t);
  const pages = {
    '/privacy': ['PRIVACY POLICY', 'Contact Information'],
    '/ru/privacy': ['ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ', 'Контактная информация'],
    '/terms': ['USER AGREEMENT', 'Final Provisions', 'Appendix — Plans'],
    '/ru/terms': ['ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ', 'Заключительные положения', 'Приложение — Тарифы'],
  };
  for (const [path, texts] of Object.entries(pages)) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    for (const text of texts) assert.ok(html.includes(text), `${path}: ${text}`);
    for (let section = 1; section <= 10; section += 1) assert.ok(html.includes(`<span class="legal-number">${section}.</span>`), `${path}: section ${section}`);
    assert.ok(!html.includes('RollyPay'), path);
    assert.ok(html.includes('MindLarp'), path);
    assert.ok(html.includes('href="mailto:maksimansakov423@gmail.com"'), path);
  }
  const privacyRu = await (await fetch(`${origin}/ru/privacy`)).text();
  assert.ok(privacyRu.includes('Настоящая Политика конфиденциальности определяет порядок сбора, обработки, хранения и защиты персональных данных'));
  assert.ok(privacyRu.includes('обратиться в службу поддержки по адресу <a href="mailto:maksimansakov423@gmail.com">maksimansakov423@gmail.com</a>'));
  const privacyEn = await (await fetch(`${origin}/privacy`)).text();
  assert.ok(privacyEn.includes('This Privacy Policy defines the procedure for the collection, processing, storage, and protection of personal data'));
  const termsRu = await (await fetch(`${origin}/ru/terms`)).text();
  assert.ok(termsRu.includes('полное и безоговорочное принятие Заказчиком условий настоящего Договора'));
  for (const [path, other] of [['/privacy', '/ru/privacy'], ['/terms', '/ru/terms'], ['/ru/privacy', '/privacy'], ['/ru/terms', '/terms']]) {
    const html = await (await fetch(`${origin}${path}`)).text();
    assert.ok(html.includes(`href="${other}"`), `${path} -> ${other}`);
  }
  for (const path of ['/terms', '/ru/terms']) {
    const html = await (await fetch(`${origin}${path}`)).text();
    for (const price of ['<td>$19</td>', '<td>$79</td>', '<td>$199</td>']) assert.ok(html.includes(price), path);
    assert.match(html, /≈1[\s\u00A0]710 ₽/);
    assert.match(html, /≈7[\s\u00A0]110 ₽/);
    assert.match(html, /≈17[\s\u00A0]910 ₽/);
  }
  assert.ok((await (await fetch(`${origin}/terms`)).text()).includes('Charges are billed in USD.'));
  assert.ok((await (await fetch(`${origin}/ru/terms`)).text()).includes('Оплата списывается в USD.'));
  const legal = await (await fetch(`${origin}/legal`)).text();
  for (const link of ['href="/privacy"', 'href="/terms"', 'href="/ru/privacy"', 'href="/ru/terms"', 'mailto:maksimansakov423@gmail.com']) assert.ok(legal.includes(link), link);
});

test('plan prices show indicative ruble amounts from a single configurable rate', async (t) => {
  const { origin } = await startApp(t);
  const pricing = await (await fetch(`${origin}/pricing`)).text();
  assert.match(pricing, /\$19<span class="plan-price-rub"> · ≈1[\s\u00A0]710 ₽<\/span>/);
  assert.match(pricing, /\$79<span class="plan-price-rub"> · ≈7[\s\u00A0]110 ₽<\/span>/);
  assert.match(pricing, /\$199<span class="plan-price-rub"> · ≈17[\s\u00A0]910 ₽<\/span>/);
  assert.ok(pricing.includes('Charges are billed in USD. The ruble amount is indicative, converted at 90 ₽/$.'));
  const custom = await startApp(t, { env: { USD_TO_RUB: '100' } });
  const customPricing = await (await fetch(`${custom.origin}/pricing`)).text();
  assert.match(customPricing, /≈1[\s\u00A0]900 ₽/);
  assert.ok(customPricing.includes('converted at 100 ₽/$'));
  const cookie = await setupOwner(custom.origin);
  const billing = await (await fetch(`${custom.origin}/console/billing`, { headers: { Cookie: cookie } })).text();
  assert.match(billing, /≈1[\s\u00A0]900 ₽/);
});

test('footer links to legal documents and support on every page', async (t) => {
  const { origin } = await startApp(t);
  for (const path of ['/', '/pricing', '/privacy', '/ru/terms', '/docs']) {
    const html = await (await fetch(`${origin}${path}`)).text();
    for (const link of ['href="/privacy">Privacy Policy', 'href="/terms">Terms of Service', 'href="mailto:maksimansakov423@gmail.com">Support']) assert.ok(html.includes(link), `${path}: ${link}`);
  }
});

test('registration and payment require accepting the legal documents', async (t) => {
  const { origin, readData } = await startApp(t);
  const setupHtml = await (await fetch(`${origin}/setup`)).text();
  assert.match(setupHtml, /name="consent" value="accepted" required/);
  let response = await post(origin, '/actions/auth/setup', { displayName: 'Ada', email: 'ada@example.com', password, confirmPassword: password });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/setup?error=consent');
  assert.equal((await readData()).users.length, 0);
  assert.match(await (await fetch(`${origin}/setup?error=consent`)).text(), /must accept the Terms of Service and Privacy Policy/);

  const cookie = await setupOwner(origin);
  const loginHtml = await (await fetch(`${origin}/login`)).text();
  assert.match(loginHtml, /name="consent" value="accepted" required/);
  response = await post(origin, '/auth/google', {});
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/login?error=consent');
  response = await post(origin, '/auth/google', { consent: 'accepted' });
  assert.equal(response.status, 503);

  const billingHtml = await (await fetch(`${origin}/console/billing`, { headers: { Cookie: cookie } })).text();
  assert.match(billingHtml, /name="consent" value="accepted" required/);
  const configured = await startApp(t, { env: { STRIPE_SECRET_KEY: 'sk_test_mindlarp', STRIPE_PRICE_ID: 'price_test', STRIPE_WEBHOOK_SECRET: 'whsec_mindlarp_test' } });
  const configuredCookie = await setupOwner(configured.origin);
  const configuredBilling = await (await fetch(`${configured.origin}/console/billing`, { headers: { Cookie: configuredCookie } })).text();
  const csrf = configuredBilling.match(/name="csrf" value="([^"]+)"/)[1];
  response = await post(configured.origin, '/console/billing/checkout', { csrf }, configuredCookie);
  assert.equal(response.status, 400);
  assert.match(await response.text(), /must accept the Terms of Service and Privacy Policy/);
});
