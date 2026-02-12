import { describe, it, expect } from 'vitest';
import {
  GAME_CONSTRAINTS,
  GAME_SESSION_STATUS,
  validateCreateGameSessionInput,
  validateGameTemplateInput,
  validateUpdateGameSession,
  validateGameResults,
  validateGameSessionStatus,
  validateGameId,
  validateSessionId,
  isActiveSessionStatus,
  isTerminalSessionStatus,
  canStartSession,
  canStopSession,
  validateGameConfiguration,
} from '../../src/domain/games/validators';

describe('games validators', () => {
  describe('validateCreateGameSessionInput', () => {
    it('validates valid input', () => {
      const result = validateCreateGameSessionInput({
        gameId: 'game-123',
        gameName: 'Quick Draw',
        roomId: null,
        duration: 60000,
        deviceIds: ['device-1', 'device-2'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gameName).toBe('Quick Draw');
        expect(result.data.deviceIds).toHaveLength(2);
      }
    });

    it('rejects empty game name', () => {
      const result = validateCreateGameSessionInput({
        gameId: 'game-123',
        gameName: '',
        roomId: null,
        deviceIds: ['device-1'],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].field).toBe('gameName');
      }
    });

    it('rejects empty device list', () => {
      const result = validateCreateGameSessionInput({
        gameId: 'game-123',
        gameName: 'Test Game',
        roomId: null,
        deviceIds: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].field).toBe('deviceIds');
      }
    });

    it('rejects too many devices', () => {
      const deviceIds = Array.from({ length: GAME_CONSTRAINTS.MAX_TARGETS + 1 }, (_, i) => `device-${i}`);
      const result = validateCreateGameSessionInput({
        gameId: 'game-123',
        gameName: 'Test Game',
        roomId: null,
        deviceIds,
      });

      expect(result.success).toBe(false);
    });

    it('rejects duration below minimum', () => {
      const result = validateCreateGameSessionInput({
        gameId: 'game-123',
        gameName: 'Test Game',
        roomId: null,
        duration: 100, // Below MIN_DURATION_MS
        deviceIds: ['device-1'],
      });

      expect(result.success).toBe(false);
    });

    it('rejects duration above maximum', () => {
      const result = validateCreateGameSessionInput({
        gameId: 'game-123',
        gameName: 'Test Game',
        roomId: null,
        duration: GAME_CONSTRAINTS.MAX_DURATION_MS + 1,
        deviceIds: ['device-1'],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('validateGameTemplateInput', () => {
    it('validates valid template input', () => {
      const result = validateGameTemplateInput({
        name: 'Speed Drill',
        description: 'A fast-paced game',
        category: 'speed_drill',
        difficulty: 'medium',
        targetCount: 3,
        shotsPerTarget: 5,
        timeLimitMs: 60000,
      });

      expect(result.success).toBe(true);
    });

    it('validates with null optional fields', () => {
      const result = validateGameTemplateInput({
        name: 'Simple Game',
        targetCount: 1,
        shotsPerTarget: 1,
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid category', () => {
      const result = validateGameTemplateInput({
        name: 'Test',
        category: 'invalid_category',
        targetCount: 1,
        shotsPerTarget: 1,
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid difficulty', () => {
      const result = validateGameTemplateInput({
        name: 'Test',
        difficulty: 'impossible',
        targetCount: 1,
        shotsPerTarget: 1,
      });

      expect(result.success).toBe(false);
    });

    it('rejects target count below minimum', () => {
      const result = validateGameTemplateInput({
        name: 'Test',
        targetCount: 0,
        shotsPerTarget: 1,
      });

      expect(result.success).toBe(false);
    });

    it('rejects shots per target above maximum', () => {
      const result = validateGameTemplateInput({
        name: 'Test',
        targetCount: 1,
        shotsPerTarget: GAME_CONSTRAINTS.MAX_SHOTS_PER_TARGET + 1,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('validateUpdateGameSession', () => {
    it('validates valid update', () => {
      const result = validateUpdateGameSession({
        status: 'running',
        score: 100,
        hitCount: 10,
      });

      expect(result.success).toBe(true);
    });

    it('rejects negative score', () => {
      const result = validateUpdateGameSession({
        score: -10,
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid status', () => {
      const result = validateUpdateGameSession({
        status: 'invalid_status',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('validateGameResults', () => {
    it('validates valid game results', () => {
      const result = validateGameResults({
        sessionId: 'session-123',
        score: 1500,
        hitCount: 15,
        missCount: 5,
        totalShots: 20,
        accuracy: 75,
        duration: 60000,
        startTime: 1000000,
        endTime: 1060000,
      });

      expect(result.success).toBe(true);
    });

    it('rejects accuracy above 100', () => {
      const result = validateGameResults({
        sessionId: 'session-123',
        score: 1000,
        hitCount: 10,
        missCount: 0,
        totalShots: 10,
        accuracy: 150,
        duration: 30000,
        startTime: 1000000,
        endTime: 1030000,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('validateGameSessionStatus', () => {
    it.each(GAME_SESSION_STATUS)('validates status: %s', (status) => {
      const result = validateGameSessionStatus(status);
      expect(result.success).toBe(true);
    });

    it('rejects invalid status', () => {
      const result = validateGameSessionStatus('not_a_status');
      expect(result.success).toBe(false);
    });
  });

  describe('validateGameId', () => {
    it('validates non-empty game ID', () => {
      const result = validateGameId('game-123');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('game-123');
      }
    });

    it('rejects empty game ID', () => {
      const result = validateGameId('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('required');
      }
    });

    it('rejects whitespace-only game ID', () => {
      const result = validateGameId('   ');
      expect(result.success).toBe(false);
    });

    it('rejects null', () => {
      const result = validateGameId(null);
      expect(result.success).toBe(false);
    });
  });

  describe('validateSessionId', () => {
    it('validates non-empty session ID', () => {
      const result = validateSessionId('session-456');
      expect(result.success).toBe(true);
    });

    it('rejects empty session ID', () => {
      const result = validateSessionId('');
      expect(result.success).toBe(false);
    });
  });

  describe('isActiveSessionStatus', () => {
    it('returns true for active statuses', () => {
      expect(isActiveSessionStatus('configuring')).toBe(true);
      expect(isActiveSessionStatus('launching')).toBe(true);
      expect(isActiveSessionStatus('running')).toBe(true);
      expect(isActiveSessionStatus('stopping')).toBe(true);
      expect(isActiveSessionStatus('finalizing')).toBe(true);
    });

    it('returns false for non-active statuses', () => {
      expect(isActiveSessionStatus('idle')).toBe(false);
      expect(isActiveSessionStatus('completed')).toBe(false);
      expect(isActiveSessionStatus('error')).toBe(false);
    });
  });

  describe('isTerminalSessionStatus', () => {
    it('returns true for terminal statuses', () => {
      expect(isTerminalSessionStatus('completed')).toBe(true);
      expect(isTerminalSessionStatus('error')).toBe(true);
    });

    it('returns false for non-terminal statuses', () => {
      expect(isTerminalSessionStatus('idle')).toBe(false);
      expect(isTerminalSessionStatus('running')).toBe(false);
      expect(isTerminalSessionStatus('configuring')).toBe(false);
    });
  });

  describe('canStartSession', () => {
    it('returns true for idle status', () => {
      expect(canStartSession('idle')).toBe(true);
    });

    it('returns false for non-idle statuses', () => {
      expect(canStartSession('running')).toBe(false);
      expect(canStartSession('configuring')).toBe(false);
      expect(canStartSession('completed')).toBe(false);
    });
  });

  describe('canStopSession', () => {
    it('returns true for running status', () => {
      expect(canStopSession('running')).toBe(true);
    });

    it('returns true for launching status', () => {
      expect(canStopSession('launching')).toBe(true);
    });

    it('returns false for other statuses', () => {
      expect(canStopSession('idle')).toBe(false);
      expect(canStopSession('completed')).toBe(false);
      expect(canStopSession('stopping')).toBe(false);
    });
  });

  describe('validateGameConfiguration', () => {
    it('validates valid configuration', () => {
      const result = validateGameConfiguration(5, 10, 60000);
      expect(result.valid).toBe(true);
    });

    it('validates configuration with null time limit', () => {
      const result = validateGameConfiguration(3, 5, null);
      expect(result.valid).toBe(true);
    });

    it('rejects target count below minimum', () => {
      const result = validateGameConfiguration(0, 5, 60000);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.violation).toContain('Target count');
      }
    });

    it('rejects target count above maximum', () => {
      const result = validateGameConfiguration(GAME_CONSTRAINTS.MAX_TARGETS + 1, 5, 60000);
      expect(result.valid).toBe(false);
    });

    it('rejects shots per target below minimum', () => {
      const result = validateGameConfiguration(5, 0, 60000);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.violation).toContain('Shots per target');
      }
    });

    it('rejects shots per target above maximum', () => {
      const result = validateGameConfiguration(5, GAME_CONSTRAINTS.MAX_SHOTS_PER_TARGET + 1, 60000);
      expect(result.valid).toBe(false);
    });

    it('rejects time limit below minimum', () => {
      const result = validateGameConfiguration(5, 10, 1000);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.violation).toContain('Time limit');
      }
    });

    it('rejects time limit above maximum', () => {
      const result = validateGameConfiguration(5, 10, GAME_CONSTRAINTS.MAX_TIME_LIMIT_MS + 1);
      expect(result.valid).toBe(false);
    });

    it('rejects NaN target count', () => {
      const result = validateGameConfiguration(NaN, 5, 60000);
      expect(result.valid).toBe(false);
    });

    it('rejects Infinity time limit', () => {
      const result = validateGameConfiguration(5, 10, Infinity);
      expect(result.valid).toBe(false);
    });
  });
});
