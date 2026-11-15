function validUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function localHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function validateProductionConfig(env = process.env) {
  const errors = [];
  if (!env.PUBLIC_URL || !validUrl(env.PUBLIC_URL)) {
    errors.push('PUBLIC_URL must be an absolute HTTP(S) origin without credentials.');
  } else if (!env.PUBLIC_URL.startsWith('https://') && env.ALLOW_HTTP_PUBLIC_URL !== 'true' && !localHttpUrl(env.PUBLIC_URL)) {
    errors.push('PUBLIC_URL must use HTTPS in production. Set ALLOW_HTTP_PUBLIC_URL=true only for an isolated local deployment.');
  }
  if (!env.DATABASE_URL && env.ALLOW_JSON_PRODUCTION !== 'true') {
    errors.push('DATABASE_URL is required. JSON storage is a development fallback; set ALLOW_JSON_PRODUCTION=true only for a local single-process deployment.');
  }
  if (env.DATABASE_URL?.includes('postgres:postgres@')) {
    errors.push('Replace the default PostgreSQL credentials in DATABASE_URL before production deployment.');
  }
  if (env.DATABASE_POOL_SIZE && (!Number.isInteger(Number(env.DATABASE_POOL_SIZE)) || Number(env.DATABASE_POOL_SIZE) < 1 || Number(env.DATABASE_POOL_SIZE) > 100)) {
    errors.push('DATABASE_POOL_SIZE must be an integer between 1 and 100.');
  }
  for (const provider of ['GOOGLE', 'GITHUB']) {
    if (Boolean(env[`${provider}_CLIENT_ID`]) !== Boolean(env[`${provider}_CLIENT_SECRET`])) {
      errors.push(`${provider}_CLIENT_ID and ${provider}_CLIENT_SECRET must be configured together.`);
    }
  }
  const stripeValues = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET'];
  if (stripeValues.some((key) => env[key]) && stripeValues.some((key) => !env[key])) {
    errors.push('STRIPE_SECRET_KEY, STRIPE_PRICE_ID, and STRIPE_WEBHOOK_SECRET must be configured together.');
  }
  if (env.MINDLARP_UPSTREAM_URL && !validUrl(env.MINDLARP_UPSTREAM_URL)) {
    errors.push('MINDLARP_UPSTREAM_URL must be an absolute HTTP(S) URL without embedded credentials.');
  }
  if (env.SMTP_PORT && (!Number.isInteger(Number(env.SMTP_PORT)) || Number(env.SMTP_PORT) < 1 || Number(env.SMTP_PORT) > 65535)) {
    errors.push('SMTP_PORT must be an integer between 1 and 65535.');
  }
  if (errors.length) throw new Error(`Production configuration is invalid:\n- ${errors.join('\n- ')}`);
}

export function reportProductionStorage(env = process.env) {
  if (!env.DATABASE_URL) console.warn('MindLarp is running with JSON storage. Use one process only; PostgreSQL is required for a public multi-instance deployment.');
}
