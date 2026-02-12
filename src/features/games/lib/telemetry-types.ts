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

export interface FinalizeSessionArgs {
  resolvedGameId: string;
  sessionLabel: string;
  startTimestamp: number;
  stopTimestamp: number;
  targetDevices: import('@/features/games/hooks/use-game-devices').NormalizedGameDevice[];
  hitHistorySnapshot: import('@/features/games/lib/device-game-flow').SessionHitRecord[];
  splitRecordsSnapshot: SplitRecord[];
  transitionRecordsSnapshot: TransitionRecord[];
  roomId: string | null;
  roomName: string | null;
  desiredDurationSeconds: number | null;
  presetId: string | null;
  goalShotsPerTarget?: Record<string, number>;
}
