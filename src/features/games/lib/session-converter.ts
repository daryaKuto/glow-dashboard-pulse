import type {
  GameHistory,
  SessionHitRecord,
  SessionSplit,
  SessionTransition,
} from '@/features/games/lib/device-game-flow';
import {
  mapSummaryToGameHistory,
  type GameHistorySummaryPayload,
} from '@/features/games/lib/game-history';
import { throttledLogOnChange } from '@/utils/log-throttle';
import type { RecentSession } from '@/features/profile';

function ensureNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function ensureString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return (value as unknown[])
    .map((entry) => ensureString(entry))
    .filter((entry): entry is string => entry !== null);
}

/**
 * Converts a Supabase RecentSession row into a GameHistory entry
 * suitable for the session history table and the post-game summary card.
 */
export function convertSessionToHistory(session: RecentSession): GameHistory {
  // Throttle log to prevent flooding when converting many sessions
  throttledLogOnChange(`games-convert-session-${session.id}`, 2000, '[Games] Converting Supabase session to history entry', session);

  const rawSummary = (session.thingsboardData ?? null) as Record<string, unknown> | null;
  const getSummaryValue = (key: string): unknown =>
    rawSummary && Object.prototype.hasOwnProperty.call(rawSummary, key)
      ? (rawSummary as Record<string, unknown>)[key]
      : undefined;

  const startTimestamp = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
  const durationMs = typeof session.duration === 'number' && Number.isFinite(session.duration) ? session.duration : 0;
  const summaryStart = ensureNumber(getSummaryValue('startTime'));
  const summaryEnd = ensureNumber(getSummaryValue('endTime'));

  const fallbackEnd = session.endedAt
    ? new Date(session.endedAt).getTime()
    : summaryStart !== null && durationMs > 0
      ? summaryStart + durationMs
      : durationMs > 0
        ? startTimestamp + durationMs
        : startTimestamp;

  const endTimestamp = summaryEnd ?? fallbackEnd;

  const actualDurationSeconds =
    ensureNumber(getSummaryValue('actualDuration')) ??
    (durationMs > 0
      ? Math.max(0, Math.round(durationMs / 1000))
      : Math.max(0, Math.round((endTimestamp - (summaryStart ?? startTimestamp)) / 1000)));

  const totalHits =
    ensureNumber(getSummaryValue('totalHits')) ??
    (typeof session.hitCount === 'number' && Number.isFinite(session.hitCount)
      ? session.hitCount
      : typeof session.totalShots === 'number' && Number.isFinite(session.totalShots)
        ? session.totalShots
        : 0);

  const rawDeviceResults = getSummaryValue('deviceResults');
  const deviceResults = Array.isArray(rawDeviceResults)
    ? rawDeviceResults
        .map((entry) => {
          const record = entry as Record<string, unknown>;
          const deviceId = ensureString(record.deviceId);
          if (!deviceId) {
            return null;
          }
          const deviceName = ensureString(record.deviceName) ?? deviceId;
          const hitCount = ensureNumber(record.hitCount) ?? 0;
          return { deviceId, deviceName, hitCount };
        })
        .filter((value): value is GameHistory['deviceResults'][number] => value !== null)
    : [];

  const rawTargetStats = getSummaryValue('targetStats');
  const targetStats = Array.isArray(rawTargetStats)
    ? rawTargetStats
        .map((entry) => {
          const record = entry as Record<string, unknown>;
          const deviceId = ensureString(record.deviceId);
          if (!deviceId) {
            return null;
          }
          const deviceName = ensureString(record.deviceName) ?? deviceId;
          const hitCount = ensureNumber(record.hitCount) ?? 0;
          const hitTimes = Array.isArray(record.hitTimes)
            ? (record.hitTimes as unknown[])
                .map((value) => ensureNumber(value))
                .filter((value): value is number => value !== null)
            : [];
          return {
            deviceId,
            deviceName,
            hitCount,
            hitTimes,
            averageInterval: ensureNumber(record.averageInterval) ?? 0,
            firstHitTime: ensureNumber(record.firstHitTime) ?? 0,
            lastHitTime: ensureNumber(record.lastHitTime) ?? 0,
          };
        })
        .filter((value): value is GameHistory['targetStats'][number] => value !== null)
    : [];

  const crossSummaryValue = getSummaryValue('crossTargetStats');
  const crossSummary =
    crossSummaryValue && typeof crossSummaryValue === 'object'
      ? (crossSummaryValue as Record<string, unknown>)
      : null;

  const crossTargetStats = crossSummary
    ? {
        totalSwitches: ensureNumber(crossSummary.totalSwitches) ?? 0,
        averageSwitchTime: ensureNumber(crossSummary.averageSwitchTime) ?? 0,
        switchTimes: Array.isArray(crossSummary.switchTimes)
          ? (crossSummary.switchTimes as unknown[])
              .map((value) => ensureNumber(value))
              .filter((value): value is number => value !== null)
          : [],
      }
    : null;

  const summaryRoomId = ensureString(getSummaryValue('roomId')) ?? session.roomId ?? null;
  const summaryRoomName = ensureString(getSummaryValue('roomName')) ?? session.roomName ?? null;
  const summaryDesiredDurationSeconds = ensureNumber(getSummaryValue('desiredDurationSeconds'));
  const summaryPresetId = ensureString(getSummaryValue('presetId')) ?? null;
  const summaryTargetDeviceIds = ensureStringArray(getSummaryValue('targetDeviceIds'));
  const summaryTargetDeviceNames = ensureStringArray(getSummaryValue('targetDeviceNames'));

  const fallbackTargetIds =
    deviceResults.length > 0
      ? deviceResults.map((result) => result.deviceId)
      : targetStats.map((stat) => stat.deviceId);

  const fallbackNamesById = new Map<string, string>();
  deviceResults.forEach((result) => {
    fallbackNamesById.set(result.deviceId, result.deviceName ?? result.deviceId);
  });
  targetStats.forEach((stat) => {
    fallbackNamesById.set(stat.deviceId, stat.deviceName ?? stat.deviceId);
  });

  const resolvedTargetDeviceIds =
    summaryTargetDeviceIds.length > 0 ? summaryTargetDeviceIds : fallbackTargetIds;
  const useSummaryNames =
    summaryTargetDeviceNames.length > 0 &&
    summaryTargetDeviceNames.length === resolvedTargetDeviceIds.length;
  const resolvedTargetDeviceNames = useSummaryNames
    ? summaryTargetDeviceNames
    : resolvedTargetDeviceIds.map((deviceId) => fallbackNamesById.get(deviceId) ?? deviceId);

  // Declare gameId early so it's available for hitHistory fallback
  const gameId = ensureString(getSummaryValue('gameId')) ?? session.id;

  const rawSplits = getSummaryValue('splits');
  const splits = Array.isArray(rawSplits)
    ? rawSplits
        .map((entry) => {
          const record = entry as Record<string, unknown>;
          const deviceId = ensureString(record.deviceId);
          if (!deviceId) {
            return null;
          }
          return {
            deviceId,
            deviceName: ensureString(record.deviceName) ?? deviceId,
            splitNumber: ensureNumber(record.splitNumber) ?? 0,
            time: ensureNumber(record.time) ?? 0,
            timestamp: ensureNumber(record.timestamp) ?? null,
          } satisfies SessionSplit;
        })
        .filter((value): value is SessionSplit => value !== null)
    : [];

  const rawTransitions = getSummaryValue('transitions');
  const transitions = Array.isArray(rawTransitions)
    ? rawTransitions
        .map((entry) => {
          const record = entry as Record<string, unknown>;
          const fromDevice = ensureString(record.fromDevice);
          const toDevice = ensureString(record.toDevice);
          if (!fromDevice || !toDevice) {
            return null;
          }
          return {
            fromDevice,
            toDevice,
            transitionNumber: ensureNumber(record.transitionNumber) ?? 0,
            time: ensureNumber(record.time) ?? 0,
          } satisfies SessionTransition;
        })
        .filter((value): value is SessionTransition => value !== null)
    : [];

  const rawHitHistory = getSummaryValue('hitHistory');
  const hitHistoryRecords = Array.isArray(rawHitHistory)
    ? rawHitHistory
        .map((entry) => {
          const record = entry as Record<string, unknown>;
          const deviceId = ensureString(record.deviceId);
          const timestamp = ensureNumber(record.timestamp);
          if (!deviceId || timestamp === null) {
            return null;
          }
          return {
            deviceId,
            deviceName: ensureString(record.deviceName) ?? deviceId,
            timestamp,
            gameId: ensureString(record.gameId) ?? gameId,
          } satisfies SessionHitRecord;
        })
        .filter((value): value is SessionHitRecord => value !== null)
    : [];

  const averageHitInterval =
    ensureNumber(getSummaryValue('averageHitInterval')) ??
    (totalHits > 0 && actualDurationSeconds > 0 ? actualDurationSeconds / totalHits : null);

  const durationMinutes =
    ensureNumber(getSummaryValue('durationMinutes')) ??
    (durationMs > 0
      ? Math.max(1, Math.round(durationMs / 60000))
      : actualDurationSeconds > 0
        ? Math.max(1, Math.round(actualDurationSeconds / 60))
        : 0);

  const gameName =
    ensureString(getSummaryValue('gameName')) ??
    session.scenarioName ??
    session.roomName ??
    gameId;

  const scoreValue =
    ensureNumber(getSummaryValue('score')) ??
    (typeof session.score === 'number' && Number.isFinite(session.score) ? session.score : totalHits);

  const accuracyValue =
    ensureNumber(getSummaryValue('accuracy')) ??
    (typeof session.accuracy === 'number' && Number.isFinite(session.accuracy) ? session.accuracy : null);

  const rawGoalShotsPerTarget = getSummaryValue('goalShotsPerTarget');
  const goalShotsPerTarget: Record<string, number> | undefined =
    rawGoalShotsPerTarget && typeof rawGoalShotsPerTarget === 'object' && rawGoalShotsPerTarget !== null
      ? (rawGoalShotsPerTarget as Record<string, number>)
      : undefined;

  const summaryPayload: GameHistorySummaryPayload = {
    gameId,
    gameName,
    durationMinutes,
    startTime: summaryStart ?? startTimestamp,
    endTime: endTimestamp,
    totalHits,
    actualDuration: actualDurationSeconds,
    averageHitInterval: averageHitInterval ?? undefined,
    score: scoreValue,
    accuracy: accuracyValue,
    scenarioName: session.scenarioName,
    scenarioType: session.scenarioType,
    roomName: summaryRoomName ?? session.roomName ?? null,
    roomId: summaryRoomId,
    desiredDurationSeconds: summaryDesiredDurationSeconds ?? null,
    presetId: summaryPresetId,
    targetDeviceIds: resolvedTargetDeviceIds,
    targetDeviceNames: resolvedTargetDeviceNames,
    deviceResults,
    targetStats,
    crossTargetStats,
    splits,
    transitions,
    hitHistory: hitHistoryRecords,
    goalShotsPerTarget,
  };

  return mapSummaryToGameHistory(summaryPayload);
}
