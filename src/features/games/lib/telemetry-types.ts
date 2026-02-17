export interface SplitRecord {
  deviceId: string;
  deviceName: string;
  time: number;
  timestamp: number;
  splitNumber: number;
}

export interface TransitionRecord {
  fromDevice: string;
  toDevice: string;
  fromDeviceName: string;
  toDeviceName: string;
  time: number;
  timestamp: number;
  transitionNumber: number;
}

export interface RoundSplit {
  roundNumber: number;
  completedAt: number;        // epoch ms — max timestamp of all devices for this round
  roundTime: number;          // seconds — time from previous round completion to this one (0 for first round)
  pairGap: number;            // seconds — abs difference between first and last device hit in this round
  deviceTimestamps: Record<string, number>; // per-device timestamp for this round
}

export interface FinalizeSessionArgs {
  resolvedGameId: string;
  sessionLabel: string;
  startTimestamp: number;
  stopTimestamp: number;
  targetDevices: import('@/features/games/hooks/use-game-devices').NormalizedGameDevice[];
  hitHistorySnapshot: import('@/features/games/lib/device-game-flow').SessionHitRecord[];
  splitRecordsSnapshot: SplitRecord[];
  transitionRecordsSnapshot: TransitionRecord[];
  roundSplitsSnapshot: RoundSplit[];
  roomId: string | null;
  roomName: string | null;
  desiredDurationSeconds: number | null;
  presetId: string | null;
  goalShotsPerTarget?: Record<string, number>;
}
