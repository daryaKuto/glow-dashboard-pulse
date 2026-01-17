import { supabase } from '@/integrations/supabase/client';
import type {
  GameHistory,
  SessionHitRecord,
  SessionSplit,
  SessionTransition,
} from '@/services/device-game-flow';

export interface GameHistorySummaryPayload {
  gameId: string;
  gameName: string;
  durationMinutes: number;
  startTime: number;
  endTime: number;
  totalHits: number;
  actualDuration: number;
  averageHitInterval?: number | null;
  score?: number | null;
  accuracy?: number | null;
  scenarioName?: string | null;
  scenarioType?: string | null;
  roomName?: string | null;
  roomId?: string | null;
  desiredDurationSeconds?: number | null;
  presetId?: string | null;
  targetDeviceIds?: string[];
  targetDeviceNames?: string[];
  deviceResults: GameHistory['deviceResults'];
  targetStats: GameHistory['targetStats'];
  crossTargetStats: GameHistory['crossTargetStats'];
  splits?: SessionSplit[];
  transitions?: SessionTransition[];
  hitHistory?: SessionHitRecord[];
  goalShotsPerTarget?: Record<string, number>;
}

interface GameHistoryResponse {
  action: 'history';
  mode: 'save' | 'list';
  record?: {
    id: string;
    summary: GameHistorySummaryPayload;
    createdAt: string;
  };
  history?: Array<{
    id: string;
    summary: GameHistorySummaryPayload;
    createdAt: string;
  }>;
  nextCursor?: string | null;
  status?: 'created' | 'updated';
  sessionPersisted?: boolean;
  sessionPersistError?: string | null;
}

export interface SaveGameHistoryResult {
  status: 'created' | 'updated' | null;
  sessionPersisted: boolean;
  sessionPersistError: string | null;
}

const HISTORY_LIMIT = 20;

// Converts the stored summary payload back into the richer GameHistory shape the UI expects.
export function mapSummaryToGameHistory(summary: GameHistorySummaryPayload): GameHistory {
  return {
    gameId: summary.gameId,
    gameName: summary.gameName,
    duration: summary.durationMinutes,
    startTime: summary.startTime,
    endTime: summary.endTime,
    score: summary.score ?? null,
    accuracy: summary.accuracy ?? null,
    scenarioName: summary.scenarioName ?? null,
    scenarioType: summary.scenarioType ?? null,
    roomName: summary.roomName ?? null,
    roomId: summary.roomId ?? null,
    desiredDurationSeconds: summary.desiredDurationSeconds ?? null,
    presetId: summary.presetId ?? null,
    targetDeviceIds: summary.targetDeviceIds ?? [],
    targetDeviceNames: summary.targetDeviceNames ?? [],
    deviceResults: summary.deviceResults ?? [],
    totalHits: summary.totalHits ?? 0,
    actualDuration: summary.actualDuration ?? 0,
    averageHitInterval: typeof summary.averageHitInterval === 'number' ? summary.averageHitInterval : null,
    targetStats: summary.targetStats ?? [],
    crossTargetStats: summary.crossTargetStats ?? null,
    splits: summary.splits ?? [],
    transitions: summary.transitions ?? [],
    hitHistory: summary.hitHistory ?? [],
    goalShotsPerTarget: summary.goalShotsPerTarget,
  };
}

