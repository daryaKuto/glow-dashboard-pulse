import { describe, it, expect, afterEach } from 'vitest';
import { apiOk } from '../../src/shared/lib/api-response';
import { targetsRepository } from '../../src/features/targets/repo';
import { getTargetsWithTelemetry, setTargetRepository } from '../../src/features/targets/service';
import type { TargetRepository } from '../../src/domain/targets/ports';

describe('targets adapter conformance', () => {
  afterEach(() => {
    // Restore the real repository after each test
    setTargetRepository(targetsRepository);
  });

  it('mock repository satisfies TargetRepository interface', async () => {
    // Create a mock that satisfies the full interface
    const mockRepo: TargetRepository = {
      getTargets: async () => apiOk({
        targets: [],
        summary: null,
        cached: false,
      }),
      getTargetDetails: async () => apiOk([]),
      getTargetsSummary: async () => apiOk(null),
      sendDeviceCommand: async () => apiOk(undefined),
      setDeviceAttributes: async () => apiOk(undefined),
      getTargetCustomNames: async () => apiOk(new Map()),
      setTargetCustomName: async () => apiOk(undefined),
      removeTargetCustomName: async () => apiOk(undefined),
    };

    // Inject the mock
    setTargetRepository(mockRepo);

    // Verify the service uses the injected repository
    const result = await getTargetsWithTelemetry();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targets).toEqual([]);
      expect(result.data.cached).toBe(false);
    }
  });

  it('mock repository with sample data works correctly', async () => {
    const sampleTarget = {
      id: 'target-123',
      name: 'Test Target',
      status: 'online' as const,
      battery: 85,
      wifiStrength: -45,
      roomId: 'room-1',
      roomName: 'Living Room',
      telemetry: {},
      lastEvent: null,
      lastGameId: null,
      lastGameName: null,
      lastHits: null,
      lastActivity: null,
      lastActivityTime: null,
      deviceName: 'DryFire Target',
      deviceType: 'target',
      createdTime: Date.now(),
      additionalInfo: {},
    };

    const mockRepo: TargetRepository = {
      getTargets: async () => apiOk({
        targets: [sampleTarget],
        summary: {
          totalTargets: 1,
          onlineTargets: 1,
          standbyTargets: 0,
          offlineTargets: 0,
          assignedTargets: 1,
          unassignedTargets: 0,
          totalRooms: 1,
          lastUpdated: Date.now(),
        },
        cached: true,
      }),
      getTargetDetails: async () => apiOk([{
        deviceId: 'target-123',
        status: 'online' as const,
        activityStatus: 'active' as const,
        lastShotTime: Date.now(),
        totalShots: 100,
        recentShotsCount: 5,
        telemetry: { battery: 85 },
      }]),
      getTargetsSummary: async () => apiOk({
        totalTargets: 1,
        onlineTargets: 1,
        standbyTargets: 0,
        offlineTargets: 0,
        assignedTargets: 1,
        unassignedTargets: 0,
        totalRooms: 1,
        lastUpdated: Date.now(),
      }),
      sendDeviceCommand: async () => apiOk(undefined),
      setDeviceAttributes: async () => apiOk(undefined),
      getTargetCustomNames: async () => apiOk(new Map([['target-123', 'My Target']])),
      setTargetCustomName: async () => apiOk(undefined),
      removeTargetCustomName: async () => apiOk(undefined),
    };

    setTargetRepository(mockRepo);

    const result = await getTargetsWithTelemetry();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targets).toHaveLength(1);
      expect(result.data.targets[0].id).toBe('target-123');
      expect(result.data.summary?.totalTargets).toBe(1);
    }
  });

  it('real repository exports match interface', () => {
    // Verify the real repository has all required methods
    expect(typeof targetsRepository.getTargets).toBe('function');
    expect(typeof targetsRepository.getTargetDetails).toBe('function');
    expect(typeof targetsRepository.getTargetsSummary).toBe('function');
    expect(typeof targetsRepository.sendDeviceCommand).toBe('function');
    expect(typeof targetsRepository.setDeviceAttributes).toBe('function');
    expect(typeof targetsRepository.getTargetCustomNames).toBe('function');
    expect(typeof targetsRepository.setTargetCustomName).toBe('function');
    expect(typeof targetsRepository.removeTargetCustomName).toBe('function');
  });
});



