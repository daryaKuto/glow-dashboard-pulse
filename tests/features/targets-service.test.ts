import { describe, it, expect, afterEach } from 'vitest';
import { apiOk } from '../../src/shared/lib/api-response';
import { targetsRepository } from '../../src/features/targets/repo';
import {
  getTargetsWithTelemetry,
  getTargetDetailsService,
  getTargetsSummaryService,
  setTargetRepository,
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

