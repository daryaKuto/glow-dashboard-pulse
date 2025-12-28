import axios, { AxiosInstance } from 'axios';

/**
 * IMPORTANT: This module is reserved for the live Games experience.
 * Do not add cross-app consumers here; all other features must go
 * through Supabase edge helpers in src/lib/edge.ts.
 */

const DEFAULT_THINGSBOARD_URL = 'https://thingsboard.cloud';
const DEFAULT_POLLING_TELEMETRY_KEYS = ['hits', 'hit_ts', 'beep_ts', 'gameStatus', 'event', 'gameId'];
type TimeoutHandle = ReturnType<typeof setTimeout>;

/**
 * Resolve the base URL for ThingsBoard API requests.
 * Defaults to the hosted cloud instance when no env override is present.
 */
const resolveThingsboardBaseUrl = (): string => {
  const configured =
    (import.meta.env.VITE_TB_BASE_URL as string | undefined) ??
    (import.meta.env.VITE_THINGSBOARD_URL as string | undefined) ??
    (import.meta.env.THINGSBOARD_URL as string | undefined);
  return configured && configured.length > 0 ? configured : DEFAULT_THINGSBOARD_URL;
};

const baseURL = resolveThingsboardBaseUrl();

const thingsboardAPI: AxiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

type AxiosErrorLike = {
  isAxiosError?: boolean;
  response?: { status?: unknown };
  code?: string;
  message?: unknown;
};

const isAxiosErrorLike = (error: unknown): error is AxiosErrorLike => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return Boolean((error as { isAxiosError?: unknown }).isAxiosError);
};

export const isAxiosNetworkError = (error: unknown): boolean => {
  if (!isAxiosErrorLike(error)) {
    return false;
  }
  const status = error.response?.status;
  if (typeof status === 'number') {
    return false;
  }
  const code = typeof error.code === 'string' ? error.code : null;
  if (code === 'ERR_NETWORK') {
    return true;
  }
  const message = typeof error.message === 'string' ? error.message : '';
  return message.toLowerCase().includes('network error');
};

export const setAuthToken = (token: string | null): void => {
  if (token) {
    thingsboardAPI.defaults.headers.common['X-Authorization'] = `Bearer ${token}`;
  } else {
    delete thingsboardAPI.defaults.headers.common['X-Authorization'];
  }
};

// Direct-control helpers (aliases used by the Games start popup flow)
export const setTbAuthToken = (token: string | null): void => setAuthToken(token);
export const tbSetShared = async (
  deviceId: string,
  attributes: Record<string, unknown>,
): Promise<void> => {
  await setSharedAttributes(deviceId, attributes);
};
export const tbSendOneway = async (
  deviceId: string,
  method: string,
  params: Record<string, unknown>,
  timeoutMs = 5_000,
): Promise<void> => {
  await sendOneWayRpc(deviceId, method, params, timeoutMs);
};

export interface LoginResponse {
  token: string;
  refreshToken?: string;
}

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await axios.post<LoginResponse>(`${resolveThingsboardBaseUrl()}/api/auth/login`, {
    username,
    password,
  });

  return response.data;
};

interface CachedAuthToken {
  token: string;
  refreshToken?: string;
  expiresAt: number;
}

let cachedAuthToken: CachedAuthToken | null = null;

const decodeJwtExpiry = (token: string): number | null => {
  try {
    const base64Payload = token.split('.')[1] ?? '';
    let json: string | null = null;
    if (typeof atob === 'function') {
      json = atob(base64Payload);
    } else if (typeof Buffer !== 'undefined') {
      json = Buffer.from(base64Payload, 'base64').toString('utf-8');
    }
    if (!json) {
      return null;
    }
    const payload = JSON.parse(json) as { exp?: number };
    if (payload && typeof payload.exp === 'number') {
      return payload.exp * 1000;
    }
  } catch {
    // ignore parse errors; fallback will be used
  }
  return null;
};

