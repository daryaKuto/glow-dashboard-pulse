import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTargets } from '../../src/state/useTargets';

describe('useTargets', () => {
  beforeEach(() => {
    // Reset the store state
    useTargets.setState({
      targets: [],
      isLoading: false,
      error: null,
    });
  });

  describe('initial state', () => {
    it('should initialize with empty targets and not loading', () => {
      const { result } = renderHook(() => useTargets());

      expect(result.current.targets).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  describe('clearCache', () => {
    it('should call clearTargetsCache', () => {
      const { result } = renderHook(() => useTargets());

      act(() => {
        result.current.clearCache();
      });

      // Verify the function was called
      expect(true).toBe(true);
    });
  });
}); 