import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type SessionLifecycle = 'idle' | 'selecting' | 'launching' | 'running' | 'stopping' | 'finalizing';

export interface SessionHitEntry {
  id: string;
  deviceName: string;
  timestamp: number;
  sequence: number;
  sinceStartSeconds: number;
  splitSeconds: number | null;
}

export function useSessionTimer() {
  const [seconds, setSeconds] = useState(0);
  const tickerRef = useRef<NodeJS.Timeout | null>(null);
  const anchorRef = useRef<number | null>(null);

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const reset = useCallback(
    (startTimestamp?: number | null) => {
      stopTicker();
      anchorRef.current = startTimestamp ?? null;
      setSeconds(0);
    },
    [stopTicker],
  );

  const start = useCallback(
    (startTimestamp: number) => {
      stopTicker();
      anchorRef.current = startTimestamp;
      const update = () => {
        setSeconds(Math.max(0, Math.floor((Date.now() - startTimestamp) / 1000)));
      };
      update();
      tickerRef.current = setInterval(update, 1_000);
    },
    [stopTicker],
  );

  const freeze = useCallback(
    (timestamp: number) => {
      stopTicker();
      if (anchorRef.current !== null) {
        setSeconds(Math.max(0, Math.floor((timestamp - anchorRef.current) / 1000)));
      }
    },
    [stopTicker],
  );

  useEffect(() => () => stopTicker(), [stopTicker]);

  return useMemo(
    () => ({
      seconds,
      reset,
      start,
      freeze,
    }),
    [freeze, reset, seconds, start],
  );
}

export function formatSessionDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '00:00';
  }
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function formatSecondsWithMillis(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) {
    return '0.00s';
  }
  const rounded = Math.max(0, totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded - minutes * 60;
  const secondsString = seconds.toFixed(2).padStart(5, '0');
  return minutes > 0 ? `${minutes.toString().padStart(2, '0')}:${secondsString}` : `${seconds.toFixed(2)}s`;
}
