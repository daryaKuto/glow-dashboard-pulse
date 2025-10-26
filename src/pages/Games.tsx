import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Gamepad2, Play, AlertCircle } from 'lucide-react';
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
import { useTargets, type Target } from '@/store/useTargets';
import { useRooms } from '@/store/useRooms';
import { useGameTelemetry, type SplitRecord, type TransitionRecord } from '@/hooks/useGameTelemetry';
import { useThingsboardToken } from '@/hooks/useThingsboardToken';
import { useDirectTbTelemetry } from '@/hooks/useDirectTbTelemetry';
import {
  ensureTbAuthToken,
  tbSetShared,
  tbSendOneway,
} from '@/services/thingsboard-client';
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
import {
  OperatorOverviewCard,
  OperatorOverviewSkeleton,
  LiveSessionCard,
  LiveSessionCardSkeleton,
  HitTimelineCard,
  HitTimelineSkeleton,
  HitDistributionCard,
  HitDistributionSkeleton,
  TargetSelectionCard,
  TargetSelectionSkeleton,
  RoomSelectionCard,
  StartSessionDialog,
} from '@/components/games';
import type { LiveSessionSummary } from '@/components/games/types';

import { useSessionTimer, type SessionLifecycle, type SessionHitEntry } from '@/components/game-session/sessionState';

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
type AxiosErrorLike = {
  isAxiosError?: boolean;
  response?: { status?: unknown };
  code?: string;
  message?: unknown;
};

const isAxiosErrorLike = (error: unknown): error is AxiosErrorLike => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return Boolean((error as { isAxiosError?: unknown }).isAxiosError);
};

