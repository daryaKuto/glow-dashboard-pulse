import { renderHook, act } from '@testing-library/react';
import { useScenarioRun } from '../useScenarioRun';
import { useRooms } from '../useRooms';
import API from '@/lib/api';
import { SCENARIOS } from '@/data/scenarios';

// Mock dependencies
vi.mock('@/lib/api');
vi.mock('../useRooms');

const mockAPI = API as any;
const mockUseRooms = useRooms as any;

describe('useScenarioRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset the store state
    useScenarioRun.setState({
      active: false,
      current: undefined,
      error: undefined
    });
    
    // Mock useRooms.getState
    mockUseRooms.getState = vi.fn().mockReturnValue({
      rooms: [
        { id: 'room-1', name: 'Test Room' },
        { id: 'room-2', name: 'Another Room' }
      ]
    });

    // Mock API.getTargets
    mockAPI.getTargets = vi.fn().mockResolvedValue([
      { id: 'target-1', roomId: 'room-1', name: 'Target 1' },
      { id: 'target-2', roomId: 'room-1', name: 'Target 2' },
      { id: 'target-3', roomId: 'room-2', name: 'Target 3' }
    ]);

    // Mock API.pushScenarioConfig
    mockAPI.pushScenarioConfig = vi.fn().mockResolvedValue(undefined);
  });

  test('should initialize with inactive state', () => {
    const { result } = renderHook(() => useScenarioRun());
    
    expect(result.current.active).toBe(false);
    expect(result.current.current).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  test('should start scenario successfully', async () => {
    const { result } = renderHook(() => useScenarioRun());
    const quickDraw = SCENARIOS.find(s => s.id === 'quick-draw')!;

    await act(async () => {
      await result.current.start(quickDraw, 'room-1');
    });

    expect(result.current.active).toBe(true);
    expect(result.current.current).toEqual(quickDraw);
    expect(result.current.error).toBeUndefined();
    expect(mockAPI.pushScenarioConfig).toHaveBeenCalledWith({
      scenarioId: 'quick-draw',
      targetIds: ['target-1'],
      shotsPerTarget: 1,
      timeLimitMs: 3000,
      startedAt: expect.any(Number)
    });
  });

  test('should handle room not found error', async () => {
    const { result } = renderHook(() => useScenarioRun());
    const quickDraw = SCENARIOS.find(s => s.id === 'quick-draw')!;

    await act(async () => {
      await result.current.start(quickDraw, 'non-existent-room');
    });

    expect(result.current.active).toBe(false);
    expect(result.current.current).toBeUndefined();
    expect(result.current.error).toBe('Room not found');
  });

  test('should handle insufficient targets error', async () => {
    const { result } = renderHook(() => useScenarioRun());
    const tripleThreat = SCENARIOS.find(s => s.id === 'triple-threat')!;

    await act(async () => {
      await result.current.start(tripleThreat, 'room-1');
    });

    expect(result.current.active).toBe(false);
    expect(result.current.current).toBeUndefined();
    expect(result.current.error).toBe('Need 3 targets, found 2');
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

  test('should handle API errors during start', async () => {
    mockAPI.pushScenarioConfig = vi.fn().mockRejectedValue(new Error('API Error'));
    
    const { result } = renderHook(() => useScenarioRun());
    const quickDraw = SCENARIOS.find(s => s.id === 'quick-draw')!;

    await act(async () => {
      await expect(result.current.start(quickDraw, 'room-1')).rejects.toThrow('API Error');
    });

    expect(result.current.active).toBe(false);
    expect(result.current.current).toBeUndefined();
  });
}); 