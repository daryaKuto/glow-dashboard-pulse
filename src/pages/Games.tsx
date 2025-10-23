import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Gamepad2,
  Play,
  Square,
  Wifi,
  WifiOff,
  AlertCircle,
  Activity,
  Trophy,
  Timer,
  Loader2
} from 'lucide-react';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/components/ui/sonner';
import type {
  DeviceStatus,
  GameHistory,
  SessionHitRecord,
  SessionSplit,
  SessionTransition,
} from '@/services/device-game-flow';
import { useGameDevices, type NormalizedGameDevice, DEVICE_ONLINE_STALE_THRESHOLD_MS } from '@/hooks/useGameDevices';
import { fetchTargetDetails } from '@/lib/edge';
import { useTargets, type Target } from '@/store/useTargets';
import { useGameSession } from '@/hooks/useGameSession';
import { useGameTelemetry, type SplitRecord, type TransitionRecord } from '@/hooks/useGameTelemetry';
import { useThingsboardToken } from '@/hooks/useThingsboardToken';
import {
  fetchAllGameHistory as fetchPersistedGameHistory,
  saveGameHistory,
  mapSummaryToGameHistory,
  type GameHistorySummaryPayload,
} from '@/services/game-history';
import { useSessionActivation } from '@/hooks/useSessionActivation';
import { useAuth } from '@/providers/AuthProvider';
import { fetchRecentSessions, type RecentSession } from '@/services/profile';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

type LiveSessionSummary = {
  gameId: string;
  gameName: string;
  startedAt: number;
  stoppedAt: number;
  durationSeconds: number;
  totalHits: number;
  averageHitInterval: number;
  deviceStats: GameHistory['targetStats'];
  crossTargetStats: GameHistory['crossTargetStats'];
  splits: SessionSplit[];
  transitions: SessionTransition[];
  targets: Array<{ deviceId: string; deviceName: string }>;
  hitHistory: SessionHitRecord[];
  historyEntry: GameHistory;
};

type SessionHitEntry = {
  id: string;
  deviceName: string;
  timestamp: number;
  sequence: number;
  sinceStartSeconds: number;
  splitSeconds: number | null;
};

const DEVICE_COLOR_PALETTE = [
  '#6C5CE7',
  '#10B981',
  '#F97316',
  '#8B5CF6',
  '#EF4444',
  '#0EA5E9',
  '#F59E0B',
  '#14B8A6',
];

const MAX_TIMELINE_POINTS = 24;
const TIMELINE_BUCKET_MS = 1_000;

type SessionLifecycle = 'idle' | 'selecting' | 'launching' | 'running' | 'stopping' | 'finalizing';

