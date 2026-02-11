import { useEffect, useRef } from 'react';
import { throttledLogOnChange } from '@/utils/log-throttle';
import type { SessionLifecycle } from '@/components/game-session/sessionState';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import type { GameHistory } from '@/features/games/lib/device-game-flow';
import type { LiveSessionSummary } from '@/components/games/types';

export interface UseGamesDebugLoggingOptions {
  recentSessionSummary: LiveSessionSummary | null;
  gameHistory: GameHistory[];
  availableDevices: NormalizedGameDevice[];
  sessionLifecycle: SessionLifecycle;
  activeDeviceIds: string[];
  selectedDeviceIds: string[];
  directTelemetryEnabled: boolean;
  currentSessionTargets: NormalizedGameDevice[];
  sessionDurationSeconds: number | null;
  sessionRoomId: string | null;
  sessionRoomName: string | null;
}

export function useGamesDebugLogging(options: UseGamesDebugLoggingOptions): void {
  const {
    recentSessionSummary,
    gameHistory,
    availableDevices,
    sessionLifecycle,
    activeDeviceIds,
    selectedDeviceIds,
    directTelemetryEnabled,
    currentSessionTargets,
    sessionDurationSeconds,
    sessionRoomId,
    sessionRoomName,
  } = options;

  const prevLifecycleRef = useRef<SessionLifecycle>('idle');

  useEffect(() => {
    if (!recentSessionSummary) {
      throttledLogOnChange('games-session-summary', 5000, '[Games] Recent session summary cleared', null);
      return;
    }
    throttledLogOnChange('games-session-summary', 5000, '[Games] Recent session summary updated', {
      gameId: recentSessionSummary.gameId,
      gameName: recentSessionSummary.gameName,
      totalHits: recentSessionSummary.totalHits,
      durationSeconds: recentSessionSummary.durationSeconds,
      devices: recentSessionSummary.deviceStats.map((stat) => ({
        deviceId: stat.deviceId,
        deviceName: stat.deviceName,
        hitCount: stat.hitCount,
      })),
      start: new Date(recentSessionSummary.startedAt).toISOString(),
      stop: new Date(recentSessionSummary.stoppedAt).toISOString(),
    });
  }, [recentSessionSummary]);

  useEffect(() => {
    throttledLogOnChange('games-history', 10000, '[Games] Game history refreshed', {
      refreshedAt: new Date().toISOString(),
      totalEntries: gameHistory.length,
      firstEntry: gameHistory[0]
        ? {
            gameId: gameHistory[0].gameId,
            score: gameHistory[0].score,
            startTime: gameHistory[0].startTime,
          }
        : null,
      sample: gameHistory.slice(0, 5).map((entry) => ({
        gameId: entry.gameId,
        score: entry.score,
        startTime: entry.startTime,
        deviceResultCount: entry.deviceResults?.length ?? 0,
      })),
    });
  }, [gameHistory]);

  useEffect(() => {
    throttledLogOnChange('games-devices', 10000, '[Games] Available devices snapshot', {
      fetchedAt: new Date().toISOString(),
      totalDevices: availableDevices.length,
      sample: availableDevices.slice(0, 5).map((device) => ({
        deviceId: device.deviceId,
        name: device.name,
        status: device.gameStatus,
        wifiStrength: device.wifiStrength,
        hitCount: device.hitCount,
      })),
    });
  }, [availableDevices]);

  useEffect(() => {
    const previous = prevLifecycleRef.current;
    throttledLogOnChange('games-lifecycle', 2000, '[Games] Session lifecycle transition', {
      previous,
      next: sessionLifecycle,
      timestamp: new Date().toISOString(),
      activeDeviceCount: activeDeviceIds.length,
      selectedDeviceCount: selectedDeviceIds.length,
    });
    prevLifecycleRef.current = sessionLifecycle;
  }, [sessionLifecycle, activeDeviceIds.length, selectedDeviceIds.length]);

  useEffect(() => {
    throttledLogOnChange('games-telemetry-state', 3000, '[Games] Direct telemetry state change', {
      enabled: directTelemetryEnabled,
      lifecycle: sessionLifecycle,
      telemetryDevices: currentSessionTargets.map((device) => ({ id: device.deviceId, name: device.name })),
      timestamp: new Date().toISOString(),
    });
  }, [directTelemetryEnabled, sessionLifecycle, currentSessionTargets]);

  useEffect(() => {
    throttledLogOnChange('games-duration', 2000, '[Games] Session desired duration updated', {
      durationSeconds: sessionDurationSeconds,
    });
  }, [sessionDurationSeconds]);

  useEffect(() => {
    throttledLogOnChange('games-room', 2000, '[Games] Session room updated', {
      sessionRoomId,
      sessionRoomName,
    });
  }, [sessionRoomId, sessionRoomName]);
}
