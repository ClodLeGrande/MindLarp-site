import { models } from '@/src/content.js';
import { apiKeyAuth } from '@/src/server/api.js';
import { apiError, readJson } from '@/src/server/responses.js';
import { recordUsage } from '@/src/server/usage.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await apiKeyAuth(request, 'inference:write');
  if (auth.error) return apiError(...auth.error);
  const { body, error } = await readJson(request);
  if (error) return error;
  const model = models.find((item) => item.id === body.model);
  if (!model) return apiError(404, 'Unknown model. Choose a model from /v1/models.', 'invalid_request_error', 'model_not_found');
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.some((message) => !message || !['system', 'user', 'assistant', 'tool'].includes(message.role) || typeof message.content !== 'string')) return apiError(400, 'messages must be a non-empty array of role and string content objects.', 'invalid_request_error', 'invalid_messages');
  if (body.temperature !== undefined && (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2)) return apiError(400, 'temperature must be a number between 0 and 2.');
  if (body.max_tokens !== undefined && (!Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 32768)) return apiError(400, 'max_tokens must be an integer between 1 and 32768.');
  if (!process.env.MINDLARP_UPSTREAM_URL) {
    await recordUsage({ key: auth.key, endpoint: '/v1/chat/completions', model: model.id, status: 503 });
    return apiError(503, 'Model inference is not configured. Set MINDLARP_UPSTREAM_URL on the server.', 'service_unavailable', 'inference_not_configured');
  }
  try {
    const response = await fetch(`${process.env.MINDLARP_UPSTREAM_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.MINDLARP_UPSTREAM_KEY ? { Authorization: `Bearer ${process.env.MINDLARP_UPSTREAM_KEY}` } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
    });
    if (body.stream && response.body) {
      await recordUsage({ key: auth.key, endpoint: '/v1/chat/completions', model: model.id, status: response.status });
      return new Response(response.body, { status: response.status, headers: { 'Content-Type': response.headers.get('content-type') || 'text/event-stream', 'Cache-Control': 'no-store' } });
    }
    const text = await response.text();
    let usage = null;
    try { usage = JSON.parse(text).usage; } catch {}
    await recordUsage({ key: auth.key, endpoint: '/v1/chat/completions', model: model.id, status: response.status, usage });
    return new Response(text, { status: response.status, headers: { 'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch {
    await recordUsage({ key: auth.key, endpoint: '/v1/chat/completions', model: model.id, status: 502 });
    return apiError(502, 'The configured inference service could not be reached.', 'upstream_error', 'upstream_unavailable');
  }
}
