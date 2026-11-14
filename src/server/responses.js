import { NextResponse } from 'next/server';

export function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function apiError(status, message, type = 'invalid_request_error', code = null) {
  return json({ error: { message, type, code } }, status);
}

export function formRedirect(request, location) {
  return new NextResponse(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

export async function readJson(request, limit = 1_048_576) {
  if (Number(request.headers.get('content-length')) > limit) {
    return { error: apiError(413, 'Request body is too large.', 'invalid_request_error', 'body_too_large') };
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw) > limit) return { error: apiError(413, 'Request body is too large.', 'invalid_request_error', 'body_too_large') };
  if (!raw) return { body: {} };
  try {
    const body = JSON.parse(raw);
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error();
    return { body };
  } catch {
    return { error: apiError(400, 'Request body must be a valid JSON object.') };
  }
}

export function routeError(error, prefix = '/v1/') {
  console.error(error);
  return apiError(error.status || 500, error.status ? error.message : 'An internal server error occurred.', 'server_error');
}
