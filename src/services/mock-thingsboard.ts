/**
 * Mock ThingsBoard Data Service
 * Provides placeholder data for demo mode - mimics ThingsBoard API responses
 */

export interface MockTarget {
  id: string;
  name: string;
  label?: string;
  status: 'online' | 'offline';
  type?: string;
  roomId?: string | null;
  additionalInfo?: any;
  createdTime?: number;
  lastActivityTime?: number;
}

export interface MockTelemetry {
  ts: number;
  value: any;
}

export interface MockDeviceStatus {
  deviceId: string;
  name: string;
  gameStatus: 'idle' | 'start' | 'stop';
  wifiStrength: number;
  ambientLight: 'good' | 'average' | 'poor';
  hitCount: number;
  lastSeen: number;
  isOnline: boolean;
  hitTimes: number[];
}

// Mock target devices
const MOCK_TARGETS: MockTarget[] = [
  {
    id: 'mock-target-001',
    name: 'Target Alpha',
    label: 'Front Range Target 1',
    status: 'online',
    type: 'DryFire Target',
    roomId: null,
    createdTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
    lastActivityTime: Date.now() - 5 * 60 * 1000,
    additionalInfo: { description: 'Demo target for testing' }
  },
  {
    id: 'mock-target-002',
    name: 'Target Bravo',
    label: 'Front Range Target 2',
    status: 'online',
    type: 'DryFire Target',
    roomId: null,
    createdTime: Date.now() - 25 * 24 * 60 * 60 * 1000,
    lastActivityTime: Date.now() - 10 * 60 * 1000,
    additionalInfo: { description: 'Demo target for testing' }
  },
  {
    id: 'mock-target-003',
    name: 'Target Charlie',
    label: 'Side Range Target 1',
    status: 'online',
    type: 'DryFire Target',
    roomId: null,
    createdTime: Date.now() - 20 * 24 * 60 * 60 * 1000,
    lastActivityTime: Date.now() - 15 * 60 * 1000,
    additionalInfo: { description: 'Demo target for testing' }
  },
  {
    id: 'mock-target-004',
    name: 'Target Delta',
    label: 'Side Range Target 2',
    status: 'offline',
    type: 'DryFire Target',
    roomId: null,
    createdTime: Date.now() - 15 * 24 * 60 * 60 * 1000,
    lastActivityTime: Date.now() - 2 * 24 * 60 * 60 * 1000,
    additionalInfo: { description: 'Demo target for testing' }
  },
  {
    id: 'mock-target-005',
    name: 'Target Echo',
    label: 'Back Range Target 1',
    status: 'online',
    type: 'DryFire Target',
    roomId: null,
    createdTime: Date.now() - 10 * 24 * 60 * 60 * 1000,
    lastActivityTime: Date.now() - 3 * 60 * 1000,
    additionalInfo: { description: 'Demo target for testing' }
  },
  {
    id: 'mock-target-006',
    name: 'Target Foxtrot',
    label: 'Back Range Target 2',
    status: 'online',
    type: 'DryFire Target',
    roomId: null,
    createdTime: Date.now() - 5 * 24 * 60 * 60 * 1000,
    lastActivityTime: Date.now() - 1 * 60 * 1000,
    additionalInfo: { description: 'Demo target for testing' }
  }
];

class MockThingsBoardService {
  private targets: MockTarget[] = [...MOCK_TARGETS];
  private telemetryStore: Map<string, Map<string, MockTelemetry[]>> = new Map();

  /**
   * Get all targets (devices)
   */
  getTargets(): MockTarget[] {
    console.log('🎭 DEMO: Fetching mock targets');
    return this.targets.map(t => ({ ...t }));
  }

  /**
   * Get a specific target by ID
   */
  getTarget(deviceId: string): MockTarget | null {
    console.log(`🎭 DEMO: Fetching mock target ${deviceId}`);
    const target = this.targets.find(t => t.id === deviceId);
    return target ? { ...target } : null;
  }

