import { describe, it, expect, afterEach } from 'vitest';
import { apiOk } from '../../src/shared/lib/api-response';
import { targetsRepository } from '../../src/features/targets/repo';
import {
  getTargetsWithTelemetry,
  getTargetDetailsService,
  getTargetsSummaryService,
  setTargetRepository,
  mergeTargetDetails,
} from '../../src/features/targets/service';
import type { TargetRepository } from '../../src/domain/targets/ports';

describe('targets service repository injection', () => {
  // Reset to real repository after each test
  afterEach(() => {
    setTargetRepository(targetsRepository);
  });

  it('uses the injected repository for getTargets', async () => {
    const mockTargets = [
      {
        id: 'target-1',
        name: 'Test Target',
        status: 'online' as const,
        battery: 100,
        wifiStrength: -50,
        roomId: null,
        telemetry: {},
        lastEvent: null,
        lastGameId: null,
        lastGameName: null,
        lastHits: null,
        lastActivity: null,
        lastActivityTime: null,
        deviceName: 'Test Target',
        deviceType: 'default',
        createdTime: null,
        additionalInfo: {},
      },
    ];

    const mockRepo: TargetRepository = {
      getTargets: async () => apiOk({ targets: mockTargets, summary: null, cached: false }),
      getTargetDetails: async () => apiOk([]),
      getTargetsSummary: async () => apiOk(null),
      sendDeviceCommand: async () => apiOk(undefined),
      setDeviceAttributes: async () => apiOk(undefined),
      getTargetCustomNames: async () => apiOk(new Map()),
      setTargetCustomName: async () => apiOk(undefined),
      removeTargetCustomName: async () => apiOk(undefined),
    };

    setTargetRepository(mockRepo);
    const result = await getTargetsWithTelemetry();
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targets).toEqual(mockTargets);
      expect(result.data.cached).toBe(false);
    }
  });

  it('uses the injected repository for getTargetDetails', async () => {
    const mockDetails = [
      {
        deviceId: 'target-1',
        status: 'online' as const,
        activityStatus: 'active' as const,
        lastShotTime: null,
        totalShots: 0,
        recentShotsCount: 0,
        telemetry: {},
      },
    ];

    const mockRepo: TargetRepository = {
      getTargets: async () => apiOk({ targets: [], summary: null, cached: false }),
      getTargetDetails: async () => apiOk(mockDetails),
      getTargetsSummary: async () => apiOk(null),
      sendDeviceCommand: async () => apiOk(undefined),
      setDeviceAttributes: async () => apiOk(undefined),
      getTargetCustomNames: async () => apiOk(new Map()),
      setTargetCustomName: async () => apiOk(undefined),
      removeTargetCustomName: async () => apiOk(undefined),
    };

    setTargetRepository(mockRepo);
    const result = await getTargetDetailsService(['target-1']);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockDetails);
    }
  });

  it('uses the injected repository for getTargetsSummary', async () => {
    const mockSummary = {
      totalTargets: 5,
      onlineTargets: 3,
      standbyTargets: 0,
      offlineTargets: 2,
      assignedTargets: 4,
      unassignedTargets: 1,
      totalRooms: 2,
      lastUpdated: Date.now(),
    };

    const mockRepo: TargetRepository = {
      getTargets: async () => apiOk({ targets: [], summary: null, cached: false }),
      getTargetDetails: async () => apiOk([]),
      getTargetsSummary: async () => apiOk(mockSummary),
      sendDeviceCommand: async () => apiOk(undefined),
      setDeviceAttributes: async () => apiOk(undefined),
      getTargetCustomNames: async () => apiOk(new Map()),
      setTargetCustomName: async () => apiOk(undefined),
      removeTargetCustomName: async () => apiOk(undefined),
    };

    setTargetRepository(mockRepo);
    const result = await getTargetsSummaryService();
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockSummary);
    }
  });
});

describe('mergeTargetDetails', () => {
  it('keeps higher totalShots when detail returns 0', () => {
    const targets = [
      {
        id: '1',
        name: 'T',
        status: 'online' as const,
        totalShots: 425,
        battery: null,
        wifiStrength: null,
        roomId: null,
        telemetry: {},
        lastEvent: null,
        lastGameId: null,
        lastGameName: null,
        lastHits: null,
        lastActivity: null,
        lastActivityTime: null,
        deviceName: 'T',
        deviceType: 'default',
        createdTime: null,
        additionalInfo: {},
      },
    ];
    const details = [
      {
        deviceId: '1',
        status: 'online' as const,
        activityStatus: 'active' as const,
        lastShotTime: null,
        totalShots: 0,
        recentShotsCount: 0,
        telemetry: {},
      },
    ];
    const merged = mergeTargetDetails(targets, details);
    expect(merged[0].totalShots).toBe(425);
  });

  it('keeps higher totalShots when target has 0 and detail has positive value', () => {
    const targets = [
      {
        id: '1',
        name: 'T',
        status: 'online' as const,
        totalShots: 0,
        battery: null,
        wifiStrength: null,
        roomId: null,
        telemetry: {},
        lastEvent: null,
        lastGameId: null,
        lastGameName: null,
        lastHits: null,
        lastActivity: null,
        lastActivityTime: null,
        deviceName: 'T',
        deviceType: 'default',
        createdTime: null,
        additionalInfo: {},
      },
    ];
    const details = [
      {
        deviceId: '1',
        status: 'online' as const,
        activityStatus: 'active' as const,
        lastShotTime: null,
        totalShots: 500,
        recentShotsCount: 0,
        telemetry: {},
      },
    ];
    const merged = mergeTargetDetails(targets, details);
    expect(merged[0].totalShots).toBe(500);
  });

  it('returns null when both totalShots are null', () => {
    const targets = [
      {
        id: '1',
        name: 'T',
        status: 'online' as const,
        totalShots: null,
        battery: null,
        wifiStrength: null,
        roomId: null,
        telemetry: {},
        lastEvent: null,
        lastGameId: null,
        lastGameName: null,
        lastHits: null,
        lastActivity: null,
        lastActivityTime: null,
        deviceName: 'T',
        deviceType: 'default',
        createdTime: null,
        additionalInfo: {},
      },
    ];
    const details = [
      {
        deviceId: '1',
        status: 'online' as const,
        activityStatus: 'active' as const,
        lastShotTime: null,
        totalShots: null,
        recentShotsCount: 0,
        telemetry: {},
      },
    ];
    const merged = mergeTargetDetails(targets, details);
    expect(merged[0].totalShots).toBeNull();
  });
});

