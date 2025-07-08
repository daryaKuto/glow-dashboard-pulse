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
    id:             'quick-draw',
    name:           'Quick Draw',
    description:    '1 target, 1 shot, 3-second limit.',
    targetCount:    1,
    shotsPerTarget: 1,
    timeLimitMs:    3_000,
  },
  {
    id:             'double-tap',
    name:           'Double Tap',
    description:    '1 target, 2 shots, 4-second limit.',
    targetCount:    1,
    shotsPerTarget: 2,
    timeLimitMs:    4_000,
  },
  {
    id:             'triple-threat',
    name:           'Triple Threat',
    description:    '3 targets, 2 shots each, 10-second limit.',
    targetCount:    3,
    shotsPerTarget: 2,
    timeLimitMs:    10_000,
  },
  // 👉 add more templates here; no backend change needed
]; 