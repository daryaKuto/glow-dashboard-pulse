interface TbAuthResponse {
  token: string;
  refreshToken?: string;
}

const TB_BASE_URL = Deno.env.get('THINGSBOARD_URL') ?? 'https://thingsboard.cloud';
const TB_USERNAME = Deno.env.get('THINGSBOARD_USERNAME');
const TB_PASSWORD = Deno.env.get('THINGSBOARD_PASSWORD');

let cachedToken: { value: string; expiresAt: number; issuedAt: number } | undefined;

async function ensureToken(force = false): Promise<string> {
  if (!force && cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  if (!TB_USERNAME || !TB_PASSWORD) {
    throw new Error('ThingsBoard credentials are not configured');
  }

  const res = await fetch(`${TB_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TB_USERNAME, password: TB_PASSWORD })
  });

  if (!res.ok) {
    throw new Error(`ThingsBoard login failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as TbAuthResponse;
  const issuedAt = Date.now();
  cachedToken = {
    value: data.token,
    issuedAt,
    expiresAt: issuedAt + 50 * 60 * 1000 // 50 minutes
  };
  return data.token;
}

export async function tbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await ensureToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Authorization', `Bearer ${token}`);

  return fetch(`${TB_BASE_URL}${path}`, {
    ...init,
    headers,
  });
}

export async function getTenantDevices(params: URLSearchParams): Promise<any> {
  const res = await tbFetch(`/api/tenant/devices?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch devices: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getDeviceTelemetry(deviceId: string, keys: string[], limit = 1): Promise<Record<string, any>> {
  const params = new URLSearchParams({
    keys: keys.join(','),
    limit: String(limit),
  });

  const res = await tbFetch(`/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch telemetry for ${deviceId}: ${res.status}`);
  }
  return res.json();
}

export async function getBatchTelemetry(
  deviceIds: string[],
  keys: string[],
  limit = 1,
): Promise<Array<{ deviceId: string; telemetry: Record<string, any> }>> {
  if (deviceIds.length === 0) {
    return [];
  }

  const chunkSize = 10;
  const aggregated: Array<{ deviceId: string; telemetry: Record<string, any> }> = [];
  const errors: Array<{ deviceId: string; error: unknown }> = [];

  for (let index = 0; index < deviceIds.length; index += chunkSize) {
    const chunk = deviceIds.slice(index, index + chunkSize);
    const results = await Promise.all(
      chunk.map(async (deviceId) => {
        try {
          const telemetry = await getDeviceTelemetry(deviceId, keys, limit);
          return { deviceId, telemetry };
        } catch (error) {
          errors.push({ deviceId, error });
          return null;
        }
      }),
    );

    for (const result of results) {
      if (result) {
        aggregated.push(result);
      }
    }
  }

  if (errors.length === deviceIds.length) {
    const sample = errors[0];
    const message =
      sample?.error instanceof Error ? sample.error.message : JSON.stringify(sample?.error);
    throw new Error(`Failed to fetch batch telemetry: ${message}`);
  }

  return aggregated;
}

export async function getHistoricalTelemetry(
  deviceId: string,
  keys: string[],
  startTs: number,
  endTs: number,
  limit = 1000,
): Promise<Record<string, any>> {
  const params = new URLSearchParams({
    keys: keys.join(','),
    startTs: String(startTs),
    endTs: String(endTs),
    limit: String(limit),
  });

  const res = await tbFetch(`/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch historical telemetry for ${deviceId}: ${res.status}`);
  }

  return res.json();
}

export async function setDeviceSharedAttributes(
  deviceId: string,
  attributes: Record<string, unknown>,
  scope: 'SHARED_SCOPE' | 'SERVER_SCOPE' = 'SHARED_SCOPE',
): Promise<void> {
  const res = await tbFetch(`/api/plugins/telemetry/DEVICE/${deviceId}/${scope}`, {
    method: 'POST',
    body: JSON.stringify(attributes),
  });

  if (!res.ok) {
    throw new Error(`Failed to set shared attributes for ${deviceId}: ${res.status} ${res.statusText}`);
  }
}

export async function getDeviceAttributes(
  deviceId: string,
  options: {
    scope?: 'CLIENT_SCOPE' | 'SHARED_SCOPE' | 'SERVER_SCOPE';
    keys?: string[];
  } = {},
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();

  if (options.scope) {
    params.set('scope', options.scope);
  }

  if (Array.isArray(options.keys) && options.keys.length > 0) {
    params.set('keys', options.keys.map(String).join(','));
  }

  const query = params.toString();
  const path = query
    ? `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes?${query}`
    : `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes`;

  const res = await tbFetch(path, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch attributes for ${deviceId}: ${res.status} ${res.statusText}`);
  }

  const payload = await res.json();

  if (Array.isArray(payload)) {
    const attributes: Record<string, unknown> = {};
    for (const entry of payload) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const key = 'key' in entry ? (entry as Record<string, unknown>).key : undefined;
      if (typeof key !== 'string' || key.length === 0) {
        continue;
      }

      const value = (entry as Record<string, unknown>).value ?? null;
      attributes[key] = value;
    }
    return attributes;
  }

  if (payload && typeof payload === 'object') {
    return payload as Record<string, unknown>;
  }

  return {};
}

export async function sendOneWayRpc(
  deviceId: string,
  method: string,
  params: Record<string, unknown>,
): Promise<Response> {
  const res = await tbFetch(`/api/rpc/oneway/${deviceId}`, {
    method: 'POST',
    body: JSON.stringify({ method, params }),
  });

  if (!res.ok) {
    throw new Error(`Failed to send RPC ${method} to ${deviceId}: ${res.status} ${res.statusText}`);
  }

  return res;
}

// Issues a ThingsBoard two-way RPC and returns the parsed response payload so callers can consume device info packets.
export async function sendTwoWayRpc<T = unknown>(
  deviceId: string,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const res = await tbFetch(`/api/rpc/twoway/${deviceId}`, {
    method: 'POST',
    body: JSON.stringify({ method, params }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Failed to send two-way RPC ${method} to ${deviceId}: ${res.status} ${res.statusText} ${detail}`);
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (_error) {
    return text as unknown as T;
  }
}

export async function sendDeviceTelemetry(
  deviceId: string,
  telemetry: Record<string, unknown>,
  scope: 'DEVICE_SCOPE' | 'SERVER_SCOPE' = 'DEVICE_SCOPE',
): Promise<void> {
  const res = await tbFetch(`/api/plugins/telemetry/${deviceId}/timeseries/${scope}`, {
    method: 'POST',
    body: JSON.stringify(telemetry),
  });

  if (!res.ok) {
    throw new Error(`Failed to send telemetry for ${deviceId}: ${res.status} ${res.statusText}`);
  }
}

export async function loginWithCredentials(
  username: string,
  password: string,
): Promise<TbAuthResponse> {
  const res = await fetch(`${TB_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(`ThingsBoard login failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<TbAuthResponse>;
}

export async function getTokenWithExpiry(options: { force?: boolean } = {}): Promise<{
  token: string;
  expiresAt: number;
  issuedAt: number;
  expiresIn: number;
}> {
  const token = await ensureToken(options.force ?? false);
  const issuedAt = cachedToken?.issuedAt ?? Date.now();
  const expiresAt = cachedToken?.expiresAt ?? (issuedAt + 50 * 60 * 1000);
  const expiresIn = Math.max(0, expiresAt - Date.now());
  return {
    token,
    issuedAt,
    expiresAt,
    expiresIn,
  };
}

export function invalidateTokenCache(): void {
  cachedToken = undefined;
}