// useSessionTimer centralises stopwatch control so the UI can react immediately to lifecycle transitions.
function useSessionTimer() {
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
    (stopTimestamp: number) => {
      stopTicker();
      if (anchorRef.current === null) {
        setSeconds(0);
        return;
      }
      setSeconds(Math.max(0, Math.floor((stopTimestamp - anchorRef.current) / 1000)));
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

// Main Live Game Control page: orchestrates device state, telemetry streams, and session history for operator control.
const Games: React.FC = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  const [sessionLifecycle, setSessionLifecycle] = useState<SessionLifecycle>('idle');
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [gameStopTime, setGameStopTime] = useState<number | null>(null);
  const [hitCounts, setHitCounts] = useState<Record<string, number>>({});
  const [hitHistory, setHitHistory] = useState<SessionHitRecord[]>([]);
  const [activeDeviceIds, setActiveDeviceIds] = useState<string[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [pendingSessionTargets, setPendingSessionTargets] = useState<NormalizedGameDevice[]>([]);
  const [currentSessionTargets, setCurrentSessionTargets] = useState<NormalizedGameDevice[]>([]);
  const [recentSessionSummary, setRecentSessionSummary] = useState<LiveSessionSummary | null>(null);
  const [expectedDeviceIdsForReadiness, setExpectedDeviceIdsForReadiness] = useState<string[]>([]);
  const [pendingReadyDeviceIds, setPendingReadyDeviceIds] = useState<string[]>([]);

  const {
    seconds: sessionTimerSeconds,
    reset: resetSessionTimer,
    start: startSessionTimer,
    freeze: freezeSessionTimer,
  } = useSessionTimer();
  const {
    triggeredAt: startTriggeredAt,
    confirmedAt: telemetryConfirmedAt,
    isConfirmed: sessionConfirmed,
    markTriggered: markSessionTriggered,
    markTelemetryConfirmed,
    resetActivation: resetSessionActivation,
    activationParams,
  } = useSessionActivation();

  const currentGameDevicesRef = useRef<string[]>([]);
  const availableDevicesRef = useRef<NormalizedGameDevice[]>([]);
  const selectionManuallyModifiedRef = useRef(false);
  const lastTargetsRefreshRef = useRef<number>(0);
  const readinessTimeoutRef = useRef<number | null>(null);
  const readinessWarningIssuedRef = useRef(false);
  const readinessPendingIdsRef = useRef<string[]>([]);
  // Centralised token manager so the Games page always has a fresh ThingsBoard JWT for sockets/RPCs.
  const { session: tbSession, refresh: refreshThingsboardSession } = useThingsboardToken();

  const isSelectingLifecycle = sessionLifecycle === 'selecting';
  const isLaunchingLifecycle = sessionLifecycle === 'launching';
  const isRunningLifecycle = sessionLifecycle === 'running';
  const isStoppingLifecycle = sessionLifecycle === 'stopping';
  const isFinalizingLifecycle = sessionLifecycle === 'finalizing';
  const isSessionLocked =
    isLaunchingLifecycle || isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle;
  const isSessionDialogVisible = sessionLifecycle !== 'idle';
  const isLiveDialogPhase = isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle;

  useEffect(() => {
    return () => {
      if (readinessTimeoutRef.current) {
        window.clearTimeout(readinessTimeoutRef.current);
        readinessTimeoutRef.current = null;
      }
    };
  }, []);

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
        splits,
        transitions,
        hitHistory: hitHistoryRecords,
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

      const combinedHistory = Array.from(historyMap.values()).sort(
        (a, b) => (b.startTime ?? 0) - (a.startTime ?? 0),
      );

      setGameHistory(combinedHistory);
      if (combinedHistory.length > 0) {
        setRecentSessionSummary(convertHistoryEntryToLiveSummary(combinedHistory[0]));
      } else {
        setRecentSessionSummary(null);
      }
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
      setRecentSessionSummary(null);
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

        if (!isRunningLifecycle) {
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

        const now = Date.now();
        if (now - lastTargetsRefreshRef.current > 30_000) {
          lastTargetsRefreshRef.current = now;
          void refreshTargets().catch((err) => {
            console.warn('[Games] Failed to refresh targets snapshot after device sync', err);
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
    [isRunningLifecycle, refreshGameDevices, refreshTargets],
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
          const now = Date.now();
          if (now - lastTargetsRefreshRef.current > 30_000) {
            lastTargetsRefreshRef.current = now;
            void refreshTargets().catch((err) => {
              console.warn('[Games] Failed to refresh targets snapshot after info poll', err);
            });
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to poll device info via RPC', error);
      }
    },
    [pollGameControlInfo, refreshTargets],
  );

  useEffect(() => {
    availableDevicesRef.current = availableDevices;
  }, [availableDevices]);

  useEffect(() => {
    void loadLiveDevices();
  }, [loadLiveDevices]);

  // Background poll loop keeps device health (wifi/ambient) fresh via the lightweight info RPC while games run.
  useEffect(() => {
    const intervalMs = isRunningLifecycle ? 5_000 : 10_000;
    const interval = setInterval(() => {
      if (isRunningLifecycle) {
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
  }, [activeDeviceIds, isRunningLifecycle, loadLiveDevices, pollDeviceInfo]);

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

  const targetById = useMemo(() => {
    const map = new Map<string, Target>();
    targetsSnapshot.forEach((target) => {
      map.set(target.id, target);
    });
    return map;
  }, [targetsSnapshot]);

  const deviceNameById = useMemo(() => {
    const map = new Map<string, string>();
    availableDevices.forEach((device) => {
      map.set(device.deviceId, device.name);
    });
    return map;
  }, [availableDevices]);

  const deriveConnectionStatus = useCallback(
    (device: NormalizedGameDevice): 'online' | 'standby' | 'offline' => {
      const target = targetById.get(device.deviceId);
      if (target) {
        if (target.status === 'offline') {
          return 'offline';
        }
        if (target.status === 'standby') {
          return 'standby';
        }
        if (target.status === 'online') {
          return 'online';
        }
      }

      const rawStatus = (device.raw?.status ?? '').toString().toLowerCase();
      if (
        rawStatus.includes('offline') ||
        rawStatus.includes('disconnected') ||
        rawStatus === 'inactive'
      ) {
        return 'offline';
      }
      if (rawStatus === 'standby' || rawStatus === 'idle') {
        return 'standby';
      }
      if (['online', 'active', 'busy', 'active_online'].includes(rawStatus)) {
        return 'online';
      }

      const rawGameStatus = (device.raw?.gameStatus ?? '').toString().toLowerCase();
      if (rawGameStatus === 'start' || rawGameStatus === 'busy') {
        return 'online';
      }
      if (rawGameStatus === 'stop' || rawGameStatus === 'idle') {
        return 'standby';
      }

      if (typeof device.raw?.isOnline === 'boolean') {
        return device.raw.isOnline ? 'online' : 'offline';
      }

      if (typeof device.isOnline === 'boolean') {
        return device.isOnline ? 'online' : 'offline';
      }

      const lastActivity =
        (typeof target?.lastActivityTime === 'number' ? target.lastActivityTime : null) ??
        (typeof device.lastSeen === 'number' ? device.lastSeen : null);
      if (lastActivity) {
        return Date.now() - lastActivity <= DEVICE_ONLINE_STALE_THRESHOLD_MS ? 'online' : 'offline';
      }

      return 'offline';
    },
    [targetById],
  );

  const deriveIsOnline = useCallback(
    (device: NormalizedGameDevice) => deriveConnectionStatus(device) !== 'offline',
    [deriveConnectionStatus],
  );

  const getOnlineDevices = useCallback(() => {
    return availableDevicesRef.current.filter((device) => deriveIsOnline(device));
  }, [deriveIsOnline]);

  useEffect(() => {
    if (isSessionLocked) {
      return;
    }

    const onlineIdsInOrder = availableDevices
      .filter((device) => deriveIsOnline(device))
      .map((device) => device.deviceId);

    setSelectedDeviceIds((prev) => {
      if (prev.length === 0) {
        return prev;
      }

      const filtered = prev.filter((id) => onlineIdsInOrder.includes(id));
      if (filtered.length === prev.length && filtered.every((id, index) => id === prev[index])) {
        return prev;
      }
      return filtered;
    });
  }, [availableDevices, deriveIsOnline, isSessionLocked]);

  const handleToggleDeviceSelection = useCallback((deviceId: string, checked: boolean) => {
    selectionManuallyModifiedRef.current = true;
    setSelectedDeviceIds((prev) => {
      if (checked) {
        if (prev.includes(deviceId)) {
          return prev;
        }
        return [...prev, deviceId];
      }
      return prev.filter((id) => id !== deviceId);
    });
  }, []);

  const handleSelectAllDevices = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    const next = availableDevicesRef.current
      .filter((device) => deriveIsOnline(device))
      .map((device) => device.deviceId);
    setSelectedDeviceIds(next);
  }, [deriveIsOnline]);

  const handleClearDeviceSelection = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    setSelectedDeviceIds([]);
  }, []);

  // Presents the confirmation dialog so operators can review selected devices before starting.
  const handleOpenStartDialog = useCallback(() => {
    const onlineDevices = getOnlineDevices();

    if (selectedDeviceIds.length === 0) {
      setErrorMessage('Select at least one target before starting a game.');
      toast.error('Select at least one online target before starting a game.');
      return;
    }

    const selectedTargets = onlineDevices.filter((device) => selectedDeviceIds.includes(device.deviceId));
    if (selectedTargets.length === 0) {
      setErrorMessage('Selected targets are offline. Choose at least one online target.');
      toast.error('Selected targets are offline. Choose at least one online target.');
      return;
    }

    setErrorMessage(null);
    setPendingSessionTargets(selectedTargets);
    resetSessionTimer(null);
    resetSessionActivation();
    setGameStartTime(null);
    setGameStopTime(null);
    setSessionLifecycle('selecting');
  }, [getOnlineDevices, resetSessionActivation, resetSessionTimer, selectedDeviceIds]);

  // Shared telemetry hook feeds real-time hit data for active devices so the page can merge hit counts, splits, and transitions.
  const telemetryState = useGameTelemetry({
    token: tbSession?.token ?? null,
    gameId: currentGameId,
    deviceIds: activeDeviceIds.map((deviceId) => ({
      deviceId,
      deviceName: availableDevicesRef.current.find((device) => device.deviceId === deviceId)?.name ?? deviceId,
    })),
    enabled: (isLaunchingLifecycle || isRunningLifecycle) && Boolean(currentGameId),
    onAuthError: () => {
      void refreshThingsboardSession({ force: true });
    },
    onError: (reason) => {
      console.warn('[Games] Telemetry stream degraded', reason);
    },
  });

  useEffect(() => {
    if ((isLaunchingLifecycle || isRunningLifecycle) && currentGameId) {
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

      if (!sessionConfirmed) {
        const latestTelemetryTimestamp = (() => {
          if (typeof telemetryState.sessionEventTimestamp === 'number') {
            return telemetryState.sessionEventTimestamp;
          }
          const fromHistory = telemetryState.hitHistory.at(-1)?.timestamp;
          if (typeof fromHistory === 'number') {
            return fromHistory;
          }
          const flattened = Object.values(telemetryState.hitTimesByDevice)
            .flat()
            .filter((value): value is number => typeof value === 'number');
          if (flattened.length > 0) {
            return Math.min(...flattened);
          }
          return null;
        })();

        if (latestTelemetryTimestamp !== null) {
          markTelemetryConfirmed(latestTelemetryTimestamp);
        }
      }
    } else if (sessionLifecycle === 'idle') {
      setHitCounts((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      setHitHistory([]);
    }
  }, [
    activeDeviceIds,
    currentGameId,
    isRunningLifecycle,
    isLaunchingLifecycle,
    sessionLifecycle,
    telemetryState.hitCounts,
    telemetryState.hitHistory,
    telemetryState.hitTimesByDevice,
    sessionConfirmed,
    markTelemetryConfirmed,
    telemetryState.sessionEventTimestamp,
  ]);

  useEffect(() => {
    if (expectedDeviceIdsForReadiness.length === 0) {
      return;
    }
    const readyMap = telemetryState.readyDevices;
    setPendingReadyDeviceIds((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const next = prev.filter((deviceId) => !readyMap[deviceId]);
      if (next.length === prev.length) {
        return prev;
      }
      const newlyReady = prev.filter((deviceId) => readyMap[deviceId] && !next.includes(deviceId));
      if (newlyReady.length > 0) {
        newlyReady.forEach((deviceId) => {
          const deviceName = deviceNameById.get(deviceId) ?? deviceId;
          console.log(`[Games] device ${deviceName} confirmed readiness via telemetry`);
        });
      }
      readinessPendingIdsRef.current = next;
      if (next.length === 0 && readinessTimeoutRef.current) {
        window.clearTimeout(readinessTimeoutRef.current);
        readinessTimeoutRef.current = null;
        toast.success('All devices confirmed readiness.');
      }
      return next;
    });
  }, [deviceNameById, expectedDeviceIdsForReadiness, telemetryState.readyDevices]);

  useEffect(() => {
    if (
      sessionLifecycle === 'launching' &&
      sessionConfirmed &&
      typeof telemetryConfirmedAt === 'number'
    ) {
      const anchor =
        startTriggeredAt !== null && telemetryConfirmedAt < startTriggeredAt
          ? startTriggeredAt
          : telemetryConfirmedAt;
      startSessionTimer(anchor);
      setSessionLifecycle('running');
    }
  }, [
    sessionLifecycle,
    sessionConfirmed,
    telemetryConfirmedAt,
    startTriggeredAt,
    startSessionTimer,
  ]);

  const splitRecords =
    isRunningLifecycle || sessionLifecycle === 'stopping' || sessionLifecycle === 'finalizing'
      ? telemetryState.splits
      : [];

  const transitionRecords =
    isRunningLifecycle || sessionLifecycle === 'stopping' || sessionLifecycle === 'finalizing'
      ? telemetryState.transitions
      : [];

  // Orchestrates the start flow: validates devices/token, calls the edge start RPC, seeds local metrics, and refreshes the snapshot.
  const handleStartGame = useCallback(async (preselectedTargets?: NormalizedGameDevice[]) => {
    if (
      isStarting ||
      isLaunchingLifecycle ||
      isRunningLifecycle ||
      isStoppingLifecycle ||
      isFinalizingLifecycle
    ) {
      return;
    }

    await loadLiveDevices({ silent: true });

    const onlineDevices = availableDevicesRef.current.filter((device) => deriveIsOnline(device));
    const preselectedIdSet =
      preselectedTargets && preselectedTargets.length > 0
        ? new Set(preselectedTargets.map((device) => device.deviceId))
        : null;
    const selectedIds =
      preselectedIdSet && preselectedIdSet.size > 0 ? Array.from(preselectedIdSet) : selectedDeviceIds;

    if (selectedIds.length === 0) {
      setErrorMessage('Select at least one target before starting a game.');
      toast.error('Select at least one online target before starting a game.');
      return;
    }

    const selectedOnlineDevices = onlineDevices.filter((device) => selectedIds.includes(device.deviceId));

    if (selectedOnlineDevices.length === 0) {
      setErrorMessage('Selected targets are offline. Choose at least one online target.');
      toast.error('Selected targets are offline. Choose at least one online target.');
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
    setPendingSessionTargets(selectedOnlineDevices);
    setSessionLifecycle('launching');
    resetSessionTimer(null);

    const targetDeviceIds = selectedOnlineDevices.map((device) => device.deviceId);
    const startResult = await startGameSession({
      deviceIds: targetDeviceIds,
    });

    if (!startResult.ok || startResult.successfulDeviceIds.length === 0) {
      setErrorMessage('Failed to start game on the selected devices.');
      toast.error('Failed to start game on the selected devices.');
      setSessionLifecycle('idle');
      setPendingSessionTargets([]);
      resetSessionTimer(null);
      resetSessionActivation();
      setExpectedDeviceIdsForReadiness([]);
      setPendingReadyDeviceIds([]);
      readinessPendingIdsRef.current = [];
      readinessWarningIssuedRef.current = false;
      if (readinessTimeoutRef.current) {
        window.clearTimeout(readinessTimeoutRef.current);
        readinessTimeoutRef.current = null;
      }
      return;
    }

    const { successfulDeviceIds, failedDeviceIds, warnings, startedAt, results: deviceResults } = startResult;

    if (Array.isArray(deviceResults)) {
      deviceResults.forEach((deviceResult) => {
        const meta = deviceResult.data as { totalMs?: number; attributeMs?: number; rpcMs?: number } | undefined;
        const parts = [
          `[Games] start dispatch device ${deviceResult.deviceId}`,
          deviceResult.success ? 'success' : 'failed',
        ];
        if (deviceResult.warning) {
          parts.push(`warning=${deviceResult.warning}`);
        }
        if (deviceResult.error) {
          parts.push(`error=${deviceResult.error}`);
        }
        if (meta) {
          const timings = [
            typeof meta.attributeMs === 'number' ? `attr=${meta.attributeMs}ms` : null,
            typeof meta.rpcMs === 'number' ? `rpc=${meta.rpcMs}ms` : null,
            typeof meta.totalMs === 'number' ? `total=${meta.totalMs}ms` : null,
          ].filter(Boolean);
          if (timings.length > 0) {
            parts.push(`timings{${timings.join(', ')}}`);
          }
        }
        console.log(parts.join(' | '));
      });
    }

    currentGameDevicesRef.current = successfulDeviceIds;
    setActiveDeviceIds(successfulDeviceIds);
    selectionManuallyModifiedRef.current = true;
    setSelectedDeviceIds(successfulDeviceIds);
    setCurrentSessionTargets(
      successfulDeviceIds
        .map((deviceId) => {
          const refreshed = availableDevicesRef.current.find((device) => device.deviceId === deviceId);
          if (refreshed) {
            return refreshed;
          }
          const fromSelection =
            selectedOnlineDevices.find((device) => device.deviceId === deviceId) ??
            preselectedTargets?.find((device) => device.deviceId === deviceId) ??
            null;
          return fromSelection ? { ...fromSelection } : null;
        })
        .filter((device): device is NormalizedGameDevice => device !== null),
    );
    setRecentSessionSummary(null);

    setExpectedDeviceIdsForReadiness(successfulDeviceIds);
    setPendingReadyDeviceIds(() => {
      readinessPendingIdsRef.current = successfulDeviceIds;
      return successfulDeviceIds;
    });
    readinessWarningIssuedRef.current = false;
    if (readinessTimeoutRef.current) {
      window.clearTimeout(readinessTimeoutRef.current);
    }
    if (successfulDeviceIds.length > 0) {
      console.log('[Games] awaiting telemetry readiness for devices:', successfulDeviceIds.join(', '));
      readinessTimeoutRef.current = window.setTimeout(() => {
        const unresolved = readinessPendingIdsRef.current;
        if (unresolved.length > 0 && !readinessWarningIssuedRef.current) {
          readinessWarningIssuedRef.current = true;
          toast.warning(`${unresolved.length} device${unresolved.length === 1 ? '' : 's'} have not confirmed readiness.`, {
            description: unresolved.join(', '),
          });
        }
      }, 5_000);
    }

    const startTimestamp = startedAt ?? Date.now();
    markSessionTriggered(startTimestamp);

    setGameStartTime(startTimestamp);
    setGameStopTime(null);
    setHitCounts(Object.fromEntries(successfulDeviceIds.map((id) => [id, 0])));
    setHitHistory([]);

    await loadLiveDevices({ silent: true });

    toast.success(`Game started (${successfulDeviceIds.length}/${targetDeviceIds.length} selected devices).`);
    if (warnings.length > 0) {
      toast.warning(`${warnings.length} device(s) reported a timeout but should still receive the command.`);
    }
    if (failedDeviceIds.length > 0) {
      toast.error(`${failedDeviceIds.length} device(s) failed to start.`);
    }
  }, [
    availableDevicesRef,
    deriveIsOnline,
    isFinalizingLifecycle,
    isLaunchingLifecycle,
    isStarting,
    isStoppingLifecycle,
    loadLiveDevices,
    refreshThingsboardSession,
    selectedDeviceIds,
    resetSessionTimer,
    resetSessionActivation,
    startGameSession,
    tbSession,
    markSessionTriggered,
  ]);

  const finalizeSession = useCallback(
    async ({
      resolvedGameId,
      sessionLabel,
      startTimestamp,
      stopTimestamp,
      targetDevices,
      hitHistorySnapshot,
      splitRecordsSnapshot,
      transitionRecordsSnapshot,
    }: {
      resolvedGameId: string;
      sessionLabel: string;
      startTimestamp: number;
      stopTimestamp: number;
      targetDevices: NormalizedGameDevice[];
      hitHistorySnapshot: SessionHitRecord[];
      splitRecordsSnapshot: SplitRecord[];
      transitionRecordsSnapshot: TransitionRecord[];
    }) => {
      const sessionSummary = buildLiveSessionSummary({
        gameId: resolvedGameId,
        gameName: sessionLabel,
        startTime: startTimestamp,
        stopTime: stopTimestamp,
        hitHistory: hitHistorySnapshot,
        splitRecords: splitRecordsSnapshot,
        transitionRecords: transitionRecordsSnapshot,
        devices: targetDevices,
      });

      setRecentSessionSummary(sessionSummary);
      setGameHistory((prev) => [sessionSummary.historyEntry, ...prev]);

      try {
        const status = await saveGameHistory(sessionSummary.historyEntry);
        if (status === 'created') {
          console.info('[Games] Game history entry created', sessionSummary.historyEntry.gameId);
        } else if (status === 'updated') {
          console.info('[Games] Game history entry updated', sessionSummary.historyEntry.gameId);
        }
      } catch (persistError) {
        console.warn('[Games] Failed to persist game history', persistError);
        toast.error('Failed to persist game history. Please check your connection.');
      }

      try {
        await loadGameHistory();
      } catch (historyError) {
        console.warn('[Games] Failed to refresh game history after stop', historyError);
      }

      try {
        await fetchTotalShots();
      } catch (fetchShotsError) {
        console.warn('[Games] Failed to refresh target totals after stop', fetchShotsError);
      }

      try {
        await loadLiveDevices({ silent: true });
      } catch (refreshError) {
        console.warn('[Games] Failed to refresh live devices after stop', refreshError);
      }

      return sessionSummary;
    },
    [fetchTotalShots, loadGameHistory, loadLiveDevices, toast],
  );

  // Coordinates stop lifecycle: calls the edge stop RPC, aggregates telemetry into a summary, persists history, and refreshes UI.
  const handleStopGame = useCallback(async () => {
    if (
      !isRunningLifecycle ||
      !currentGameId ||
      isStopping ||
      isStoppingLifecycle ||
      isFinalizingLifecycle
    ) {
      return;
    }

    const activeDeviceIdsSnapshot = [...currentGameDevicesRef.current];
    if (activeDeviceIdsSnapshot.length === 0) {
      setSessionLifecycle('idle');
      setGameStopTime(null);
      resetSessionTimer(null);
      resetSessionActivation();
      return;
    }

    const stopRequestTimestamp = Date.now();
    const startTimestampSnapshot = gameStartTime ?? stopRequestTimestamp;

    setSessionLifecycle('stopping');
    setGameStopTime(stopRequestTimestamp);
    freezeSessionTimer(stopRequestTimestamp);

    try {
      const stopResult = await stopGameSession({ deviceIds: activeDeviceIdsSnapshot });

      if (!stopResult.ok) {
        setErrorMessage('Failed to stop game. Please try again.');
        toast.error('Failed to stop game.');
        setSessionLifecycle('running');
        setGameStopTime(null);
        if (telemetryConfirmedAt || gameStartTime) {
          const timerAnchor = telemetryConfirmedAt ?? gameStartTime ?? Date.now();
          startSessionTimer(timerAnchor);
        }
        return;
      }

      let finalizeSucceeded = false;

      const { failedDeviceIds, warnings, stoppedAt, gameId } = stopResult;
      const stopTimestamp = stoppedAt ?? stopRequestTimestamp;
      setGameStopTime(stopTimestamp);
      freezeSessionTimer(stopTimestamp);
      setSessionLifecycle('finalizing');

      try {
        setAvailableDevices((prev) =>
          prev.map((device) => {
            if (activeDeviceIdsSnapshot.includes(device.deviceId)) {
              return {
                ...device,
                gameStatus: 'stop',
                lastSeen: stopTimestamp,
              };
            }
            return device;
          }),
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
        const targetDevices =
          currentSessionTargets.length > 0
            ? currentSessionTargets
            : activeDeviceIdsSnapshot
                .map((deviceId) => availableDevicesRef.current.find((device) => device.deviceId === deviceId) ?? null)
                .filter((device): device is NormalizedGameDevice => device !== null);

        const hitHistorySnapshot = [...hitHistory];
        const splitRecordsSnapshot = [...splitRecords];
        const transitionRecordsSnapshot = [...transitionRecords];
        const sessionLabel = `Game ${new Date(startTimestampSnapshot).toLocaleTimeString()}`;

        await finalizeSession({
          resolvedGameId,
          sessionLabel,
          startTimestamp: startTimestampSnapshot,
          stopTimestamp,
          targetDevices,
          hitHistorySnapshot,
          splitRecordsSnapshot,
          transitionRecordsSnapshot,
        });

        finalizeSucceeded = true;
      } catch (finalizeError) {
        console.error('[Games] Failed to finalize session', finalizeError);
        setErrorMessage('Failed to finalize session. Please try again.');
        toast.error('Failed to finalize session. Please try again.');
        setSessionLifecycle('running');
        setGameStopTime(null);
        if (gameStartTime) {
          startSessionTimer(gameStartTime);
        }
      }

      if (finalizeSucceeded) {
        currentGameDevicesRef.current = [];
        setActiveDeviceIds([]);
        setCurrentSessionTargets([]);
        setPendingSessionTargets([]);
        setGameStartTime(null);
        setGameStopTime(null);
        resetSessionTimer(null);
        setSessionLifecycle('idle');
        resetSessionActivation();
        setExpectedDeviceIdsForReadiness([]);
        setPendingReadyDeviceIds([]);
        readinessPendingIdsRef.current = [];
        readinessWarningIssuedRef.current = false;
        if (readinessTimeoutRef.current) {
          window.clearTimeout(readinessTimeoutRef.current);
          readinessTimeoutRef.current = null;
        }
      }
    } catch (error) {
      console.error('Failed to stop game:', error);
      setErrorMessage('Failed to stop game. Please try again.');
      toast.error('Failed to stop game.');
      setSessionLifecycle('running');
      setGameStopTime(null);
      if (telemetryConfirmedAt || gameStartTime) {
        const timerAnchor = telemetryConfirmedAt ?? gameStartTime ?? Date.now();
        startSessionTimer(timerAnchor);
      }
    }
  }, [
    availableDevicesRef,
    currentGameId,
    currentSessionTargets,
    fetchTotalShots,
    gameStartTime,
    hitHistory,
    isFinalizingLifecycle,
    isRunningLifecycle,
    isStopping,
    isStoppingLifecycle,
    loadLiveDevices,
    loadGameHistory,
    finalizeSession,
    freezeSessionTimer,
    resetSessionTimer,
    startSessionTimer,
    resetSessionActivation,
    telemetryConfirmedAt,
    splitRecords,
    transitionRecords,
    stopGameSession
  ]);

  // Closes the start dialog without mutating any session state.
  const handleCloseStartDialog = useCallback(() => {
    if (sessionLifecycle !== 'selecting' || isStarting || isLaunchingLifecycle) {
      return;
    }
    setSessionLifecycle('idle');
    setPendingSessionTargets([]);
    resetSessionTimer(null);
  }, [isLaunchingLifecycle, isStarting, resetSessionTimer, sessionLifecycle]);

  // Fires the existing start flow after dismissing the dialog confirmation.
  const handleConfirmStartDialog = useCallback(() => {
    void handleStartGame(pendingSessionTargets);
  }, [handleStartGame, pendingSessionTargets]);

  // Allows the dialog to immediately terminate the active session if needed.
  const handleStopFromDialog = useCallback(() => {
    void handleStopGame();
  }, [handleStopGame]);

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

  const getWifiIndicator = (
    strength: number | null,
    connectionStatus: 'online' | 'standby' | 'offline',
  ) => {
    if (connectionStatus === 'offline') {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }

    return <Wifi className="h-4 w-4 text-green-500" />;
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

  const trackedDevices = useMemo(() => {
    const map = new Map<string, string>();
    const seedIds =
      activeDeviceIds.length > 0
        ? activeDeviceIds
        : selectedDeviceIds.length > 0
          ? selectedDeviceIds
          : availableDevices.map((device) => device.deviceId);

    seedIds.forEach((deviceId) => {
      if (!map.has(deviceId)) {
        map.set(deviceId, deviceNameById.get(deviceId) ?? deviceId);
      }
    });

    hitHistory.forEach((record) => {
      if (!map.has(record.deviceId)) {
        map.set(record.deviceId, record.deviceName ?? deviceNameById.get(record.deviceId) ?? record.deviceId);
      }
    });

    return Array.from(map.entries()).map(([deviceId, deviceName]) => ({
      deviceId,
      deviceName,
    }));
  }, [activeDeviceIds, availableDevices, deviceNameById, hitHistory, selectedDeviceIds]);

  const deviceHitSummary = useMemo(() => {
    if (trackedDevices.length === 0) {
      return [];
    }

    const fallbackHits = new Map<string, number>();
    availableDevices.forEach((device) => {
      fallbackHits.set(device.deviceId, Number.isFinite(device.hitCount) ? Number(device.hitCount) : 0);
    });

    return trackedDevices
      .map(({ deviceId, deviceName }) => {
        const liveHits = hitCounts[deviceId];
        const baseline = fallbackHits.get(deviceId) ?? 0;
        return {
          deviceId,
          deviceName,
          hits: typeof liveHits === 'number' ? liveHits : baseline,
        };
      })
      .sort((a, b) => b.hits - a.hits);
  }, [availableDevices, hitCounts, trackedDevices]);

  const totalHitsLive = useMemo(
    () => deviceHitSummary.reduce((sum, entry) => sum + entry.hits, 0),
    [deviceHitSummary],
  );

  const pieChartData = useMemo(() => {
    if (deviceHitSummary.length === 0) {
      return [{ name: 'No hits yet', value: 1 }];
    }

    const values = deviceHitSummary.map((entry) => ({
      name: entry.deviceName,
      value: entry.hits > 0 ? entry.hits : 1,
    }));

    const total = values.reduce((sum, entry) => sum + entry.value, 0);
    if (total === 0) {
      return values.map((entry) => ({ ...entry, value: 1 }));
    }

    return values;
  }, [deviceHitSummary]);

  const hitTimelineData = useMemo(() => {
    if (!gameStartTime || trackedDevices.length === 0) {
      return [];
    }

    const timelineEnd = isRunningLifecycle ? Date.now() : gameStopTime ?? Date.now();
    const windowStart = Math.max(
      gameStartTime,
      timelineEnd - MAX_TIMELINE_POINTS * TIMELINE_BUCKET_MS,
    );

    const buckets = Array.from({ length: MAX_TIMELINE_POINTS }, (_, index) => {
      const bucketStart = windowStart + index * TIMELINE_BUCKET_MS;
      const secondsSinceStart = Math.max(0, Math.floor((bucketStart - gameStartTime) / 1000));
      const entry: Record<string, number | string> = {
        time: `${secondsSinceStart}s`,
      };
      trackedDevices.forEach(({ deviceName }) => {
        entry[deviceName] = 0;
      });
      return entry;
    });

    hitHistory.forEach((record) => {
      if (record.timestamp < windowStart) {
        return;
      }
      const bucketIndex = Math.min(
        MAX_TIMELINE_POINTS - 1,
        Math.floor((record.timestamp - windowStart) / TIMELINE_BUCKET_MS),
      );
      const bucket = buckets[bucketIndex];
      if (!bucket) {
        return;
      }
      const deviceName =
        trackedDevices.find((device) => device.deviceId === record.deviceId)?.deviceName ??
        record.deviceName ??
        deviceNameById.get(record.deviceId) ??
        record.deviceId;
      if (typeof bucket[deviceName] !== 'number') {
        bucket[deviceName] = 0;
      }
      bucket[deviceName] = (bucket[deviceName] as number) + 1;
    });

    return buckets;
  }, [deviceNameById, gameStartTime, gameStopTime, hitHistory, isRunningLifecycle, trackedDevices]);

  const recentSplits = useMemo(() => {
    if (splitRecords.length === 0) {
      return [];
    }
    return splitRecords
      .slice(-8)
      .map((split, index) => ({
        id: `${split.deviceId}-${split.timestamp ?? index}`,
        deviceId: split.deviceId,
        deviceName: split.deviceName ?? deviceNameById.get(split.deviceId) ?? split.deviceId,
        label: `${
          split.deviceName ?? deviceNameById.get(split.deviceId) ?? split.deviceId
        } #${split.splitNumber ?? index + 1}`,
        time: typeof split.time === 'number' ? split.time : Number(split.time) || 0,
        splitNumber: split.splitNumber ?? index + 1,
      }))
      .reverse();
  }, [deviceNameById, splitRecords]);

  const recentTransitions = useMemo(() => {
    if (transitionRecords.length === 0) {
      return [];
    }
    return transitionRecords
      .slice(-8)
      .map((transition, index) => {
        const fromDevice =
          transition.fromDeviceName ??
          deviceNameById.get(transition.fromDevice) ??
          transition.fromDevice;
        const toDevice =
          transition.toDeviceName ?? deviceNameById.get(transition.toDevice) ?? transition.toDevice;

        return {
          id: `${transition.fromDevice}-${transition.toDevice}-${index}`,
          fromDevice,
          toDevice,
          label: `${fromDevice} → ${toDevice}`,
          time: typeof transition.time === 'number' ? transition.time : Number(transition.time) || 0,
          transitionNumber: transition.transitionNumber ?? index + 1,
        };
      })
      .reverse();
  }, [deviceNameById, transitionRecords]);

  const elapsedSeconds = useMemo(() => {
    if (isRunningLifecycle) {
      return sessionTimerSeconds;
    }
    if (gameStartTime && gameStopTime) {
      return Math.max(0, Math.floor((gameStopTime - gameStartTime) / 1000));
    }
    return sessionTimerSeconds;
  }, [gameStartTime, gameStopTime, isRunningLifecycle, sessionTimerSeconds]);

  const selectedOnlineDevices = useMemo(() => {
    if (selectedDeviceIds.length === 0) {
      return 0;
    }

    return selectedDeviceIds.filter((id) => {
      const device = availableDevices.find((item) => item.deviceId === id);
      return device ? deriveIsOnline(device) : false;
    }).length;
  }, [availableDevices, deriveIsOnline, selectedDeviceIds]);

  const totalOnlineSelectableTargets = useMemo(() => {
    return availableDevices.filter((device) => deriveIsOnline(device)).length;
  }, [availableDevices, deriveIsOnline]);

  const sessionHitEntries = useMemo<SessionHitEntry[]>(() => {
    if (hitHistory.length === 0) {
      return [];
    }
    const baseTime = (gameStartTime ?? hitHistory[0]?.timestamp ?? Date.now());

    return hitHistory.map((hit, index) => {
      const previous = index > 0 ? hitHistory[index - 1] : null;
      const sinceStartSeconds = Math.max(0, (hit.timestamp - baseTime) / 1000);
      const splitSeconds =
        previous && previous.timestamp
          ? Math.max(0, (hit.timestamp - previous.timestamp) / 1000)
          : null;

      return {
        id: `${hit.deviceId}-${hit.timestamp}`,
        deviceName: hit.deviceName,
        timestamp: hit.timestamp,
        sequence: index + 1,
        sinceStartSeconds,
        splitSeconds,
      };
    });
  }, [hitHistory, gameStartTime]);

  const isLiveDataLoading = loadingDevices || isHistoryLoading || loadingTotalShots;

  const operatorName = useMemo(() => {
    if (user?.user_metadata?.full_name && typeof user.user_metadata.full_name === 'string') {
      return user.user_metadata.full_name;
    }
    if (user?.email) {
      return user.email;
    }
    return 'Operator';
  }, [user]);

  const operatorInitials = useMemo(() => {
    return operatorName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'DF';
  }, [operatorName]);

  const displayedSelectedCount = selectedDeviceIds.length;
  const sessionDialogTargets =
    isLiveDialogPhase && currentSessionTargets.length > 0 ? currentSessionTargets : pendingSessionTargets;
  const canDismissSessionDialog = sessionLifecycle === 'selecting' && !isStarting && !isLaunchingLifecycle;

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
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h1 className="font-heading text-2xl md:text-3xl font-semibold text-brand-text">
                    Live Game Control
                  </h1>
                  <p className="font-body text-brand-text/70 text-sm md:text-base">
                    Orchestrate your session and watch hits stream in from ThingsBoard.
                  </p>
                </div>
                <div className="flex flex-col items-stretch gap-3 text-sm text-brand-dark/60 sm:flex-row sm:items-center sm:gap-4" />
              </div>

              <div className="grid gap-4 xl:gap-6 lg:grid-cols-[320px_minmax(320px,1fr)_minmax(320px,380px)]">
                  <div className="space-y-4">
                    {/* Operator overview card summarises current auth user and macro ThingsBoard stats (online targets, selections, lifetime hits). */}
                    {isLiveDataLoading ? (
                      <OperatorOverviewSkeleton />
                    ) : (
                      <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                        <CardContent className="p-4 md:p-5 space-y-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 bg-brand-secondary/20 text-brand-primary">
                              <AvatarFallback className="text-sm font-semibold text-brand-primary">
                                {operatorInitials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-heading text-base text-brand-dark">{operatorName}</p>
                              <p className="text-xs text-brand-dark/60">ThingsBoard session active</p>
                            </div>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-3 text-xs text-brand-dark/60">
                            <div>
                              <p className="uppercase tracking-wide">Targets Online</p>
                              <p className="font-heading text-lg text-brand-dark">
                                {onlineDevices}/{totalDevices}
                              </p>
                            </div>
                            <div>
                              <p className="uppercase tracking-wide">Selected</p>
                              <p className="font-heading text-lg text-brand-dark">
                                {displayedSelectedCount}
                              </p>
                            </div>
                            <div>
                              <p className="uppercase tracking-wide">Total Hits</p>
                              <p className="font-heading text-lg text-brand-dark">
                                {resolvedTotalHits}
                              </p>
                            </div>
                            <div>
                              <p className="uppercase tracking-wide">Best Score</p>
                              <p className="font-heading text-lg text-brand-dark">
                                {bestScore}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Live session card visualises the active session timer, hit totals, and post-session summary fed by telemetry. */}
                    {isLiveDataLoading ? (
                      <LiveSessionCardSkeleton />
                    ) : (
                      <LiveSessionCard
                        isRunning={isRunningLifecycle}
                        timerSeconds={sessionTimerSeconds}
                        activeTargets={currentSessionTargets}
                        activeHits={activeSessionHits}
                        hitCounts={hitCounts}
                        recentSummary={recentSessionSummary}
                      />
                    )}

                    {/* Target selection card (with Start Game action) lists ThingsBoard devices with connection, hit counts, and lets operators assemble session rosters. */}
                    {isLiveDataLoading ? (
                      <TargetSelectionSkeleton />
                    ) : (
                      <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                        <CardContent className="p-4 md:p-5 space-y-3">
                          <div className="space-y-2">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <h2 className="font-heading text-lg text-brand-dark">Target Selection</h2>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleSelectAllDevices}
                                  disabled={isSessionLocked || loadingDevices}
                                >
                                  Select all
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleClearDeviceSelection}
                                  disabled={isSessionLocked || (!loadingDevices && selectedDeviceIds.length === 0)}
                                >
                                  Clear
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-brand-dark/60">
                              {displayedSelectedCount} selected • {totalOnlineSelectableTargets} online
                            </p>
                          </div>

                          {loadingDevices ? (
                            <div className="flex items-center justify-center py-10 text-sm text-brand-dark/60">
                              Refreshing device list...
                            </div>
                          ) : availableDevices.length === 0 ? (
                            <p className="text-sm text-brand-dark/60">
                              No ThingsBoard devices found for this tenant.
                            </p>
                          ) : (
                            <ScrollArea className="h-[260px] pr-2">
                              <div className="space-y-3">
                                {availableDevices.map((device) => {
                                  const checkboxId = `target-${device.deviceId}`;
                                  const connectionStatus = deriveConnectionStatus(device);
                                  const isOnline = connectionStatus !== 'offline';
                                  const targetRecord = targetById.get(device.deviceId);
                                  const wifiStrength = Math.max(
                                    0,
                                    Math.round(
                                      (targetRecord?.wifiStrength ?? device.wifiStrength ?? 0) as number,
                                    ),
                                  );
                                  const lastActivityTimestamp =
                                    (typeof targetRecord?.lastActivityTime === 'number'
                                      ? targetRecord.lastActivityTime
                                      : null) ??
                                    (typeof device.lastSeen === 'number' ? device.lastSeen : 0);
                                  const connectionLabel =
                                    connectionStatus === 'online'
                                      ? 'Online'
                                      : connectionStatus === 'standby'
                                        ? 'Standby'
                                        : 'Offline';
                                  const connectionColor =
                                    connectionStatus === 'online'
                                      ? 'text-green-600'
                                      : connectionStatus === 'standby'
                                        ? 'text-amber-600'
                                        : 'text-red-600';
                                  const isChecked = selectedDeviceIds.includes(device.deviceId);
                                  return (
                                    <div
                                      key={device.deviceId}
                                      className={`flex items-start justify-between rounded-lg border px-3 py-2 transition-colors ${
                                        isChecked
                                          ? 'border-brand-primary/40 bg-brand-primary/5'
                                          : 'border-gray-200 bg-white'
                                      }`}
                                    >
                                      <div className="flex items-start gap-3">
                                        <Checkbox
                                          id={checkboxId}
                                          checked={isChecked}
                                          disabled={isSessionLocked || !isOnline}
                                          onCheckedChange={(value) =>
                                            handleToggleDeviceSelection(device.deviceId, Boolean(value))
                                          }
                                        />
                                        <div className="space-y-1">
                                          <label
                                            htmlFor={checkboxId}
                                            className="font-heading text-sm text-brand-dark leading-tight"
                                          >
                                            {device.name}
                                          </label>
                                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-dark/60">
                                            <span className={`flex items-center gap-1 font-medium ${connectionColor}`}>
                                              <span className="inline-block h-2 w-2 rounded-full bg-current" />
                                              {connectionLabel}
                                            </span>
                                            <span className="flex items-center gap-1">
                                              {getWifiIndicator(wifiStrength, connectionStatus)}
                                              {wifiStrength}%
                                            </span>
                                            <span>
                                              Hits {hitCounts[device.deviceId] ?? device.hitCount ?? 0}
                                            </span>
                                            <span>{formatLastSeen(lastActivityTimestamp ?? 0)}</span>
                                          </div>
                                        </div>
                                      </div>
                                      {getDeviceStatusBadge(device)}
                                    </div>
                                  );
                                })}
                              </div>
                            </ScrollArea>
                          )}
                          <Button
                            onClick={handleOpenStartDialog}
                            disabled={isSessionLocked || isStarting || loadingDevices || selectedOnlineDevices === 0}
                            className="w-full bg-green-600 hover:bg-green-700"
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
                        </CardContent>
                      </Card>
                    )}

                  </div>

                  <div className="space-y-4">
                    {/* Hit distribution card renders live pie chart + breakdown sourced from current session hit tallies. */}
                    {isLiveDataLoading ? (
                      <HitDistributionSkeleton />
                    ) : (
                      <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                        <CardContent className="p-4 md:p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <h2 className="font-heading text-lg text-brand-dark">Hit Distribution</h2>
                            <Badge variant="outline" className="text-xs">
                              {totalHitsLive} hits
                            </Badge>
                          </div>
                          <div className="h-56">
                            {deviceHitSummary.length === 0 ? (
                              <div className="flex h-full items-center justify-center text-sm text-brand-dark/60 text-center">
                                Start a game to see live hit distribution.
                              </div>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={pieChartData}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius="45%"
                                    outerRadius="75%"
                                    paddingAngle={2}
                                  >
                                    {pieChartData.map((entry, index) => (
                                      <Cell
                                        key={entry.name}
                                        fill={DEVICE_COLOR_PALETTE[index % DEVICE_COLOR_PALETTE.length]}
                                      />
                                    ))}
                                  </Pie>
                                  <RechartsTooltip />
                                </PieChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                          <div className="space-y-3">
                            {deviceHitSummary.length === 0 ? (
                              <p className="text-xs text-brand-dark/60 text-center">
                                No hits recorded yet.
                              </p>
                            ) : (
                              deviceHitSummary.slice(0, 4).map((entry, index) => {
                                const color = DEVICE_COLOR_PALETTE[index % DEVICE_COLOR_PALETTE.length];
                                return (
                                  <div key={entry.deviceId} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs text-brand-dark/60">
                                      <span className="flex items-center gap-2 font-medium text-brand-dark">
                                        <span
                                          className="inline-block h-2.5 w-2.5 rounded-full"
                                          style={{ backgroundColor: color }}
                                        />
                                        {entry.deviceName}
                                      </span>
                                      <span className="font-heading text-sm text-brand-dark">
                                        {entry.hits}
                                      </span>
                                    </div>
                                    <Progress
                                      value={
                                        totalHitsLive > 0
                                          ? Math.min(100, (entry.hits / totalHitsLive) * 100)
                                          : 0
                                      }
                                      className="h-2 bg-brand-secondary/10"
                                    />
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Recent hits card streams the latest telemetry events so operators can audit per-hit chronology. */}
                    {isLiveDataLoading ? (
                      <RecentHitsSkeleton />
                    ) : (
                      <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                        <CardContent className="p-4 md:p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h2 className="font-heading text-lg text-brand-dark">Recent Hits</h2>
                            <Badge variant="outline" className="text-xs">
                              {hitHistory.length}
                            </Badge>
                          </div>
                          {hitHistory.length === 0 ? (
                            <p className="text-sm text-brand-dark/60 text-center py-6">
                              {isRunningLifecycle ? 'Waiting for hits...' : 'No hits recorded yet.'}
                            </p>
                          ) : (
                            <ScrollArea className="max-h-64 pr-2">
                              <div className="space-y-2">
                                {[...hitHistory].reverse().slice(0, 60).map((hit) => (
                                  <div
                                    key={`${hit.deviceId}-${hit.timestamp}`}
                                    className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs"
                                  >
                                    <span className="font-medium text-brand-dark">{hit.deviceName}</span>
                                    <span className="text-brand-dark/60">
                                      {new Date(hit.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Hit timeline card plots hits over time per device to highlight activity spikes and target performance. */}
                    {isLiveDataLoading ? (
                      <HitTimelineSkeleton />
                    ) : (
                      <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                        <CardContent className="p-4 md:p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h2 className="font-heading text-lg text-brand-dark">Hit Timeline</h2>
                            <Badge variant="outline" className="text-xs">
                              {trackedDevices.length} devices
                            </Badge>
                          </div>
                          <div className="h-56">
                            {hitTimelineData.length === 0 ? (
                              <div className="flex h-full items-center justify-center text-sm text-brand-dark/60 text-center">
                                Start streaming hits to see the live timeline.
                              </div>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={hitTimelineData} margin={{ top: 8, right: 16, left: -12, bottom: 36 }}>
                                  <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" />
                                  <XAxis dataKey="time" stroke="#64748B" fontSize={10} />
                                  <YAxis stroke="#64748B" fontSize={10} allowDecimals={false} />
                                  <RechartsTooltip />
                                <Legend
                                  verticalAlign="bottom"
                                  iconSize={8}
                                  height={48}
                                  wrapperStyle={{ paddingTop: 12, width: '100%', maxHeight: 56, overflowY: 'auto' }}
                                />
                                  {trackedDevices.map((device, index) => (
                                    <Line
                                      key={device.deviceId}
                                      type="monotone"
                                      dataKey={device.deviceName}
                                      stroke={DEVICE_COLOR_PALETTE[index % DEVICE_COLOR_PALETTE.length]}
                                      strokeWidth={2}
                                      dot={false}
                                      isAnimationActive={false}
                                    />
                                  ))}
                                </LineChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Split times card visualises recent per-device split durations calculated from telemetry split records. */}
                    {isLiveDataLoading ? (
                      <RecentSplitsSkeleton />
                    ) : (
                      <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                        <CardContent className="p-4 md:p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h2 className="font-heading text-lg text-brand-dark">Split Times</h2>
                            <Badge variant="outline" className="text-xs">
                              {recentSplits.length}
                            </Badge>
                          </div>
                          <div className="h-48">
                            {recentSplits.length === 0 ? (
                              <div className="flex h-full items-center justify-center text-sm text-brand-dark/60 text-center">
                                Splits will appear once hits are recorded.
                              </div>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={recentSplits}
                                  layout="vertical"
                                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                  <XAxis type="number" stroke="#64748B" fontSize={10} unit="s" />
                                  <YAxis
                                    dataKey="label"
                                    type="category"
                                    stroke="#64748B"
                                    fontSize={10}
                                    width={140}
                                  />
                                  <RechartsTooltip formatter={(value) => [`${value} s`, 'Split']} />
                                  <Bar dataKey="time" radius={[4, 4, 4, 4]}>
                                    {recentSplits.map((entry, index) => (
                                      <Cell
                                        key={entry.id}
                                        fill={DEVICE_COLOR_PALETTE[index % DEVICE_COLOR_PALETTE.length]}
                                      />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Target transitions card charts cross-target movement latency using transition telemetry. */}
                    {isLiveDataLoading ? (
                      <RecentTransitionsSkeleton />
                    ) : (
                      <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                        <CardContent className="p-4 md:p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h2 className="font-heading text-lg text-brand-dark">Target Transitions</h2>
                            <Badge variant="outline" className="text-xs">
                              {recentTransitions.length}
                            </Badge>
                          </div>
                          <div className="h-48">
                            {recentTransitions.length === 0 ? (
                              <div className="flex h-full items-center justify-center text-sm text-brand-dark/60 text-center">
                                Target transitions will display once multiple devices register hits.
                              </div>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={recentTransitions}
                                  layout="vertical"
                                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                  <XAxis type="number" stroke="#64748B" fontSize={10} unit="s" />
                                  <YAxis
                                    dataKey="label"
                                    type="category"
                                    stroke="#64748B"
                                    fontSize={10}
                                    width={150}
                                  />
                                  <RechartsTooltip formatter={(value) => [`${value} s`, 'Transition']} />
                                  <Bar dataKey="time" radius={[4, 4, 4, 4]}>
                                    {recentTransitions.map((entry, index) => (
                                      <Cell
                                        key={entry.id}
                                        fill={DEVICE_COLOR_PALETTE[index % DEVICE_COLOR_PALETTE.length]}
                                      />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
              </div>
            </div>
          </div>
        </main>
        <StartSessionDialog
          open={isSessionDialogVisible}
          lifecycle={sessionLifecycle}
          onClose={handleCloseStartDialog}
          onConfirm={handleConfirmStartDialog}
          onStop={handleStopFromDialog}
          isStarting={isStarting}
          isStopping={isStopping}
          canClose={canDismissSessionDialog}
          sessionSeconds={sessionTimerSeconds}
          targets={sessionDialogTargets}
          sessionHits={sessionHitEntries}
          currentGameId={currentGameId}
        />
      </div>
    </div>
  );
};

function convertHistoryEntryToLiveSummary(entry: GameHistory): LiveSessionSummary {
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
          ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
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
  const computedDurationSeconds = Math.max(0, Math.round((endTime - startTime) / 1000));
  const durationSeconds = Number.isFinite(entry.actualDuration) && entry.actualDuration > 0
    ? Math.round(entry.actualDuration)
    : computedDurationSeconds;

  const computedAverageHitInterval = (() => {
    if (sortedHitHistory.length < 2) {
      return 0;
    }
    const intervals = sortedHitHistory
      .slice(1)
      .map((hit, idx) => (hit.timestamp - sortedHitHistory[idx].timestamp) / 1000);
    return intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : 0;
  })();

  const averageHitInterval =
    typeof entry.averageHitInterval === 'number' && Number.isFinite(entry.averageHitInterval)
      ? entry.averageHitInterval
      : computedAverageHitInterval;

  const splits = Array.isArray(entry.splits) ? entry.splits.map((split) => ({ ...split })) : [];
  const transitions = Array.isArray(entry.transitions)
    ? entry.transitions.map((transition) => ({ ...transition }))
    : [];

  const targets = (Array.isArray(entry.deviceResults) ? entry.deviceResults : deviceStats).map((result) => ({
    deviceId: result.deviceId,
    deviceName: result.deviceName ?? result.deviceId,
  }));

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
    historyEntry: entry,
  };
}

interface BuildLiveSessionSummaryArgs {
  gameId: string;
  gameName?: string;
  startTime: number;
  stopTime: number;
  hitHistory: SessionHitRecord[];
  splitRecords: SplitRecord[];
  transitionRecords: TransitionRecord[];
  devices: NormalizedGameDevice[];
}

// Consolidates telemetry streams and device metadata into a reusable session report.
function buildLiveSessionSummary({
  gameId,
  gameName,
  startTime,
  stopTime,
  hitHistory,
  splitRecords,
  transitionRecords,
  devices,
}: BuildLiveSessionSummaryArgs): LiveSessionSummary {
  const safeStart = Number.isFinite(startTime) ? startTime : stopTime;
  const durationSeconds = Math.max(0, Math.round((stopTime - safeStart) / 1000));
  const deviceMap = new Map(devices.map((device) => [device.deviceId, device]));
  const deviceIdSet = new Set(devices.map((device) => device.deviceId));

  const sortedHits = [...hitHistory]
    .filter((hit) => deviceIdSet.size === 0 || deviceIdSet.has(hit.deviceId))
    .sort((a, b) => a.timestamp - b.timestamp);

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
        ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
        : 0,
      firstHitTime: sortedHitTimes[0] ?? 0,
      lastHitTime: sortedHitTimes[sortedHitTimes.length - 1] ?? 0,
    };
  });

  const totalHits = deviceStats.reduce((sum, stat) => sum + stat.hitCount, 0);
  const overallIntervals = sortedHits.slice(1).map((hit, idx) => (hit.timestamp - sortedHits[idx].timestamp) / 1000);
  const averageHitInterval = overallIntervals.length
    ? overallIntervals.reduce((sum, value) => sum + value, 0) / overallIntervals.length
    : 0;

  const switchTimes: number[] = [];
  for (let i = 1; i < sortedHits.length; i++) {
    if (sortedHits[i].deviceId !== sortedHits[i - 1].deviceId) {
      switchTimes.push((sortedHits[i].timestamp - sortedHits[i - 1].timestamp) / 1000);
    }
  }

  const crossTargetStats = {
    totalSwitches: switchTimes.length,
    averageSwitchTime: switchTimes.length
      ? switchTimes.reduce((sum, value) => sum + value, 0) / switchTimes.length
      : 0,
    switchTimes,
  };

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

  const historyEntry: GameHistory = {
    gameId,
    gameName: gameName ?? `Game ${new Date(safeStart).toLocaleTimeString()}`,
    duration: Math.max(1, Math.ceil(durationSeconds / 60)),
    startTime: safeStart,
    endTime: stopTime,
    score: totalHits,
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
  historyEntry.splits = splits;
  historyEntry.transitions = transitions;
  historyEntry.hitHistory = sortedHits;

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
    historyEntry,
  };
}

// Formats a raw second count into mm:ss for the stopwatch display.
function formatSessionDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatSecondsWithMillis(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) {
    return '0.00s';
  }
  const rounded = Math.max(0, totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded - minutes * 60;
  const secondsString = seconds.toFixed(2).padStart(5, '0');
  return minutes > 0 ? `${minutes.toString().padStart(2, '0')}:${secondsString}` : `${seconds.toFixed(2)}s`;
}

interface StartSessionDialogProps {
  open: boolean;
  lifecycle: SessionLifecycle;
  onClose: () => void;
  onConfirm: () => void;
  onStop: () => void;
  isStarting: boolean;
  isStopping: boolean;
  canClose: boolean;
  sessionSeconds: number;
  targets: NormalizedGameDevice[];
  sessionHits: SessionHitEntry[];
  currentGameId: string | null;
}

const SessionStopwatchCard: React.FC<{
  seconds: number;
  accent: 'default' | 'live';
  statusText: string;
  showSpinner?: boolean;
}> = ({ seconds, accent, statusText, showSpinner = false }) => {
  const isLive = accent === 'live';
  const containerClasses = [
    'flex flex-col items-center justify-center rounded-2xl px-6 py-8 text-center',
    isLive ? 'bg-white/10 border border-white/15 shadow-lg' : 'bg-brand-secondary/10 border border-brand-secondary/30',
  ].join(' ');

  return (
    <div className={containerClasses}>
      <Timer className={`mb-4 h-10 w-10 ${isLive ? 'text-white/80' : 'text-brand-primary'}`} />
      <div className={`text-[11px] uppercase tracking-[0.4em] font-semibold ${isLive ? 'text-white/70' : 'text-brand-dark/60'}`}>
        Stopwatch
      </div>
      <div className={`mt-4 font-heading ${isLive ? 'text-white text-5xl sm:text-6xl' : 'text-brand-dark text-4xl sm:text-5xl'}`}>
        {formatSessionDuration(seconds)}
      </div>
      <p className={`mt-3 text-xs font-medium ${isLive ? 'text-white/70' : 'text-brand-dark/60'}`}>
        {statusText}
      </p>
      {showSpinner && (
        <Loader2 className={`mt-3 h-5 w-5 animate-spin ${isLive ? 'text-white/70' : 'text-brand-primary'}`} />
      )}
    </div>
  );
};

const SessionTargetList: React.FC<{ targets: NormalizedGameDevice[] }> = ({ targets }) => {
  if (targets.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-brand-secondary/40 bg-brand-secondary/10 px-3 py-4 text-sm text-brand-dark/60 text-center">
        Select at least one online target to begin a live session.
      </p>
    );
  }

  return (
    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
      {targets.map((target) => (
        <div
          key={target.deviceId}
          className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
        >
          <div>
            <p className="font-medium text-brand-dark">{target.name ?? target.deviceId}</p>
            <p className="text-xs text-brand-dark/60">{target.deviceId}</p>
          </div>
          <Badge
            variant="outline"
            className={
              target.isOnline === false
                ? 'text-brand-dark/60'
                : 'bg-green-100 text-green-700 border-green-200'
            }
          >
            {target.isOnline === false ? 'Offline' : 'Online'}
          </Badge>
        </div>
      ))}
    </div>
  );
};

const SessionProgressMessage: React.FC<{
  tone: 'default' | 'live';
  message: string;
  subtext?: string;
}> = ({ tone, message, subtext }) => {
  const isLive = tone === 'live';
  return (
    <div
      className={[
        'rounded-xl border px-4 py-6 text-center text-sm flex flex-col items-center gap-3',
        isLive ? 'border-white/15 bg-white/10 text-white/80' : 'border-brand-secondary/20 bg-brand-secondary/10 text-brand-dark/70',
      ].join(' ')}
    >
      <Loader2 className={`h-5 w-5 animate-spin ${isLive ? 'text-white/80' : 'text-brand-primary'}`} />
      <p>{message}</p>
      {subtext && <p className="text-xs opacity-75">{subtext}</p>}
    </div>
  );
};

const SessionHitFeedList: React.FC<{
  hits: SessionHitEntry[];
  variant: 'live' | 'finalizing';
  emptyLabel: string;
  limit?: number;
}> = ({ hits, variant, emptyLabel, limit = 12 }) => {
  if (hits.length === 0) {
    return (
      <div
        className={
          variant === 'live'
            ? 'rounded-xl border border-white/15 bg-white/10 px-4 py-6 text-center text-sm text-white/70'
            : 'rounded-xl border border-white/15 bg-white/10 px-4 py-6 text-center text-sm text-white/70'
        }
      >
        {emptyLabel}
      </div>
    );
  }

  const sliced = hits.slice(-limit).reverse();

  return (
    <div
      className={
        variant === 'live'
          ? 'max-h-60 overflow-y-auto rounded-xl border border-white/15 bg-white/10 divide-y divide-white/10'
          : 'max-h-52 overflow-y-auto rounded-xl border border-white/15 bg-white/10 divide-y divide-white/10'
      }
    >
      {sliced.map((hit) => (
        <div
          key={hit.id}
          className={
            variant === 'live'
              ? 'flex items-center justify-between px-4 py-3 text-xs sm:text-sm text-white'
              : 'flex items-center justify-between px-4 py-3 text-xs sm:text-sm text-white/80'
          }
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] sm:text-xs text-white/60">
              #{hit.sequence}
            </span>
            <span className="font-semibold">{hit.deviceName}</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] sm:text-xs uppercase tracking-wide">
            <span>{formatSecondsWithMillis(hit.sinceStartSeconds)}</span>
            <span className="text-white/70">
              {hit.splitSeconds !== null ? `+${formatSecondsWithMillis(hit.splitSeconds)}` : '—'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// Renders the confirmation dialog that summarises the session setup before issuing RPC commands.
const StartSessionDialog: React.FC<StartSessionDialogProps> = ({
  open,
  lifecycle,
  onClose,
  onConfirm,
  onStop,
  isStarting,
  isStopping,
  canClose,
  sessionSeconds,
  targets,
  sessionHits,
  currentGameId,
}) => {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && canClose) {
      onClose();
    }
  };

  const isSelectingPhase = lifecycle === 'selecting';
  const isLaunchingPhase = lifecycle === 'launching';
  const isRunningPhase = lifecycle === 'running';
  const isStoppingPhase = lifecycle === 'stopping';
  const isFinalizingPhase = lifecycle === 'finalizing';
  const usesLivePalette = isRunningPhase || isStoppingPhase || isFinalizingPhase;

  const dialogDescription = (() => {
    if (isFinalizingPhase) {
      return 'Wrapping up telemetry and saving the session summary.';
    }
    if (isStoppingPhase) {
      return 'Stopping the live session and notifying all selected targets.';
    }
    if (isRunningPhase) {
      return 'Session is live—watch the stopwatch and shot feed update as hits come in.';
    }
    if (isLaunchingPhase) {
      return 'Starting the session on your selected targets. Hang tight—this usually takes a moment.';
    }
    return 'Review your target list and get ready to launch this live session.';
  })();

  const stopwatchStatus = (() => {
    if (isFinalizingPhase) {
      return 'Saving session results...';
    }
    if (isStoppingPhase) {
      return 'Stopping session...';
    }
    if (isRunningPhase) {
      return 'Session is live';
    }
    if (isLaunchingPhase) {
      return 'Launching session...';
    }
    return 'Review selected targets before starting.';
  })();

  const showStopwatchSpinner = isLaunchingPhase || isStoppingPhase || isFinalizingPhase;
  const canTriggerStart = isSelectingPhase && !isStarting && targets.length > 0;
  const showCloseButton = isSelectingPhase || isLaunchingPhase;
  const showStartButton = isSelectingPhase;
  const showStopButton = isRunningPhase;

  let bodyContent: React.ReactNode;
  if (isRunningPhase) {
    bodyContent = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge className="bg-white/15 text-white border-white/20 text-xs px-3 py-1">
            {`${targets.length} target${targets.length === 1 ? '' : 's'} armed`}
          </Badge>
        </div>
        <h3 className="text-sm uppercase tracking-wide text-white/80">Live shot feed</h3>
        <SessionHitFeedList
          hits={sessionHits}
          variant="live"
          emptyLabel="Waiting for the first hit..."
          limit={12}
        />
      </div>
    );
  } else if (isStoppingPhase || isFinalizingPhase) {
    const message = isFinalizingPhase
      ? 'Persisting session summary...'
      : 'Sending stop command to all targets...';
    bodyContent = (
      <div className="space-y-3">
        <SessionProgressMessage tone="live" message={message} />
        {sessionHits.length > 0 && (
          <>
            <h3 className="text-sm uppercase tracking-wide text-white/80">Recent hits</h3>
            <SessionHitFeedList
              hits={sessionHits}
              variant="finalizing"
              emptyLabel="Waiting for hits..."
              limit={6}
            />
          </>
        )}
      </div>
    );
  } else if (isLaunchingPhase) {
    bodyContent = (
      <div className="space-y-3">
        <SessionProgressMessage
          tone="default"
          message="Starting session on selected targets..."
          subtext="Waiting for ThingsBoard to confirm the game is live."
        />
      </div>
    );
  } else {
    bodyContent = (
      <div className="space-y-3">
        <h3 className="font-heading text-sm uppercase tracking-wide text-brand-dark/70">
          Targets ({targets.length})
        </h3>
        <SessionTargetList targets={targets} />
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={[
          'max-w-xl',
          'transition-colors',
          'duration-300',
          'shadow-xl',
          usesLivePalette ? 'bg-brand-secondary text-white border-brand-secondary/50' : 'bg-white text-brand-dark border-gray-200',
        ].join(' ')}
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-heading">Current Session</DialogTitle>
          <DialogDescription className={usesLivePalette ? 'text-white/80' : 'text-brand-dark/70'}>
            {dialogDescription}
          </DialogDescription>
          {currentGameId && (
            <p className={`text-xs font-mono ${usesLivePalette ? 'text-white/65' : 'text-brand-dark/50'}`}>Game ID: {currentGameId}</p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          <SessionStopwatchCard
            seconds={sessionSeconds}
            accent={usesLivePalette ? 'live' : 'default'}
            statusText={stopwatchStatus}
            showSpinner={showStopwatchSpinner}
          />

          {bodyContent}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          {showCloseButton ? (
            <Button
              variant="outline"
              onClick={onClose}
              disabled={!canClose || isStarting || isLaunchingPhase}
              className={usesLivePalette ? 'border-white/35 text-white hover:bg-white/10 hidden' : undefined}
            >
              {canClose ? 'Cancel' : 'Close'}
            </Button>
          ) : (
            <span className="hidden sm:block" aria-hidden="true" />
          )}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {showStopButton && (
              <Button
                variant="destructive"
                onClick={onStop}
                disabled={isStoppingPhase || isStopping}
                className="sm:min-w-[140px]"
              >
                {isStopping ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Stop Session
                  </>
                )}
              </Button>
            )}
            {showStartButton && (
              <Button
                onClick={onConfirm}
                disabled={!canTriggerStart}
                className={
                  canTriggerStart
                    ? 'sm:min-w-[140px] bg-green-600 hover:bg-green-700'
                    : 'sm:min-w-[140px] bg-green-600/40 text-green-900/60 cursor-not-allowed'
                }
              >
                {isStarting ? (
                  <>
                    <Play className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Begin Session
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Displays placeholder content while the operator overview card loads.
const OperatorOverviewSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full bg-gray-200" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 bg-gray-200" />
          <Skeleton className="h-3 w-24 bg-gray-200" />
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-20 bg-gray-200" />
            <Skeleton className="h-5 w-12 bg-gray-200" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// Provides a loading state for the live session card while telemetry initialises.
const LiveSessionCardSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32 bg-gray-200" />
        <Skeleton className="h-6 w-16 bg-gray-200" />
      </div>
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-8 text-center space-y-3">
        <Skeleton className="mx-auto h-10 w-10 rounded-full bg-gray-200" />
        <Skeleton className="mx-auto h-4 w-20 bg-gray-200" />
        <Skeleton className="mx-auto h-10 w-40 bg-gray-200" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between">
            <Skeleton className="h-3 w-28 bg-gray-200" />
            <Skeleton className="h-3 w-16 bg-gray-200" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// Renders the device selection placeholder until ThingsBoard devices are ready.
const TargetSelectionSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32 bg-gray-200" />
          <Skeleton className="h-3 w-44 bg-gray-200" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 bg-gray-200 rounded-md" />
          <Skeleton className="h-9 w-16 bg-gray-200 rounded-md" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 bg-gray-200 rounded-sm" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 bg-gray-200" />
                <Skeleton className="h-3 w-40 bg-gray-200" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// Shows a placeholder chart while hit distribution data streams in.
const HitDistributionSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28 bg-gray-200" />
        <Skeleton className="h-4 w-12 bg-gray-200" />
      </div>
      <Skeleton className="h-56 w-full bg-gray-100 rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-32 bg-gray-200" />
              <Skeleton className="h-3 w-8 bg-gray-200" />
            </div>
            <Skeleton className="h-2 w-full bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// Provides a placeholder feed for the recent hits card.
const RecentHitsSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28 bg-gray-200" />
        <Skeleton className="h-4 w-10 bg-gray-200" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
          >
            <Skeleton className="h-3 w-32 bg-gray-200" />
            <Skeleton className="h-3 w-16 bg-gray-200" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// Covers the hit timeline chart while telemetry history is loading.
const HitTimelineSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28 bg-gray-200" />
        <Skeleton className="h-4 w-20 bg-gray-200" />
      </div>
      <Skeleton className="h-56 w-full bg-gray-100 rounded-lg" />
    </CardContent>
  </Card>
);

// Shows split-time placeholders before the bar chart renders.
const RecentSplitsSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24 bg-gray-200" />
        <Skeleton className="h-4 w-10 bg-gray-200" />
      </div>
      <Skeleton className="h-48 w-full bg-gray-100 rounded-lg" />
    </CardContent>
  </Card>
);

// Mimics the target transition bar chart while the data is coming in.
const RecentTransitionsSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32 bg-gray-200" />
        <Skeleton className="h-4 w-12 bg-gray-200" />
      </div>
      <Skeleton className="h-48 w-full bg-gray-100 rounded-lg" />
    </CardContent>
  </Card>
);

interface LiveSessionCardProps {
  isRunning: boolean;
  timerSeconds: number;
  activeTargets: NormalizedGameDevice[];
  activeHits: number;
  hitCounts: Record<string, number>;
  recentSummary: LiveSessionSummary | null;
}

// Displays either the live session telemetry or the latest summary once the game ends.
const LiveSessionCard: React.FC<LiveSessionCardProps> = ({
  isRunning,
  timerSeconds,
  activeTargets,
  activeHits,
  hitCounts,
  recentSummary,
}) => {
  if (isRunning) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
        <CardContent className="p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg text-brand-dark">Live Session</h2>
              <p className="text-xs text-brand-dark/60">Tracking {activeTargets.length} targets in real time</p>
            </div>
            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Active</Badge>
          </div>
          <div className="flex items-center justify-between rounded-md border border-brand-secondary/40 bg-brand-secondary/10 px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-brand-dark/60">Stopwatch</p>
              <p className="font-heading text-2xl text-brand-dark">{formatSessionDuration(timerSeconds)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-brand-dark/60">Session Hits</p>
              <p className="font-heading text-2xl text-brand-dark">{activeHits}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-brand-dark/60">Targets</p>
            {activeTargets.length === 0 ? (
              <p className="rounded-md border border-dashed border-brand-secondary/40 bg-brand-secondary/10 px-3 py-4 text-sm text-brand-dark/60 text-center">
                Select one or more online targets to stream live stats.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {activeTargets.map((target) => {
                  const hits = hitCounts[target.deviceId] ?? target.hitCount ?? 0;
                  return (
                    <div
                      key={target.deviceId}
                      className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div>
                        <p className="font-medium text-brand-dark leading-tight">{target.name ?? target.deviceId}</p>
                        <p className="text-[11px] text-brand-dark/60">{target.deviceId}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-brand-dark/60 uppercase tracking-wide">Hits</p>
                        <p className="font-heading text-base text-brand-dark">{hits}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recentSummary) {
    const topResults = [...(recentSummary.historyEntry.deviceResults ?? [])]
      .sort((a, b) => (b.hitCount ?? 0) - (a.hitCount ?? 0))
      .slice(0, 3);
    const recentSplits = (recentSummary.splits ?? []).slice(0, 4);

    return (
      <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
        <CardContent className="p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-heading text-lg text-brand-dark">Last Session Summary</h2>
              <p className="text-xs text-brand-dark/60">
                {new Date(recentSummary.startedAt).toLocaleTimeString()} • {recentSummary.targets.length} targets
              </p>
            </div>
            <Badge variant="outline" className="text-xs text-brand-dark/70">
              {formatSessionDuration(recentSummary.durationSeconds)}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-brand-dark/60">
            <div>
              <p className="uppercase tracking-wide">Total Hits</p>
              <p className="font-heading text-lg text-brand-dark">{recentSummary.totalHits}</p>
            </div>
            <div>
              <p className="uppercase tracking-wide">Avg Split</p>
              <p className="font-heading text-lg text-brand-dark">
                {recentSummary.averageHitInterval > 0 ? `${recentSummary.averageHitInterval.toFixed(2)}s` : '—'}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-wide">Switches</p>
              <p className="font-heading text-lg text-brand-dark">
                {recentSummary.crossTargetStats?.totalSwitches ?? 0}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-wide">Game ID</p>
              <p className="font-heading text-sm text-brand-dark truncate max-w-[180px]" title={recentSummary.gameId}>
                {recentSummary.gameId}
              </p>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-brand-dark/60">Top Targets</p>
            {topResults.length === 0 ? (
              <p className="text-sm text-brand-dark/60">No target activity captured for this session.</p>
            ) : (
              <div className="space-y-2">
                {topResults.map((result) => (
                  <div key={result.deviceId} className="flex items-center justify-between">
                    <span className="font-medium text-brand-dark">{result.deviceName}</span>
                    <span className="font-heading text-sm text-brand-dark">{result.hitCount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {recentSplits.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-brand-dark/60">Recent Splits</p>
                <div className="space-y-1">
                  {recentSplits.map((split) => (
                    <div key={`${split.deviceId}-${split.splitNumber}`} className="flex items-center justify-between text-xs">
                      <span className="text-brand-dark/70">
                        {split.deviceName} #{split.splitNumber}
                      </span>
                      <span className="font-heading text-brand-dark">{split.time.toFixed(2)}s</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
      <CardContent className="p-4 md:p-5 text-sm text-brand-dark/60">
        Launch a live session to capture real-time stats and view the summary here.
      </CardContent>
    </Card>
  );
};

export default Games;
