import type { GameHistory, SessionHitRecord, SessionSplit, SessionTransition } from '@/services/device-game-flow';

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
  efficiencyScore: number;
};
