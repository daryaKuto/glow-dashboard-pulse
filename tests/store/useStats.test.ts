
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStats } from '../../src/state/useStats';

describe('useStats store', () => {
  beforeEach(() => {
    // Reset the store state
    useStats.setState({
      activeTargets: 0,
      roomsCreated: 0,
      lastScenarioScore: 0,
      pendingInvites: 0,
      hitTrend: Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return { 
          date: date.toISOString().split('T')[0], 
          hits: 0
        };
      }),
      isLoading: false,
      error: null,
      wsConnected: false,
    });
  });

  describe('initial state', () => {
    it('should initialize with default stats', () => {
      const { result } = renderHook(() => useStats());

      expect(result.current.activeTargets).toBe(0);
      expect(result.current.roomsCreated).toBe(0);
      expect(result.current.lastScenarioScore).toBe(0);
      expect(result.current.pendingInvites).toBe(0);
      expect(result.current.hitTrend).toHaveLength(7);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.wsConnected).toBe(false);
    });
  });

  describe('available functions', () => {
    it('should have fetchStats function', () => {
      const { result } = renderHook(() => useStats());

      expect(typeof result.current.fetchStats).toBe('function');
    });

    it('should have updateHit function', () => {
      const { result } = renderHook(() => useStats());

      expect(typeof result.current.updateHit).toBe('function');
    });

    it('should have setWsConnected function', () => {
      const { result } = renderHook(() => useStats());

      expect(typeof result.current.setWsConnected).toBe('function');
    });

    it('should have initializeWebSocket function', () => {
      const { result } = renderHook(() => useStats());

      expect(typeof result.current.initializeWebSocket).toBe('function');
    });
  });
});

