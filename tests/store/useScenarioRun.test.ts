import { renderHook, act } from '@testing-library/react';
import { useScenarioRun } from '../../src/_legacy/state/useScenarioRun_old_code';
import { useRooms } from '../../src/state/useRooms';
import API from '../../src/lib/api';
import { SCENARIOS } from '../../src/data/scenarios';

describe('useScenarioRun', () => {
  beforeEach(() => {
    // Reset the store state
    useScenarioRun.setState({
      active: false,
      current: undefined,
      error: undefined
    });
  });

  test('should initialize with inactive state', () => {
    const { result } = renderHook(() => useScenarioRun());
    
    expect(result.current.active).toBe(false);
    expect(result.current.current).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  test('should stop scenario', () => {
    const { result } = renderHook(() => useScenarioRun());

    act(() => {
      result.current.stop();
    });

    expect(result.current.active).toBe(false);
    expect(result.current.current).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });
}); 