import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const { Pool } = pg;

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL.');
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE || 10),
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
  });
}

export function getDatabase() {
  if (!globalThis.__mindLarpDatabase) globalThis.__mindLarpDatabase = createPool();
  return globalThis.__mindLarpDatabase;
}

export async function migrateDatabase(pool, directory = resolve('db/migrations')) {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const files = (await readdir(/* turbopackIgnore: true */ directory)).filter((file) => file.endsWith('.sql')).sort();
  const client = await pool.connect();
  try {
    for (const file of files) {
      await client.query('BEGIN');
      try {
        await client.query("SELECT pg_advisory_xact_lock(741852963)");
        const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
        if (!applied.rowCount) {
          await client.query(await readFile(/* turbopackIgnore: true */ resolve(directory, file), 'utf8'));
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
}
