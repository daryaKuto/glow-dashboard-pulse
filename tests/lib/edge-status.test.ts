/**
 * Status logic tests: deriveStatusFromRaw must stay aligned with
 * scripts/check-online-targets-thingsboard.sh and edge targets-with-telemetry.
 * RECENT_THRESHOLD_MS = 12h (43200_000); standby only when lastActivityTime is recent.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deriveStatusFromRaw } from '@/lib/edge';

const TWELVE_HOURS_MS = 43200_000;

describe('deriveStatusFromRaw (script/edge-aligned)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns online when gameStatus is start|busy|active', () => {
    expect(deriveStatusFromRaw({ gameStatus: 'start' })).toBe('online');
    expect(deriveStatusFromRaw({ gameStatus: 'busy' })).toBe('online');
    expect(deriveStatusFromRaw({ gameStatus: 'active' })).toBe('online');
  });

  it('active=false: standby only when tbLastActivityTime within 12h', () => {
    const now = Date.now();
    expect(deriveStatusFromRaw({ active: false, tbLastActivityTime: now - 1000 })).toBe('standby');
    expect(deriveStatusFromRaw({ active: false, tbLastActivityTime: now - TWELVE_HOURS_MS })).toBe('standby');
    expect(deriveStatusFromRaw({ active: false, tbLastActivityTime: now - TWELVE_HOURS_MS - 1 })).toBe('offline');
    expect(deriveStatusFromRaw({ active: false })).toBe('offline');
  });

  it('active=true and rawStatus in [online,active,active_online,busy] -> online', () => {
    expect(deriveStatusFromRaw({ active: true, rawStatus: 'online' })).toBe('online');
    expect(deriveStatusFromRaw({ active: true, rawStatus: 'active' })).toBe('online');
    expect(deriveStatusFromRaw({ active: true, rawStatus: 'active_online' })).toBe('online');
    expect(deriveStatusFromRaw({ active: true, rawStatus: 'busy' })).toBe('online');
  });

  it('active=true and rawStatus not in online set: standby only when lastActivityTime within 12h', () => {
    const now = Date.now();
    expect(deriveStatusFromRaw({ active: true, rawStatus: 'idle', tbLastActivityTime: now - 1000 })).toBe('standby');
    expect(deriveStatusFromRaw({ active: true, rawStatus: 'standby', tbLastActivityTime: now - 1000 })).toBe('standby');
    expect(deriveStatusFromRaw({ active: true, rawStatus: 'idle', tbLastActivityTime: now - TWELVE_HOURS_MS - 1 })).toBe('offline');
    expect(deriveStatusFromRaw({ active: true, rawStatus: 'idle' })).toBe('offline');
  });

  it('active=null: only standby when tbLastActivityTime within 12h (no rawStatus idle/standby alone)', () => {
    const now = Date.now();
    expect(deriveStatusFromRaw({ rawStatus: 'standby' })).toBe('offline');
    expect(deriveStatusFromRaw({ rawStatus: 'idle' })).toBe('offline');
    expect(deriveStatusFromRaw({ rawStatus: 'standby', tbLastActivityTime: now - 1000 })).toBe('standby');
    expect(deriveStatusFromRaw({ rawStatus: 'online' })).toBe('online');
  });
});
