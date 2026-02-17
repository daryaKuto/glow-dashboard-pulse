import type { GameHistory, SessionHitRecord, SessionSplit, SessionTransition } from '@/features/games/lib/device-game-flow';
import type { LiveSessionSummary } from '@/features/games/ui/components/types';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import type { SplitRecord, TransitionRecord, RoundSplit } from '@/features/games/lib/telemetry-types';
import { calculateSessionScore } from '@/domain/games/rules';
import { logger } from '@/shared/lib/logger';

export interface BuildLiveSessionSummaryArgs {
  gameId: string;
  gameName?: string;
  startTime: number;
  stopTime: number;
  hitHistory: SessionHitRecord[];
  splitRecords: SplitRecord[];
  transitionRecords: TransitionRecord[];
  devices: NormalizedGameDevice[];
  roomId?: string | null;
  roomName?: string | null;
  desiredDurationSeconds?: number | null;
  presetId?: string | null;
  goalShotsPerTarget?: Record<string, number>;
  /** Target order for multi-target sessions with order enforcement */
  targetOrder?: string[];
  /** Round-based splits for multi-target sessions (from useDirectTbTelemetry) */
  roundSplits?: RoundSplit[];
}

export function convertHistoryEntryToLiveSummary(entry: GameHistory): LiveSessionSummary {
  const sortedHitHistory = Array.isArray(entry.hitHistory)
    ? [...entry.hitHistory].sort((a, b) => a.timestamp - b.timestamp)
    : [];

  const hitsByDevice = new Map<string, number[]>();
  sortedHitHistory.forEach((hit) => {
    const existing = hitsByDevice.get(hit.deviceId);
    if (existing) {
      existing.push(hit.timestamp);
    } else {
      hitsByDevice.set(hit.deviceId, [hit.timestamp]);
    }
  });

  let deviceStats: GameHistory['targetStats'];
  if (Array.isArray(entry.targetStats) && entry.targetStats.length > 0) {
    deviceStats = entry.targetStats.map((stat) => ({
      deviceId: stat.deviceId,
      deviceName: stat.deviceName,
      hitCount: stat.hitCount,
      hitTimes: [...stat.hitTimes],
      averageInterval: stat.averageInterval,
      firstHitTime: stat.firstHitTime,
      lastHitTime: stat.lastHitTime,
    }));
  } else if (Array.isArray(entry.deviceResults) && entry.deviceResults.length > 0) {
    deviceStats = entry.deviceResults.map((result) => {
      const deviceHits = hitsByDevice.get(result.deviceId) ?? [];
      const intervals = deviceHits.slice(1).map((ts, idx) => (ts - deviceHits[idx]) / 1000);

      return {
        deviceId: result.deviceId,
        deviceName: result.deviceName ?? result.deviceId,
        hitCount: Number.isFinite(result.hitCount) ? result.hitCount : deviceHits.length,
        hitTimes: [...deviceHits],
        averageInterval: intervals.length
          ? Number((intervals.reduce((sum, value) => sum + value, 0) / intervals.length).toFixed(2))
          : 0,
        firstHitTime: deviceHits[0] ?? 0,
        lastHitTime: deviceHits[deviceHits.length - 1] ?? 0,
      };
    });
  } else {
    deviceStats = [];
  }

  const totalHits = Number.isFinite(entry.totalHits)
    ? entry.totalHits
    : deviceStats.reduce((sum, stat) => sum + (stat.hitCount ?? 0), 0);

  const firstHitTimestamp = sortedHitHistory.length > 0 ? sortedHitHistory[0].timestamp : undefined;
  const lastHitTimestamp =
    sortedHitHistory.length > 0 ? sortedHitHistory[sortedHitHistory.length - 1].timestamp : undefined;

  const startTime = Number.isFinite(entry.startTime) ? entry.startTime : firstHitTimestamp ?? Date.now();
  const endTime = Number.isFinite(entry.endTime) ? entry.endTime : lastHitTimestamp ?? startTime;
  const derivedFirstHitTimestamp = sortedHitHistory.length > 0 ? sortedHitHistory[0].timestamp : startTime;
  const derivedLastHitTimestamp = sortedHitHistory.length > 0
    ? sortedHitHistory[sortedHitHistory.length - 1].timestamp
    : derivedFirstHitTimestamp;
  const totalSessionSpan = Math.max(1, endTime - startTime);
  const activeSpanRaw = derivedLastHitTimestamp - derivedFirstHitTimestamp;
  const normalizedActiveSpan =
    totalHits < 2 || !Number.isFinite(activeSpanRaw) || activeSpanRaw <= 0 ? totalSessionSpan : activeSpanRaw;
  const efficiencyScoreFromHistory =
    totalHits > 0 ? Math.round((totalHits * (totalSessionSpan / Math.max(1, normalizedActiveSpan))) * 100) / 100 : 0;
  const efficiencyScore = Number.isFinite(efficiencyScoreFromHistory)
    ? efficiencyScoreFromHistory
    : typeof entry.score === 'number' && Number.isFinite(entry.score)
      ? entry.score
      : 0;
  const computedDurationSeconds = Math.max(0, (endTime - startTime) / 1000);
  const durationSeconds = Number.isFinite(entry.actualDuration) && entry.actualDuration > 0
    ? Number(entry.actualDuration.toFixed(2))
    : Number(computedDurationSeconds.toFixed(2));

  const computedAverageHitInterval = (() => {
    if (sortedHitHistory.length < 2) {
      return 0;
    }
    const intervals = sortedHitHistory
      .slice(1)
      .map((hit, idx) => (hit.timestamp - sortedHitHistory[idx].timestamp) / 1000);
    return intervals.length
      ? Number((intervals.reduce((sum, value) => sum + value, 0) / intervals.length).toFixed(2))
      : 0;
  })();

  const averageHitInterval =
    typeof entry.averageHitInterval === 'number' && Number.isFinite(entry.averageHitInterval)
      ? Number(entry.averageHitInterval.toFixed(2))
      : computedAverageHitInterval;

  entry.roomId = typeof entry.roomId === 'string' && entry.roomId.length > 0 ? entry.roomId : null;
  entry.roomName = entry.roomName ?? null;

  const normalizedDesiredDuration =
    typeof entry.desiredDurationSeconds === 'number' && Number.isFinite(entry.desiredDurationSeconds) && entry.desiredDurationSeconds > 0
      ? Math.round(entry.desiredDurationSeconds)
      : null;
  entry.desiredDurationSeconds = normalizedDesiredDuration;
  entry.presetId = typeof entry.presetId === 'string' && entry.presetId.length > 0 ? entry.presetId : null;

  const splits = Array.isArray(entry.splits) ? entry.splits.map((split) => ({ ...split })) : [];
  const transitions = Array.isArray(entry.transitions)
    ? entry.transitions.map((transition) => ({ ...transition }))
    : [];

  const aggregateTargets = Array.isArray(entry.deviceResults) && entry.deviceResults.length > 0 ? entry.deviceResults : deviceStats;
  const fallbackTargets = aggregateTargets.map((result) => ({
    deviceId: result.deviceId,
    deviceName: result.deviceName ?? result.deviceId,
  }));

  const targetDeviceIds =
    Array.isArray(entry.targetDeviceIds) && entry.targetDeviceIds.length > 0
      ? entry.targetDeviceIds
      : fallbackTargets.map((target) => target.deviceId);

  const targetDeviceNames = Array.isArray(entry.targetDeviceNames) ? entry.targetDeviceNames : [];

  const targets = targetDeviceIds.map((deviceId, index) => {
    const existingName =
      targetDeviceNames[index] ??
      deviceStats.find((stat) => stat.deviceId === deviceId)?.deviceName ??
      fallbackTargets.find((target) => target.deviceId === deviceId)?.deviceName ??
      deviceId;
    return {
      deviceId,
      deviceName: existingName ?? deviceId,
    };
  });

  entry.targetDeviceIds = targets.map((target) => target.deviceId);
  entry.targetDeviceNames = targets.map((target) => target.deviceName);

  // Calculate time-based score using the new scoring system.
  // Filter goalShotsPerTarget to only include devices that actually participated
  // in this session — presets may carry phantom goal keys for devices that were
  // not selected, causing calculateSessionScore to mark the run as invalid.
  const rawGoalShotsPerTarget = entry.goalShotsPerTarget ?? {};
  const participatingDeviceIds = new Set([
    ...sortedHitHistory.map((h) => h.deviceId),
    ...targets.map((t) => t.deviceId),
  ]);
  const goalShotsPerTarget: Record<string, number> = {};
  for (const [id, shots] of Object.entries(rawGoalShotsPerTarget)) {
    if (participatingDeviceIds.has(id)) {
      goalShotsPerTarget[id] = shots;
    }
  }
  let scoreResult = calculateSessionScore(sortedHitHistory, goalShotsPerTarget, startTime);

  // Cross-check: if score says invalid but deviceResults/targetStats show all goals met,
  // the hitHistory deviceIds likely don't match goalShotsPerTarget keys.
  // Trust deviceResults in this case and recalculate from deviceStats hitTimes.
  if (!scoreResult.isValid && Object.keys(goalShotsPerTarget).length > 0) {
    const goalKeys = Object.keys(goalShotsPerTarget);
    const hitDeviceIds = [...new Set(sortedHitHistory.map((h) => h.deviceId))];
    logger.warn('[convertHistoryEntryToLiveSummary] Score invalid despite goals set', {
      goalKeys,
      hitDeviceIds,
      hitHistoryLength: sortedHitHistory.length,
      goalShotsPerTarget,
      entryDeviceResults: entry.deviceResults?.map((d) => ({ id: d.deviceId, hits: d.hitCount })),
    });

    const allGoalsMet = Object.entries(goalShotsPerTarget).every(([deviceId, required]) => {
      const result = deviceStats.find((d) => d.deviceId === deviceId);
      return result && result.hitCount >= required;
    });

    if (allGoalsMet) {
      // Goals are met per deviceResults — recalculate score from deviceStats hitTimes
      const syntheticHitHistory = deviceStats.flatMap((stat) =>
        stat.hitTimes.map((ts) => ({ deviceId: stat.deviceId, timestamp: ts })),
      );
      const retryResult = calculateSessionScore(
        syntheticHitHistory.sort((a, b) => a.timestamp - b.timestamp),
        goalShotsPerTarget,
        startTime,
      );
      if (retryResult.isValid) {
        scoreResult = retryResult;
      }
    }
  }

  return {
    gameId: entry.gameId,
    gameName: entry.gameName,
    startedAt: startTime,
    stoppedAt: endTime,
    durationSeconds,
    totalHits,
    averageHitInterval,
    deviceStats,
    crossTargetStats: entry.crossTargetStats ?? null,
    splits,
    transitions,
    targets,
    hitHistory: sortedHitHistory,
    roomId: entry.roomId ?? null,
    roomName: entry.roomName ?? null,
    desiredDurationSeconds: entry.desiredDurationSeconds ?? null,
    targetDeviceIds: entry.targetDeviceIds ?? targets.map((target) => target.deviceId),
    presetId: entry.presetId ?? null,
    historyEntry: {
      ...entry,
      // Ensure goalShotsPerTarget is preserved
      goalShotsPerTarget: entry.goalShotsPerTarget ?? undefined,
    },
    efficiencyScore, // deprecated, kept for backwards compatibility
    score: scoreResult.score,
    isValid: scoreResult.isValid,
  };
}