const isAxiosNetworkError = (error: unknown): boolean => {
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

const resolveHttpStatus = (error: unknown): number | undefined => {
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

const DIRECT_TB_CONTROL_ENABLED = true;

const resolveNumericTelemetryValue = (input: unknown): number | null => {
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

const getTargetTotalShots = (target: Target): number | null => {
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

const getTargetBestScore = (target: Target): number | null => {
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

// Main Live Game Control page: orchestrates device state, telemetry streams, and session history for operator control.
const Games: React.FC = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  // Tracks the shadcn sidebar state so we know whether to render the drawer on small screens.
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Holds the persisted session summaries displayed in the Session History card.
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  // Mirrors the fetch lifecycle so the history section can show skeletons/spinners.
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const { isLoading: loadingDevices, refresh: refreshGameDevices } = useGameDevices({ immediate: false });
  const targetsSnapshot = useTargets((state) => state.targets);
  const targetsStoreLoading = useTargets((state) => state.isLoading);
  const targetDetailsLoading = useTargets((state) => state.detailsLoading);
  const refreshTargets = useTargets((state) => state.refresh);
  const targetsLastFetched = useTargets((state) => state.lastFetched);
  const rooms = useRooms((state) => state.rooms);
  const roomsLoading = useRooms((state) => state.isLoading);
  const fetchRooms = useRooms((state) => state.fetchRooms);
  // Canonical list of targets decorated with live telemetry that powers the tables and selectors.
  const [availableDevices, setAvailableDevices] = useState<NormalizedGameDevice[]>([]);
  // Surface-level error banner for operator actions (start/stop failures, auth issues).
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Single source of truth for the popup lifecycle (selecting → launching → running → stopping → finalizing).
  const [sessionLifecycle, setSessionLifecycle] = useState<SessionLifecycle>('idle');
  // Prevents the dialog from re-opening automatically when an operator intentionally dismisses it mid-idle.
  const [isSessionDialogDismissed, setIsSessionDialogDismissed] = useState(false);
  const sessionLifecycleRef = useRef<SessionLifecycle>('idle');
  // Start/stop timestamps anchor timer displays and summary persistence payloads.
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [gameStopTime, setGameStopTime] = useState<number | null>(null);
  // Live counters and history feed the hit charts plus the popup shot list.
  const [hitCounts, setHitCounts] = useState<Record<string, number>>({});
  const [historicalHitCounts, setHistoricalHitCounts] = useState<Record<string, number>>({});
  const [hitHistory, setHitHistory] = useState<SessionHitRecord[]>([]);
  // Active devices represent the targets we actually armed for the in-progress session.
  const [activeDeviceIds, setActiveDeviceIds] = useState<string[]>([]);
  // Selected devices reflect the operator's current choices in the Target Selection card.
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  // Pending targets are staged in the dialog before the operator confirms Begin Session.
  const [pendingSessionTargets, setPendingSessionTargets] = useState<NormalizedGameDevice[]>([]);
  // Current session targets are locked once the session is running, informing UI badges and telemetry subscriptions.
  const [currentSessionTargets, setCurrentSessionTargets] = useState<NormalizedGameDevice[]>([]);
  // Snapshot of the most recent completed game, displayed in the post-session summary card.
  const [recentSessionSummary, setRecentSessionSummary] = useState<LiveSessionSummary | null>(null);
  // directSessionGameId mirrors the ThingsBoard `gameId` string used by the RPC start/stop commands.
  const [directSessionGameId, setDirectSessionGameId] = useState<string | null>(null);
  // directSessionTargets stores `{deviceId, name}` pairs used by the popup telemetry stream and status pills.
  const [directSessionTargets, setDirectSessionTargets] = useState<Array<{ deviceId: string; name: string }>>([]);
  // Indicates whether the direct TB control path is active (needed to gate realtime commands and UI copy).
  const [directFlowActive, setDirectFlowActive] = useState(false);
  // Tracks the per-device RPC start acknowledgement so the dialog can render success/pending/error badges.
  const [directStartStates, setDirectStartStates] = useState<Record<string, 'idle' | 'pending' | 'success' | 'error'>>({});
  // Flag toggled after commands are issued so the dialog knows it can subscribe directly to ThingsBoard.
  const [directTelemetryEnabled, setDirectTelemetryEnabled] = useState(false);
  // Stores the JWT returned by `ensureTbAuthToken` for RPCs and direct WebSocket subscriptions.
  const [directControlToken, setDirectControlToken] = useState<string | null>(null);
  // Populates the dialog error banner whenever the ThingsBoard auth handshake fails.
  const [directControlError, setDirectControlError] = useState<string | null>(null);
  // Spinner state for the authentication request shown while the dialog prepares direct control.
  const [isDirectAuthLoading, setIsDirectAuthLoading] = useState(false);
  // Toggles the retry button state while we resend start commands to failed devices.
  const [isRetryingFailedDevices, setIsRetryingFailedDevices] = useState(false);
  const directStartStatesRef = useRef<Record<string, 'idle' | 'pending' | 'success' | 'error'>>({});
  const updateDirectStartStates = useCallback((
    value:
      | Record<string, 'idle' | 'pending' | 'success' | 'error'>
      | ((
        prev: Record<string, 'idle' | 'pending' | 'success' | 'error'>,
      ) => Record<string, 'idle' | 'pending' | 'success' | 'error'>),
  ) => {
    setDirectStartStates((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      directStartStatesRef.current = next;
      console.info('[Games] Direct start state update', next);
      return next;
    });
  }, []);

  // Session timer powers the stopwatch in the popup and elapsed time block in the dashboard cards.
  const {
    seconds: sessionTimerSeconds,
    reset: resetSessionTimer,
    start: startSessionTimer,
    freeze: freezeSessionTimer,
  } = useSessionTimer();
  // Activation metadata helps correlate when we fired the ThingsBoard start command vs. when telemetry confirmed it.
  const {
    triggeredAt: startTriggeredAt,
    confirmedAt: telemetryConfirmedAt,
    isConfirmed: sessionConfirmed,
    markTriggered: markSessionTriggered,
    markTelemetryConfirmed,
    resetActivation: resetSessionActivation,
    activationParams,
  } = useSessionActivation();
  // Lets async callbacks check the latest confirmation state without waiting for React re-render.
  const sessionConfirmedRef = useRef<boolean>(false);

  // currentGameDevicesRef keeps a stable list of armed targets so stop/finalize logic can reference them after state resets.
  const currentGameDevicesRef = useRef<string[]>([]);
  // We mutate the cached devices in effects; this ref ensures selectors don't fight with React batching.
  const availableDevicesRef = useRef<NormalizedGameDevice[]>([]);
  // Indicates whether the operator manually toggled checkboxes (prevents auto-selecting devices mid-refresh).
  const selectionManuallyModifiedRef = useRef(false);
  // Tracks whether the initial ThingsBoard device snapshot has been loaded.
  const hasLoadedDevicesRef = useRef(false);
  // Centralised token manager so the Games page always has a fresh ThingsBoard JWT for sockets/RPCs.
  const { session: tbSession, refresh: refreshThingsboardSession } = useThingsboardToken();

  const isSelectingLifecycle = sessionLifecycle === 'selecting';
  const isLaunchingLifecycle = sessionLifecycle === 'launching';
  const isRunningLifecycle = sessionLifecycle === 'running';
  const isStoppingLifecycle = sessionLifecycle === 'stopping';
  const isFinalizingLifecycle = sessionLifecycle === 'finalizing';
  const isSessionLocked =
    isLaunchingLifecycle || isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle;
  const isSessionDialogVisible = sessionLifecycle !== 'idle' && !isSessionDialogDismissed;
  const isLiveDialogPhase = isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle;

  useEffect(() => {
    console.info('[Games] Session lifecycle changed', sessionLifecycle);
    sessionLifecycleRef.current = sessionLifecycle;
  }, [sessionLifecycle]);

  useEffect(() => {
    if (sessionLifecycle === 'idle') {
      setIsSessionDialogDismissed(false);
    }
  }, [sessionLifecycle]);

  useEffect(() => {
    console.info('[Games] Direct telemetry enabled state', {
      enabled: directTelemetryEnabled,
      lifecycle: sessionLifecycle,
    });
  }, [directTelemetryEnabled, sessionLifecycle]);

  useEffect(() => {
    sessionConfirmedRef.current = sessionConfirmed;
  }, [sessionConfirmed]);

  const refreshDirectAuthToken = useCallback(async () => {
    try {
      setIsDirectAuthLoading(true);
      const token = await ensureTbAuthToken();
      setDirectControlToken(token);
      setDirectControlError(null);
      return token;
    } catch (authError) {
      const message =
        authError instanceof Error ? authError.message : 'Failed to refresh ThingsBoard authentication.';
      setDirectControlError(message);
      throw authError;
    } finally {
      setIsDirectAuthLoading(false);
    }
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

  const currentGameId: string | null = null;
  const isStarting = isLaunchingLifecycle;
  const isStopping = isStoppingLifecycle;

  // Loads the latest edge snapshot and keeps local mirrors (state + refs) in sync so downstream hooks can reuse the same data.
  const loadLiveDevices = useCallback(
    async ({
      silent = false,
      showToast = false,
      reason = 'manual',
    }: { silent?: boolean; showToast?: boolean; reason?: 'initial' | 'postStop' | 'manual' } = {}) => {
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

        hasLoadedDevicesRef.current = true;

        if (reason === 'initial' || reason === 'postStop') {
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

  useEffect(() => {
    availableDevicesRef.current = availableDevices;
  }, [availableDevices]);

  useEffect(() => {
    if (hasLoadedDevicesRef.current) {
      return;
    }
    void loadLiveDevices({ showToast: true, reason: 'initial' });
  }, [loadLiveDevices]);

  useEffect(() => {
    if (targetsSnapshot.length === 0 && !targetsStoreLoading) {
      void refreshTargets().catch((err) => {
        console.warn('[Games] Failed to refresh targets snapshot for status sync', err);
      });
    }
  }, [targetsSnapshot.length, targetsStoreLoading, refreshTargets]);

  useEffect(() => {
    let cancelled = false;
    let timeout: number | null = null;

    const run = async () => {
      if (cancelled) {
        return;
      }
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        schedule();
        return;
      }
      try {
        await refreshTargets();
      } catch (err) {
        console.warn('[Games] Periodic targets refresh failed', err);
      } finally {
        schedule();
      }
    };

    function schedule() {
      if (cancelled) {
        return;
      }
      timeout = window.setTimeout(() => {
        void run();
      }, 60_000);
    }

    void run();

    return () => {
      cancelled = true;
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
    };
  }, [refreshTargets]);

  useEffect(() => {
    let cancelled = false;

    const loadRooms = async () => {
      try {
        await fetchRooms();
      } catch (err) {
        if (!cancelled) {
          console.warn('[Games] Failed to fetch rooms for selection card', err);
        }
      }
    };

    void loadRooms();

    return () => {
      cancelled = true;
    };
  }, [fetchRooms]);

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

  const availableDeviceMap = useMemo(() => {
    const map = new Map<string, NormalizedGameDevice>();
    availableDevices.forEach((device) => {
      map.set(device.deviceId, device);
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

  const roomSelections = useMemo(() => {
    return rooms
      .map((room) => {
        const targets = Array.isArray(room.targets) ? room.targets : [];
        const deviceIds = targets
          .map((target) => target.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        if (deviceIds.length === 0) {
          return null;
        }
        let onlineCount = 0;
        deviceIds.forEach((deviceId) => {
          const device = availableDeviceMap.get(deviceId);
          if (device && deriveConnectionStatus(device) !== 'offline') {
            onlineCount += 1;
          }
        });
        return {
          id: room.id,
          name: room.name,
          deviceIds,
          targetCount: deviceIds.length,
          onlineCount,
        };
      })
      .filter((room): room is {
        id: string;
        name: string;
        deviceIds: string[];
        targetCount: number;
        onlineCount: number;
      } => room !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rooms, availableDeviceMap, deriveConnectionStatus]);

  const deriveIsOnline = useCallback(
    (device: NormalizedGameDevice) => deriveConnectionStatus(device) !== 'offline',
    [deriveConnectionStatus],
  );

  const getOnlineDevices = useCallback(() => {
    return availableDevicesRef.current.filter((device) => deriveIsOnline(device));
  }, [deriveIsOnline]);

  const buildHitCountsFromSummary = useCallback((summary: LiveSessionSummary | null) => {
    if (!summary) {
      return {};
    }
    const deviceResults = Array.isArray(summary.historyEntry?.deviceResults)
      ? summary.historyEntry.deviceResults
      : [];
    const fallbackStats = Array.isArray(summary.deviceStats) ? summary.deviceStats : [];
    const source = deviceResults.length > 0 ? deviceResults : fallbackStats;
    if (source.length === 0) {
      return {};
    }
    return source.reduce<Record<string, number>>((acc, entry) => {
      if (entry && typeof entry.deviceId === 'string' && entry.deviceId.length > 0) {
        const hits =
          typeof entry.hitCount === 'number' ? entry.hitCount : Number(entry.hitCount) || 0;
        acc[entry.deviceId] = hits;
      }
      return acc;
    }, {});
  }, []);

  useEffect(() => {
    if (isRunningLifecycle) {
      setHistoricalHitCounts({});
      return;
    }
    if (recentSessionSummary) {
      setHistoricalHitCounts(buildHitCountsFromSummary(recentSessionSummary));
    } else {
      setHistoricalHitCounts({});
    }
  }, [buildHitCountsFromSummary, isRunningLifecycle, recentSessionSummary]);

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

  const handleToggleRoomTargets = useCallback(
    (roomId: string, checked: boolean) => {
      selectionManuallyModifiedRef.current = true;
      const room = roomSelections.find((entry) => entry.id === roomId);
      if (!room) {
        return;
      }
      const roomDeviceIds = room.deviceIds;
      if (roomDeviceIds.length === 0) {
        return;
      }
      setSelectedDeviceIds((prev) => {
        if (checked) {
          const merged = new Set(prev);
          roomDeviceIds.forEach((id) => merged.add(id));
          return Array.from(merged);
        }
        const deviceIdsToRemove = new Set(roomDeviceIds);
        return prev.filter((id) => !deviceIdsToRemove.has(id));
      });
    },
    [roomSelections],
  );

  const handleSelectAllRooms = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    const roomDeviceIds = roomSelections.flatMap((room) => room.deviceIds);
    if (roomDeviceIds.length === 0) {
      return;
    }
    setSelectedDeviceIds((prev) => Array.from(new Set([...prev, ...roomDeviceIds])));
  }, [roomSelections]);

  const handleClearRoomSelection = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    const roomDeviceIds = roomSelections.flatMap((room) => room.deviceIds);
    if (roomDeviceIds.length === 0) {
      return;
    }
    const deviceIdsToRemove = new Set(roomDeviceIds);
    setSelectedDeviceIds((prev) => prev.filter((id) => !deviceIdsToRemove.has(id)));
  }, [roomSelections]);

  // Presents the confirmation dialog so operators can review selected devices before starting.
  const handleOpenStartDialog = useCallback(async () => {
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

    let generatedGameId: string | null = null;
    try {
      console.info('[Games] Authenticating with ThingsBoard before opening start dialog');
      const token = await refreshDirectAuthToken();
      console.info('[Games] ThingsBoard authentication succeeded');
      generatedGameId = `GM-${Date.now()}`;
    } catch (error) {
      console.error('[Games] ThingsBoard authentication failed', error);
      const message =
        error instanceof Error ? error.message : 'Failed to authenticate with ThingsBoard.';
      setDirectControlError(message);
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    const directTargetList = selectedTargets.map((device) => ({
      deviceId: device.deviceId,
      name: device.name ?? device.deviceId,
    }));
    console.info('[Games] Direct control targets prepared', directTargetList);

    const initialStates = directTargetList.reduce<Record<string, 'idle' | 'pending' | 'success' | 'error'>>((acc, target) => {
      acc[target.deviceId] = 'idle';
      return acc;
    }, {});
    setDirectSessionTargets(directTargetList);
    updateDirectStartStates(() => initialStates);
    setDirectFlowActive(false);
    setDirectSessionGameId(generatedGameId ?? `GM-${Date.now()}`);
    console.info('[Games] Direct telemetry disabled until begin is confirmed');
    setDirectTelemetryEnabled(false);

    setErrorMessage(null);
    setPendingSessionTargets(selectedTargets);
    resetSessionTimer(null);
    resetSessionActivation();
    setGameStartTime(null);
    setGameStopTime(null);
    setIsSessionDialogDismissed(false);
    setSessionLifecycle('selecting');
  }, [
    getOnlineDevices,
    resetSessionActivation,
    resetSessionTimer,
    selectedDeviceIds,
    updateDirectStartStates,
    setDirectSessionGameId,
    setDirectSessionTargets,
    setDirectFlowActive,
    setDirectTelemetryEnabled,
    refreshDirectAuthToken,
    setDirectControlError,
    setErrorMessage,
    setPendingSessionTargets,
    setGameStartTime,
    setGameStopTime,
    setIsSessionDialogDismissed,
    toast,
  ]);

  // Shared telemetry hook feeds real-time hit data for active devices so the page can merge hit counts, splits, and transitions.
  const directTelemetryDeviceDescriptors = useMemo(
    () =>
      activeDeviceIds.map((deviceId) => ({
        deviceId,
        deviceName: availableDevicesRef.current.find((device) => device.deviceId === deviceId)?.name ?? deviceId,
      })),
    [activeDeviceIds],
  );

  const isDirectTelemetryLifecycle =
    DIRECT_TB_CONTROL_ENABLED && Boolean(directSessionGameId) &&
    (isLaunchingLifecycle || isRunningLifecycle || isStoppingLifecycle || isFinalizingLifecycle);

  const directTelemetryState = useDirectTbTelemetry({
    enabled: isDirectTelemetryLifecycle && directTelemetryEnabled,
    token: directControlToken,
    gameId: directSessionGameId,
    devices: directTelemetryDeviceDescriptors,
  });

  const standardTelemetryState = useGameTelemetry({
    token: tbSession?.token ?? null,
    gameId: currentGameId,
    deviceIds: directTelemetryDeviceDescriptors,
    enabled: (isLaunchingLifecycle || isRunningLifecycle) && Boolean(currentGameId),
    onAuthError: () => {
      void refreshThingsboardSession({ force: true });
    },
    onError: (reason) => {
      console.warn('[Games] Telemetry stream degraded', reason);
    },
  });

  const isDirectFlow = isDirectTelemetryLifecycle && directTelemetryEnabled;
  const telemetryState = isDirectFlow ? directTelemetryState : standardTelemetryState;

  useEffect(() => {
    if ((isLaunchingLifecycle || isRunningLifecycle) && (currentGameId || isDirectFlow)) {
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
    isDirectFlow,
  ]);

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

      console.info('[Games] Session summary prepared', {
        gameId: sessionSummary.gameId,
        totalHits: sessionSummary.totalHits,
        durationSeconds: sessionSummary.durationSeconds,
        deviceStats: sessionSummary.deviceStats,
        splits: sessionSummary.splits,
        transitions: sessionSummary.transitions,
        targets: sessionSummary.targets,
        hitHistory: sessionSummary.hitHistory,
        historyEntry: sessionSummary.historyEntry,
      });

      console.info('[Games] Persisting Supabase payload', sessionSummary.historyEntry);
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

      return sessionSummary;
    },
    [toast],
  );

  // Coordinates stop lifecycle: calls direct ThingsBoard RPCs, aggregates telemetry into a summary, persists history, and refreshes UI.
  const handleStopDirectGame = useCallback(async () => {
    if (!directSessionGameId) {
      return;
    }

    const activeDeviceIdsSnapshot = [...activeDeviceIds];
    if (activeDeviceIdsSnapshot.length === 0) {
      setSessionLifecycle('idle');
      setGameStopTime(null);
      resetSessionTimer(null);
      resetSessionActivation();
      setDirectTelemetryEnabled(false);
      setDirectFlowActive(false);
      return;
    }

    console.info('[Games] Stopping direct ThingsBoard session', {
      gameId: directSessionGameId,
      deviceIds: activeDeviceIdsSnapshot,
    });

    const stopTimestamp = Date.now();
    setSessionLifecycle('stopping');
    setGameStopTime(stopTimestamp);
    freezeSessionTimer(stopTimestamp);
    console.info('[Games] Disabling direct telemetry stream (stop initiated)');
    setDirectTelemetryEnabled(false);

    const stopResults = await Promise.allSettled(
      directSessionTargets.map(async ({ deviceId }) => {
        updateDirectStartStates((prev) => ({ ...prev, [deviceId]: 'pending' }));
        let attemptedRefresh = false;

        const sendStopCommand = async () => {
          try {
            await tbSendOneway(deviceId, 'stop', {
              ts: stopTimestamp,
              values: {
                deviceId,
                event: 'stop',
                gameId: directSessionGameId,
              },
            });
          } catch (error) {
            const status = resolveHttpStatus(error);
            if (status === 504) {
              console.info('[Games] ThingsBoard stop RPC timed out (expected for oneway command)', {
                deviceId,
                gameId: directSessionGameId,
              });
            } else if (status === 401 && !attemptedRefresh) {
              attemptedRefresh = true;
              await refreshDirectAuthToken();
              await sendStopCommand();
            } else if (isAxiosNetworkError(error)) {
              console.info('[Games] ThingsBoard stop RPC hit a network issue; command may still apply', {
                deviceId,
              });
            } else {
              throw error;
            }
          }
        };

        try {
          await tbSetShared(deviceId, { status: 'free' });
          await sendStopCommand();
          updateDirectStartStates((prev) => ({ ...prev, [deviceId]: 'success' }));
        } catch (error) {
          console.error('[Games] Failed to stop device via ThingsBoard', error);
          updateDirectStartStates((prev) => ({ ...prev, [deviceId]: 'error' }));
          throw error;
        }
      }),
    );

    const stopFailures = stopResults.filter((result) => result.status === 'rejected');
    if (stopFailures.length > 0) {
      toast.error(`${stopFailures.length} device(s) may not have received the stop command.`);
    } else {
      toast.success('Stop commands sent to all devices.');
    }

    setSessionLifecycle('finalizing');

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

    const targetDevices =
      currentSessionTargets.length > 0
        ? currentSessionTargets
        : activeDeviceIdsSnapshot
            .map((deviceId) => availableDevicesRef.current.find((device) => device.deviceId === deviceId) ?? null)
            .filter((device): device is NormalizedGameDevice => device !== null);

    const hitHistorySnapshot = [...hitHistory];
    const splitRecordsSnapshot = [...splitRecords];
    const transitionRecordsSnapshot = [...transitionRecords];
    const startTimestampSnapshot = gameStartTime ?? stopTimestamp;
    const sessionLabel = `Game ${new Date(startTimestampSnapshot).toLocaleTimeString()}`;

    try {
      await finalizeSession({
        resolvedGameId: directSessionGameId,
        sessionLabel,
        startTimestamp: startTimestampSnapshot,
        stopTimestamp,
        targetDevices,
        hitHistorySnapshot,
        splitRecordsSnapshot,
        transitionRecordsSnapshot,
      });

      console.info('[Games] Direct session persisted successfully', {
        gameId: directSessionGameId,
        stopTimestamp,
      });
      toast.success('Game stopped successfully.');
    } catch (error) {
      console.error('[Games] Failed to persist direct session summary', error);
      toast.error('Failed to finalize session. Please try again.');
      setSessionLifecycle('running');
      setDirectTelemetryEnabled(true);
      return;
    }

    currentGameDevicesRef.current = [];
    setActiveDeviceIds([]);
    setCurrentSessionTargets([]);
    setPendingSessionTargets([]);
    setDirectFlowActive(false);
    setSessionLifecycle('idle');
    setGameStartTime(null);
    setGameStopTime(stopTimestamp);
    resetSessionTimer(null);
    resetSessionActivation();
    setDirectTelemetryEnabled(false);
    updateDirectStartStates({});
    setDirectSessionTargets([]);
    setDirectSessionGameId(null);
    void loadLiveDevices({ silent: true, showToast: true, reason: 'postStop' });
  }, [
    directSessionGameId,
    directSessionTargets,
    activeDeviceIds,
    currentSessionTargets,
    finalizeSession,
    freezeSessionTimer,
    hitHistory,
    splitRecords,
    transitionRecords,
    gameStartTime,
    resetSessionActivation,
    resetSessionTimer,
    setActiveDeviceIds,
    setCurrentSessionTargets,
    updateDirectStartStates,
    setDirectTelemetryEnabled,
    setDirectFlowActive,
    setSessionLifecycle,
    setGameStopTime,
    setPendingSessionTargets,
    setGameStartTime,
    setDirectSessionTargets,
    setDirectSessionGameId,
    setAvailableDevices,
    refreshDirectAuthToken,
    loadLiveDevices,
    toast,
  ]);

  const handleStopGame = useCallback(async () => {
    if (!isRunningLifecycle || isStopping || isStoppingLifecycle || isFinalizingLifecycle) {
      return;
    }

    console.info('[Games] Forwarding stop request to direct ThingsBoard handler');
    await handleStopDirectGame();
  }, [isRunningLifecycle, isStopping, isStoppingLifecycle, isFinalizingLifecycle, handleStopDirectGame]);
  // Dismisses the start dialog, cancelling setup when we're still in the pre-launch phase.
  const handleCloseStartDialog = useCallback(() => {
    if (sessionLifecycle === 'selecting' && !isStarting && !isLaunchingLifecycle) {
      setSessionLifecycle('idle');
      setPendingSessionTargets([]);
      resetSessionTimer(null);
      setIsSessionDialogDismissed(false);
      return;
    }

    if (sessionLifecycle !== 'idle') {
      setIsSessionDialogDismissed(true);
    }
  }, [
    isLaunchingLifecycle,
    isStarting,
    resetSessionTimer,
    sessionLifecycle,
    setIsSessionDialogDismissed,
    setPendingSessionTargets,
  ]);


  const executeDirectStart = useCallback(
    async ({ deviceIds, timestamp, isRetry = false }: { deviceIds: string[]; timestamp: number; isRetry?: boolean }) => {
      const uniqueIds = Array.from(new Set(deviceIds));
      if (uniqueIds.length === 0) {
        toast.error('No devices selected to start.');
        return { successIds: [], errorIds: [] };
      }

      if (!directSessionGameId) {
        toast.error('Missing ThingsBoard game identifier. Close and reopen the dialog to retry.');
        return { successIds: [], errorIds: uniqueIds };
      }

      const targetsToCommand = directSessionTargets.filter((target) => uniqueIds.includes(target.deviceId));
      if (targetsToCommand.length === 0) {
        toast.error('Unable to resolve ThingsBoard devices for the start command.');
        return { successIds: [], errorIds: uniqueIds };
      }

      updateDirectStartStates((prev) => {
        const next = { ...prev };
        uniqueIds.forEach((deviceId) => {
          next[deviceId] = 'pending';
        });
        return next;
      });

      await Promise.allSettled(
        targetsToCommand.map(async ({ deviceId }) => {
          let attemptedRefresh = false;
          const run = async () => {
            await tbSetShared(deviceId, {
              gameId: directSessionGameId,
              status: 'busy',
            });

            try {
              await tbSendOneway(deviceId, 'start', {
                ts: timestamp,
                values: {
                  deviceId,
                  event: 'start',
                  gameId: directSessionGameId,
                },
              });
            } catch (error) {
              const status = resolveHttpStatus(error);
              if (status === 504) {
                console.info('[Games] ThingsBoard start RPC timed out (expected for oneway)', { deviceId, gameId: directSessionGameId });
              } else if (status === 401 && !attemptedRefresh) {
                attemptedRefresh = true;
                await refreshDirectAuthToken();
                await run();
                return;
              } else if (isAxiosNetworkError(error)) {
                console.info('[Games] ThingsBoard start RPC hit a network issue; command may still apply', { deviceId });
              } else {
                throw error;
              }
            }
          };

          try {
            await run();
            updateDirectStartStates((prev) => ({ ...prev, [deviceId]: 'success' }));
          } catch (error) {
            updateDirectStartStates((prev) => ({ ...prev, [deviceId]: 'error' }));
            console.error('[Games] ThingsBoard start command failed', { deviceId, error });
            throw error;
          }
        }),
      );

      const finalStates = directStartStatesRef.current;
      const successIds = uniqueIds.filter((deviceId) => finalStates[deviceId] === 'success');
      const errorIds = uniqueIds.filter((deviceId) => finalStates[deviceId] === 'error');

      if (successIds.length === 0) {
        setDirectFlowActive(false);
        setDirectTelemetryEnabled(false);
        setSessionLifecycle('selecting');
        setGameStartTime(null);
        setGameStopTime(null);
        resetSessionTimer(null);
        setHitCounts({});
        setHitHistory([]);
        setDirectControlError('Start commands failed. Adjust the devices or refresh your session and try again.');
        if (!isRetry) {
          toast.error('Failed to start session. Update device status and retry.');
        }
        return { successIds: [], errorIds };
      }

      setDirectFlowActive(true);
      setDirectTelemetryEnabled(true);
      setSessionLifecycle('running');
      setGameStartTime((prev) => prev ?? timestamp);
      markTelemetryConfirmed(timestamp);
      setDirectControlError(errorIds.length > 0 ? 'Some devices failed to start. Retry failed devices.' : null);

      if (errorIds.length > 0) {
        toast.warning(`${errorIds.length} device${errorIds.length === 1 ? '' : 's'} failed to start. Use retry to try again.`);
      } else if (!isRetry) {
        toast.success(`Start commands dispatched to ${successIds.length} device${successIds.length === 1 ? '' : 's'}.`);
      }

      return { successIds, errorIds };
    },
    [
      directSessionTargets,
      directSessionGameId,
      updateDirectStartStates,
      refreshDirectAuthToken,
      toast,
      setDirectFlowActive,
      setDirectTelemetryEnabled,
      setSessionLifecycle,
      setGameStartTime,
      setGameStopTime,
      resetSessionTimer,
      setHitCounts,
      setHitHistory,
      setDirectControlError,
      markTelemetryConfirmed,
    ],
  );

  // Fires the direct start flow after dismissing the dialog confirmation.
  const handleConfirmStartDialog = useCallback(() => {
    if (directSessionTargets.length === 0 || !directSessionGameId) {
      toast.error('No devices are ready for direct control. Close and reopen the dialog.');
      return;
    }

    const timestamp = Date.now();
    const targetedDeviceIds =
      pendingSessionTargets.length > 0
        ? pendingSessionTargets.map((device) => device.deviceId)
        : directSessionTargets.map((target) => target.deviceId);

    const normalizedTargets =
      pendingSessionTargets.length > 0
        ? pendingSessionTargets
        : targetedDeviceIds
            .map((deviceId) => availableDevicesRef.current.find((device) => device.deviceId === deviceId) ?? null)
            .filter((device): device is NormalizedGameDevice => device !== null);

    if (normalizedTargets.length === 0) {
      toast.error('Unable to resolve target metadata for the selected devices.');
      return;
    }

    setPendingSessionTargets(normalizedTargets);
    setCurrentSessionTargets(normalizedTargets);
    currentGameDevicesRef.current = targetedDeviceIds;
    selectionManuallyModifiedRef.current = true;
    setSelectedDeviceIds(targetedDeviceIds);
    setActiveDeviceIds(targetedDeviceIds);
    setRecentSessionSummary(null);
    setGameStartTime(null);
    setGameStopTime(null);
    setHitCounts(Object.fromEntries(targetedDeviceIds.map((id) => [id, 0])));
    setHitHistory([]);
    setErrorMessage(null);
    setDirectControlError(null);

    markSessionTriggered(timestamp);
    setSessionLifecycle('launching');
    setDirectFlowActive(true);
    setDirectTelemetryEnabled(false);
    startSessionTimer(timestamp);

    updateDirectStartStates(() => {
      const next: Record<string, 'idle' | 'pending' | 'success' | 'error'> = {};
      targetedDeviceIds.forEach((deviceId) => {
        next[deviceId] = 'pending';
      });
      return next;
    });

    console.info('[Games] Begin session pressed (direct ThingsBoard path)', {
      deviceIds: targetedDeviceIds,
      gameId: directSessionGameId,
    });

    void executeDirectStart({ deviceIds: targetedDeviceIds, timestamp });
  }, [
    availableDevicesRef,
    directSessionGameId,
    directSessionTargets,
    executeDirectStart,
    markSessionTriggered,
    pendingSessionTargets,
    setActiveDeviceIds,
    setCurrentSessionTargets,
    setDirectFlowActive,
    setDirectTelemetryEnabled,
    setDirectControlError,
    setErrorMessage,
    setGameStartTime,
    setGameStopTime,
    setHitCounts,
    setHitHistory,
    setPendingSessionTargets,
    setRecentSessionSummary,
    setSelectedDeviceIds,
    setSessionLifecycle,
    startSessionTimer,
    toast,
    updateDirectStartStates,
  ]);

  const handleRetryFailedDevices = useCallback(async () => {
    const failedIds = Object.entries(directStartStatesRef.current)
      .filter(([, state]) => state === 'error')
      .map(([deviceId]) => deviceId);

    if (failedIds.length === 0) {
      toast.info('No failed devices to retry.');
      return;
    }

    if (!directSessionGameId) {
      toast.error('Session is missing a ThingsBoard identifier. Close and reopen the dialog to retry.');
      return;
    }

    setIsRetryingFailedDevices(true);
    try {
      setDirectControlError(null);
      await executeDirectStart({ deviceIds: failedIds, timestamp: Date.now(), isRetry: true });
    } catch (error) {
      console.error('[Games] Retry failed devices encountered an error', error);
      toast.error('Retry failed devices encountered an error. Check connectivity and try again.');
    } finally {
      setIsRetryingFailedDevices(false);
    }
  }, [directSessionGameId, executeDirectStart, toast, setDirectControlError]);
  // Allows the dialog to immediately terminate the active session if needed.
  const handleStopFromDialog = useCallback(() => {
    void handleStopGame();
  }, [handleStopGame]);

  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return 'No activity';
    const diffMs = Date.now() - timestamp;
    if (diffMs < 5_000) return 'Just now';
    if (diffMs < 60_000) return `${Math.round(diffMs / 1000)}s ago`;
    if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`;
    return new Date(timestamp).toLocaleTimeString();
  };

  const operatorOverviewMetrics = useMemo(() => {
    const validTargets = targetsSnapshot.filter(
      (target) => !target?.isNoDataMessage && !target?.isErrorMessage,
    );
    const totalTargets = validTargets.length;

    let onlineTargets = 0;
    let totalShots = 0;
    let bestScoreValue = 0;
    let hasShotData = false;

    validTargets.forEach((target) => {
      if (!target || target.isNoDataMessage || target.isErrorMessage) {
        return;
      }

      const status = typeof target.status === 'string' ? target.status.toLowerCase() : '';
      if (['online', 'standby', 'active'].includes(status)) {
        onlineTargets += 1;
      }

      const targetTotalShots = getTargetTotalShots(target);
      if (typeof targetTotalShots === 'number') {
        totalShots += targetTotalShots;
        hasShotData = true;
      }

      const targetBestScore = getTargetBestScore(target);
      if (typeof targetBestScore === 'number') {
        bestScoreValue = Math.max(bestScoreValue, targetBestScore);
      }
    });

    return {
      totalTargets,
      onlineTargets,
      offlineTargets: Math.max(totalTargets - onlineTargets, 0),
      totalShots: hasShotData ? totalShots : 0,
      bestScore: bestScoreValue,
    };
  }, [targetsSnapshot]);

  const hasResolvedTargets = useMemo(
    () => operatorOverviewMetrics.totalTargets > 0,
    [operatorOverviewMetrics.totalTargets],
  );

  const { totalTargets: totalDevices, onlineTargets: onlineDevices, totalShots: resolvedTotalHits, bestScore } =
    operatorOverviewMetrics;

  const operatorBestScore = useMemo(() => {
    const latestSummaryScore =
      typeof recentSessionSummary?.efficiencyScore === 'number' && Number.isFinite(recentSessionSummary.efficiencyScore)
        ? recentSessionSummary.efficiencyScore
        : 0;
    const snapshotScore = typeof bestScore === 'number' && Number.isFinite(bestScore) ? bestScore : 0;
    return Math.max(latestSummaryScore, snapshotScore);
  }, [bestScore, recentSessionSummary?.efficiencyScore]);
  const activeSessionDevices = activeDeviceIds.length;
  const activeSessionHits = activeDeviceIds.reduce(
    (sum, id) => sum + (hitCounts[id] ?? 0),
    0
  );
  const trackedDevices = useMemo(() => {
    const map = new Map<string, string>();
    const summaryTargets = recentSessionSummary?.targets ?? [];

    const seedIds = (() => {
      if (isRunningLifecycle) {
        if (activeDeviceIds.length > 0) {
          return activeDeviceIds;
        }
        if (selectedDeviceIds.length > 0) {
          return selectedDeviceIds;
        }
        return availableDevices.map((device) => device.deviceId);
      }
      if (summaryTargets.length > 0) {
        return summaryTargets.map((target) => target.deviceId);
      }
      return availableDevices.map((device) => device.deviceId);
    })();

    seedIds.forEach((deviceId) => {
      if (!map.has(deviceId)) {
        const summaryName = summaryTargets.find((target) => target.deviceId === deviceId)?.deviceName;
        map.set(deviceId, summaryName ?? deviceNameById.get(deviceId) ?? deviceId);
      }
    });

    const sourceHitHistory = isRunningLifecycle ? hitHistory : recentSessionSummary?.hitHistory ?? [];
    sourceHitHistory.forEach((record) => {
      if (!map.has(record.deviceId)) {
        map.set(record.deviceId, record.deviceName ?? deviceNameById.get(record.deviceId) ?? record.deviceId);
      }
    });

    return Array.from(map.entries()).map(([deviceId, deviceName]) => ({
      deviceId,
      deviceName,
    }));
  }, [
    activeDeviceIds,
    availableDevices,
    deviceNameById,
    hitHistory,
    isRunningLifecycle,
    recentSessionSummary,
    selectedDeviceIds,
  ]);

  const resolvedHitCounts = useMemo(
    () => (isRunningLifecycle ? hitCounts : historicalHitCounts),
    [historicalHitCounts, hitCounts, isRunningLifecycle],
  );

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
        const liveHits = resolvedHitCounts[deviceId];
        const baseline = fallbackHits.get(deviceId) ?? 0;
        return {
          deviceId,
          deviceName,
          hits: typeof liveHits === 'number' ? liveHits : baseline,
        };
      })
      .sort((a, b) => b.hits - a.hits);
  }, [availableDevices, resolvedHitCounts, trackedDevices]);

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
    const sourceHitHistory = isRunningLifecycle
      ? hitHistory
      : recentSessionSummary?.hitHistory ?? [];

    const sourceStartTime = isRunningLifecycle
      ? gameStartTime
      : recentSessionSummary?.startedAt ?? gameStartTime;

    const sourceStopTime = isRunningLifecycle
      ? gameStopTime ?? Date.now()
      : recentSessionSummary?.stoppedAt ?? recentSessionSummary?.startedAt ?? Date.now();

    if (!sourceStartTime || trackedDevices.length === 0 || sourceHitHistory.length === 0) {
      return [];
    }

    const timelineEnd = isRunningLifecycle ? Date.now() : sourceStopTime;
    const windowStart = Math.max(
      sourceStartTime,
      timelineEnd - MAX_TIMELINE_POINTS * TIMELINE_BUCKET_MS,
    );

    const buckets = Array.from({ length: MAX_TIMELINE_POINTS }, (_, index) => {
      const bucketStart = windowStart + index * TIMELINE_BUCKET_MS;
      const secondsSinceStart = Math.max(0, Math.floor((bucketStart - sourceStartTime) / 1000));
      const entry: Record<string, number | string> = {
        time: `${secondsSinceStart}s`,
      };
      trackedDevices.forEach(({ deviceName }) => {
        entry[deviceName] = 0;
      });
      return entry;
    });

    sourceHitHistory.forEach((record) => {
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
  }, [
    deviceNameById,
    gameStartTime,
    gameStopTime,
    hitHistory,
    isRunningLifecycle,
    recentSessionSummary,
    trackedDevices,
  ]);

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
        id: `${hit.deviceId}-${hit.timestamp}-${index}`,
        deviceName: hit.deviceName,
        timestamp: hit.timestamp,
        sequence: index + 1,
        sinceStartSeconds,
        splitSeconds,
      };
    });
  }, [hitHistory, gameStartTime]);

  const isLiveDataLoading = loadingDevices || isHistoryLoading;

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
  const operatorOverviewLoading =
    targetsStoreLoading ||
    targetDetailsLoading ||
    targetsLastFetched === null ||
    !hasResolvedTargets;
  const isPageLoading = operatorOverviewLoading || isLiveDataLoading;
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
                    {isPageLoading ? (
                      <OperatorOverviewSkeleton />
                    ) : (
                      <OperatorOverviewCard
                        operatorName={operatorName}
                        operatorInitials={operatorInitials}
                        onlineTargets={onlineDevices}
                        totalTargets={totalDevices}
                        totalHits={resolvedTotalHits}
                        bestScore={operatorBestScore}
                      />
                    )}

                    {/* Live session card visualises the active session timer, hit totals, and post-session summary fed by telemetry. */}
                    {isPageLoading ? (
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
                  </div>

                  <div className="space-y-4">
                    {/* Hit distribution card renders live pie chart + breakdown sourced from current session hit tallies. */}
                    {isPageLoading ? (
                      <HitDistributionSkeleton />
                    ) : (
                      <HitDistributionCard
                        totalHits={totalHitsLive}
                        deviceHitSummary={deviceHitSummary}
                        pieChartData={pieChartData}
                      />
                    )}

                    {isPageLoading ? (
                      <HitTimelineSkeleton />
                    ) : (
                      <HitTimelineCard trackedDevices={trackedDevices} data={hitTimelineData} />
                    )}

                  </div>

                  <div className="space-y-4">
                    {/* Room selection card allows quick selection by pre-defined room groupings. */}
                    {isPageLoading ? (
                      <TargetSelectionSkeleton />
                    ) : (
                      <RoomSelectionCard
                        roomsLoading={roomsLoading}
                        rooms={roomSelections}
                        selectedDeviceIds={selectedDeviceIds}
                        isSessionLocked={isSessionLocked}
                        onSelectAllRooms={handleSelectAllRooms}
                        onClearRooms={handleClearRoomSelection}
                        onToggleRoomTargets={handleToggleRoomTargets}
                      />
                    )}

                    {/* Target selection card (with Start Game action) lists ThingsBoard devices with connection, hit counts, and lets operators assemble session rosters. */}
                    {isPageLoading ? (
                      <TargetSelectionSkeleton />
                    ) : (
                      <TargetSelectionCard
                        loadingDevices={loadingDevices}
                        isSessionLocked={isSessionLocked}
                        devices={availableDevices}
                        targetDetails={targetById}
                        selectedDeviceIds={selectedDeviceIds}
                        hitCounts={hitCounts}
                        deriveConnectionStatus={deriveConnectionStatus}
                        deriveIsOnline={deriveIsOnline}
                        formatLastSeen={formatLastSeen}
                        onToggleDevice={handleToggleDeviceSelection}
                        onSelectAll={handleSelectAllDevices}
                        onClearSelection={handleClearDeviceSelection}
                        selectedCount={displayedSelectedCount}
                        totalOnlineSelectableTargets={totalOnlineSelectableTargets}
                      />
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
          directControlEnabled={DIRECT_TB_CONTROL_ENABLED}
          directToken={directControlToken}
          directAuthError={directControlError}
          isDirectAuthLoading={isDirectAuthLoading}
          directTargets={directSessionTargets}
          directGameId={directSessionGameId}
          directStartStates={directStartStates}
          directFlowActive={directFlowActive}
          onRetryFailed={handleRetryFailedDevices}
          isRetryingFailedDevices={isRetryingFailedDevices}
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
    efficiencyScore,
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
  const totalHits = sortedHits.length;

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
        ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
        : 0,
      firstHitTime: sortedHitTimes[0] ?? 0,
      lastHitTime: sortedHitTimes[sortedHitTimes.length - 1] ?? 0,
    };
  });

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
    score: efficiencyScore,
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
    efficiencyScore,
  };
}


export default Games;