  /**
   * Get device status for game flow
   */
  getDeviceStatus(deviceId: string): MockDeviceStatus | null {
    const target = this.getTarget(deviceId);
    if (!target) return null;

    return {
      deviceId: target.id,
      name: target.name,
      gameStatus: 'idle',
      wifiStrength: target.status === 'online' ? 85 : 0,
      ambientLight: target.status === 'online' ? 'good' : 'poor',
      hitCount: 0,
      lastSeen: target.status === 'online' ? Date.now() : 0,
      isOnline: target.status === 'online',
      hitTimes: []
    };
  }

  /**
   * Get all device statuses for game flow
   */
  getAllDeviceStatuses(): MockDeviceStatus[] {
    console.log('🎭 DEMO: Fetching all mock device statuses');
    return this.targets.map(t => this.getDeviceStatus(t.id)!).filter(Boolean);
  }

  /**
   * Get latest telemetry for a device
   */
  getLatestTelemetry(deviceId: string, keys: string[]): Record<string, MockTelemetry[]> {
    console.log(`🎭 DEMO: Fetching mock telemetry for ${deviceId}`, keys);
    
    const result: Record<string, MockTelemetry[]> = {};
    const deviceTelemetry = this.telemetryStore.get(deviceId) || new Map();
    
    keys.forEach(key => {
      const values = deviceTelemetry.get(key) || [];
      result[key] = values.length > 0 ? values : this.generateDefaultTelemetry(key);
    });
    
    return result;
  }

  /**
   * Generate default telemetry values for demo
   */
  private generateDefaultTelemetry(key: string): MockTelemetry[] {
    const now = Date.now();
    switch (key) {
      case 'hits':
      case 'hitCount':
        return [{ ts: now, value: Math.floor(Math.random() * 50) }];
      case 'status':
      case 'active':
        return [{ ts: now, value: true }];
      case 'wifiStrength':
        return [{ ts: now, value: 75 + Math.floor(Math.random() * 25) }];
      case 'ambientLight':
        return [{ ts: now, value: 'good' }];
      default:
        return [{ ts: now, value: 0 }];
    }
  }

  /**
   * Set telemetry value (for simulation)
   */
  setTelemetry(deviceId: string, key: string, value: any): void {
    if (!this.telemetryStore.has(deviceId)) {
      this.telemetryStore.set(deviceId, new Map());
    }
    const deviceTelemetry = this.telemetryStore.get(deviceId)!;
    
    const existing = deviceTelemetry.get(key) || [];
    existing.push({ ts: Date.now(), value });
    
    // Keep only last 100 values
    if (existing.length > 100) {
      existing.shift();
    }
    
    deviceTelemetry.set(key, existing);
  }

  /**
   * Update target status
   */
  updateTargetStatus(deviceId: string, status: 'online' | 'offline'): void {
    const target = this.targets.find(t => t.id === deviceId);
    if (target) {
      target.status = status;
      target.lastActivityTime = Date.now();
    }
  }

  /**
   * Assign target to room
   */
  assignTargetToRoom(deviceId: string, roomId: string | null): void {
    console.log(`🎭 DEMO: Assigning target ${deviceId} to room ${roomId}`);
    const target = this.targets.find(t => t.id === deviceId);
    if (target) {
      target.roomId = roomId;
      if (target.additionalInfo) {
        target.additionalInfo.roomId = roomId;
      } else {
        target.additionalInfo = { roomId };
      }
    }
  }

  /**
   * Get targets by room
   */
  getTargetsByRoom(roomId: string): MockTarget[] {
    return this.targets.filter(t => t.roomId === roomId);
  }

  /**
   * Get unassigned targets
   */
  getUnassignedTargets(): MockTarget[] {
    return this.targets.filter(t => !t.roomId || t.roomId === null);
  }

  /**
   * Reset all data to initial state
   */
  reset(): void {
    console.log('🎭 DEMO: Resetting mock ThingsBoard data');
    this.targets = [...MOCK_TARGETS];
    this.telemetryStore.clear();
  }
}

// Export singleton instance
export const mockThingsBoardService = new MockThingsBoardService();

