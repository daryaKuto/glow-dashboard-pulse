const DEFAULT_ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';

const BASE_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': DEFAULT_ALLOWED_HEADERS,
  'Access-Control-Max-Age': '86400',
} as const;

function buildHeaders(current?: HeadersInit): Headers {
  const headers = new Headers(BASE_CORS_HEADERS);
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

export function preflightResponse(req?: Request): Response {
  const headers = buildHeaders();

  const origin = req?.headers.get('origin');
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  headers.delete('Access-Control-Allow-Credentials');

  const requestHeaders = req?.headers.get('access-control-request-headers');
  if (requestHeaders && requestHeaders.length > 0) {
    headers.set('Access-Control-Allow-Headers', requestHeaders);
  } else {
    headers.set('Access-Control-Allow-Headers', DEFAULT_ALLOWED_HEADERS);
  }

  const requestMethod = req?.headers.get('access-control-request-method');
  if (requestMethod && requestMethod.length > 0) {
    const allowedMethods = new Set<string>(['OPTIONS']);
    requestMethod.split(',').forEach((method) => {
      const normalized = method.trim().toUpperCase();
      if (normalized) {
        allowedMethods.add(normalized);
      }
    });
    headers.set('Access-Control-Allow-Methods', Array.from(allowedMethods).join(','));
  } else {
    headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }

  headers.set('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  headers.set('Content-Length', '0');
  headers.delete('Content-Type');

  return new Response(null, {
    status: 204,
    headers,
  });
}
