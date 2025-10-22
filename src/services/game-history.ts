import { supabase } from '@/integrations/supabase/client';
import type { GameHistory } from '@/services/device-game-flow';

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
  deviceResults: GameHistory['deviceResults'];
  targetStats: GameHistory['targetStats'];
  crossTargetStats: GameHistory['crossTargetStats'];
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
    deviceResults: summary.deviceResults ?? [],
    totalHits: summary.totalHits ?? 0,
    actualDuration: summary.actualDuration ?? 0,
    averageHitInterval: typeof summary.averageHitInterval === 'number' ? summary.averageHitInterval : null,
    targetStats: summary.targetStats ?? [],
    crossTargetStats: summary.crossTargetStats ?? null,
  };
}

// Persists a completed game summary through the game-control edge function so history remains centralised.
export async function saveGameHistory(summary: GameHistory): Promise<'created' | 'updated' | null> {
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
    deviceResults: summary.deviceResults,
    targetStats: summary.targetStats,
    crossTargetStats: summary.crossTargetStats,
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

  return data?.status ?? null;
}

export interface FetchGameHistoryOptions {
  limit?: number;
  cursor?: string | null;
  startBefore?: number;
  startAfter?: number;
  deviceId?: string;
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
