import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Gamepad2,
  Play,
  Square,
  Plus,
  Wifi,
  WifiOff,
  AlertCircle,
  Activity,
  Target as TargetIcon,
  ArrowLeft,
  Trophy
} from 'lucide-react';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/components/ui/sonner';
import type { DeviceStatus, GameHistory } from '@/services/device-game-flow';
import { useGameDevices, type NormalizedGameDevice, DEVICE_ONLINE_STALE_THRESHOLD_MS } from '@/hooks/useGameDevices';
import { fetchTargetDetails } from '@/lib/edge';
import { useTargets, type Target } from '@/store/useTargets';
import { useGameSession } from '@/hooks/useGameSession';
import { useGameTelemetry } from '@/hooks/useGameTelemetry';
import { useThingsboardToken } from '@/hooks/useThingsboardToken';
import {
  fetchGameHistory as fetchPersistedGameHistory,
  saveGameHistory,
  mapSummaryToGameHistory,
  type GameHistorySummaryPayload,
} from '@/services/game-history';
import { useAuth } from '@/providers/AuthProvider';
import { fetchRecentSessions, type RecentSession } from '@/services/profile';

type GameStage = 'main-dashboard' | 'game-control';

type HitRecord = {
  deviceId: string;
  deviceName: string;
  timestamp: number;
  gameId: string;
};

