import type { GamePreset } from '@/features/games';
import type { Target } from '@/features/targets/schema';
import { formatSessionDuration } from '@/components/game-session/sessionState';

type AxiosErrorLike = {
  isAxiosError?: boolean;
  response?: { status?: unknown };
  code?: string;
  message?: unknown;
};

export const isAxiosErrorLike = (error: unknown): error is AxiosErrorLike => {
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

export const resolveHttpStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  if ('status' in error && !(error instanceof Response)) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') {
      return status;
    }
  }
  if (isAxiosErrorLike(error) && error.response && typeof error.response.status === 'number') {
    return error.response.status as number;
  }
  if (error instanceof Response) {
    return error.status;
  }
  return undefined;
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
  return null;
};

export const getTargetTotalShots = (target: Target): number | null => {
  const candidates: Array<unknown> = [
    target.totalShots,
    target.lastHits,
    target.telemetry?.hits,
    target.telemetry?.totalShots,
  ];

  for (const candidate of candidates) {
    const resolved = resolveNumericTelemetryValue(candidate);
    if (typeof resolved === 'number') {
      return resolved;
    }
  }
  return null;
};

export const getTargetBestScore = (target: Target): number | null => {
  const candidates: Array<unknown> = [
    target.lastHits,
    target.totalShots,
    target.telemetry?.score,
    target.telemetry?.hits,
  ];

  for (const candidate of candidates) {
    const resolved = resolveNumericTelemetryValue(candidate);
    if (typeof resolved === 'number') {
      return resolved;
    }
  }

  return null;
};

// Formats preset duration seconds into mm:ss while tolerating nulls.
export const renderPresetDuration = (durationSeconds: number | null): string => {
  if (!Number.isFinite(durationSeconds) || durationSeconds === null || durationSeconds <= 0) {
    return '—';
  }
  return formatSessionDuration(durationSeconds);
};

export const resolvePresetDurationSeconds = (preset: GamePreset): number | null => {
  const candidate = preset.durationSeconds;
  if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
    return Math.round(candidate);
  }
  const settingsValue =
    preset.settings != null
      ? (preset.settings as Record<string, unknown>)['desiredDurationSeconds']
      : null;
  if (typeof settingsValue === 'number' && Number.isFinite(settingsValue) && settingsValue > 0) {
    return Math.round(settingsValue);
  }
  return null;
};
