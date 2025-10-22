import { ensureThingsboardSession, fetchTargetDetails } from '@/lib/edge';
import {
  GAME_TELEMETRY_REALTIME,
  TELEMETRY_KEYS,
  TELEMETRY_POLLING_DEFAULTS,
  resolveIntervalWithBackoff,
} from '@/config/telemetry';

export interface TelemetryEnvelope {
  subscriptionId?: number;
  entityId?: string;
  data?: Record<string, unknown>;
}

export type TelemetryCallback = (message: TelemetryEnvelope) => void;

export interface TelemetryStreamOptions {
  realtime?: boolean;
  pollIntervalMs?: number;
}

const DEFAULT_KEYS = [...TELEMETRY_KEYS];

// Determines which ThingsBoard base URL to use, defaulting to the hosted cloud instance when no env override is present.
const resolveThingsboardBaseUrl = (): string => {
  const configured = import.meta.env.VITE_THINGSBOARD_URL as string | undefined;
  return configured && configured.length > 0 ? configured : 'https://thingsboard.cloud';
};

// Builds the ThingsBoard telemetry WebSocket endpoint, injecting the caller’s JWT for authentication.
const createThingsboardWsUrl = (token: string): string => {
  const baseUrl = resolveThingsboardBaseUrl();
  const url = new URL(baseUrl);
  url.pathname = '/api/ws/plugins/telemetry';
  url.searchParams.set('token', token);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
};

