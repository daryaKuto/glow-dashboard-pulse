export const TELEMETRY_SLA_MS = {
  dashboards: 10_000,
  liveGame: 1_000,
} as const;

export const TELEMETRY_POLLING_DEFAULTS = {
  defaultIntervalMs: 30_000,
  activeIntervalMs: 10_000,
  recentIntervalMs: 20_000,
  standbyIntervalMs: 45_000,
  minIntervalMs: 5_000,
  maxIntervalMs: 120_000,
  heartbeatThresholdMs: 300_000,
  backoffMultiplier: 1.5,
  maxRetry: 5,
  slowResponseWarningMs: 7_000,
} as const;

export const GAME_TELEMETRY_REALTIME = {
  heartbeatIntervalMs: 15_000,
  sampleIntervalMs: 1_000,
  fallbackGraceMs: 3_000,
} as const;

export const TELEMETRY_KEYS = ['hits', 'hit_ts', 'event', 'gameStatus', 'gameId'] as const;

export type TelemetryKey = (typeof TELEMETRY_KEYS)[number];

export const resolveIntervalWithBackoff = (
  baseInterval: number,
  errorCount: number,
): number => {
  if (errorCount <= 0) {
    return baseInterval;
  }
  const multiplier = Math.pow(TELEMETRY_POLLING_DEFAULTS.backoffMultiplier, errorCount);
  const interval = Math.round(baseInterval * multiplier);
  return Math.min(Math.max(interval, TELEMETRY_POLLING_DEFAULTS.minIntervalMs), TELEMETRY_POLLING_DEFAULTS.maxIntervalMs);
};
