# MindLarp

The website, documentation, chat, and developer console for the MindLarp model family by GonidonCloud. Built with Next.js 16, React 19, Node.js, GSAP, and Lenis.

## Features

- Monochrome public website with model pages, pricing, changelog, status, and legal pages.
- English documentation and an OpenAI-compatible API reference.
- SEO metadata, Open Graph, JSON-LD, `robots.txt`, sitemap, and web manifest.
- Responsive chat connected to a configurable OpenAI-compatible inference service.
- Account registration, returning-user login, logout, and password changes.
- Google and GitHub OAuth with PKCE where supported.
- Password recovery over SMTP using single-use, 30-minute tokens.
- Console with scoped API keys, usage reporting, profile settings, and billing.
- Stripe Checkout, Customer Portal, and signed subscription webhooks.
- Local JSON persistence with atomic writes and serialized updates.

MindLarp does not include a model runtime. Chat and inference return a clear `503` until an upstream service is configured.

## Requirements

- Node.js 20 or newer
- npm
- Optional: an OpenAI-compatible inference endpoint
- Optional: Google, GitHub, Stripe, and SMTP credentials

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

On a new installation, visit `/setup` and create the owner account. After that:

- `/register` creates additional accounts.
- `/login` signs in returning users.
- `/forgot-password` starts SMTP password recovery.
- `/chat` opens the model chat.
- `/console` manages keys, usage, billing, and settings.
- `/docs` contains the developer documentation.

For production, build the application before starting the Next.js server:

```bash
npm run build
npm start
```

The production server defaults to port `3000`; set `PORT=5173` to keep the development port.

If the development server reports `EADDRINUSE`, another process is already using the port. Stop it or choose another port:

```bash
PORT=5174 npm run dev
```

## Configuration

Next.js loads configuration from `.env` and the other supported environment files. Never commit `.env` or real credentials. `.env.example` contains placeholders only.

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | No | Use `production` to enable secure session cookies. |
| `HOST` | No | Listen address; defaults to `0.0.0.0`. |
| `PORT` | No | HTTP port; development default is `5173`. |
| `PUBLIC_URL` | Production | Public origin without a trailing slash, such as `https://mindlarp.ai`. Used for OAuth callbacks, reset links, canonical URLs, and Stripe redirects. |
| `DATA_FILE` | No | JSON database path; defaults to `./data/mindlarp.json`. |
| `MINDLARP_UPSTREAM_URL` | For inference | OpenAI-compatible base URL, for example `https://provider.example/v1`. |
| `MINDLARP_UPSTREAM_KEY` | If required | Bearer token sent to the inference provider. |
| `GOOGLE_CLIENT_ID` | For Google login | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | For Google login | Google OAuth client secret. |
| `GITHUB_CLIENT_ID` | For GitHub login | GitHub OAuth client ID. |
| `GITHUB_CLIENT_SECRET` | For GitHub login | GitHub OAuth client secret. |
| `STRIPE_SECRET_KEY` | For billing | Stripe secret API key. |
| `STRIPE_PRICE_ID` | For billing | ID of a recurring Stripe Price. |
| `STRIPE_WEBHOOK_SECRET` | For billing | Signing secret for the Stripe webhook endpoint. |
| `SMTP_HOST` | For recovery | SMTP server hostname. |
| `SMTP_PORT` | No | SMTP port; defaults to `587`. |
| `SMTP_SECURE` | No | `true` for implicit TLS, commonly port `465`; otherwise `false`. |
| `SMTP_USER` | If required | SMTP username. |
| `SMTP_PASS` | If required | SMTP password or app password. |
| `SMTP_FROM` | For recovery | Sender, for example `MindLarp <no-reply@mindlarp.ai>`. |

Do not expose `.env` values in browser JavaScript. API keys created in the console are different from `MINDLARP_UPSTREAM_KEY`: console keys authenticate MindLarp users, while the upstream key authenticates the server with its inference provider.

## Model inference

Set the upstream base URL without `/chat/completions`:

```dotenv
MINDLARP_UPSTREAM_URL=https://provider.example/v1
MINDLARP_UPSTREAM_KEY=your-provider-key
```

The server proxies requests to:

```text
POST https://provider.example/v1/chat/completions
```

Available model identifiers are `MindLarp-Sol-1-Plus` and `MindLarp-Sol-1-Max`. The upstream must accept these identifiers and return OpenAI-compatible responses. Configure model aliases in the upstream gateway if necessary.

