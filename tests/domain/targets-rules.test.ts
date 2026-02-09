import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TELEMETRY_THRESHOLDS,
  BATTERY_THRESHOLDS,
  WIFI_THRESHOLDS,
  determineTargetStatus,
  determineActivityStatus,
  getBatteryLevel,
  getWifiQuality,
  targetNeedsAttention,
  isTargetReadyForGame,
  calculateTargetHealthScore,
  sortTargetsByPriority,
  filterTargetsByStatus,
  getTargetsNeedingAttention,
} from '../../src/domain/targets/rules';
import type { TargetDomainModel } from '../../src/domain/targets/mappers';

// Helper to create a mock target
function createTarget(overrides: Partial<TargetDomainModel> = {}): TargetDomainModel {
  return {
    id: 'target-1',
    name: 'Target 1',
    customName: null,
    status: 'online',
    activityStatus: 'standby',
    battery: 80,
    wifiStrength: -50,
    roomId: null,
    lastShotTime: null,
    lastActivityTime: Date.now(),
    totalShots: 0,
    recentShotsCount: 0,
    lastEvent: null,
    gameStatus: null,
    errors: [],
    ...overrides,
  };
}

describe('targets rules', () => {
  describe('determineTargetStatus', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns offline for null lastActivityTime', () => {
      expect(determineTargetStatus(null)).toBe('offline');
    });

    it('returns online for activity within STALE_WINDOW (1 hour)', () => {
      const now = Date.now();
      const recentActivity = now - (TELEMETRY_THRESHOLDS.STALE_WINDOW - 60000); // 59 minutes ago
      expect(determineTargetStatus(recentActivity)).toBe('online');
    });

    it('returns standby for activity between STALE_WINDOW and OFFLINE_THRESHOLD', () => {
      const now = Date.now();
      const staleActivity = now - (TELEMETRY_THRESHOLDS.STALE_WINDOW + 60000); // 61 minutes ago
      expect(determineTargetStatus(staleActivity)).toBe('standby');
    });

    it('returns offline for activity older than OFFLINE_THRESHOLD (2 hours)', () => {
      const now = Date.now();
      const oldActivity = now - (TELEMETRY_THRESHOLDS.OFFLINE_THRESHOLD + 60000); // 2 hours + 1 minute ago
      expect(determineTargetStatus(oldActivity)).toBe('offline');
    });

    it('returns online at exactly STALE_WINDOW boundary', () => {
      const now = Date.now();
      const boundaryActivity = now - TELEMETRY_THRESHOLDS.STALE_WINDOW;
      expect(determineTargetStatus(boundaryActivity)).toBe('online');
    });

    it('returns standby at exactly OFFLINE_THRESHOLD boundary', () => {
      const now = Date.now();
      const boundaryActivity = now - TELEMETRY_THRESHOLDS.OFFLINE_THRESHOLD;
      expect(determineTargetStatus(boundaryActivity)).toBe('standby');
    });
  });

  describe('determineActivityStatus', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns standby for null lastShotTime', () => {
      expect(determineActivityStatus(null)).toBe('standby');
    });

    it('returns active for shot within ACTIVE_WINDOW (5 min)', () => {
      const now = Date.now();
      const recentShot = now - (TELEMETRY_THRESHOLDS.ACTIVE_WINDOW - 60000); // 4 minutes ago
      expect(determineActivityStatus(recentShot)).toBe('active');
    });

    it('returns recent for shot between ACTIVE_WINDOW and RECENT_WINDOW', () => {
      const now = Date.now();
      const notSoRecentShot = now - (TELEMETRY_THRESHOLDS.ACTIVE_WINDOW + 60000); // 6 minutes ago
      expect(determineActivityStatus(notSoRecentShot)).toBe('recent');
    });

    it('returns standby for shot older than RECENT_WINDOW (30 min)', () => {
      const now = Date.now();
      const oldShot = now - (TELEMETRY_THRESHOLDS.RECENT_WINDOW + 60000); // 31 minutes ago
      expect(determineActivityStatus(oldShot)).toBe('standby');
    });

    it('returns active at exactly ACTIVE_WINDOW boundary', () => {
      const now = Date.now();
      const boundaryShot = now - TELEMETRY_THRESHOLDS.ACTIVE_WINDOW;
      expect(determineActivityStatus(boundaryShot)).toBe('active');
    });

    it('returns recent at exactly RECENT_WINDOW boundary', () => {
      const now = Date.now();
      const boundaryShot = now - TELEMETRY_THRESHOLDS.RECENT_WINDOW;
      expect(determineActivityStatus(boundaryShot)).toBe('recent');
    });
  });

  describe('getBatteryLevel', () => {
    it('returns unknown for null', () => {
      expect(getBatteryLevel(null)).toBe('unknown');
    });

    it('returns critical for 0%', () => {
      expect(getBatteryLevel(0)).toBe('critical');
    });

    it('returns critical for percentage at CRITICAL threshold (10%)', () => {
      expect(getBatteryLevel(BATTERY_THRESHOLDS.CRITICAL)).toBe('critical');
    });

    it('returns low for percentage just above CRITICAL (11%)', () => {
      expect(getBatteryLevel(11)).toBe('low');
    });

    it('returns low for percentage at LOW threshold (25%)', () => {
      expect(getBatteryLevel(BATTERY_THRESHOLDS.LOW)).toBe('low');
    });

    it('returns medium for percentage just above LOW (26%)', () => {
      expect(getBatteryLevel(26)).toBe('medium');
    });

    it('returns medium for percentage at MEDIUM threshold (50%)', () => {
      expect(getBatteryLevel(BATTERY_THRESHOLDS.MEDIUM)).toBe('medium');
    });

    it('returns high for percentage just above MEDIUM (51%)', () => {
      expect(getBatteryLevel(51)).toBe('high');
    });

    it('returns high for percentage at HIGH threshold (75%)', () => {
      expect(getBatteryLevel(BATTERY_THRESHOLDS.HIGH)).toBe('high');
    });

    it('returns full for percentage above HIGH (76%)', () => {
      expect(getBatteryLevel(76)).toBe('full');
    });

    it('returns full for 100%', () => {
      expect(getBatteryLevel(100)).toBe('full');
    });
  });

  describe('getWifiQuality', () => {
    it('returns unknown for null', () => {
      expect(getWifiQuality(null)).toBe('unknown');
    });

    it('returns excellent for -30 dBm (strong signal)', () => {
      expect(getWifiQuality(-30)).toBe('excellent');
    });

    it('returns excellent at EXCELLENT threshold (-50 dBm)', () => {
      expect(getWifiQuality(WIFI_THRESHOLDS.EXCELLENT)).toBe('excellent');
    });

    it('returns good for -55 dBm', () => {
      expect(getWifiQuality(-55)).toBe('good');
    });

    it('returns good at GOOD threshold (-60 dBm)', () => {
      expect(getWifiQuality(WIFI_THRESHOLDS.GOOD)).toBe('good');
    });

    it('returns fair for -65 dBm', () => {
      expect(getWifiQuality(-65)).toBe('fair');
    });

    it('returns fair at FAIR threshold (-70 dBm)', () => {
      expect(getWifiQuality(WIFI_THRESHOLDS.FAIR)).toBe('fair');
    });

    it('returns poor for -75 dBm', () => {
      expect(getWifiQuality(-75)).toBe('poor');
    });

    it('returns poor at POOR threshold (-80 dBm)', () => {
      expect(getWifiQuality(WIFI_THRESHOLDS.POOR)).toBe('poor');
    });

    it('returns weak for -85 dBm (weaker than POOR)', () => {
      expect(getWifiQuality(-85)).toBe('weak');
    });

    it('returns weak for -90 dBm (very weak signal)', () => {
      expect(getWifiQuality(-90)).toBe('weak');
    });
  });

  describe('targetNeedsAttention', () => {
    it('returns valid for healthy target', () => {
      const target = createTarget();
      const result = targetNeedsAttention(target);
      expect(result.valid).toBe(true);
    });

    it('returns invalid with HAS_ERRORS for target with errors', () => {
      const target = createTarget({ errors: ['Connection timeout'] });
      const result = targetNeedsAttention(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('HAS_ERRORS');
      }
    });

    it('returns invalid with LOW_BATTERY for critical battery', () => {
      const target = createTarget({ errors: [], battery: 5 });
      const result = targetNeedsAttention(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('LOW_BATTERY');
      }
    });

    it('returns invalid with LOW_BATTERY for low battery', () => {
      const target = createTarget({ errors: [], battery: 20 });
      const result = targetNeedsAttention(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('LOW_BATTERY');
      }
    });

    it('returns invalid with POOR_WIFI for poor WiFi signal', () => {
      const target = createTarget({ errors: [], battery: 80, wifiStrength: -75 });
      const result = targetNeedsAttention(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('POOR_WIFI');
      }
    });

    it('returns invalid with POOR_WIFI for weak WiFi signal', () => {
      const target = createTarget({ errors: [], battery: 80, wifiStrength: -85 });
      const result = targetNeedsAttention(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('POOR_WIFI');
      }
    });

    it('returns invalid with OFFLINE for offline status', () => {
      const target = createTarget({ errors: [], battery: 80, wifiStrength: -50, status: 'offline' });
      const result = targetNeedsAttention(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('OFFLINE');
      }
    });

    it('checks errors before battery (priority order)', () => {
      const target = createTarget({ errors: ['Error'], battery: 5 });
      const result = targetNeedsAttention(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('HAS_ERRORS');
      }
    });

    it('checks battery before WiFi (priority order)', () => {
      const target = createTarget({ errors: [], battery: 5, wifiStrength: -85 });
      const result = targetNeedsAttention(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('LOW_BATTERY');
      }
    });

    it('checks WiFi before status (priority order)', () => {
      const target = createTarget({ errors: [], battery: 80, wifiStrength: -85, status: 'offline' });
      const result = targetNeedsAttention(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('POOR_WIFI');
      }
    });
  });

  describe('isTargetReadyForGame', () => {
    it('returns valid for online healthy target', () => {
      const target = createTarget();
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(true);
    });

    it('returns invalid with NOT_ONLINE for standby target', () => {
      const target = createTarget({ status: 'standby' });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('NOT_ONLINE');
      }
    });

    it('returns invalid with NOT_ONLINE for offline target', () => {
      const target = createTarget({ status: 'offline' });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('NOT_ONLINE');
      }
    });

    it('returns invalid with CRITICAL_BATTERY for critical battery', () => {
      const target = createTarget({ battery: 5 });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('CRITICAL_BATTERY');
      }
    });

    it('allows low battery (not critical)', () => {
      const target = createTarget({ battery: 20 });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(true);
    });

    it('returns invalid with BLOCKING_ERRORS for hardware error', () => {
      const target = createTarget({ errors: ['hardware failure'] });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('BLOCKING_ERRORS');
      }
    });

    it('returns invalid with BLOCKING_ERRORS for sensor error', () => {
      const target = createTarget({ errors: ['sensor malfunction'] });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('BLOCKING_ERRORS');
      }
    });

    it('returns invalid with BLOCKING_ERRORS for calibration error', () => {
      const target = createTarget({ errors: ['calibration needed'] });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('BLOCKING_ERRORS');
      }
    });

    it('returns invalid with BLOCKING_ERRORS for fatal error', () => {
      const target = createTarget({ errors: ['fatal exception'] });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('BLOCKING_ERRORS');
      }
    });

    it('returns invalid with BLOCKING_ERRORS for critical error', () => {
      const target = createTarget({ errors: ['CRITICAL: system failure'] });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('BLOCKING_ERRORS');
      }
    });

    it('allows non-blocking errors like timeout', () => {
      const target = createTarget({ errors: ['connection timeout', 'network retry'] });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(true);
    });

    it('returns invalid with ALREADY_IN_GAME for active game status', () => {
      const target = createTarget({ gameStatus: 'active' });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('ALREADY_IN_GAME');
      }
    });

    it('returns invalid with ALREADY_IN_GAME for running game status', () => {
      const target = createTarget({ gameStatus: 'running' });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('ALREADY_IN_GAME');
      }
    });

    it('allows idle game status', () => {
      const target = createTarget({ gameStatus: 'idle' });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(true);
    });

    it('allows stopped game status', () => {
      const target = createTarget({ gameStatus: 'stopped' });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(true);
    });

    it('allows null game status', () => {
      const target = createTarget({ gameStatus: null });
      const result = isTargetReadyForGame(target);
      expect(result.valid).toBe(true);
    });
  });

  describe('calculateTargetHealthScore', () => {
    it('returns 100 for perfect target', () => {
      const target = createTarget({
        status: 'online',
        battery: 100,
        wifiStrength: -30,
        errors: [],
      });
      expect(calculateTargetHealthScore(target)).toBe(100);
    });

    it('penalizes offline status by 50 points', () => {
      const target = createTarget({
        status: 'offline',
        battery: 100,
        wifiStrength: -30,
        errors: [],
      });
      expect(calculateTargetHealthScore(target)).toBe(50);
    });

    it('penalizes standby status by 20 points', () => {
      const target = createTarget({
        status: 'standby',
        battery: 100,
        wifiStrength: -30,
        errors: [],
      });
      expect(calculateTargetHealthScore(target)).toBe(80);
    });

    it('penalizes critical battery by 30 points', () => {
      const target = createTarget({
        status: 'online',
        battery: 5,
        wifiStrength: -30,
        errors: [],
      });
      expect(calculateTargetHealthScore(target)).toBe(70);
    });

    it('penalizes low battery by 15 points', () => {
      const target = createTarget({
        status: 'online',
        battery: 20,
        wifiStrength: -30,
        errors: [],
      });
      expect(calculateTargetHealthScore(target)).toBe(85);
    });

    it('penalizes medium battery by 5 points', () => {
      const target = createTarget({
        status: 'online',
        battery: 40,
        wifiStrength: -30,
        errors: [],
      });
      expect(calculateTargetHealthScore(target)).toBe(95);
    });

    it('penalizes unknown battery by 10 points', () => {
      const target = createTarget({
        status: 'online',
        battery: null,
        wifiStrength: -30,
        errors: [],
      });
      expect(calculateTargetHealthScore(target)).toBe(90);
    });

    it('penalizes weak WiFi by 20 points', () => {
      const target = createTarget({
        status: 'online',
        battery: 100,
        wifiStrength: -85,
        errors: [],
      });
      expect(calculateTargetHealthScore(target)).toBe(80);
    });

    it('penalizes poor WiFi by 10 points', () => {
      const target = createTarget({
        status: 'online',
        battery: 100,
        wifiStrength: -75,
        errors: [],
      });
      expect(calculateTargetHealthScore(target)).toBe(90);
    });

    it('penalizes fair WiFi by 5 points', () => {
      const target = createTarget({
        status: 'online',
        battery: 100,
        wifiStrength: -65,
        errors: [],
      });
      expect(calculateTargetHealthScore(target)).toBe(95);
    });

    it('penalizes unknown WiFi by 5 points', () => {
      const target = createTarget({
        status: 'online',
        battery: 100,
        wifiStrength: null,
        errors: [],
      });
      expect(calculateTargetHealthScore(target)).toBe(95);
    });

    it('penalizes each error by 10 points', () => {
      const target = createTarget({
        status: 'online',
        battery: 100,
        wifiStrength: -30,
        errors: ['error1', 'error2'],
      });
      expect(calculateTargetHealthScore(target)).toBe(80);
    });

    it('caps error penalty at 30 points', () => {
      const target = createTarget({
        status: 'online',
        battery: 100,
        wifiStrength: -30,
        errors: ['e1', 'e2', 'e3', 'e4', 'e5'],
      });
      expect(calculateTargetHealthScore(target)).toBe(70);
    });

    it('stacks multiple penalties', () => {
      const target = createTarget({
        status: 'offline', // -50
        battery: 5, // -30
        wifiStrength: -85, // -20
        errors: ['e1'], // -10
      });
      // 100 - 50 - 30 - 20 - 10 = -10, clamped to 0
      expect(calculateTargetHealthScore(target)).toBe(0);
    });

    it('clamps score to minimum of 0', () => {
      const target = createTarget({
        status: 'offline',
        battery: 5,
        wifiStrength: -90,
        errors: ['e1', 'e2', 'e3', 'e4'],
      });
      expect(calculateTargetHealthScore(target)).toBe(0);
    });
  });

  describe('sortTargetsByPriority', () => {
    it('returns empty array for empty input', () => {
      expect(sortTargetsByPriority([])).toEqual([]);
    });

    it('sorts online targets before standby', () => {
      const targets = [
        createTarget({ id: 'standby', name: 'A', status: 'standby' }),
        createTarget({ id: 'online', name: 'B', status: 'online' }),
      ];
      const sorted = sortTargetsByPriority(targets);
      expect(sorted[0].id).toBe('online');
      expect(sorted[1].id).toBe('standby');
    });

    it('sorts standby targets before offline', () => {
      const targets = [
        createTarget({ id: 'offline', name: 'A', status: 'offline' }),
        createTarget({ id: 'standby', name: 'B', status: 'standby' }),
      ];
      const sorted = sortTargetsByPriority(targets);
      expect(sorted[0].id).toBe('standby');
      expect(sorted[1].id).toBe('offline');
    });

    it('sorts online before standby before offline', () => {
      const targets = [
        createTarget({ id: 'offline', name: 'A', status: 'offline' }),
        createTarget({ id: 'online', name: 'B', status: 'online' }),
        createTarget({ id: 'standby', name: 'C', status: 'standby' }),
      ];
      const sorted = sortTargetsByPriority(targets);
      expect(sorted.map((t) => t.id)).toEqual(['online', 'standby', 'offline']);
    });

    it('sorts active before recent within same status', () => {
      const targets = [
        createTarget({ id: 'recent', name: 'A', status: 'online', activityStatus: 'recent' }),
        createTarget({ id: 'active', name: 'B', status: 'online', activityStatus: 'active' }),
      ];
      const sorted = sortTargetsByPriority(targets);
      expect(sorted[0].id).toBe('active');
      expect(sorted[1].id).toBe('recent');
    });

    it('sorts recent before standby activity within same status', () => {
      const targets = [
        createTarget({ id: 'standby-activity', name: 'A', status: 'online', activityStatus: 'standby' }),
        createTarget({ id: 'recent', name: 'B', status: 'online', activityStatus: 'recent' }),
      ];
      const sorted = sortTargetsByPriority(targets);
      expect(sorted[0].id).toBe('recent');
      expect(sorted[1].id).toBe('standby-activity');
    });

    it('sorts alphabetically by name within same status and activity', () => {
      const targets = [
        createTarget({ id: '3', name: 'Charlie', status: 'online', activityStatus: 'active' }),
        createTarget({ id: '1', name: 'Alpha', status: 'online', activityStatus: 'active' }),
        createTarget({ id: '2', name: 'Bravo', status: 'online', activityStatus: 'active' }),
      ];
      const sorted = sortTargetsByPriority(targets);
      expect(sorted.map((t) => t.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    it('does not mutate the original array', () => {
      const targets = [
        createTarget({ id: '2', name: 'B', status: 'offline' }),
        createTarget({ id: '1', name: 'A', status: 'online' }),
      ];
      const originalOrder = targets.map((t) => t.id);
      sortTargetsByPriority(targets);
      expect(targets.map((t) => t.id)).toEqual(originalOrder);
    });
  });

  describe('filterTargetsByStatus', () => {
    const targets = [
      createTarget({ id: '1', status: 'online' }),
      createTarget({ id: '2', status: 'standby' }),
      createTarget({ id: '3', status: 'offline' }),
      createTarget({ id: '4', status: 'online' }),
    ];

    it('filters by single status string', () => {
      const result = filterTargetsByStatus(targets, 'online');
      expect(result.map((t) => t.id)).toEqual(['1', '4']);
    });

    it('filters by array of statuses', () => {
      const result = filterTargetsByStatus(targets, ['online', 'standby']);
      expect(result.map((t) => t.id)).toEqual(['1', '2', '4']);
    });

    it('returns empty array for no matches', () => {
      const onlineTargets = [createTarget({ id: '1', status: 'online' })];
      const result = filterTargetsByStatus(onlineTargets, 'offline');
      expect(result).toEqual([]);
    });

    it('returns empty array for empty input', () => {
      const result = filterTargetsByStatus([], 'online');
      expect(result).toEqual([]);
    });
  });

  describe('getTargetsNeedingAttention', () => {
    it('returns empty array when all targets are healthy', () => {
      const targets = [
        createTarget({ id: '1' }),
        createTarget({ id: '2' }),
      ];
      const result = getTargetsNeedingAttention(targets);
      expect(result).toEqual([]);
    });

    it('returns only unhealthy targets', () => {
      const targets = [
        createTarget({ id: 'healthy' }),
        createTarget({ id: 'with-errors', errors: ['error'] }),
        createTarget({ id: 'low-battery', battery: 5, errors: [] }),
        createTarget({ id: 'also-healthy' }),
      ];
      const result = getTargetsNeedingAttention(targets);
      expect(result.map((t) => t.id)).toEqual(['with-errors', 'low-battery']);
    });

    it('returns empty array for empty input', () => {
      const result = getTargetsNeedingAttention([]);
      expect(result).toEqual([]);
    });

    it('returns targets with poor WiFi', () => {
      const targets = [
        createTarget({ id: 'healthy' }),
        createTarget({ id: 'poor-wifi', wifiStrength: -85, errors: [] }),
      ];
      const result = getTargetsNeedingAttention(targets);
      expect(result.map((t) => t.id)).toEqual(['poor-wifi']);
    });

    it('returns offline targets', () => {
      const targets = [
        createTarget({ id: 'healthy' }),
        createTarget({ id: 'offline-target', status: 'offline', errors: [] }),
      ];
      const result = getTargetsNeedingAttention(targets);
      expect(result.map((t) => t.id)).toEqual(['offline-target']);
    });
  });
});
