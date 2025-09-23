/**
 * ThingsBoard Scenario Data Templates
 * Defines the data structures for scenario execution and telemetry collection
 */

export interface ScenarioSession {
  // Session identification
  sessionId: string;           // Unique session identifier
  scenarioId: string;          // Reference to scenario template
  roomId: string;              // Room where scenario is executed
  userId: string;              // User executing the scenario
  
  // Timing
  startTime: number;           // Unix timestamp when scenario started
  endTime?: number;            // Unix timestamp when scenario ended
  duration?: number;           // Total duration in milliseconds
  
  // Configuration
  targetDeviceIds: string[];   // Array of target device IDs participating
  expectedShots: number;       // Total expected shots (targetCount * shotsPerTarget)
  timeLimitMs: number;         // Time limit for the scenario
  
  // Status
  status: 'active' | 'completed' | 'failed' | 'timeout';
  completedAt?: number;        // When scenario was completed
}

export interface ScenarioBeepEvent {
  // Event identification
  sessionId: string;           // Reference to scenario session
  targetDeviceId: string;      // Which target received the beep
  beepSequence: number;        // Order of beep (1st, 2nd, etc.)
  
  // Timing
  beepTimestamp: number;       // When beep was sent to target
  expectedResponseWindow: number; // How long target has to respond (ms)
  
  // Configuration
  beepType: 'start' | 'ready' | 'go';  // Type of beep signal
  targetNumber: number;        // Which target in sequence (1, 2, etc.)
}

export interface ScenarioHitEvent {
  // Event identification
  sessionId: string;           // Reference to scenario session
  targetDeviceId: string;      // Which target was hit
  hitSequence: number;         // Order of hit within scenario
  
  // Timing
  hitTimestamp: number;        // When hit was registered by target
  reactionTime: number;        // Time from beep to hit (ms)
  relativeTime: number;        // Time from scenario start (ms)
  
  // Context
  expectedTarget: boolean;     // Was this the correct target to hit?
  shotNumber: number;          // Which shot for this target (1st or 2nd)
  beepTimestamp: number;       // Reference to when beep was sent
  
  // Performance
  accuracy: 'hit' | 'miss';    // Did the shot register properly?
  zone?: string;               // Hit zone if target supports it
}

export interface ScenarioResults {
  // Session reference
  sessionId: string;
  scenarioId: string;
  
  // Performance metrics
  totalHits: number;           // Total successful hits
  expectedHits: number;        // Total expected hits
  accuracy: number;            // Percentage (totalHits / expectedHits)
  
  // Timing analysis
  averageReactionTime: number; // Average time from beep to hit
  fastestReactionTime: number; // Fastest reaction time
  slowestReactionTime: number; // Slowest reaction time
  totalDuration: number;       // Total scenario duration
  
  // Target-specific results
  targetResults: TargetResult[];
  
  // Overall result
  passed: boolean;             // Did user complete successfully?
  score: number;               // Performance score (0-100)
  completedAt: number;         // When results were calculated
}

export interface TargetResult {
  targetDeviceId: string;
  targetNumber: number;        // 1st target, 2nd target, etc.
  
  // Hit analysis
  hitsReceived: number;        // How many hits this target got
  expectedHits: number;        // How many hits it should have got
  accuracy: number;            // Percentage for this target
  
  // Timing analysis
  reactionTimes: number[];     // All reaction times for this target
  averageReactionTime: number; // Average for this target
  
  // Sequence analysis
  hitSequence: number[];       // Order this target was hit
  correctSequence: boolean;    // Was target hit in correct order?
}

/**
 * ThingsBoard API Payload Templates
 */

// Payload to start a scenario session
export interface StartScenarioPayload {
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
}

// Payload to send beep command to target
export interface BeepCommandPayload {
  sessionId: string;
  targetDeviceId: string;
  beepType: 'start' | 'ready' | 'go';
  beepSequence: number;
  timestamp: number;
  expectedResponseWindow: number;
}

// Payload received from target when hit occurs
export interface HitTelemetryPayload {
  sessionId: string;
  targetDeviceId: string;
  hitTimestamp: number;
  hitSequence: number;
  shotNumber: number;
  beepReference: number;       // Reference to which beep this responds to
  sensorData?: {
    zone?: string;
    impact?: number;
    confidence?: number;
  };
}

// Payload to end scenario session
export interface EndScenarioPayload {
  sessionId: string;
  endTime: number;
  reason: 'completed' | 'timeout' | 'user_stopped' | 'error';
  finalResults?: ScenarioResults;
}

/**
 * ThingsBoard Telemetry Keys
 * These are the keys we'll use to store and retrieve scenario data
 */
export const SCENARIO_TELEMETRY_KEYS = {
  // Session management
  SESSION_ID: 'scenario_session_id',
  SESSION_STATUS: 'scenario_status',
  SESSION_START: 'scenario_start_time',
  SESSION_END: 'scenario_end_time',
  
  // Beep events
  BEEP_SENT: 'beep_sent_timestamp',
  BEEP_TYPE: 'beep_type',
  BEEP_SEQUENCE: 'beep_sequence',
  
  // Hit events
  HIT_REGISTERED: 'hit_timestamp',
  HIT_SEQUENCE: 'hit_sequence',
  REACTION_TIME: 'reaction_time_ms',
  SHOT_NUMBER: 'shot_number',
  
  // Results
  SCENARIO_SCORE: 'scenario_score',
  SCENARIO_ACCURACY: 'scenario_accuracy',
  TOTAL_HITS: 'total_hits',
  AVERAGE_REACTION: 'avg_reaction_time',
  
  // Legacy compatibility
  HITS: 'hits',
  HIT_TS: 'hit_ts',
  BEEP_TS: 'beep_ts',
  EVENT: 'event',
  GAME_NAME: 'game_name',
  GAME_ID: 'gameId'
} as const;

/**
 * Double Tap Scenario Specific Logic
 */
export interface DoubleTapSequence {
  // Target sequence (which target to hit when)
  sequence: Array<{
    targetNumber: 1 | 2;       // Which target (1st or 2nd)
    shotNumber: 1 | 2;         // Which shot for that target
    expectedTiming: number;    // When this should happen (ms from start)
  }>;
  
  // Timing windows
  beepInterval: number;        // Time between beeps (ms)
  responseWindow: number;      // Time allowed for each shot (ms)
  
  // Expected sequence: Target1-Shot1, Target2-Shot1, Target1-Shot2, Target2-Shot2
  // Or: Target1-Shot1, Target1-Shot2, Target2-Shot1, Target2-Shot2
  sequenceType: 'alternating' | 'sequential';
}

// Default Double Tap configuration
export const DOUBLE_TAP_CONFIG: DoubleTapSequence = {
  sequence: [
    { targetNumber: 1, shotNumber: 1, expectedTiming: 1000 },  // 1s: Target 1, Shot 1
    { targetNumber: 2, shotNumber: 1, expectedTiming: 3000 },  // 3s: Target 2, Shot 1  
    { targetNumber: 1, shotNumber: 2, expectedTiming: 5000 },  // 5s: Target 1, Shot 2
    { targetNumber: 2, shotNumber: 2, expectedTiming: 7000 },  // 7s: Target 2, Shot 2
  ],
  beepInterval: 2000,          // 2 seconds between commands
  responseWindow: 1500,        // 1.5 seconds to respond to each beep
  sequenceType: 'alternating'
};