// Persists a completed game summary through the game-control edge function so history remains centralised.
export async function saveGameHistory(summary: GameHistory): Promise<SaveGameHistoryResult> {
  const payload: GameHistorySummaryPayload = {
    gameId: summary.gameId,
    gameName: summary.gameName,
    durationMinutes: summary.duration,
    startTime: summary.startTime,
    endTime: summary.endTime,
    totalHits: summary.totalHits,
    actualDuration: summary.actualDuration,
    averageHitInterval: summary.averageHitInterval,
    score: summary.score ?? null,
    accuracy: summary.accuracy ?? null,
    scenarioName: summary.scenarioName ?? null,
    scenarioType: summary.scenarioType ?? null,
    roomName: summary.roomName ?? null,
    roomId: summary.roomId ?? null,
    desiredDurationSeconds: summary.desiredDurationSeconds ?? null,
    presetId: summary.presetId ?? null,
    targetDeviceIds: summary.targetDeviceIds ?? [],
    targetDeviceNames: summary.targetDeviceNames ?? [],
    deviceResults: summary.deviceResults,
    targetStats: summary.targetStats,
    crossTargetStats: summary.crossTargetStats,
    splits: summary.splits ?? [],
    transitions: summary.transitions ?? [],
    hitHistory: summary.hitHistory ?? [],
    goalShotsPerTarget: summary.goalShotsPerTarget,
  };

  const { data, error } = await supabase.functions.invoke<GameHistoryResponse>('game-control', {
    method: 'POST',
    body: {
      action: 'history',
      mode: 'save',
      summary: payload,
    },
  });

  if (error) {
    throw error;
  }

  const status = data?.status ?? null;
  const sessionPersisted = typeof data?.sessionPersisted === 'boolean' ? data.sessionPersisted : false;
  const sessionPersistError =
    typeof data?.sessionPersistError === 'string' && data.sessionPersistError.length > 0
      ? data.sessionPersistError
      : null;

  if (!sessionPersisted && sessionPersistError) {
    console.warn('[game-history] Session analytics failed to persist', {
      gameId: summary.gameId,
      sessionPersistError,
    });
  }

  return {
    status,
    sessionPersisted,
    sessionPersistError,
  };
}

export interface FetchGameHistoryOptions {
  limit?: number;
  cursor?: string | null;
  startBefore?: number;
  startAfter?: number;
  deviceId?: string;
}

export interface FetchAllGameHistoryOptions extends Omit<FetchGameHistoryOptions, 'limit'> {
  pageSize?: number;
  maxPages?: number;
}

// Retrieves the most recent game history records for the authenticated user.
export async function fetchGameHistory(
  options: FetchGameHistoryOptions = {},
): Promise<{ history: GameHistory[]; nextCursor: string | null }> {
  const limit = typeof options.limit === 'number' ? options.limit : HISTORY_LIMIT;
  const { data, error } = await supabase.functions.invoke<GameHistoryResponse>('game-control', {
    method: 'POST',
    body: {
      action: 'history',
      mode: 'list',
      limit,
      cursor: options.cursor ?? undefined,
      startBefore: options.startBefore,
      startAfter: options.startAfter,
      deviceId: options.deviceId,
    },
  });

  if (error) {
    throw error;
  }

  const history = data?.history ?? [];
  return {
    history: history.map((entry) => mapSummaryToGameHistory(entry.summary)),
    nextCursor: data?.nextCursor ?? null,
  };
}

// Walks all available history pages (within the configured guardrails) and flattens them into a single array.
export async function fetchAllGameHistory(
  options: FetchAllGameHistoryOptions = {},
): Promise<{ history: GameHistory[]; nextCursor: string | null }> {
  const {
    pageSize,
    maxPages,
    cursor: initialCursor,
    ...baseFilters
  } = options;

  const perPage = typeof pageSize === 'number' && Number.isFinite(pageSize)
    ? Math.max(1, Math.min(100, Math.floor(pageSize)))
    : HISTORY_LIMIT;

  const maximumPages = typeof maxPages === 'number' && Number.isFinite(maxPages)
    ? Math.max(1, Math.floor(maxPages))
    : 50;

  const aggregated: GameHistory[] = [];
  let cursor: string | null = initialCursor ?? null;
  let nextCursor: string | null = null;

  for (let page = 0; page < maximumPages; page += 1) {
    const { history, nextCursor: pageCursor } = await fetchGameHistory({
      ...baseFilters,
      cursor: cursor ?? undefined,
      limit: perPage,
    });

    aggregated.push(...history);

    const noMoreRecords = !pageCursor || history.length < perPage;
    const repeatedCursor = cursor !== null && pageCursor === cursor;

    if (noMoreRecords || repeatedCursor) {
      nextCursor = pageCursor ?? null;
      break;
    }

    cursor = pageCursor;
    nextCursor = pageCursor ?? null;
  }

  return { history: aggregated, nextCursor };
}
