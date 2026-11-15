export function checkSameOrigin(request) {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');

  if (origin !== null) {
    try {
      if (new URL(origin).origin === expectedOrigin && new URL(origin).origin === origin) {
        return null;
      }
    } catch {
      // Invalid Origin header.
    }

    return new Response('Forbidden', {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const referer = request.headers.get('referer');

  if (referer !== null) {
    try {
      if (new URL(referer).origin === expectedOrigin) {
        return null;
      }
    } catch {
      // Invalid Referer header.
    }
  }

  return new Response('Forbidden', {
    status: 403,
    headers: { 'Cache-Control': 'no-store' },
  });
}