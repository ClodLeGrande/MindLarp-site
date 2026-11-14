import { json } from '@/src/server/responses.js';

export function GET() {
  return json({ status: 'ok', service: 'mindlarp-site' });
}