// Subscribes to ThingsBoard telemetry for the given devices, falling back to polling when realtime transport is unavailable.
export const subscribeToGameTelemetry = (
  deviceIds: string[],
  onMessage: TelemetryCallback,
  options: TelemetryStreamOptions & {
    token?: string;
    onError?: (reason: unknown) => void;
    onAuthError?: () => void;
  } = {},
): (() => void) => {
  if (deviceIds.length === 0) {
    return () => undefined;
  }

  const {
    realtime = true,
    pollIntervalMs,
    token: providedToken,
    onError,
    onAuthError,
  } = options;
  const pollInterval = pollIntervalMs ?? GAME_TELEMETRY_REALTIME.sampleIntervalMs;

  let pollingTimer: number | null = null;
  let websocket: WebSocket | null = null;
  let closed = false;
  let consecutivePollErrors = 0;
  const subscriptionMap = new Map<number, string>();

  const stopPolling = () => {
    if (pollingTimer !== null) {
      clearTimeout(pollingTimer);
      pollingTimer = null;
    }
  };

  const startPolling = () => {
    stopPolling();

    const executePoll = async () => {
      if (closed) {
        return;
      }

      const cycleStart = performance.now();

      try {
        const { details } = await fetchTargetDetails(deviceIds, {
          includeHistory: false,
          telemetryKeys: DEFAULT_KEYS,
        });

        details.forEach((detail) => {
          onMessage({
            entityId: detail.deviceId,
            data: detail.telemetry,
          });
        });

        consecutivePollErrors = 0;
      } catch (error) {
        consecutivePollErrors = Math.min(
          TELEMETRY_POLLING_DEFAULTS.maxRetry,
          consecutivePollErrors + 1,
        );
        console.warn('[GameTelemetry] Polling failed, applying backoff', error);
        onError?.(error);
      }

      const duration = performance.now() - cycleStart;
      if (duration > TELEMETRY_POLLING_DEFAULTS.slowResponseWarningMs) {
        console.warn('[GameTelemetry] Polling cycle exceeded SLA', {
          durationMs: Math.round(duration),
          slowdownThresholdMs: TELEMETRY_POLLING_DEFAULTS.slowResponseWarningMs,
        });
      }

      if (!closed) {
        const nextInterval = resolveIntervalWithBackoff(pollInterval, consecutivePollErrors);
        pollingTimer = setTimeout(executePoll, nextInterval) as unknown as number;
      }
    };

    pollingTimer = setTimeout(executePoll, 0) as unknown as number;
  };

  const handleRealtimePayload = (payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    const records = payload as Array<{ deviceId?: string; telemetry?: Record<string, unknown> }>;
    if (!Array.isArray(records)) {
      return;
    }

    records.forEach((record) => {
      if (!record || typeof record !== 'object') {
        return;
      }
      const deviceId = record.deviceId;
      if (!deviceId) {
        return;
      }
      onMessage({
        entityId: deviceId,
        data: record.telemetry ?? {},
      });
    });
  };

  const startRealtime = async () => {
    if (!realtime) {
      startPolling();
      return;
    }

    try {
      let tbToken: string | undefined = providedToken;
      if (!tbToken) {
        try {
          const session = await ensureThingsboardSession();
          tbToken = session.token;
        } catch (tokenError) {
          console.warn('[GameTelemetry] Unable to obtain ThingsBoard session token', tokenError);
          onAuthError?.();
          onError?.(tokenError);
        }
      }

      if (!tbToken) {
        const err = new Error('No ThingsBoard token available for realtime telemetry');
        onError?.(err);
        throw err;
      }

      const wsUrl = createThingsboardWsUrl(tbToken);
      websocket = new WebSocket(wsUrl);

      let upgraded = false;
      const fallbackTimer = window.setTimeout(() => {
        if (!upgraded && !closed) {
          console.warn('[GameTelemetry] WebSocket upgrade timed out; falling back to polling');
          websocket?.close();
          startPolling();
        }
      }, GAME_TELEMETRY_REALTIME.fallbackGraceMs);

      websocket.onopen = () => {
        upgraded = true;
        window.clearTimeout(fallbackTimer);
        stopPolling();

        subscriptionMap.clear();
        const tsSubCmds = deviceIds.map((deviceId, index) => {
          const subscriptionId = index + 1;
          subscriptionMap.set(subscriptionId, deviceId);
          return {
            entityType: 'DEVICE',
            entityId: deviceId,
            scope: 'LATEST_TELEMETRY',
            cmdId: subscriptionId,
          };
        });

        if (tsSubCmds.length > 0) {
          try {
            websocket?.send(
              JSON.stringify({
                tsSubCmds,
                historyCmds: [],
                attrSubCmds: [],
              }),
            );
          } catch (sendError) {
            console.error('[GameTelemetry] Failed to initiate ThingsBoard subscription', sendError);
            onError?.(sendError);
          }
        }
      };

      websocket.onmessage = (event: MessageEvent) => {
        try {
          const envelope = JSON.parse(event.data as string) as
            | {
                subscriptionId?: number;
                data?: Record<string, unknown>;
                error?: string;
                errorMsg?: string;
                errorCode?: number;
              }
            | {
                type: string;
                payload?: unknown;
                message?: string;
              };

          if ('subscriptionId' in envelope && typeof envelope.subscriptionId === 'number') {
            const deviceId = subscriptionMap.get(envelope.subscriptionId);
            if (!deviceId || !envelope.data) {
              return;
            }
            onMessage({
              entityId: deviceId,
              data: envelope.data,
            });
            return;
          }

          if ('type' in envelope) {
            switch (envelope.type) {
              case 'telemetry':
                handleRealtimePayload(envelope.payload);
                break;
              case 'error':
                console.warn('[GameTelemetry] Telemetry transport error', envelope.message);
                onError?.(envelope.message);
                break;
              default:
                break;
            }
          } else if ('error' in envelope || 'errorMsg' in envelope) {
            console.warn('[GameTelemetry] ThingsBoard telemetry error', envelope);
            const errorMessage = envelope.errorMsg ?? envelope.error ?? 'ThingsBoard telemetry error';
            if (
              typeof envelope.errorCode === 'number' && envelope.errorCode === 401
            ) {
              onAuthError?.();
            } else if (typeof errorMessage === 'string' && /401|unauthor/i.test(errorMessage)) {
              onAuthError?.();
            }
            onError?.(errorMessage);
          }
        } catch (error) {
          console.error('[GameTelemetry] Failed to parse realtime payload', error);
          onError?.(error);
        }
      };

      websocket.onerror = (event) => {
        console.error('[GameTelemetry] WebSocket error', event);
        onError?.(event);
      };

      websocket.onclose = (event) => {
        window.clearTimeout(fallbackTimer);
        websocket = null;
        subscriptionMap.clear();
        if (event?.code === 4401 || event?.code === 4403) {
          onAuthError?.();
        }
        if (!closed) {
          startPolling();
        }
      };
    } catch (error) {
      console.warn('[GameTelemetry] Realtime channel unavailable; falling back to polling', error);
      onError?.(error);
      startPolling();
    }
  };

  void startRealtime();

  return () => {
    closed = true;
    stopPolling();
    if (websocket && websocket.readyState === WebSocket.OPEN && subscriptionMap.size > 0) {
      try {
        const tsUnsubCmds = Array.from(subscriptionMap.keys()).map((subscriptionId) => ({ subscriptionId }));
        websocket.send(JSON.stringify({ tsUnsubCmds }));
      } catch (error) {
        console.warn('[GameTelemetry] Failed to unsubscribe ThingsBoard telemetry', error);
        onError?.(error);
      }
    }
    subscriptionMap.clear();
    websocket?.close();
  };
};
