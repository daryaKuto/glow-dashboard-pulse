/**
 * Scenario Types
 *
 * Types for scenario execution and telemetry collection.
 * Used by scenario services and stores.
 *
 * @migrated from src/types/scenario-data.ts
 */

export type ScenarioSession = {
  sessionId: string;
  scenarioId: string;
  roomId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  targetDeviceIds: string[];
  expectedShots: number;
  timeLimitMs: number;
  status: 'active' | 'completed' | 'failed' | 'timeout';
  completedAt?: number;
};

export type ScenarioBeepEvent = {
  sessionId: string;
  targetDeviceId: string;
  beepSequence: number;
  beepTimestamp: number;
  expectedResponseWindow: number;
  beepType: 'start' | 'ready' | 'go';
  targetNumber: number;
};

export type ScenarioHitEvent = {
  sessionId: string;
  targetDeviceId: string;
  hitSequence: number;
  hitTimestamp: number;
  reactionTime: number;
  relativeTime: number;
  expectedTarget: boolean;
  shotNumber: number;
  beepTimestamp: number;
  accuracy: 'hit' | 'miss';
  zone?: string;
};

export type TargetResult = {
  targetDeviceId: string;
  targetNumber: number;
  hitsReceived: number;
  expectedHits: number;
  accuracy: number;
  reactionTimes: number[];
  averageReactionTime: number;
  hitSequence: number[];
  correctSequence: boolean;
};

export type ScenarioResults = {
  sessionId: string;
  scenarioId: string;
  totalHits: number;
  expectedHits: number;
  accuracy: number;
  averageReactionTime: number;
  fastestReactionTime: number;
  slowestReactionTime: number;
  totalDuration: number;
  targetResults: TargetResult[];
  passed: boolean;
  score: number;
  completedAt: number;
};

/**
 * API Payload Types
 */

export type StartScenarioPayload = {
  sessionId: string;
  scenarioConfig: {
    id: string;
    targetCount: number;
    shotsPerTarget: number;
    timeLimitMs: number;
  };
  targetDeviceIds: string[];
  roomId: string;
  userId: string;
  startTime: number;
};

export type BeepCommandPayload = {
  sessionId: string;
  targetDeviceId: string;
  beepType: 'start' | 'ready' | 'go';
  beepSequence: number;
  timestamp: number;
  expectedResponseWindow: number;
};

export type HitTelemetryPayload = {
  sessionId: string;
  targetDeviceId: string;
  hitTimestamp: number;
  hitSequence: number;
  shotNumber: number;
  beepReference: number;
  sensorData?: {
    zone?: string;
    impact?: number;
    confidence?: number;
  };
};

export type EndScenarioPayload = {
  sessionId: string;
  endTime: number;
  reason: 'completed' | 'timeout' | 'user_stopped' | 'error';
  finalResults?: ScenarioResults;
};

/**
 * Double Tap Scenario Types
 */

export type DoubleTapSequence = {
  sequence: Array<{
    targetNumber: 1 | 2;
    shotNumber: 1 | 2;
    expectedTiming: number;
  }>;
  beepInterval: number;
  responseWindow: number;
  sequenceType: 'alternating' | 'sequential';
};

/**
 * Telemetry Keys
 */

export const SCENARIO_TELEMETRY_KEYS = {
  SESSION_ID: 'scenario_session_id',
  SESSION_STATUS: 'scenario_status',
  SESSION_START: 'scenario_start_time',
  SESSION_END: 'scenario_end_time',
  BEEP_SENT: 'beep_sent_timestamp',
  BEEP_TYPE: 'beep_type',
  BEEP_SEQUENCE: 'beep_sequence',
  HIT_REGISTERED: 'hit_timestamp',
  HIT_SEQUENCE: 'hit_sequence',
  REACTION_TIME: 'reaction_time_ms',
  SHOT_NUMBER: 'shot_number',
  SCENARIO_SCORE: 'scenario_score',
  SCENARIO_ACCURACY: 'scenario_accuracy',
  TOTAL_HITS: 'total_hits',
  AVERAGE_REACTION: 'avg_reaction_time',
  HITS: 'hits',
  HIT_TS: 'hit_ts',
  BEEP_TS: 'beep_ts',
  EVENT: 'event',
  GAME_NAME: 'game_name',
  GAME_ID: 'gameId',
} as const;

/**
 * Default Double Tap Configuration
 */

export const DOUBLE_TAP_CONFIG: DoubleTapSequence = {
  sequence: [
    { targetNumber: 1, shotNumber: 1, expectedTiming: 1000 },
    { targetNumber: 2, shotNumber: 1, expectedTiming: 3000 },
    { targetNumber: 1, shotNumber: 2, expectedTiming: 5000 },
    { targetNumber: 2, shotNumber: 2, expectedTiming: 7000 },
  ],
  beepInterval: 2000,
  responseWindow: 1500,
  sequenceType: 'alternating',
};
