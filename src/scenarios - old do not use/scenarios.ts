export interface ScenarioTemplate {
  id:             string;          // slug
  name:           string;
  description:    string;
  targetCount:    number;          // how many targets required
  shotsPerTarget: number;
  timeLimitMs:    number;          // time from first beep to "run over"
}

export const SCENARIOS: ScenarioTemplate[] = [
  {
    id:             'double-tap',
    name:           'Double Tap',
    description:    '2 targets, 2 shots each, 10-second limit.',
    targetCount:    2,
    shotsPerTarget: 2,
    timeLimitMs:    10_000,
  },
]; 