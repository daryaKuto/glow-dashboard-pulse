import { openTelemetryWS } from '@/services/thingsboard';

export interface TelemetryEnvelope {
  subscriptionId?: number;
  entityId?: string;
  data?: Record<string, unknown>;
}

export type TelemetryCallback = (message: TelemetryEnvelope) => void;

export const subscribeToGameTelemetry = (
  token: string,
  deviceIds: string[],
  onMessage: TelemetryCallback
): (() => void) => {
  const ws = openTelemetryWS(token);
  const subscriptionDeviceMap = new Map<number, string>();

  ws.onopen = () => {
    const tsSubCmds = deviceIds.map((deviceId, index) => {
      const cmdId = index + 1;
      subscriptionDeviceMap.set(cmdId, deviceId);
      return {
        entityType: 'DEVICE',
        entityId: deviceId,
        scope: 'LATEST_TELEMETRY',
        cmdId,
      };
    });

    const subscriptionPayload = {
      tsSubCmds,
      historyCmds: [],
      attrSubCmds: [],
    };

    ws.send(JSON.stringify(subscriptionPayload));
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data as string) as TelemetryEnvelope;

      if (
        typeof data.subscriptionId === 'number' &&
        !data.entityId &&
        subscriptionDeviceMap.has(data.subscriptionId)
      ) {
        data.entityId = subscriptionDeviceMap.get(data.subscriptionId);
      }

      onMessage(data);
    } catch (error) {
      console.error('[GameTelemetry] Failed to parse telemetry message', error);
    }
  };

  ws.onerror = (error) => {
    console.error('[GameTelemetry] WebSocket error', error);
  };

  const unsubscribe = () => {
    try {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.close();
    } catch (error) {
      console.warn('[GameTelemetry] Failed to close WebSocket cleanly', error);
    }
  };

  return unsubscribe;
};
