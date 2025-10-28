import { useCallback, useMemo, useRef, useState } from 'react';

type ActivationParams = {
  triggeredAt: number;
  telemetryTimestamp: number;
};

// Stores the moment a start command was issued and marks the session active once telemetry confirms.
export function useSessionActivation() {
  const [triggeredAt, setTriggeredAt] = useState<number | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<number | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const latestTriggerRef = useRef<number | null>(null);

  const markTriggered = useCallback((timestamp: number) => {
    latestTriggerRef.current = timestamp;
    setTriggeredAt(timestamp);
    setIsConfirmed(false);
    setConfirmedAt(null);
  }, []);

  const markTelemetryConfirmed = useCallback((timestamp: number) => {
    if (latestTriggerRef.current === null) {
      return;
    }
    if (isConfirmed) {
      return;
    }
    setConfirmedAt(timestamp);
    setIsConfirmed(true);
  }, [isConfirmed]);

  const resetActivation = useCallback(() => {
    latestTriggerRef.current = null;
    setTriggeredAt(null);
    setConfirmedAt(null);
    setIsConfirmed(false);
  }, []);

  const activationParams = useMemo<ActivationParams | null>(() => {
    if (triggeredAt === null || confirmedAt === null) {
      return null;
    }
    return {
      triggeredAt,
      telemetryTimestamp: confirmedAt,
    };
  }, [triggeredAt, confirmedAt]);

  return {
    triggeredAt,
    confirmedAt,
    isConfirmed,
    markTriggered,
    markTelemetryConfirmed,
    resetActivation,
    activationParams,
  };
}
