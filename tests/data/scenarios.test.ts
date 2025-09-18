import { SCENARIOS, ScenarioTemplate } from '../../src/data/scenarios';

describe('Scenario Templates', () => {
  test('should have valid scenario templates', () => {
    expect(SCENARIOS).toBeDefined();
    expect(Array.isArray(SCENARIOS)).toBe(true);
    expect(SCENARIOS.length).toBeGreaterThan(0);
  });

  test('each scenario should have required properties', () => {
    SCENARIOS.forEach((scenario: ScenarioTemplate) => {
      expect(scenario.id).toBeDefined();
      expect(typeof scenario.id).toBe('string');
      expect(scenario.id.length).toBeGreaterThan(0);

      expect(scenario.name).toBeDefined();
      expect(typeof scenario.name).toBe('string');
      expect(scenario.name.length).toBeGreaterThan(0);

      expect(scenario.description).toBeDefined();
      expect(typeof scenario.description).toBe('string');
      expect(scenario.description.length).toBeGreaterThan(0);

      expect(scenario.targetCount).toBeDefined();
      expect(typeof scenario.targetCount).toBe('number');
      expect(scenario.targetCount).toBeGreaterThan(0);

      expect(scenario.shotsPerTarget).toBeDefined();
      expect(typeof scenario.shotsPerTarget).toBe('number');
      expect(scenario.shotsPerTarget).toBeGreaterThan(0);

      expect(scenario.timeLimitMs).toBeDefined();
      expect(typeof scenario.timeLimitMs).toBe('number');
      expect(scenario.timeLimitMs).toBeGreaterThan(0);
    });
  });

  test('scenario IDs should be unique', () => {
    const ids = SCENARIOS.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('should have specific scenarios', () => {
    const doubleTap = SCENARIOS.find(s => s.id === 'double-tap');
    expect(doubleTap).toBeDefined();
    expect(doubleTap?.name).toBe('Double Tap');
    expect(doubleTap?.targetCount).toBe(2);
    expect(doubleTap?.shotsPerTarget).toBe(2);
    expect(doubleTap?.timeLimitMs).toBe(10000);
  });
}); 