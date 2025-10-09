/**
 * Game templates define the preset games users can play.
 * When a game starts:
 * 1. A gameId is generated (format: GM-XXXXXX)
 * 2. ThingsBoard 'configure' command is sent to devices
 * 3. Game starts with 'start' command
 * 4. Devices send 'hit' telemetry events
 * 5. Game ends with 'stop' or 'timeout' events
 * 6. Session data is stored in Supabase
 */

export interface GameTemplate {
  id: string;           // Maps to gameId in ThingsBoard (e.g., "double-tap" → "GM-001")
  name: string;         // Display name (e.g., "Double Tap")
  description: string;
  targetCount: number;  // Number of devices needed
  shotsPerTarget: number;
  timeLimitMs: number;  // Maps to gameDuration in ThingsBoard
}

export const GAMES: GameTemplate[] = [
  {
    id: 'double-tap',
    name: 'Double Tap',
    description: '2 targets, 2 shots each, 10-second limit.',
    targetCount: 2,
    shotsPerTarget: 2,
    timeLimitMs: 10_000,
  },
];

// Legacy export for backward compatibility
export const SCENARIOS = GAMES;
export type ScenarioTemplate = GameTemplate;