// Consolidates telemetry streams and device metadata into a reusable session report.
export function buildLiveSessionSummary({
  gameId,
  gameName,
  startTime,
  stopTime,
  hitHistory,
  splitRecords,
  transitionRecords,
  devices,
  roomId = null,
  roomName = null,
  desiredDurationSeconds = null,
  presetId = null,
  goalShotsPerTarget = {},
  targetOrder,
  roundSplits: inputRoundSplits = [],
}: BuildLiveSessionSummaryArgs): LiveSessionSummary {
  const safeStart = Number.isFinite(startTime) ? startTime : stopTime;
  const durationMs = Math.max(0, stopTime - safeStart);
  const rawDurationSeconds = durationMs / 1000;
  const durationSeconds = Number(rawDurationSeconds.toFixed(2));
  const deviceMap = new Map(devices.map((device) => [device.deviceId, device]));
  const deviceIdSet = new Set(devices.map((device) => device.deviceId));

  const sortedHits = [...hitHistory]
    .filter((hit) => deviceIdSet.size === 0 || deviceIdSet.has(hit.deviceId))
    .sort((a, b) => a.timestamp - b.timestamp);
  const totalHits = sortedHits.length;

  // Filter goalShotsPerTarget to only include devices that are part of this session.
  // Presets may carry phantom goal keys for devices that were not selected.
  const filteredGoalShotsPerTarget: Record<string, number> = {};
  for (const [id, shots] of Object.entries(goalShotsPerTarget)) {
    if (deviceIdSet.has(id)) {
      filteredGoalShotsPerTarget[id] = shots;
    }
  }

  // Calculate time-based score using the new scoring system
  // Score = time of last required hit (lower is better)
  // A run is valid only if all required hits occur
  const scoreResult = calculateSessionScore(sortedHits, filteredGoalShotsPerTarget, safeStart, {
    targetOrder,
  });

  if (!scoreResult.isValid && Object.keys(filteredGoalShotsPerTarget).length > 0) {
    const goalKeys = Object.keys(filteredGoalShotsPerTarget);
    const hitDeviceIds = [...new Set(hitHistory.map((h) => h.deviceId))];
    const filteredDeviceIds = [...new Set(sortedHits.map((h) => h.deviceId))];
    logger.warn('[buildLiveSessionSummary] Score invalid despite goals set', {
      goalKeys,
      hitDeviceIds,
      filteredDeviceIds,
      deviceIdSetContents: [...deviceIdSet],
      hitHistoryLength: hitHistory.length,
      sortedHitsLength: sortedHits.length,
      totalHits,
      filteredGoalShotsPerTarget,
    });
  }

  // Keep legacy efficiencyScore for backwards compatibility (deprecated)
  const firstHitTimestamp = sortedHits.length > 0 ? sortedHits[0].timestamp : safeStart;
  const lastHitTimestamp = sortedHits.length > 0 ? sortedHits[sortedHits.length - 1].timestamp : firstHitTimestamp;
  const totalSessionSpan = Math.max(1, stopTime - safeStart);
  const activeSpanRaw = lastHitTimestamp - firstHitTimestamp;
  const normalizedActiveSpan =
    totalHits < 2 || !Number.isFinite(activeSpanRaw) || activeSpanRaw <= 0 ? totalSessionSpan : activeSpanRaw;
  const efficiencyScore =
    totalHits > 0 ? Math.round((totalHits * (totalSessionSpan / Math.max(1, normalizedActiveSpan))) * 100) / 100 : 0;

  const deviceStats = devices.map((device) => {
    const hitsForDevice = sortedHits.filter((hit) => hit.deviceId === device.deviceId);
    const hitTimes = hitsForDevice.map((hit) => hit.timestamp);
    const sortedHitTimes = [...hitTimes].sort((a, b) => a - b);
    const intervals = sortedHitTimes.slice(1).map((ts, idx) => (ts - sortedHitTimes[idx]) / 1000);

    return {
      deviceId: device.deviceId,
      deviceName: device.name ?? device.deviceId,
      hitCount: hitsForDevice.length,
      hitTimes: sortedHitTimes,
      averageInterval: intervals.length
        ? Number((intervals.reduce((sum, value) => sum + value, 0) / intervals.length).toFixed(2))
        : 0,
      firstHitTime: sortedHitTimes[0] ?? 0,
      lastHitTime: sortedHitTimes[sortedHitTimes.length - 1] ?? 0,
    };
  });

  const isMultiTarget = devices.length > 1;

  // Compute round completion times for multi-target sessions.
  // Used for both averageHitInterval and crossTargetStats.
  let roundCompletionTimes: number[] = [];
  if (isMultiTarget) {
    // Prefer pre-computed roundSplits from the telemetry hook
    if (inputRoundSplits.length > 0) {
      roundCompletionTimes = inputRoundSplits.map((r) => r.completedAt);
      console.log(
        `%c[SUMMARY] Multi-target: using ${inputRoundSplits.length} pre-computed roundSplits%c | roundTimes: [${inputRoundSplits.map((r) => r.roundTime.toFixed(3) + 's').join(', ')}] | pairGaps: [${inputRoundSplits.map((r) => r.pairGap.toFixed(3) + 's').join(', ')}]`,
        'color: #CE3E0A; font-weight: bold; font-size: 12px',
        'color: inherit; font-size: 12px',
      );
    } else {
      // Fallback: compute from hitHistory
      const hitsByDevice = new Map<string, number[]>();
      sortedHits.forEach((hit) => {
        const arr = hitsByDevice.get(hit.deviceId) ?? [];
        arr.push(hit.timestamp);
        hitsByDevice.set(hit.deviceId, arr);
      });
      if (hitsByDevice.size > 1) {
        const minRounds = Math.min(...[...hitsByDevice.values()].map((arr) => arr.length));
        for (let r = 0; r < minRounds; r++) {
          const maxTs = Math.max(...[...hitsByDevice.values()].map((arr) => arr[r]));
          roundCompletionTimes.push(maxTs);
        }
      }
      console.log(
        `%c[SUMMARY] Multi-target: computed ${roundCompletionTimes.length} rounds from hitHistory fallback%c`,
        'color: #CE3E0A; font-weight: bold; font-size: 12px',
        'color: inherit; font-size: 12px',
      );
    }
  }

  // averageHitInterval: for multi-target, use round cadence; for single-target, use consecutive hit intervals
  let averageHitInterval: number;
  if (isMultiTarget && roundCompletionTimes.length > 1) {
    const roundIntervals = roundCompletionTimes.slice(1).map(
      (ts, idx) => (ts - roundCompletionTimes[idx]) / 1000,
    );
    averageHitInterval = roundIntervals.length
      ? Number((roundIntervals.reduce((sum, value) => sum + value, 0) / roundIntervals.length).toFixed(2))
      : 0;
    console.log(
      `%c[SUMMARY] averageHitInterval (multi-target round cadence)%c: ${averageHitInterval}s | roundIntervals: [${roundIntervals.map((i) => i.toFixed(3) + 's').join(', ')}]`,
      'color: #816E94; font-weight: bold',
      'color: inherit',
    );
  } else {
    const overallIntervals = sortedHits.slice(1).map((hit, idx) => (hit.timestamp - sortedHits[idx].timestamp) / 1000);
    averageHitInterval = overallIntervals.length
      ? Number((overallIntervals.reduce((sum, value) => sum + value, 0) / overallIntervals.length).toFixed(2))
      : 0;
    console.log(
      `%c[SUMMARY] averageHitInterval (single-target sequential)%c: ${averageHitInterval}s | ${overallIntervals.length} intervals`,
      'color: #816E94; font-weight: bold',
      'color: inherit',
    );
  }

  // crossTargetStats: for multi-target, use round-to-round intervals; for single-target, use sequential switches
  let crossTargetStats: GameHistory['crossTargetStats'];
  if (isMultiTarget && roundCompletionTimes.length > 1) {
    const roundIntervals = roundCompletionTimes.slice(1).map(
      (ts, idx) => Number(((ts - roundCompletionTimes[idx]) / 1000).toFixed(2)),
    );
    crossTargetStats = {
      totalSwitches: roundIntervals.length,
      averageSwitchTime: roundIntervals.length
        ? Number((roundIntervals.reduce((a, b) => a + b, 0) / roundIntervals.length).toFixed(2))
        : 0,
      switchTimes: roundIntervals,
    };
    console.log(
      `%c[SUMMARY] crossTargetStats (multi-target round-based)%c: totalSwitches: ${crossTargetStats.totalSwitches} | avgSwitchTime: ${crossTargetStats.averageSwitchTime}s | switchTimes: [${roundIntervals.map((i) => i + 's').join(', ')}]`,
      'color: #816E94; font-weight: bold',
      'color: inherit',
    );
  } else {
    const switchTimes: number[] = [];
    for (let i = 1; i < sortedHits.length; i++) {
      if (sortedHits[i].deviceId !== sortedHits[i - 1].deviceId) {
        const switchSpan = (sortedHits[i].timestamp - sortedHits[i - 1].timestamp) / 1000;
        switchTimes.push(Number(switchSpan.toFixed(2)));
      }
    }
    crossTargetStats = {
      totalSwitches: switchTimes.length,
      averageSwitchTime: switchTimes.length
        ? Number((switchTimes.reduce((sum, value) => sum + value, 0) / switchTimes.length).toFixed(2))
        : 0,
      switchTimes,
    };
    console.log(
      `%c[SUMMARY] crossTargetStats (single-target sequential)%c: totalSwitches: ${crossTargetStats.totalSwitches} | avgSwitchTime: ${crossTargetStats.averageSwitchTime}s`,
      'color: #816E94; font-weight: bold',
      'color: inherit',
    );
  }

  const splits: SessionSplit[] = splitRecords
    .filter((split) => deviceIdSet.has(split.deviceId))
    .map((split) => ({
      deviceId: split.deviceId,
      deviceName: split.deviceName ?? deviceMap.get(split.deviceId)?.name ?? split.deviceId,
      splitNumber: split.splitNumber,
      time: typeof split.time === 'number' ? split.time : Number(split.time) || 0,
      timestamp: typeof split.timestamp === 'number' ? split.timestamp : null,
    }))
    .sort((a, b) => a.splitNumber - b.splitNumber);

  const transitions: SessionTransition[] = transitionRecords
    .filter((transition) => deviceIdSet.has(transition.fromDevice) || deviceIdSet.has(transition.toDevice))
    .map((transition) => ({
      fromDevice: transition.fromDeviceName ?? transition.fromDevice,
      toDevice: transition.toDeviceName ?? transition.toDevice,
      transitionNumber: transition.transitionNumber,
      time: typeof transition.time === 'number' ? transition.time : Number(transition.time) || 0,
    }))
    .sort((a, b) => a.transitionNumber - b.transitionNumber);

  const targets = devices.map((device) => ({
    deviceId: device.deviceId,
    deviceName: device.name ?? device.deviceId,
  }));

  // Use time-based score for the history entry, fallback to efficiencyScore for backwards compatibility
  const historyEntryScore = scoreResult.score ?? efficiencyScore;

  const historyEntry: GameHistory = {
    gameId,
    gameName: gameName ?? `Game ${new Date(safeStart).toLocaleTimeString()}`,
    duration: Math.max(1, Math.ceil(rawDurationSeconds / 60)),
    startTime: safeStart,
    endTime: stopTime,
    score: historyEntryScore,
    deviceResults: deviceStats.map(({ deviceId, deviceName, hitCount }) => ({
      deviceId,
      deviceName,
      hitCount,
    })),
    totalHits,
    actualDuration: durationSeconds,
    averageHitInterval,
    targetStats: deviceStats,
    crossTargetStats,
  };
  historyEntry.roomId = roomId ?? null;
  historyEntry.roomName = roomName ?? null;
  const normalizedDesiredDuration =
    typeof desiredDurationSeconds === 'number' && Number.isFinite(desiredDurationSeconds) && desiredDurationSeconds > 0
      ? Math.round(desiredDurationSeconds)
      : null;
  historyEntry.desiredDurationSeconds = normalizedDesiredDuration;
  historyEntry.presetId = presetId ?? null;
  if (Object.keys(filteredGoalShotsPerTarget).length > 0) {
    historyEntry.goalShotsPerTarget = filteredGoalShotsPerTarget;
  }
  historyEntry.targetDeviceIds = targets.map((target) => target.deviceId);
  historyEntry.targetDeviceNames = targets.map((target) => target.deviceName);
  historyEntry.splits = splits;
  historyEntry.transitions = transitions;
  historyEntry.hitHistory = sortedHits;
  if (inputRoundSplits.length > 0) {
    historyEntry.roundSplits = inputRoundSplits;
  }

  return {
    gameId: historyEntry.gameId,
    gameName: historyEntry.gameName,
    startedAt: historyEntry.startTime,
    stoppedAt: historyEntry.endTime,
    durationSeconds,
    totalHits,
    averageHitInterval,
    deviceStats,
    crossTargetStats: historyEntry.crossTargetStats,
    splits,
    transitions,
    targets,
    hitHistory: historyEntry.hitHistory ?? [],
    roomId: historyEntry.roomId ?? null,
    roomName: historyEntry.roomName ?? null,
    desiredDurationSeconds: historyEntry.desiredDurationSeconds ?? null,
    targetDeviceIds: historyEntry.targetDeviceIds ?? targets.map((target) => target.deviceId),
    presetId: historyEntry.presetId ?? null,
    historyEntry,
    efficiencyScore, // deprecated, kept for backwards compatibility
    score: scoreResult.score,
    isValid: scoreResult.isValid,
  };
}
