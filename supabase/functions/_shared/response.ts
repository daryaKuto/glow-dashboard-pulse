const DEFAULT_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
} as const;

function buildHeaders(current?: HeadersInit): Headers {
  const headers = new Headers(DEFAULT_CORS_HEADERS);
  if (current) {
    const custom = new Headers(current);
    custom.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = buildHeaders(init.headers);
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export function errorResponse(message: string, status = 500, detail?: unknown): Response {
  return jsonResponse({ error: message, detail }, { status });
}

export function preflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: buildHeaders({ 'Content-Length': '0' }),
  });
}
