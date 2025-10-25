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
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
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
import { useTargets, type Target } from '@/store/useTargets';
import { useRooms } from '@/store/useRooms';
import { useGameTelemetry, type SplitRecord, type TransitionRecord } from '@/hooks/useGameTelemetry';
import { useThingsboardToken } from '@/hooks/useThingsboardToken';
import { useDirectTbTelemetry } from '@/hooks/useDirectTbTelemetry';
import {
  ensureTbAuthToken,
  tbSetShared,
  tbSendOneway,
  tbSubscribeTelemetry,
  type TelemetryEnvelope,
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

const resolveSeriesValue = (input: unknown): unknown => {
  if (Array.isArray(input) && input.length > 0) {
    const first = input[0];
    if (Array.isArray(first) && first.length > 1) {
      return first[1];
    }
    if (first && typeof first === 'object' && 'value' in (first as Record<string, unknown>)) {
      return (first as { value: unknown }).value;
    }
    return first;
  }
  if (input && typeof input === 'object' && 'value' in (input as Record<string, unknown>)) {
    return (input as { value: unknown }).value;
  }
  return input;
};

const resolveSeriesTimestamp = (input: unknown): number | null => {
  if (Array.isArray(input) && input.length > 0) {
    const first = input[0];
    if (Array.isArray(first) && typeof first[0] === 'number') {
      return first[0];
    }
    if (first && typeof first === 'object' && 'ts' in (first as Record<string, unknown>)) {
      const ts = (first as { ts?: number }).ts;
      if (typeof ts === 'number') {
        return ts;
      }
    }
  }
  if (input && typeof input === 'object' && 'ts' in (input as Record<string, unknown>)) {
    const ts = (input as { ts?: number }).ts;
    if (typeof ts === 'number') {
      return ts;
    }
  }
  if (typeof input === 'number') {
    return input;
  }
  return null;
};

const resolveSeriesString = (input: unknown): string | null => {
  const value = resolveSeriesValue(input);
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
};

type SessionLifecycle = 'idle' | 'selecting' | 'launching' | 'running' | 'stopping' | 'finalizing';

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
    if (rooms.length === 0 && !roomsLoading) {
      void fetchRooms().catch((err) => {
        console.warn('[Games] Failed to fetch rooms for selection card', err);
      });
    }
  }, [rooms.length, roomsLoading, fetchRooms]);

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
      const secondsSinceStart = Math.max(0, Math.floor((bucketStart - gameStartTime) / 1000));
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
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-brand-dark/60">
                            <div>
                              <p className="uppercase tracking-wide">Targets Online</p>
                              <p className="font-heading text-lg text-brand-dark">
                                {onlineDevices}/{totalDevices}
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

                    {/* Hit timeline card plots hits over time per device to highlight activity spikes and target performance. */}
                    {isPageLoading ? (
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

                  </div>

                  <div className="space-y-4">
                    {/* Room selection card allows quick selection by pre-defined room groupings. */}
                    {isPageLoading ? (
                      <TargetSelectionSkeleton />
                    ) : (
                      <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                        <CardContent className="p-4 md:p-5 space-y-3">
                          <div className="space-y-2">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <h2 className="font-heading text-lg text-brand-dark">Room Selection</h2>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleSelectAllRooms}
                                  disabled={isSessionLocked || roomsLoading}
                                >
                                  Select all rooms
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleClearRoomSelection}
                                  disabled={isSessionLocked}
                                >
                                  Clear rooms
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-brand-dark/60">
                              {roomSelections.length} rooms • {roomSelections.reduce((sum, room) => sum + room.targetCount, 0)} targets
                            </p>
                          </div>

                          {roomsLoading ? (
                            <div className="flex items-center justify-center py-10 text-sm text-brand-dark/60">
                              Loading rooms…
                            </div>
                          ) : roomSelections.length === 0 ? (
                            <p className="text-sm text-brand-dark/60">No rooms with assigned targets available.</p>
                          ) : (
                            <ScrollArea className="h-[220px] pr-2">
                              <div className="space-y-2">
                                {roomSelections.map((room) => {
                                  const isRoomSelected = room.deviceIds.every((id) => selectedDeviceIds.includes(id));
                                  const partialSelection = !isRoomSelected && room.deviceIds.some((id) => selectedDeviceIds.includes(id));
                                  const checkboxState = isRoomSelected ? true : partialSelection ? 'indeterminate' : false;
                                  return (
                                    <div
                                      key={room.id}
                                      className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                                        isRoomSelected
                                          ? 'border-brand-primary/40 bg-brand-primary/5'
                                          : 'border-gray-200 bg-white'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <Checkbox
                                          id={`room-${room.id}`}
                                          checked={checkboxState}
                                          onCheckedChange={(checked) =>
                                            handleToggleRoomTargets(room.id, Boolean(checked))
                                          }
                                          disabled={isSessionLocked}
                                        />
                                        <label htmlFor={`room-${room.id}`} className="cursor-pointer select-none space-y-0.5">
                                          <p className="font-medium text-sm text-brand-dark">{room.name}</p>
                                          <p className="text-xs text-brand-dark/60">
                                            {room.onlineCount}/{room.targetCount} online
                                          </p>
                                        </label>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleToggleRoomTargets(room.id, !isRoomSelected)}
                                        disabled={isSessionLocked}
                                      >
                                        {isRoomSelected ? 'Remove' : 'Select'}
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </ScrollArea>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Target selection card (with Start Game action) lists ThingsBoard devices with connection, hit counts, and lets operators assemble session rosters. */}
                    {isPageLoading ? (
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

                    {/* Target transitions card charts cross-target movement latency using transition telemetry. */}
                    {isPageLoading ? (
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
  directControlEnabled: boolean;
  directToken: string | null;
  directAuthError: string | null;
  isDirectAuthLoading: boolean;
  directTargets: Array<{ deviceId: string; name: string }>;
  directGameId: string | null;
  directStartStates: Record<string, 'idle' | 'pending' | 'success' | 'error'>;
  directFlowActive: boolean;
  onRetryFailed: () => void;
  isRetryingFailedDevices: boolean;
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
  directControlEnabled,
  directToken,
  directAuthError,
  isDirectAuthLoading,
  directTargets,
  directGameId,
  directStartStates,
  directFlowActive,
  onRetryFailed,
  isRetryingFailedDevices,
}) => {
  const [dialogHitHistory, setDialogHitHistory] = useState<SessionHitRecord[]>([]);

  const dialogDeviceIds = useMemo(() => targets.map((target) => target.deviceId), [targets]);
  const dialogDeviceIdSet = useMemo(() => new Set(dialogDeviceIds), [dialogDeviceIds]);
  const targetNameMap = useMemo(() => {
    const map = new Map<string, string>();
    targets.forEach((target) => {
      map.set(target.deviceId, target.name ?? target.deviceId);
    });
    return map;
  }, [targets]);

  const dialogStreamingLifecycle = lifecycle === 'launching' || lifecycle === 'running' || lifecycle === 'stopping' || lifecycle === 'finalizing';
  const shouldStreamDialogTelemetry = Boolean(
    open &&
    dialogStreamingLifecycle &&
    directControlEnabled &&
    directFlowActive &&
    directToken &&
    directGameId &&
    dialogDeviceIds.length > 0,
  );

  // Clears the dialog-scoped telemetry buffers whenever the popup closes or resubscribes.
  const resetDialogTelemetry = useCallback(() => {
    setDialogHitHistory([]);
  }, []);

  useEffect(() => {
    if (!shouldStreamDialogTelemetry || !directToken || !directGameId) {
      resetDialogTelemetry();
      return;
    }

    resetDialogTelemetry();

    const unsubscribe = tbSubscribeTelemetry(
      dialogDeviceIds,
      directToken,
      (payload: TelemetryEnvelope) => {
        const telemetryData = payload.data;
        if (!telemetryData) {
          return;
        }

        const eventValue = resolveSeriesString(telemetryData.event);
        const gameIdValue = resolveSeriesString(telemetryData.gameId);
        const deviceId = payload.entityId;

        if (!deviceId || !dialogDeviceIdSet.has(deviceId)) {
          return;
        }

        if (eventValue !== 'hit' || gameIdValue !== directGameId) {
          return;
        }

        const now = Date.now();
        const timestamp = resolveSeriesTimestamp(telemetryData.event, now) ?? now;
        const deviceName = targetNameMap.get(deviceId) ?? deviceId;

        setDialogHitHistory((prev) => ([
          ...prev,
          {
            deviceId,
            deviceName,
            timestamp,
            gameId: directGameId,
          },
        ]));
      },
      {
        realtime: true,
        onError: (reason) => {
          console.warn('[StartSessionDialog] Telemetry degraded, relying on fallback state', reason);
        },
      },
    );

    return () => {
      unsubscribe();
    };
  }, [
    directGameId,
    directToken,
    dialogDeviceIdSet,
    dialogDeviceIds,
    resetDialogTelemetry,
    shouldStreamDialogTelemetry,
    targetNameMap,
  ]);

  const dialogSessionHits = useMemo<SessionHitEntry[]>(() => {
    if (dialogHitHistory.length === 0) {
      return [];
    }

    const baseTime = dialogHitHistory[0]?.timestamp ?? Date.now();

    return dialogHitHistory.map((hit, index) => {
      const previous = index > 0 ? dialogHitHistory[index - 1] : null;
      const sinceStartSeconds = Math.max(0, (hit.timestamp - baseTime) / 1000);
      const splitSeconds = previous ? Math.max(0, (hit.timestamp - previous.timestamp) / 1000) : null;

      return {
        id: `${hit.deviceId}-${hit.timestamp}-${index}`,
        deviceName: hit.deviceName,
        timestamp: hit.timestamp,
        sequence: index + 1,
        sinceStartSeconds,
        splitSeconds,
      };
    });
  }, [dialogHitHistory]);

  const displayedSessionHits = dialogSessionHits.length > 0 ? dialogSessionHits : sessionHits;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  };

  const isSelectingPhase = lifecycle === 'selecting';
  const isLaunchingPhase = lifecycle === 'launching';
  const isRunningPhase = lifecycle === 'running';
  const isStoppingPhase = lifecycle === 'stopping';
  const isFinalizingPhase = lifecycle === 'finalizing';
  const usesLivePalette = isLaunchingPhase || isRunningPhase || isStoppingPhase || isFinalizingPhase;
  const resolvedGameId = currentGameId ?? directGameId;
  const directControlStatus = (() => {
    if (!directControlEnabled) {
      return null;
    }
    if (isDirectAuthLoading) {
      return { message: 'Authenticating with ThingsBoard…', intent: 'info' as const };
    }
    if (directAuthError) {
      return { message: directAuthError, intent: 'error' as const };
    }
    if (directFlowActive && directToken) {
      return {
        message: 'Live ThingsBoard control is active for this session.',
        intent: 'success' as const,
      };
    }
    if (directToken) {
      return {
        message: 'Connected to ThingsBoard. Commands will execute directly against live targets.',
        intent: 'success' as const,
      };
    }
    return { message: 'Awaiting ThingsBoard authentication…', intent: 'info' as const };
  })();

  const startStateValues = directTargets.map((target) => directStartStates[target.deviceId] ?? 'idle');
  const failedCount = startStateValues.filter((state) => state === 'error').length;
  const pendingCount = startStateValues.filter((state) => state === 'pending').length;
  const successCount = startStateValues.filter((state) => state === 'success').length;
  const hasFailedTargets = failedCount > 0;
  const hasPendingTargets = pendingCount > 0;
  const hasSuccessTargets = successCount > 0;

  const renderDirectTargetStatuses = () => {
    if (!directControlEnabled || directTargets.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2">
        <h4 className="text-xs uppercase tracking-wide text-brand-dark/60">
          ThingsBoard Device IDs
        </h4>
        {(hasSuccessTargets || hasPendingTargets || hasFailedTargets) && (
          <p className="text-xs text-brand-dark/60">
            {hasSuccessTargets && (
              <span>{successCount} device{successCount === 1 ? '' : 's'} acknowledged the start command. </span>
            )}
            {hasPendingTargets && (
              <span>Waiting for {pendingCount} device{pendingCount === 1 ? '' : 's'} to acknowledge.</span>
            )}
            {hasFailedTargets && !hasPendingTargets && (
              <span>Some devices failed to start. Retry the failed devices below.</span>
            )}
          </p>
        )}
        <div className="space-y-1 rounded-lg border border-dashed border-brand-secondary/30 bg-brand-secondary/5 px-3 py-3">
          {directTargets.map((target) => {
            const state = directStartStates[target.deviceId] ?? 'idle';
            const label = (() => {
              if (state === 'pending') {
                return lifecycle === 'running' ? 'Sending start command…' : 'Stopping…';
              }
              if (state === 'success') {
                return lifecycle === 'running' ? 'Ready' : 'Stopped';
              }
              if (state === 'error') {
                return 'Error';
              }
              return 'Pending';
            })();
            const tone =
              state === 'success'
                ? 'text-green-700'
                : state === 'error'
                  ? 'text-red-600'
                  : 'text-brand-dark/70';
            const icon = (() => {
              if (state === 'success') {
                return <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />;
              }
              if (state === 'error') {
                return <XCircle className="h-4 w-4 text-red-500" aria-hidden="true" />;
              }
              return (
                <Loader2 className={`h-4 w-4 ${state === 'pending' ? 'animate-spin text-brand-dark/70' : 'text-brand-dark/40'}`} aria-hidden="true" />
              );
            })();
            return (
              <div key={target.deviceId} className="flex items-center justify-between gap-3 text-xs">
                <span className="font-mono text-[11px] text-brand-dark/80">{target.deviceId}</span>
                <div className="flex items-center gap-2">
                  {icon}
                  <span className={tone}>{label}</span>
                </div>
              </div>
            );
          })}
        </div>
        {hasFailedTargets && (
          <Button
            variant="outline"
            onClick={onRetryFailed}
            disabled={isRetryingFailedDevices}
            className="w-full sm:w-auto"
          >
            {isRetryingFailedDevices ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Retry failed devices
          </Button>
        )}
      </div>
    );
  };

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
  const canCancelSetup = isSelectingPhase && canClose;
  const isDismissDisabled = canCancelSetup && isStarting;
  const closeButtonLabel = canCancelSetup ? 'Cancel' : 'Close';
  const directControlNotice =
    directControlStatus && isSelectingPhase ? (
      <div
        className={
          directControlStatus.intent === 'error'
            ? 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'
            : directControlStatus.intent === 'success'
              ? 'rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700'
              : 'rounded-lg border border-brand-secondary/30 bg-brand-secondary/10 px-3 py-2 text-sm text-brand-dark/70'
        }
      >
        {directControlStatus.message}
      </div>
    ) : null;

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
          hits={displayedSessionHits}
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
        {renderDirectTargetStatuses()}
        {displayedSessionHits.length > 0 && (
          <>
            <h3 className="text-sm uppercase tracking-wide text-white/80">Recent hits</h3>
            <SessionHitFeedList
              hits={displayedSessionHits}
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
        {renderDirectTargetStatuses()}
      </div>
    );
  } else {
    bodyContent = (
      <div className="space-y-3">
        {directControlNotice}
        <h3 className="font-heading text-sm uppercase tracking-wide text-brand-dark/70">
          Targets ({targets.length})
        </h3>
        <SessionTargetList targets={targets} />
        {renderDirectTargetStatuses()}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={[
          'w-full',
          'max-w-xl',
          'ml-5',
          'mr-8',
          'sm:mx-auto',
          'transition-colors',
          'duration-300',
          'shadow-xl',
          'px-4',
          'py-5',
          'sm:px-6',
          'sm:py-6',
          usesLivePalette ? 'bg-brand-secondary text-white border-brand-secondary/50' : 'bg-white text-brand-dark border-gray-200',
        ].join(' ')}
      >
        <DialogHeader className="space-y-1.5 sm:space-y-2">
          <DialogTitle className="text-xl sm:text-2xl font-heading">Current Session</DialogTitle>
          <DialogDescription className={usesLivePalette ? 'text-white/80' : 'text-brand-dark/70'}>
            {dialogDescription}
          </DialogDescription>
          {resolvedGameId && (
            <p className={`text-xs sm:text-[13px] font-mono ${usesLivePalette ? 'text-white/65' : 'text-brand-dark/50'}`}>Game ID: {resolvedGameId}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
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
              disabled={isDismissDisabled}
              className={usesLivePalette ? 'border-white/35 text-white hover:bg-white/10 hidden' : undefined}
            >
              {closeButtonLabel}
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
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
      <Card className="rounded-md md:rounded-lg border border-brand-primary/20 bg-gradient-to-br from-white via-brand-primary/5 to-brand-secondary/10 shadow-lg">
        <CardContent className="p-4 md:p-5 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-brand-primary font-semibold">Last Session</p>
              <h2 className="font-heading text-xl text-brand-dark">Summary</h2>
              <p className="text-xs text-brand-dark/70">
                {new Date(recentSummary.startedAt).toLocaleTimeString()} • {recentSummary.targets.length} targets
              </p>
            </div>
            <Badge className="bg-brand-primary/10 text-brand-primary border-brand-primary/40">
              {formatSessionDuration(recentSummary.durationSeconds)}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-brand-secondary/30 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-brand-dark/60">Total Hits</p>
              <p className="font-heading text-2xl text-brand-primary">{recentSummary.totalHits}</p>
            </div>
            <div className="rounded-xl border border-brand-secondary/30 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-brand-dark/60">Avg Split</p>
              <p className="font-heading text-2xl text-brand-primary">
                {recentSummary.averageHitInterval > 0 ? `${recentSummary.averageHitInterval.toFixed(2)}s` : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-brand-secondary/30 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-brand-dark/60">Switches</p>
              <p className="font-heading text-2xl text-brand-primary">
                {recentSummary.crossTargetStats?.totalSwitches ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-brand-secondary/30 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-brand-dark/60">Game ID</p>
              <p className="font-heading text-base text-brand-dark truncate max-w-[200px]" title={recentSummary.gameId}>
                {recentSummary.gameId}
              </p>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-wide text-brand-dark/60">Top Targets</p>
            {topResults.length === 0 ? (
              <p className="text-sm text-brand-dark/60">No target activity captured for this session.</p>
            ) : (
              <div className="space-y-2">
                {topResults.map((result) => (
                  <div
                    key={result.deviceId}
                    className="flex items-center justify-between rounded-lg border border-brand-secondary/20 bg-white/80 px-3 py-2"
                  >
                    <span className="font-medium text-brand-dark">{result.deviceName}</span>
                    <span className="font-heading text-lg text-brand-primary">{result.hitCount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {recentSplits.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-brand-dark/60">
                  <span>Recent Splits</span>
                  <span className="text-brand-primary text-[10px] font-semibold">Hit number + Time Split</span>
                </div>
                <div className="space-y-1.5">
                  {recentSplits.map((split) => (
                    <div
                      key={`${split.deviceId}-${split.splitNumber}`}
                      className="flex items-center justify-between rounded-lg border border-brand-primary/20 bg-brand-primary/5 px-3 py-2 text-xs text-brand-dark"
                    >
                      <span className="font-medium text-brand-dark">
                        {split.deviceName} #{split.splitNumber}
                      </span>
                      <span className="font-heading text-sm text-brand-primary">{split.time.toFixed(2)}s</span>
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
