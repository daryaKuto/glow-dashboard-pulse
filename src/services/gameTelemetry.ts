import { supabase } from '@/integrations/supabase/client';
import { fetchTargetDetails } from '@/lib/edge';
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

const createWebSocketUrl = async (deviceIds: string[]): Promise<string> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) {
    throw new Error('Supabase URL is not configured');
  }

  const { data: sessionData, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('No active Supabase session found');
  }

  const url = new URL(supabaseUrl);
  url.pathname = '/functions/v1/device-telemetry';
  url.searchParams.set('deviceIds', deviceIds.join(','));
  url.searchParams.set('access_token', token);

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (anonKey) {
    url.searchParams.set('apikey', anonKey);
  }

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
};

export const subscribeToGameTelemetry = (
  deviceIds: string[],
  onMessage: TelemetryCallback,
  options: TelemetryStreamOptions = {},
): (() => void) => {
  if (deviceIds.length === 0) {
    return () => undefined;
  }

  const { realtime = true, pollIntervalMs } = options;
  const pollInterval = pollIntervalMs ?? GAME_TELEMETRY_REALTIME.sampleIntervalMs;

  let pollingTimer: number | null = null;
  let websocket: WebSocket | null = null;
  let closed = false;
  let consecutivePollErrors = 0;

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
      const wsUrl = await createWebSocketUrl(deviceIds);
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
      };

      websocket.onmessage = (event: MessageEvent) => {
        try {
          const envelope = JSON.parse(event.data as string) as {
            type: string;
            payload?: unknown;
            message?: string;
          };

          switch (envelope.type) {
            case 'telemetry':
              handleRealtimePayload(envelope.payload);
              break;
            case 'error':
              console.warn('[GameTelemetry] Edge telemetry error', envelope.message);
              break;
            default:
              break;
          }
        } catch (error) {
          console.error('[GameTelemetry] Failed to parse realtime payload', error);
        }
      };

      websocket.onerror = (event) => {
        console.error('[GameTelemetry] WebSocket error', event);
      };

      websocket.onclose = () => {
        window.clearTimeout(fallbackTimer);
        websocket = null;
        if (!closed) {
          startPolling();
        }
      };
    } catch (error) {
      console.warn('[GameTelemetry] Realtime channel unavailable; falling back to polling', error);
      startPolling();
    }
  };

  void startRealtime();

  return () => {
    closed = true;
    stopPolling();
    websocket?.close();
  };
};
