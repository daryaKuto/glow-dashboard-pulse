import type { GameHistory, SessionHitRecord, SessionSplit, SessionTransition } from '@/features/games/lib/device-game-flow';

// Shared representation of the most recent live session summary consumed across dashboard cards.
export type LiveSessionSummary = {
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
  /** @deprecated Use `score` instead */
  efficiencyScore: number;
  /** 
   * Time-based score in seconds. Lower is better.
   * - With goals set: time of the last required hit. Null if run is invalid (DNF).
   * - Without goals: time from first hit to last hit. Null if fewer than 2 hits.
   */
  score: number | null;
  /** Whether the run is valid (all required hits occurred). Always true if no goals were set. */
  isValid: boolean;
  roomId: string | null;
  roomName: string | null;
  desiredDurationSeconds: number | null;
  targetDeviceIds: string[];
  presetId: string | null;
};
