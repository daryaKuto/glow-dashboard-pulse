interface TbAuthResponse {
  token: string;
  refreshToken?: string;
}

const TB_BASE_URL = Deno.env.get('THINGSBOARD_URL') ?? 'https://thingsboard.cloud';
const TB_USERNAME = Deno.env.get('THINGSBOARD_USERNAME');
const TB_PASSWORD = Deno.env.get('THINGSBOARD_PASSWORD');

let cachedToken: { value: string; expiresAt: number } | undefined;

async function ensureToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
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
  cachedToken = {
    value: data.token,
    expiresAt: Date.now() + 50 * 60 * 1000 // 50 minutes
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

  const res = await tbFetch('/api/plugins/telemetry/DEVICE/values/timeseries', {
    method: 'POST',
    body: JSON.stringify({ deviceIds, keys, limit }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch batch telemetry: ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item) => ({
    deviceId: String(item.deviceId ?? item.id ?? ''),
    telemetry: item.telemetry ?? {},
  }));
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