const Games: React.FC = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentStage, setCurrentStage] = useState<GameStage>('main-dashboard');

  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const { isLoading: loadingDevices, refresh: refreshGameDevices, pollInfo: pollGameControlInfo } =
    useGameDevices({ immediate: false });
  const targetsSnapshot = useTargets((state) => state.targets);
  const targetsStoreLoading = useTargets((state) => state.isLoading);
  const refreshTargets = useTargets((state) => state.refresh);
  const [availableDevices, setAvailableDevices] = useState<NormalizedGameDevice[]>([]);
  const [totalShotsFromThingsBoard, setTotalShotsFromThingsBoard] = useState<number>(0);
  const [loadingTotalShots, setLoadingTotalShots] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [gameStopTime, setGameStopTime] = useState<number | null>(null);
  const [hitCounts, setHitCounts] = useState<Record<string, number>>({});
  const [hitHistory, setHitHistory] = useState<HitRecord[]>([]);
  const [activeDeviceIds, setActiveDeviceIds] = useState<string[]>([]);

  const currentGameDevicesRef = useRef<string[]>([]);
  const availableDevicesRef = useRef<NormalizedGameDevice[]>([]);
  // Centralised token manager so the Games page always has a fresh ThingsBoard JWT for sockets/RPCs.
  const { session: tbSession, refresh: refreshThingsboardSession } = useThingsboardToken();

  const convertSessionToHistory = useCallback(
    (session: RecentSession): GameHistory => {
      const ensureNumber = (value: unknown): number | null => {
        if (value === null || value === undefined) {
          return null;
        }
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
      };

      const ensureString = (value: unknown): string | null => {
        if (typeof value === 'string' && value.trim().length > 0) {
          return value;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          return String(value);
        }
        return null;
      };

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

      const gameId = ensureString(getSummaryValue('gameId')) ?? session.id;
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
        roomName: session.roomName,
        deviceResults,
        targetStats,
        crossTargetStats,
      };

      return mapSummaryToGameHistory(summaryPayload);
    },
    []
  );

  // Pulls persisted history rows so the dashboard reflects stored and recent game sessions.
  const loadGameHistory = useCallback(async () => {
    if (!user) {
      return;
    }

    setIsHistoryLoading(true);
    try {
      const [historyResult, sessionsResult] = await Promise.allSettled([
        fetchPersistedGameHistory(),
        fetchRecentSessions(user.id, 20),
      ]);

      const persistedHistory =
        historyResult.status === 'fulfilled' ? historyResult.value.history ?? [] : [];
      if (historyResult.status === 'rejected') {
        console.warn('[Games] Failed to load persisted game history', historyResult.reason);
      }

      const sessionHistory =
        sessionsResult.status === 'fulfilled'
          ? sessionsResult.value.map(convertSessionToHistory)
          : [];
      if (sessionsResult.status === 'rejected') {
        console.warn('[Games] Failed to load session history', sessionsResult.reason);
      }

      const historyMap = new Map<string, GameHistory>();
      persistedHistory.forEach((entry) => {
        historyMap.set(entry.gameId, {
          ...entry,
          score: entry.score ?? entry.totalHits ?? 0,
        });
      });
      sessionHistory.forEach((entry) => {
        const existing = historyMap.get(entry.gameId);
        if (!existing || (existing.totalHits ?? 0) === 0) {
          historyMap.set(entry.gameId, entry);
        }
      });

      const combinedHistory = Array.from(historyMap.values())
        .sort((a, b) => (b.startTime ?? 0) - (a.startTime ?? 0))
        .slice(0, 30);

      setGameHistory(combinedHistory);
    } catch (error) {
      console.warn('[Games] Failed to load game history', error);
      setGameHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [convertSessionToHistory, user]);

  useEffect(() => {
    if (!user) {
      setGameHistory([]);
      setIsHistoryLoading(false);
      return;
    }
    void loadGameHistory();
  }, [loadGameHistory, user]);

  const {
    startGameSession,
    stopGameSession,
    currentGameId,
    isStarting,
    isStopping,
  } = useGameSession({
    onStop: () => undefined,
  });

  // Loads the latest edge snapshot and keeps local mirrors (state + refs) in sync so downstream hooks can reuse the same data.
  const loadLiveDevices = useCallback(
    async ({ silent = false, showToast = false }: { silent?: boolean; showToast?: boolean } = {}) => {
      try {
        const result = await refreshGameDevices({ silent });
        if (!result) {
          return;
        }
        const mapped = result.devices;

        setAvailableDevices(mapped);
        availableDevicesRef.current = mapped;
        setErrorMessage(null);

        if (!isGameRunning) {
          const baseline: Record<string, number> = {};
          mapped.forEach((device) => {
            baseline[device.deviceId] = device.hitCount ?? 0;
          });
          setHitCounts(baseline);
        } else {
          setHitCounts((prev) => {
            const next = { ...prev };
            mapped.forEach((device) => {
              if (!(device.deviceId in next)) {
                next[device.deviceId] = device.hitCount ?? 0;
              }
            });
            return next;
          });
        }

        if (showToast) {
          const onlineCount = mapped.filter((device) => device.isOnline).length;
          const total = mapped.length;
          const offlineCount = total - onlineCount;

          if (total === 0) {
            toast.warning('🔗 No devices found in ThingsBoard');
          } else if (onlineCount === 0) {
            toast.warning('🔗 All devices are currently offline', {
              description: 'At least one online device is required to start a game.',
            });
          } else if (offlineCount > 0) {
            toast.info(`🔗 ${onlineCount} online, ${offlineCount} offline devices found`);
          } else {
            toast.success(`🔗 ${onlineCount} devices online and ready for games`);
          }
        }
      } catch (error) {
        console.error('❌ Failed to load live device data:', error);
        if (showToast) {
          toast.error('Failed to refresh device list');
        }
        if (!silent) {
          setErrorMessage('Failed to load live device data. Please try again.');
        }
        setAvailableDevices([]);
        availableDevicesRef.current = [];
      }
    },
    [isGameRunning, refreshGameDevices],
  );

  // Periodically calls the info RPC while a game is running to keep local device cards in sync with ThingsBoard telemetry.
  const pollDeviceInfo = useCallback(
    async (deviceIds: string[]) => {
      if (deviceIds.length === 0) {
        return;
      }
      try {
        const result = await pollGameControlInfo(deviceIds);
        if (result) {
          setAvailableDevices(result.devices);
          availableDevicesRef.current = result.devices;
          setErrorMessage(null);
        }
      } catch (error) {
        console.warn('⚠️ Failed to poll device info via RPC', error);
      }
    },
    [pollGameControlInfo],
  );

  useEffect(() => {
    availableDevicesRef.current = availableDevices;
  }, [availableDevices]);

  useEffect(() => {
    void loadLiveDevices();
  }, [loadLiveDevices]);

  useEffect(() => {
    if (currentStage === 'game-control') {
      void loadLiveDevices();
    }
  }, [currentStage, loadLiveDevices]);

  // Background poll loop keeps device health (wifi/ambient) fresh via the lightweight info RPC while games run.
  useEffect(() => {
    const intervalMs = isGameRunning ? 5_000 : 10_000;
    const interval = setInterval(() => {
      if (isGameRunning) {
        const activeIds = activeDeviceIds.length > 0
          ? [...activeDeviceIds]
          : availableDevicesRef.current
              .filter((device) => {
                if (device.isOnline) {
                  return true;
                }
                if (typeof device.lastSeen === 'number' && device.lastSeen > 0) {
                  return Date.now() - device.lastSeen <= DEVICE_ONLINE_STALE_THRESHOLD_MS;
                }
                return false;
              })
              .map((device) => device.deviceId);

        if (activeIds.length === 0) {
          void loadLiveDevices({ silent: true });
        } else {
          void pollDeviceInfo(activeIds);
        }
      } else {
        void loadLiveDevices({ silent: true });
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [activeDeviceIds, isGameRunning, loadLiveDevices, pollDeviceInfo]);

  const fetchTotalShots = useCallback(async () => {
    setLoadingTotalShots(true);
    try {
      const targets = useTargets.getState().targets as Target[];
      let totalShots = 0;

      const deviceIds = targets.map((target) =>
        typeof target.id === 'string'
          ? target.id
          : (target.id as { id: string })?.id || String(target.id),
      );

      if (deviceIds.length > 0) {
        const { details } = await fetchTargetDetails(deviceIds, {
          includeHistory: false,
          telemetryKeys: ['hits'],
        });

        totalShots = details.reduce((sum, detail) => {
          const hitsArray = Array.isArray(detail.telemetry?.hits) ? detail.telemetry.hits : [];
          if (hitsArray.length === 0) {
            return sum;
          }

          const latest = hitsArray[0]?.value ?? hitsArray[0];
          const numeric = Number(latest);
          return Number.isFinite(numeric) ? sum + numeric : sum;
        }, 0);
      }

      setTotalShotsFromThingsBoard(totalShots);
    } catch (error) {
      console.error('Failed to fetch total shots:', error);
    } finally {
      setLoadingTotalShots(false);
    }
  }, []);

  useEffect(() => {
    void fetchTotalShots();
  }, [fetchTotalShots]);

  useEffect(() => {
    if (targetsSnapshot.length === 0 && !targetsStoreLoading) {
      void refreshTargets().catch((err) => {
        console.warn('[Games] Failed to refresh targets snapshot for status sync', err);
      });
    }
  }, [targetsSnapshot.length, targetsStoreLoading, refreshTargets]);

  const targetStatusById = useMemo(() => {
    const map = new Map<string, string>();
    targetsSnapshot.forEach((target) => {
      map.set(target.id, target.status ?? 'unknown');
    });
    return map;
  }, [targetsSnapshot]);

  const deriveIsOnline = useCallback((device: DeviceStatus) => {
    const targetStatus = targetStatusById.get(device.deviceId);
    if (targetStatus === 'online' || targetStatus === 'standby' || targetStatus === 'active') {
      return true;
    }
    if (device.isOnline) {
      return true;
    }
    if (typeof device.lastSeen === 'number' && device.lastSeen > 0) {
      return Date.now() - device.lastSeen <= DEVICE_ONLINE_STALE_THRESHOLD_MS;
    }
    return false;
  }, [targetStatusById]);

  const getOnlineDevices = useCallback(() => {
    return availableDevicesRef.current.filter((device) => deriveIsOnline(device));
  }, [deriveIsOnline]);

  // Shared telemetry hook feeds real-time hit data for active devices so the page can merge hit counts, splits, and transitions.
  const telemetryState = useGameTelemetry({
    token: tbSession?.token ?? null,
    gameId: currentGameId,
    deviceIds: activeDeviceIds.map((deviceId) => ({
      deviceId,
      deviceName: availableDevicesRef.current.find((device) => device.deviceId === deviceId)?.name ?? deviceId,
    })),
    enabled: isGameRunning && Boolean(currentGameId),
    onAuthError: () => {
      void refreshThingsboardSession({ force: true });
    },
    onError: (reason) => {
      console.warn('[Games] Telemetry stream degraded', reason);
    },
  });

  useEffect(() => {
    if (!isGameRunning || !currentGameId) {
      return;
    }

    setHitCounts(telemetryState.hitCounts);
    setHitHistory(telemetryState.hitHistory);

    setAvailableDevices((prev) => {
      const next = prev.map((device) => {
        const count = telemetryState.hitCounts[device.deviceId] ?? device.hitCount;
        const hitTimes = telemetryState.hitTimesByDevice[device.deviceId];
        if (typeof count !== 'number' && !hitTimes) {
          return device;
        }

        return {
          ...device,
          hitCount: typeof count === 'number' ? count : device.hitCount,
          hitTimes: hitTimes ?? device.hitTimes,
        };
      });
      availableDevicesRef.current = next;
      return next;
    });
  }, [activeDeviceIds, isGameRunning, currentGameId, telemetryState.hitCounts, telemetryState.hitHistory, telemetryState.hitTimesByDevice]);

  // Orchestrates the start flow: validates devices/token, calls the edge start RPC, seeds local metrics, and refreshes the snapshot.
  const handleStartGame = useCallback(async () => {
    if (isStarting || isGameRunning) {
      return;
    }

    await loadLiveDevices({ silent: true });
    const onlineDevices = getOnlineDevices();
    if (onlineDevices.length === 0) {
      setErrorMessage('No online devices available to start a game.');
      toast.error('No online devices available to start a game.');
      return;
    }

    if (!tbSession?.token) {
      const refreshed = await refreshThingsboardSession({ force: true });
      if (!refreshed?.token) {
        toast.error('Unable to obtain ThingsBoard session token. Please retry.');
        return;
      }
    }

    setErrorMessage(null);

    const startResult = await startGameSession({
      deviceIds: onlineDevices.map((device) => device.deviceId),
    });

    if (!startResult.ok || startResult.successfulDeviceIds.length === 0) {
      setErrorMessage('Failed to start game on the selected devices.');
      toast.error('Failed to start game on the selected devices.');
      return;
    }

    const { successfulDeviceIds, failedDeviceIds, warnings, startedAt, gameId } = startResult;

    currentGameDevicesRef.current = successfulDeviceIds;
    setActiveDeviceIds(successfulDeviceIds);

    const startTimestamp = startedAt ?? Date.now();

    setIsGameRunning(true);
    setGameStartTime(startTimestamp);
    setGameStopTime(null);
    setHitCounts(Object.fromEntries(successfulDeviceIds.map((id) => [id, 0])));
    setHitHistory([]);

    await loadLiveDevices({ silent: true });

    toast.success(`Game started (${successfulDeviceIds.length}/${onlineDevices.length} devices).`);
    if (warnings.length > 0) {
      toast.warning(`${warnings.length} device(s) reported a timeout but should still receive the command.`);
    }
    if (failedDeviceIds.length > 0) {
      toast.error(`${failedDeviceIds.length} device(s) failed to start.`);
    }
  }, [
    getOnlineDevices,
    isGameRunning,
    isStarting,
    loadLiveDevices,
    startGameSession,
    tbSession,
    refreshThingsboardSession,
  ]);

  // Coordinates stop lifecycle: calls the edge stop RPC, aggregates telemetry into a summary, persists history, and refreshes UI.
  const handleStopGame = useCallback(async () => {
    if (!isGameRunning || !currentGameId || isStopping) {
      return;
    }

    const activeDeviceIdsSnapshot = [...currentGameDevicesRef.current];
    if (activeDeviceIdsSnapshot.length === 0) {
      setIsGameRunning(false);
      return;
    }

    try {
      const stopResult = await stopGameSession({ deviceIds: activeDeviceIdsSnapshot });

      if (!stopResult.ok) {
        setErrorMessage('Failed to stop game. Please try again.');
        toast.error('Failed to stop game.');
        return;
      }

      const { failedDeviceIds, warnings, stoppedAt, gameId } = stopResult;
      const stopTimestamp = stoppedAt ?? Date.now();

      setIsGameRunning(false);
      setGameStopTime(stopTimestamp);

      setAvailableDevices(prev =>
        prev.map(device => {
          if (activeDeviceIdsSnapshot.includes(device.deviceId)) {
            return {
              ...device,
              gameStatus: 'stop',
              lastSeen: stopTimestamp,
            };
          }
          return device;
        })
      );

      if (failedDeviceIds.length > 0) {
        toast.warning(`${failedDeviceIds.length} device(s) may not have received the stop command.`);
      } else {
        toast.success('Game stopped successfully.');
      }

      if (warnings.length > 0) {
        toast.warning(`${warnings.length} device(s) reported a timeout when stopping.`);
      }

      const resolvedGameId = gameId ?? currentGameId ?? `GM-${Date.now()}`;
      const deviceStats = activeDeviceIdsSnapshot.map(deviceId => {
        const hitsForDevice = hitHistory.filter(hit => hit.deviceId === deviceId);
        const hitTimes = hitsForDevice.map(hit => hit.timestamp);
        const intervals = hitTimes.slice(1).map((ts, idx) => (ts - hitTimes[idx]) / 1000);
        const deviceInfo = availableDevicesRef.current.find(device => device.deviceId === deviceId);

        return {
          deviceId,
          deviceName: deviceInfo?.name ?? deviceId,
          hitCount: hitsForDevice.length,
          hitTimes,
          averageInterval: intervals.length
            ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
            : 0,
          firstHitTime: hitTimes[0] ?? 0,
          lastHitTime: hitTimes[hitTimes.length - 1] ?? 0,
        };
      });

      const totalHits = deviceStats.reduce((sum, stat) => sum + stat.hitCount, 0);
      const actualDurationSeconds = gameStartTime
        ? Math.max(0, Math.round((stopTimestamp - gameStartTime) / 1000))
        : 0;

      const sortedHitTimes = hitHistory.map(hit => hit.timestamp).sort((a, b) => a - b);
      const overallIntervals = sortedHitTimes
        .slice(1)
        .map((ts, idx) => (ts - sortedHitTimes[idx]) / 1000);

      const averageHitInterval = overallIntervals.length
        ? overallIntervals.reduce((sum, value) => sum + value, 0) / overallIntervals.length
        : 0;

      const switchTimes: number[] = [];
      for (let i = 1; i < hitHistory.length; i++) {
        if (hitHistory[i].deviceId !== hitHistory[i - 1].deviceId) {
          switchTimes.push((hitHistory[i].timestamp - hitHistory[i - 1].timestamp) / 1000);
        }
      }

      const historyEntry: GameHistory = {
        gameId: resolvedGameId,
        gameName: `Game ${new Date(gameStartTime ?? stopTimestamp).toLocaleTimeString()}`,
        duration: Math.max(1, Math.ceil(actualDurationSeconds / 60)),
        startTime: gameStartTime ?? stopTimestamp,
        endTime: stopTimestamp,
        score: totalHits,
        deviceResults: deviceStats.map(({ deviceId, deviceName, hitCount }) => ({
          deviceId,
          deviceName,
          hitCount,
        })),
        totalHits,
        actualDuration: actualDurationSeconds,
        averageHitInterval,
        targetStats: deviceStats,
        crossTargetStats: {
          totalSwitches: switchTimes.length,
          averageSwitchTime: switchTimes.length
            ? switchTimes.reduce((sum, value) => sum + value, 0) / switchTimes.length
            : 0,
          switchTimes,
        },
      };

    setGameHistory(prev => [historyEntry, ...prev]);
    void saveGameHistory(historyEntry)
      .then((status) => {
        if (status === 'created') {
          console.info('[Games] Game history entry created', historyEntry.gameId);
        } else if (status === 'updated') {
          console.info('[Games] Game history entry updated', historyEntry.gameId);
        }
        void loadGameHistory();
      })
      .catch((error) => {
        console.warn('[Games] Failed to persist game history', error);
      });
    currentGameDevicesRef.current = [];
    setActiveDeviceIds([]);
    void fetchTotalShots();
    await loadLiveDevices({ silent: true });
  } catch (error) {
    console.error('Failed to stop game:', error);
    setErrorMessage('Failed to stop game. Please try again.');
    toast.error('Failed to stop game.');
  }
  }, [
    availableDevicesRef,
    currentGameId,
    fetchTotalShots,
    gameStartTime,
    hitHistory,
    isGameRunning,
    isStopping,
    loadLiveDevices,
    loadGameHistory,
    stopGameSession
  ]);

  const handleBackToMain = useCallback(async () => {
    if (isGameRunning) {
      await handleStopGame();
    }
    setCurrentStage('main-dashboard');
  }, [handleStopGame, isGameRunning]);

  const getDeviceStatusBadge = (device: DeviceStatus) => {
    const deviceOnline = deriveIsOnline(device);
    if (!deviceOnline) {
      return <Badge variant="destructive" className="text-xs">Offline</Badge>;
    }

    switch (device.gameStatus) {
      case 'start':
        return <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Active</Badge>;
      case 'stop':
        return <Badge variant="secondary" className="text-xs">Stopped</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Idle</Badge>;
    }
  };

  const getWifiIndicator = (strength: number) => {
    if (strength >= 80) return <Wifi className="h-4 w-4 text-green-500" />;
    if (strength >= 50) return <Wifi className="h-4 w-4 text-yellow-500" />;
    return <WifiOff className="h-4 w-4 text-red-500" />;
  };

  const getAmbientLightColor = (light: string) => {
    switch (light) {
      case 'good':
        return 'text-green-500';
      case 'average':
        return 'text-yellow-500';
      case 'poor':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return 'No activity';
    const diffMs = Date.now() - timestamp;
    if (diffMs < 5_000) return 'Just now';
    if (diffMs < 60_000) return `${Math.round(diffMs / 1000)}s ago`;
    if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`;
    return new Date(timestamp).toLocaleTimeString();
  };

  const deviceStatusSummary = useMemo(() => {
    if (targetsSnapshot.length > 0) {
      const online = targetsSnapshot.filter((target) =>
        target && typeof target.status === 'string'
          ? ['online', 'standby', 'active'].includes(target.status)
          : false,
      ).length;
      const total = targetsSnapshot.length;
      return {
        total,
        online,
        offline: Math.max(total - online, 0),
      };
    }

    const total = availableDevices.length;
    const online = availableDevices.filter((device) => deriveIsOnline(device)).length;
    return {
      total,
      online,
      offline: Math.max(total - online, 0),
    };
  }, [targetsSnapshot, availableDevices, deriveIsOnline]);

  const totalDevices = deviceStatusSummary.total;
  const onlineDevices = deviceStatusSummary.online;
  const offlineDevices = deviceStatusSummary.offline;
  const activeSessionDevices = activeDeviceIds.length;
  const activeSessionHits = activeDeviceIds.reduce(
    (sum, id) => sum + (hitCounts[id] ?? 0),
    0
  );
  const totalHitsFromHistory = useMemo(
    () =>
      gameHistory.reduce((sum, game) => {
        if (typeof game.totalHits === 'number' && Number.isFinite(game.totalHits)) {
          return sum + game.totalHits;
        }
        if (typeof game.score === 'number' && Number.isFinite(game.score)) {
          return sum + game.score;
        }
        if (Array.isArray(game.deviceResults) && game.deviceResults.length > 0) {
          return (
            sum +
            game.deviceResults.reduce(
              (inner, result) => inner + (Number.isFinite(result.hitCount) ? result.hitCount : 0),
              0,
            )
          );
        }
        return sum;
      }, 0),
    [gameHistory],
  );
  const totalHitsFallback = useMemo(
    () =>
      availableDevices.reduce(
        (sum, device) => sum + (Number.isFinite(device.hitCount) ? device.hitCount : 0),
        0,
      ),
    [availableDevices],
  );
  const resolvedTotalHits = useMemo(() => {
    const fallback = Math.max(totalHitsFromHistory, totalHitsFallback);
    return totalShotsFromThingsBoard > 0 ? totalShotsFromThingsBoard : fallback;
  }, [totalShotsFromThingsBoard, totalHitsFallback, totalHitsFromHistory]);
  const bestScore = useMemo(() => {
    if (gameHistory.length === 0) {
      return 0;
    }
    return gameHistory.reduce((max, game) => {
      const candidate =
        typeof game.score === 'number' && Number.isFinite(game.score)
          ? game.score
          : typeof game.totalHits === 'number' && Number.isFinite(game.totalHits)
            ? game.totalHits
            : 0;
      return Math.max(max, candidate);
    }, 0);
  }, [gameHistory]);

  return (
    <div className="min-h-screen bg-brand-background">
      <Header onMenuClick={() => setIsMobileMenuOpen(true)} />

      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        <MobileDrawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        <main className="flex-1 overflow-y-auto">
          <div className="p-2 md:p-4 lg:p-6 xl:p-8 max-w-[1600px] mx-auto">
            {errorMessage && (
              <Card className="border-red-200 bg-red-50 mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-red-800 font-medium">{errorMessage}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setErrorMessage(null)}
                      className="ml-auto text-red-600 hover:text-red-800"
                    >
                      ×
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStage === 'main-dashboard' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="text-left">
                    <h1 className="font-heading text-2xl md:text-3xl font-semibold text-brand-text mb-2">
                      DryFire Games
                    </h1>
                    <p className="font-body text-brand-text/70 text-sm md:text-base">
                      Manage game sessions with real-time device monitoring
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={async () => {
                        setErrorMessage(null);
                        setCurrentStage('game-control');
                        await loadLiveDevices({ showToast: true });
                      }}
                      className="bg-brand-primary hover:bg-brand-primary/90 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Game
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg">
                    <CardContent className="p-2 md:p-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
                          <p className="text-xs font-medium text-brand-dark/70 font-body">Total Devices</p>
                          <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">
                            {loadingDevices && totalDevices === 0 ? (
                              <span className="animate-pulse">...</span>
                            ) : (
                              totalDevices
                            )}
                          </p>
                          <p className="text-xs text-brand-dark/50 font-body">
                            {loadingDevices && totalDevices === 0
                              ? 'Loading...'
                              : `${onlineDevices} online • ${offlineDevices} offline`}
                          </p>
                        </div>
                        <div className="flex-shrink-0 p-1 md:p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
                          <TargetIcon className="text-brand-primary w-6 h-6 md:w-10 md:h-10" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg">
                    <CardContent className="p-2 md:p-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
                          <p className="text-xs font-medium text-brand-dark/70 font-body">Games Played</p>
                          <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">
                            {isHistoryLoading && gameHistory.length === 0 ? (
                              <span className="animate-pulse">...</span>
                            ) : (
                              gameHistory.length
                            )}
                          </p>
                          <p className="text-xs text-brand-dark/50 font-body">Total sessions</p>
                        </div>
                        <div className="flex-shrink-0 p-1 md:p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
                          <Gamepad2 className="text-brand-primary w-6 h-6 md:w-10 md:h-10" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg">
                    <CardContent className="p-2 md:p-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
                          <p className="text-xs font-medium text-brand-dark/70 font-body">Total Hits</p>
                          <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">
                            {loadingTotalShots || (isHistoryLoading && gameHistory.length === 0) ? (
                              <span className="animate-pulse">...</span>
                            ) : (
                              resolvedTotalHits.toLocaleString()
                            )}
                          </p>
                          <p className="text-xs text-brand-dark/50 font-body">All time shots</p>
                        </div>
                        <div className="flex-shrink-0 p-1 md:p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
                          <Activity className="text-brand-primary w-6 h-6 md:w-10 md:h-10" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg">
                    <CardContent className="p-2 md:p-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
                          <p className="text-xs font-medium text-brand-dark/70 font-body">Best Score</p>
                          <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">
                            {isHistoryLoading && gameHistory.length === 0 ? (
                              <span className="animate-pulse">...</span>
                            ) : (
                              bestScore.toLocaleString()
                            )}
                          </p>
                          <p className="text-xs text-brand-dark/50 font-body">Single game</p>
                        </div>
                        <div className="flex-shrink-0 p-1 md:p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
                          <Trophy className="text-brand-primary w-6 h-6 md:w-10 md:h-10" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {(isGameRunning || currentGameId || hitHistory.length > 0) && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="h-5 w-5" />
                      <h2 className="font-heading text-xl font-semibold text-brand-text">Current Session</h2>
                      <Badge
                        variant={isGameRunning ? 'default' : 'outline'}
                        className={isGameRunning ? 'bg-green-100 text-green-700 border-green-200 text-xs' : 'text-xs'}
                      >
                        {isGameRunning ? 'ACTIVE' : currentGameId ? 'STOPPED' : 'IDLE'}
                      </Badge>
                    </div>

                    <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                      <CardContent className="p-3 md:p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center md:text-left">
                          <div>
                            <p className="text-xs text-brand-dark/60 font-body">Game ID</p>
                            <p className="text-sm md:text-lg font-heading text-brand-dark">{currentGameId ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-brand-dark/60 font-body">Status</p>
                            <p className="text-sm md:text-lg font-heading text-brand-dark">
                              {isGameRunning ? 'Active' : currentGameId ? 'Stopped' : 'Idle'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-brand-dark/60 font-body">Devices</p>
                            <p className="text-sm md:text-lg font-heading text-brand-dark">{activeSessionDevices}</p>
                          </div>
                          <div>
                            <p className="text-xs text-brand-dark/60 font-body">Hits Recorded</p>
                            <p className="text-sm md:text-lg font-heading text-brand-dark">{activeSessionHits}</p>
                          </div>
                        </div>

                        <div className="border-t border-gray-200 pt-3">
                          <p className="text-xs uppercase tracking-wide text-brand-dark/50 mb-2">Live Device Status</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                            {availableDevices.map(device => {
                              const deviceOnline = deriveIsOnline(device);
                              return (
                              <div
                                key={device.deviceId}
                                className="border border-gray-200 rounded-md md:rounded-lg p-2 md:p-3 bg-white shadow-sm"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${deviceOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                    <span className="font-heading text-xs md:text-sm text-brand-dark">{device.name}</span>
                                  </div>
                                  {getDeviceStatusBadge(device)}
                                </div>
                                <div className="text-xs md:text-sm text-brand-dark/70 flex items-center justify-between">
                                  <span>Hits</span>
                                  <span className="font-semibold text-brand-dark">{hitCounts[device.deviceId] ?? device.hitCount ?? 0}</span>
                                </div>
                                <div className="text-xs md:text-sm text-brand-dark/70 flex items-center justify-between">
                                  <span>Last Hit</span>
                                  <span className="font-semibold text-brand-dark">{device.hitTimes?.length ? formatLastSeen(device.hitTimes[device.hitTimes.length - 1]) : '—'}</span>
                                </div>
                                  <div className="mt-2 flex items-center justify-between text-[11px] md:text-xs text-brand-dark/60">
                                    <div className="flex items-center gap-1">
                                      {getWifiIndicator(device.wifiStrength)}
                                      <span>{device.wifiStrength}%</span>
                                    </div>
                                  <div className={`flex items-center gap-1 ${getAmbientLightColor(device.ambientLight)}`}>
                                    <div className="w-2 h-2 rounded-full bg-current"></div>
                                    <span className="capitalize">{device.ambientLight}</span>
                                  </div>
                                  <span>{formatLastSeen(device.lastSeen)}</span>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    <h2 className="font-heading text-xl font-semibold text-brand-text">Game History</h2>
                  </div>

                  {isHistoryLoading ? (
                    <Card className="bg-white border-gray-200 shadow-sm rounded-sm md:rounded-lg">
                      <CardContent className="p-8 text-center text-brand-dark/60 text-sm">
                        Loading game history...
                      </CardContent>
                    </Card>
                  ) : gameHistory.length === 0 ? (
                    <Card className="bg-white border-gray-200 shadow-sm rounded-sm md:rounded-lg">
                      <CardContent className="p-8 text-center">
                        <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Games Yet</h3>
                        <p className="text-gray-600">Start your first game to see results here</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
                      {gameHistory.slice(0, 6).map(game => {
                        const deviceResults = Array.isArray(game.deviceResults) ? game.deviceResults : [];
                        const totalHits = typeof game.totalHits === 'number' && Number.isFinite(game.totalHits)
                          ? game.totalHits
                          : deviceResults.reduce(
                              (sum, r) => sum + (Number.isFinite(r.hitCount) ? r.hitCount : 0),
                              0,
                            );
                        const score = typeof game.score === 'number' && Number.isFinite(game.score)
                          ? game.score
                          : totalHits;
                        const accuracy = typeof game.accuracy === 'number' && Number.isFinite(game.accuracy)
                          ? game.accuracy
                          : null;
                        const deviceCount = deviceResults.length > 0 ? deviceResults.length : null;
                        const displayScenario = game.scenarioName ?? game.gameName;
                        const formattedDate = game.startTime
                          ? new Date(game.startTime).toLocaleDateString()
                          : '';

                        return (
                          <Card
                            key={game.gameId}
                            className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg"
                          >
                            <CardContent className="p-2 md:p-4">
                              <div className="flex items-start gap-2">
                                <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
                                  <p className="text-xs font-medium text-brand-dark/70 font-body">
                                    {displayScenario}
                                  </p>
                                  <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">
                                    {score.toLocaleString()}
                                  </p>
                                  <p className="text-xs text-brand-dark/50 font-body">
                                    {formattedDate}
                                    {accuracy !== null ? ` • ${accuracy.toFixed(1)}% accuracy` : ''}
                                  </p>
                                </div>
                                <div className="flex-shrink-0 p-1 md:p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
                                  <Trophy className="text-brand-primary w-6 h-6 md:w-10 md:h-10" />
                                </div>
                              </div>

                              <div className="mt-1 md:mt-3 space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-brand-dark/70">Hits</span>
                                  <span className="font-medium text-brand-dark">{totalHits}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-brand-dark/70">Duration</span>
                                  <span className="font-medium text-brand-dark">
                                    {game.duration ? `${game.duration}m` : '—'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-brand-dark/70">Devices</span>
                                  <span className="font-medium text-brand-dark">
                                    {deviceCount ?? '—'}
                                  </span>
                                </div>
                                {game.roomName && (
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-brand-dark/70">Room</span>
                                    <span className="font-medium text-brand-dark">{game.roomName}</span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStage === 'game-control' && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" onClick={handleBackToMain} className="p-2">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-left">
                    <h1 className="font-heading text-2xl md:text-3xl font-semibold text-brand-text mb-2">
                      Live Game Control
                    </h1>
                    <p className="font-body text-brand-text/70 text-sm md:text-base">
                      Start and stop your ThingsBoard-backed dryfire session and monitor hits in real time.
                    </p>
                  </div>
                </div>

                <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                  <CardContent className="p-4 md:p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-brand-dark/50 mb-1">Game ID</p>
                        <p className="text-lg font-heading text-brand-dark">
                          {currentGameId ?? 'Not started'}
                        </p>
                        {gameStartTime && (
                          <p className="text-xs text-brand-dark/60">
                            Started {new Date(gameStartTime).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleStartGame}
                          disabled={isGameRunning || isStarting || loadingDevices}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isStarting ? (
                            <>
                              <Play className="h-4 w-4 mr-2 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Start Game
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleStopGame}
                          disabled={!isGameRunning || isStopping}
                          variant="destructive"
                        >
                          {isStopping ? (
                            <>
                              <Square className="h-4 w-4 mr-2 animate-spin" />
                              Stopping...
                            </>
                          ) : (
                            <>
                              <Square className="h-4 w-4 mr-2" />
                              Stop Game
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-brand-dark/60 uppercase tracking-wide">Status</p>
                        <p className="text-lg font-heading text-brand-dark">
                          {isGameRunning ? 'Active' : currentGameId ? 'Stopped' : 'Idle'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-brand-dark/60 uppercase tracking-wide">Devices</p>
                        <p className="text-lg font-heading text-brand-dark">
                          {activeDeviceIds.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-brand-dark/60 uppercase tracking-wide">Total Hits</p>
                        <p className="text-lg font-heading text-brand-dark">
                          {activeDeviceIds.reduce((sum, id) => sum + (hitCounts[id] ?? 0), 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-brand-dark/60 uppercase tracking-wide">Elapsed</p>
                        <p className="text-lg font-heading text-brand-dark">
                          {gameStartTime
                            ? `${Math.max(
                                0,
                                Math.floor(
                                  ((isGameRunning ? Date.now() : gameStopTime ?? Date.now()) - gameStartTime) /
                                    1000
                                )
                              )}s`
                            : '0s'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                  <CardContent className="p-4 md:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-heading text-lg font-semibold text-brand-dark">Devices</h2>
                      <Badge variant="outline" className="text-xs">
                        {onlineDevices} online / {totalDevices} total
                      </Badge>
                    </div>

                    {loadingDevices ? (
                      <div className="flex items-center justify-center py-10 text-sm text-brand-dark/60">
                        Refreshing device list...
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {availableDevices.map(device => {
                          const deviceOnline = deriveIsOnline(device);
                          return (
                          <div
                            key={device.deviceId}
                            className="border border-gray-200 rounded-md md:rounded-lg p-3 bg-white shadow-sm space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${deviceOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                                <span className="font-heading text-sm text-brand-dark">{device.name}</span>
                              </div>
                              {getDeviceStatusBadge(device)}
                            </div>
                            <div className="flex items-center justify-between text-xs text-brand-dark/70">
                              <span>Hits</span>
                              <span className="font-semibold text-brand-dark">{hitCounts[device.deviceId] ?? device.hitCount ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-brand-dark/70">
                              <span>WiFi</span>
                              <div className="flex items-center gap-1">
                                {getWifiIndicator(device.wifiStrength)}
                                <span>{device.wifiStrength}%</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-brand-dark/70">
                              <span>Last Activity</span>
                              <span>{formatLastSeen(device.lastSeen)}</span>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                  <CardContent className="p-4 md:p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-heading text-lg font-semibold text-brand-dark">Hit Feed</h2>
                      <Badge variant="outline" className="text-xs">
                        {hitHistory.length} hits
                      </Badge>
                    </div>
                    {hitHistory.length === 0 ? (
                      <p className="text-sm text-brand-dark/60 text-center py-6">
                        {isGameRunning ? 'Waiting for hits...' : 'No hits recorded yet.'}
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {[...hitHistory].reverse().slice(0, 50).map(hit => (
                          <div
                            key={`${hit.deviceId}-${hit.timestamp}`}
                            className="flex items-center justify-between text-xs border border-gray-100 rounded-md px-3 py-2 bg-gray-50"
                          >
                            <span className="font-medium text-brand-dark">{hit.deviceName}</span>
                            <span className="text-brand-dark/60">{new Date(hit.timestamp).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Games;
