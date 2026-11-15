import { getDatabase } from '@/src/server/database.js';
import { json } from '@/src/server/responses.js';

export async function GET() {
  if (!process.env.DATABASE_URL) return json({ status: 'ok', service: 'mindlarp-site' });
  try {
    await getDatabase().query('SELECT 1');
    return json({ status: 'ok', service: 'mindlarp-site', database: 'postgresql' });
  } catch {
    return json({ status: 'error', service: 'mindlarp-site', database: 'unavailable' }, 503);
  }
}