Example request after creating a key in `/console/keys`:

```bash
curl http://localhost:5173/v1/chat/completions \
  -H "Authorization: Bearer ml_sk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MindLarp-Sol-1-Plus",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Google and GitHub login

Create separate OAuth applications and use these callback URLs, replacing the origin with your `PUBLIC_URL`:

```text
http://localhost:5173/auth/google/callback
http://localhost:5173/auth/github/callback
```

For Google, configure an OAuth **Web application** in Google Cloud Console. For GitHub, create an OAuth App and set its authorization callback URL accordingly. Add the credentials to `.env`; OAuth routes return `503` while a provider is unconfigured.

OAuth identities are linked by provider ID. A new verified provider identity can also be linked to an existing account with the same email address. Review this policy before operating a public multi-tenant service.

## Stripe billing

1. Create a recurring Price in Stripe and copy its `price_...` ID.
2. Add `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` to `.env`.
3. Create a webhook destination at:

   ```text
   https://your-domain.example/webhooks/stripe
   ```

4. Subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

For local webhook forwarding, use the Stripe CLI:

```bash
stripe listen --forward-to localhost:5173/webhooks/stripe
```

Checkout and Customer Portal are available from `/console/billing`. Use Stripe test keys during development. The current integration stores subscription state but does not yet implement metered token invoicing, spending limits, or entitlement enforcement.

## SMTP password recovery

Example using implicit TLS:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM="MindLarp <no-reply@example.com>"
```

For port `587`, normally use `SMTP_SECURE=false` and allow the provider to upgrade the connection with STARTTLS. Reset links expire after 30 minutes, are stored only as SHA-256 hashes, and cannot be reused. A successful password reset signs out all existing sessions for that account.

Without `SMTP_HOST`, password recovery returns a clear configuration error and no email is claimed to have been sent.

## JSON data storage

By default, data is stored in `data/mindlarp.json`. The file is created automatically with owner-only permissions where supported by the operating system. Writes use a temporary file followed by an atomic rename, and updates are serialized within the Node.js process.

The JSON file contains:

- users and password hashes with unique salts;
- hashed sessions and API keys;
- API usage records;
- chat conversations, including message contents;
- hashed password reset tokens.

Full API keys and reset tokens are not stored in plaintext. Back up the file securely because it still contains personal and conversation data. `data/` is excluded from Git.

**This is a temporary, single-process development store.** Do not run multiple server processes against the same JSON file. Before production, migrate to a database such as PostgreSQL, add transactional constraints and migrations, and implement managed backups and retention policies.

## Verification

```bash
npm test
npm run check
```

The integration tests start the production Next.js server on isolated ports with temporary JSON files. They exercise public pages, account setup, registration and login, sessions, CSRF protection, API keys, JSON and streaming inference through a local mock provider, chat, OAuth redirects, signed Stripe webhooks, and password recovery through a local mock SMTP server. No production test backdoors are used. `npm run check` performs JavaScript syntax checks; `npm run build` validates the React and Next.js application.

## Project structure

```text
app/                   Next.js App Router pages, form actions, and API routes
components/            React browser effects and reusable controls
src/server/            Next.js authentication, persistence, and response adapters
src/store.js           JSON persistence
src/security.js        Password, token, and cookie helpers
src/oauth.js           Google and GitHub OAuth
src/mailer.js          SMTP password recovery email
src/views/             Page templates and layouts
public/                Styles, browser scripts, icons, and manifest
proxy.js               Security headers and CSP nonces
test/                  Node.js integration tests against production Next.js
data/                  Local JSON data; not committed
```

## Production checklist

- Replace JSON storage with PostgreSQL or another transactional database.
- Serve through HTTPS and set `NODE_ENV=production` and the correct `PUBLIC_URL`.
- Keep secrets in a deployment secret manager; never commit `.env`.
- Put Node.js behind a reverse proxy with request limits and appropriate timeouts.
- Add distributed rate limiting for login, registration, recovery, chat, and inference.
- Decide whether public registration is allowed and add invitation or workspace authorization controls if needed.
- Configure real model aliases, provider limits, usage metering, and Stripe entitlements.
- Back up account and billing data; define chat retention and deletion policies.
- Review the placeholder legal page and all model, price, status, and social-link content before launch.
- Test OAuth callbacks and Stripe webhooks on the public domain before accepting users.
