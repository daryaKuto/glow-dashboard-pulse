
import { describe, it, expect, beforeEach } from 'vitest';
import { useStats } from '../useStats';
import { act, renderHook } from '@testing-library/react';

describe('useStats store', () => {
  beforeEach(() => {
    // Reset the store before each test
    useStats.setState({
      activeTargets: 0,
      roomsCreated: 0,
      lastSessionScore: 0,
      pendingInvites: 0,
      hitTrend: Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return { 
          date: date.toISOString().split('T')[0], 
          hits: 0
        };
      }),
      isLoading: true,
      error: null,
      wsConnected: false,
      fetchStats: useStats.getState().fetchStats,
      updateHit: useStats.getState().updateHit,
      setWsConnected: useStats.getState().setWsConnected
    });
  });

  it('should initialize with default values', () => {
    const state = useStats.getState();
    expect(state.activeTargets).toBe(0);
    expect(state.roomsCreated).toBe(0);
    expect(state.lastSessionScore).toBe(0);
    expect(state.pendingInvites).toBe(0);
    expect(state.hitTrend).toHaveLength(7);
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
    expect(state.wsConnected).toBe(false);
  });

  it('should fetch stats', async () => {
    await act(async () => {
      await useStats.getState().fetchStats('test_token');
    });

    const state = useStats.getState();
    expect(state.isLoading).toBe(false);
    expect(state.activeTargets).toBe(5);
    expect(state.roomsCreated).toBe(3);
    expect(state.lastSessionScore).toBe(84);
    expect(state.pendingInvites).toBe(2);
  });

  it('should update hit trend', () => {
    // Update hit for a target
    act(() => {
      useStats.getState().updateHit('target-123', 50);
    });

    // Check that today's hit count increased
    const state = useStats.getState();
    const today = state.hitTrend[state.hitTrend.length - 1];
    
    expect(today.hits).toBeGreaterThan(0);
    expect(state.lastSessionScore).toBe(50);
    
    // Update with higher score
    act(() => {
      useStats.getState().updateHit('target-123', 75);
    });
    
    expect(useStats.getState().lastSessionScore).toBe(75);
  });

  it('should update WebSocket connection status', () => {
    act(() => {
      useStats.getState().setWsConnected(true);
    });
    
    expect(useStats.getState().wsConnected).toBe(true);
    
    act(() => {
      useStats.getState().setWsConnected(false);
    });
    
    expect(useStats.getState().wsConnected).toBe(false);
  });
});