const resolveEnvTbCredentials = (): { username: string; password: string } | null => {
  const username =
    (import.meta.env.VITE_TB_USERNAME as string | undefined) ??
    (import.meta.env.THINGSBOARD_USERNAME as string | undefined);
  const password =
    (import.meta.env.VITE_TB_PASSWORD as string | undefined) ??
    (import.meta.env.THINGSBOARD_PASSWORD as string | undefined);
  if (!username || !password) {
    return null;
  }
  return { username, password };
};

export const ensureTbAuthToken = async (): Promise<string> => {
  const now = Date.now();
  if (cachedAuthToken && cachedAuthToken.expiresAt - now > 60_000) {
    setTbAuthToken(cachedAuthToken.token);
    return cachedAuthToken.token;
  }

  const credentials = resolveEnvTbCredentials();
  if (!credentials) {
    throw new Error('ThingsBoard credentials are not configured. Set VITE_TB_USERNAME/VITE_TB_PASSWORD in .env.local.');
  }

  const auth = await login(credentials.username, credentials.password);
  const expiry =
    decodeJwtExpiry(auth.token) ??
    now + 50 * 60 * 1000; // fallback to 50 minutes if exp is missing

  cachedAuthToken = {
    token: auth.token,
    refreshToken: auth.refreshToken,
    expiresAt: expiry,
  };
  setTbAuthToken(auth.token);
  return auth.token;
};

export const clearTbAuthToken = (): void => {
  cachedAuthToken = null;
  setTbAuthToken(null);
};

export interface ThingsboardDevice {
  id: { id: string };
  name: string;
  type?: string;
  status?: string;
  additionalInfo?: Record<string, unknown>;
  createdTime?: number;
  // Server-side attributes for connection status
  active?: boolean;
  lastActivityTime?: number;
  lastConnectTime?: number;
  lastDisconnectTime?: number;
  inactivityTimeout?: number;
}

export interface ThingsboardAsset {
  id: { id: string };
  name: string;
  type: string;
  label?: string;
}

