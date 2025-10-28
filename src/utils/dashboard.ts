import type { Target } from '@/store/useTargets';

export const formatScoreValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }
  return value % 1 === 0 ? value.toString() : value.toFixed(2);
};

export const formatDurationValue = (durationMs: number | null | undefined): string => {
  if (durationMs === null || durationMs === undefined || Number.isNaN(durationMs)) {
    return '—';
  }

  const totalSeconds = Math.max(0, durationMs / 1000);

  if (totalSeconds < 60) {
    const preciseSeconds = Number(totalSeconds.toFixed(1));
    return `${preciseSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds - minutes * 60;
  const formattedSeconds =
    remainingSeconds > 0 ? `${Number(remainingSeconds.toFixed(1))}s` : '';

  return formattedSeconds ? `${minutes}m ${formattedSeconds}` : `${minutes}m`;
};

export const resolveNumericTelemetryValue = (input: unknown): number | null => {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === 'string') {
    const numeric = Number(input);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (Array.isArray(input) && input.length > 0) {
    const first = input[0];
    if (typeof first === 'number' && Number.isFinite(first)) {
      return first;
    }
    if (first && typeof first === 'object') {
      const firstRecord = first as Record<string, unknown>;
      if ('value' in firstRecord) {
        const candidate = firstRecord.value;
        if (candidate != null) {
          return resolveNumericTelemetryValue(candidate);
        }
      }
    }
  }
  if (input && typeof input === 'object' && 'value' in (input as Record<string, unknown>)) {
    return resolveNumericTelemetryValue((input as { value: unknown }).value);
  }
  return null;
};

export const getTargetHitCount = (target: Target): number => {
  const candidates: Array<unknown> = [
    target.totalShots,
    target.lastHits,
    target.recentShotsCount,
    target.telemetry?.hits,
    target.telemetry?.totalShots,
  ];

  for (const candidate of candidates) {
    const resolved = resolveNumericTelemetryValue(candidate);
    if (typeof resolved === 'number') {
      return resolved;
    }
  }

  return 0;
};
