/**
 * Status logic tests for the Games direct-TB path: determineStatus must stay
 * aligned with scripts/check-online-targets-thingsboard.sh, edge
 * targets-with-telemetry, and lib/edge deriveStatusFromRaw.
 *
 * RECENT_THRESHOLD_MS = 12h (43200_000); standby only when lastActivityTime
 * is within threshold.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { determineStatus } from '@/features/games/lib/thingsboard-targets';

const TWELVE_HOURS_MS = 43200_000;

describe('determineStatus (thingsboard-targets, script-aligned)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns online when gameStatus is start|busy|active', () => {
    expect(determineStatus(null, 'start', null, null, null)).toBe('online');
    expect(determineStatus(null, 'busy', null, null, null)).toBe('online');
    expect(determineStatus(null, 'active', null, null, null)).toBe('online');
  });

  it('active=false: standby only when lastActivityTime within 12h', () => {
    const now = Date.now();
    expect(determineStatus(null, null, null, false, now - 1000)).toBe('standby');
    expect(determineStatus(null, null, null, false, now - TWELVE_HOURS_MS)).toBe('standby');
    expect(determineStatus(null, null, null, false, now - TWELVE_HOURS_MS - 1)).toBe('offline');
    expect(determineStatus(null, null, null, false, null)).toBe('offline');
  });

  it('active=true and rawStatus in [online,active,active_online,busy] -> online', () => {
    expect(determineStatus('online', null, null, true, null)).toBe('online');
    expect(determineStatus('active', null, null, true, null)).toBe('online');
    expect(determineStatus('active_online', null, null, true, null)).toBe('online');
    expect(determineStatus('busy', null, null, true, null)).toBe('online');
  });

  it('active=true and rawStatus not in online set: standby only when lastActivityTime within 12h', () => {
    const now = Date.now();
    expect(determineStatus('idle', null, null, true, now - 1000)).toBe('standby');
    expect(determineStatus('standby', null, null, true, now - 1000)).toBe('standby');
    expect(determineStatus('idle', null, null, true, now - TWELVE_HOURS_MS - 1)).toBe('offline');
    expect(determineStatus('idle', null, null, true, null)).toBe('offline');
  });

  it('active=null: only standby when lastActivityTime within 12h (no rawStatus idle/standby alone)', () => {
    const now = Date.now();
    expect(determineStatus('standby', null, null, null, null)).toBe('offline');
    expect(determineStatus('idle', null, null, null, null)).toBe('offline');
    expect(determineStatus('standby', null, null, null, now - 1000)).toBe('standby');
    expect(determineStatus('online', null, null, null, null)).toBe('online');
  });

  it('gameStatus takes priority over active flag', () => {
    // Even if active=false and no lastActivityTime, gameStatus busy -> online
    expect(determineStatus(null, 'busy', null, false, null)).toBe('online');
    expect(determineStatus('idle', 'start', null, true, null)).toBe('online');
  });

  it('lastShotTime parameter does not influence status', () => {
    const now = Date.now();
    // active=false with recent lastShotTime but no lastActivityTime -> still offline
    expect(determineStatus(null, null, now - 1000, false, null)).toBe('offline');
    // active=null with recent lastShotTime but no lastActivityTime -> still offline
    expect(determineStatus('idle', null, now - 1000, null, null)).toBe('offline');
  });
});