export interface ThingsboardPage<T> {
  data: T[];
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export const getTenantDevices = async (params: URLSearchParams): Promise<ThingsboardPage<ThingsboardDevice>> => {
  const response = await thingsboardAPI.get<ThingsboardPage<ThingsboardDevice>>('/api/tenant/devices', {
    params,
  });

  return response.data;
};

export const getAssetByName = async (assetName: string): Promise<ThingsboardAsset | null> => {
  const response = await thingsboardAPI.get<ThingsboardPage<ThingsboardAsset>>('/api/tenant/assets', {
    params: {
      pageSize: 100,
      page: 0,
      textSearch: assetName,
    },
  });

  return response.data.data.find((asset) => asset.name === assetName) ?? null;
};

export const createAsset = async (payload: Pick<ThingsboardAsset, 'name' | 'type' | 'label'>): Promise<ThingsboardAsset> => {
  const response = await thingsboardAPI.post<ThingsboardAsset>('/api/asset', payload);
  return response.data;
};

export interface BatchTelemetryResult {
  deviceId: string;
  telemetry: Record<string, unknown>;
}

export const getBatchTelemetry = async (
  deviceIds: string[],
  keys: string[],
  limit = 1,
): Promise<BatchTelemetryResult[]> => {
  const results: BatchTelemetryResult[] = [];
  const chunkSize = 10;

  for (let index = 0; index < deviceIds.length; index += chunkSize) {
    const chunk = deviceIds.slice(index, index + chunkSize);
    const chunkPromises = chunk.map(async (deviceId) => {
      const telemetry = await getDeviceTelemetry(deviceId, keys, limit);
      return { deviceId, telemetry };
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  return results;
};

export const getDeviceTelemetry = async (
  deviceId: string,
  keys: string[],
  limit = 1,
): Promise<Record<string, unknown>> => {
  const response = await thingsboardAPI.get<Record<string, unknown>>(
    `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`,
    {
      params: {
        keys: keys.join(','),
        limit,
      },
    },
  );

  return response.data;
};

export const getHistoricalTelemetry = async (
  deviceId: string,
  keys: string[],
  startTs: number,
  endTs: number,
  limit = 1000,
): Promise<Record<string, unknown>> => {
  const response = await thingsboardAPI.get<Record<string, unknown>>(
    `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`,
    {
      params: {
        keys: keys.join(','),
        startTs,
        endTs,
        limit,
      },
    },
  );

  return response.data;
};

export const setSharedAttributes = async (
  deviceId: string,
  attributes: Record<string, unknown>,
): Promise<void> => {
  await thingsboardAPI.post(`/api/plugins/telemetry/DEVICE/${deviceId}/SHARED_SCOPE`, attributes);
};

/**
 * Get server-side attributes for a device (includes 'active' status, lastActivityTime, etc.)
 */
export const getServerAttributes = async (
  deviceId: string,
  keys?: string[],
): Promise<Record<string, any>> => {
  const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`;
  const params = keys && keys.length > 0 ? { keys: keys.join(',') } : undefined;
  
  const response = await thingsboardAPI.get<Array<{ key: string; value: any; lastUpdateTs?: number }>>(
    url,
    { params }
  );

  // Convert array response to key-value object
  const attributes: Record<string, any> = {};
  if (Array.isArray(response.data)) {
    response.data.forEach((attr) => {
      attributes[attr.key] = attr.value;
    });
  }
  
  return attributes;
};

/**
 * Get server-side attributes for multiple devices in batch
 */
export const getBatchServerAttributes = async (
  deviceIds: string[],
  keys?: string[],
): Promise<Map<string, Record<string, any>>> => {
  const results = new Map<string, Record<string, any>>();
  const chunkSize = 10;

  for (let index = 0; index < deviceIds.length; index += chunkSize) {
    const chunk = deviceIds.slice(index, index + chunkSize);
    const chunkPromises = chunk.map(async (deviceId) => {
      try {
        const attributes = await getServerAttributes(deviceId, keys);
        return { deviceId, attributes };
      } catch (error) {
        console.warn(`[ThingsBoard] Failed to fetch attributes for device ${deviceId}:`, error);
        return { deviceId, attributes: {} };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    chunkResults.forEach(({ deviceId, attributes }) => {
      results.set(deviceId, attributes);
    });
  }

  return results;
};

export const sendOneWayRpc = async (
  deviceId: string,
  method: string,
  params: Record<string, unknown>,
  timeoutMs = 5_000,
): Promise<void> => {
  try {
    await thingsboardAPI.post(
      `/api/rpc/oneway/${deviceId}`,
      {
        method,
        params,
      },
      {
        timeout: timeoutMs,
      },
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status =
        error.response?.status ?? (error.code === 'ECONNABORTED' ? 504 : undefined);
      throw new ThingsboardRpcError(
        error.response?.data?.message ?? error.message ?? 'ThingsBoard RPC request failed',
        status,
      );
    }
    throw error;
  }
};

export const sendTwoWayRpc = async <T = unknown>(
  deviceId: string,
  method: string,
  params: Record<string, unknown>,
  timeoutMs = 3000,
): Promise<T> => {
  const response = await thingsboardAPI.post<T>(
    `/api/rpc/twoway/${deviceId}`,
    {
      method,
      params,
    },
    {
      timeout: timeoutMs,
    },
  );

  return response.data;
};

export interface TelemetryEnvelope {
  subscriptionId?: number;
  entityId?: string;
  data?: Record<string, unknown>;
}

export type TelemetryCallback = (payload: TelemetryEnvelope) => void;

interface SubscriptionState {
  websocket: WebSocket | null;
  pollingTimer: TimeoutHandle | null;
  closed: boolean;
}

const DEFAULT_WEBSOCKET_PATH = '/api/ws/plugins/telemetry';

const buildWebSocketUrl = (token: string): string => {
  const baseUrl = resolveThingsboardBaseUrl();
  const url = new URL(baseUrl);
  url.pathname = DEFAULT_WEBSOCKET_PATH;
  url.searchParams.set('token', token);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
};

export interface SubscribeOptions {
  realtime?: boolean;
  pollIntervalMs?: number;
  onError?: (reason: unknown) => void;
}

export const subscribeToDeviceTelemetry = (
  deviceIds: string[],
  token: string,
  onMessage: TelemetryCallback,
  options: SubscribeOptions = {},
): (() => void) => {
  if (deviceIds.length === 0) {
    return () => undefined;
  }

  const { realtime = true, pollIntervalMs = 5000, onError } = options;
  let pollingFallbackActivated = false;
  const state: SubscriptionState = {
    websocket: null,
    pollingTimer: null,
    closed: false,
  };

  const schedulePoll = (delayMs = pollIntervalMs) => {
    if (state.pollingTimer !== null) {
      clearTimeout(state.pollingTimer);
    }

    const execute = async () => {
      if (state.closed) {
        return;
      }

      try {
        await Promise.all(
          deviceIds.map(async (deviceId) => {
            const telemetry = await getDeviceTelemetry(deviceId, DEFAULT_POLLING_TELEMETRY_KEYS, 1);
            onMessage({
              entityId: deviceId,
              data: telemetry,
            });
          }),
        );
      } catch (error) {
        onError?.(error);
      }

      if (!state.closed) {
        state.pollingTimer = setTimeout(execute, pollIntervalMs) as TimeoutHandle;
      }
    };

    state.pollingTimer = setTimeout(execute, delayMs) as TimeoutHandle;
  };

  if (!realtime) {
    schedulePoll(0);
    return () => {
      state.closed = true;
      if (state.pollingTimer !== null) {
        clearTimeout(state.pollingTimer);
      }
    };
  }

  const wsUrl = buildWebSocketUrl(token);
  const websocket = new WebSocket(wsUrl);
  state.websocket = websocket;
  const subscriptionMap = new Map<number, string>();

  const activatePollingFallback = (reason: unknown) => {
    if (state.closed || pollingFallbackActivated) {
      return;
    }
    pollingFallbackActivated = true;
    onError?.(reason);
    schedulePoll(0);
  };

  websocket.onopen = () => {
    if (state.closed) {
      websocket.close();
      return;
    }
    const subscription = {
      tsSubCmds: deviceIds.map((deviceId, index) => {
        const cmdId = index + 1;
        subscriptionMap.set(cmdId, deviceId);
        return {
          entityType: 'DEVICE' as const,
          entityId: deviceId,
          scope: 'LATEST_TELEMETRY',
          cmdId,
        };
      }),
      historyCmds: [],
      attrSubCmds: [],
    };

    websocket.send(JSON.stringify(subscription));
  };

  websocket.onmessage = (event: MessageEvent) => {
    try {
      const payload = JSON.parse(event.data) as TelemetryEnvelope;
      if (typeof payload.subscriptionId === 'number') {
        const mappedDeviceId = subscriptionMap.get(payload.subscriptionId);
        if (mappedDeviceId) {
          payload.entityId = mappedDeviceId;
        }
      }
      onMessage(payload);
    } catch (error) {
      onError?.(error);
    }
  };

  websocket.onerror = (event) => {
    activatePollingFallback(event);
  };

  websocket.onclose = () => {
    if (!state.closed) {
      activatePollingFallback(new Event('ThingsBoard websocket closed'));
    }
  };

  return () => {
    state.closed = true;
    if (state.pollingTimer !== null) {
      clearTimeout(state.pollingTimer);
    }
    if (state.websocket && state.websocket.readyState === WebSocket.OPEN) {
      state.websocket.close();
    }
  };
};

export const tbSubscribeTelemetry = subscribeToDeviceTelemetry;

export class ThingsboardRpcError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ThingsboardRpcError';
    this.status = status;
  }
}
