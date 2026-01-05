/**
 * @deprecated Legacy implementation.
 * Replaced by: src/features/games/hooks/use-game-telemetry.ts,
 * src/features/games/lib/device-game-flow.ts (live telemetry flow).
 */

import { DeviceStatus, GameSession, GameHistory, DeviceGameEvent } from '../../features/games/lib/device-game-flow';

class DemoGameFlowService {
  private activeSessions: Map<string, GameSession> = new Map();
  private deviceStatuses: Map<string, DeviceStatus> = new Map();
  private eventCallbacks: Map<string, (event: DeviceGameEvent) => void> = new Map();
  private gameIntervals: Map<string, NodeJS.Timeout> = new Map();
  private hitSimulationIntervals: Map<string, NodeJS.Timeout> = new Map();

  // Mock devices for demo mode
  private mockDevices: DeviceStatus[] = [
    {
      deviceId: 'demo-target-alpha',
      name: 'Training Target Alpha',
      gameStatus: 'idle',
      wifiStrength: 95,
      ambientLight: 'good',
      hitCount: 0,
      lastSeen: Date.now(),
      isOnline: true
    },
    {
      deviceId: 'demo-target-beta',
      name: 'Training Target Beta', 
      gameStatus: 'idle',
      wifiStrength: 87,
      ambientLight: 'good',
      hitCount: 0,
      lastSeen: Date.now(),
      isOnline: true
    },
    {
      deviceId: 'demo-target-gamma',
      name: 'Training Target Gamma',
      gameStatus: 'idle',
      wifiStrength: 72,
      ambientLight: 'average',
      hitCount: 0,
      lastSeen: Date.now(),
      isOnline: true
    },
    {
      deviceId: 'demo-target-delta',
      name: 'Training Target Delta',
      gameStatus: 'idle',
      wifiStrength: 0,
      ambientLight: 'poor',
      hitCount: 0,
      lastSeen: 0,
      isOnline: false
    }
  ];

  /**
   * Get mock devices for demo mode
   */
  getMockDevices(): DeviceStatus[] {
    return [...this.mockDevices];
  }

  /**
   * Simulate device configuration
   */
  async configureDevices(
    deviceIds: string[],
    gameId: string,
    gameDuration: number
  ): Promise<{ success: string[], failed: string[] }> {
    console.log(`🎭 DEMO: Configuring ${deviceIds.length} devices for game ${gameId}`);
    
    const results = { success: [] as string[], failed: [] as string[] };
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    for (const deviceId of deviceIds) {
      const device = this.mockDevices.find(d => d.deviceId === deviceId);
      
      if (device && device.isOnline) {
        // Simulate successful configuration
        device.gameStatus = 'idle';
        device.lastSeen = Date.now();
        this.deviceStatuses.set(deviceId, { ...device });
        
        // Simulate device response
        const responseEvent: DeviceGameEvent = {
          ts: Math.floor(Date.now() / 1000),
          values: {
            deviceId,
            event: 'info',
            gameId,
            gameStatus: 'idle',
            wifiStrength: device.wifiStrength,
            ambientLight: device.ambientLight
          }
        };
        
        // Trigger callback after short delay
        setTimeout(() => {
          const callback = this.eventCallbacks.get(deviceId);
          if (callback) {
            callback(responseEvent);
          }
        }, 500);
        
        results.success.push(deviceId);
        console.log(`✅ DEMO: Device ${deviceId} configured successfully`);
      } else {
        results.failed.push(deviceId);
        console.log(`❌ DEMO: Device ${deviceId} configuration failed (offline)`);
      }
    }
    
    return results;
  }

  /**
   * Simulate game start
   */
  async startGame(
    deviceIds: string[],
    gameId: string
  ): Promise<{ success: string[], failed: string[] }> {
    console.log(`🚀 DEMO: Starting game ${gameId} on ${deviceIds.length} devices`);
    
    const results = { success: [] as string[], failed: [] as string[] };
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    for (const deviceId of deviceIds) {
      const device = this.deviceStatuses.get(deviceId);
      
      if (device && device.isOnline) {
        // Update device status to active
        device.gameStatus = 'start';
        device.hitCount = 0;
        device.lastSeen = Date.now();
        
        // Simulate device start response
        const responseEvent: DeviceGameEvent = {
          ts: Math.floor(Date.now() / 1000),
          values: {
            deviceId,
            event: 'start',
            gameId,
            gameStatus: 'start'
          }
        };
        
        // Trigger callback
        setTimeout(() => {
          const callback = this.eventCallbacks.get(deviceId);
          if (callback) {
            callback(responseEvent);
          }
        }, 300);
        
        // Start simulating hits for this device
        this.startHitSimulation(deviceId, gameId);
        
        results.success.push(deviceId);
        console.log(`✅ DEMO: Game started on device ${deviceId}`);
      } else {
        results.failed.push(deviceId);
        console.log(`❌ DEMO: Failed to start game on device ${deviceId}`);
      }
    }
    
    return results;
  }

  /**
   * Simulate game stop
   */
  async stopGame(
    deviceIds: string[],
    gameId: string
  ): Promise<{ success: string[], failed: string[] }> {
    console.log(`🛑 DEMO: Stopping game ${gameId} on ${deviceIds.length} devices`);
    
    const results = { success: [] as string[], failed: [] as string[] };
    
    // Stop hit simulations
    deviceIds.forEach(deviceId => {
      this.stopHitSimulation(deviceId);
    });
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    for (const deviceId of deviceIds) {
      const device = this.deviceStatuses.get(deviceId);
      
      if (device) {
        // Simulate device stop response with final hit count
        const responseEvent: DeviceGameEvent = {
          ts: Math.floor(Date.now() / 1000),
          values: {
            deviceId,
            gameId,
            event: 'stop',
            hitCount: device.hitCount
          }
        };
        
        device.gameStatus = 'stop';
        device.lastSeen = Date.now();
        
        // Trigger callback
        setTimeout(() => {
          const callback = this.eventCallbacks.get(deviceId);
          if (callback) {
            callback(responseEvent);
          }
        }, 200);
        
        results.success.push(deviceId);
        console.log(`✅ DEMO: Game stopped on device ${deviceId}, final hits: ${device.hitCount}`);
      }
    }
    
    return results;
  }

  /**
   * Simulate periodic info requests
   */
  startPeriodicInfoRequests(deviceIds: string[], gameId: string): NodeJS.Timeout {
    console.log(`⏰ DEMO: Starting periodic info requests for game ${gameId}`);
    
    return setInterval(() => {
      deviceIds.forEach(deviceId => {
        const device = this.deviceStatuses.get(deviceId);
        if (device && device.isOnline) {
          // Simulate info response with slight WiFi fluctuation
          const wifiVariation = Math.floor(Math.random() * 10) - 5;
          const newWifiStrength = Math.max(0, Math.min(100, device.wifiStrength + wifiVariation));
          
          device.wifiStrength = newWifiStrength;
          device.lastSeen = Date.now();
          
          const infoEvent: DeviceGameEvent = {
            ts: Math.floor(Date.now() / 1000),
            values: {
              deviceId,
              event: 'info',
              gameId,
              gameStatus: device.gameStatus,
              wifiStrength: newWifiStrength,
              ambientLight: device.ambientLight
            }
          };
          
          const callback = this.eventCallbacks.get(deviceId);
          if (callback) {
            callback(infoEvent);
          }
        }
      });
    }, 5000); // Every 5 seconds as per documentation
  }

  /**
   * Stop periodic info requests
   */
  stopPeriodicInfoRequests(intervalId: NodeJS.Timeout): void {
    console.log(`⏰ DEMO: Stopping periodic info requests`);
    clearInterval(intervalId);
  }

  /**
   * Start simulating hits for a device
   */
  private startHitSimulation(deviceId: string, gameId: string): void {
    const device = this.deviceStatuses.get(deviceId);
    if (!device) return;

    // Random hit frequency (every 2-8 seconds)
    const hitInterval = setInterval(() => {
      if (device.gameStatus === 'start') {
        device.hitCount += 1;
        device.lastSeen = Date.now();
        
        const hitEvent: DeviceGameEvent = {
          ts: Math.floor(Date.now() / 1000),
          values: {
            deviceId,
            gameId,
            event: 'hit'
          }
        };
        
        const callback = this.eventCallbacks.get(deviceId);
        if (callback) {
          callback(hitEvent);
        }
        
        console.log(`🎯 DEMO: Hit registered on ${deviceId}, total: ${device.hitCount}`);
      }
    }, Math.random() * 6000 + 2000); // 2-8 seconds
    
    this.hitSimulationIntervals.set(deviceId, hitInterval);
  }

  /**
   * Stop hit simulation for a device
   */
  private stopHitSimulation(deviceId: string): void {
    const interval = this.hitSimulationIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.hitSimulationIntervals.delete(deviceId);
    }
  }

  /**
   * Create game session
   */
  createGameSession(
    gameId: string,
    gameName: string,
    duration: number,
    deviceIds: string[]
  ): GameSession {
    console.log(`🎮 DEMO: Creating game session ${gameId}`);
    
    const devices = deviceIds.map(id => {
      const mockDevice = this.mockDevices.find(d => d.deviceId === id);
      return mockDevice ? { ...mockDevice } : {
        deviceId: id,
        name: `Demo Device ${id}`,
        gameStatus: 'idle' as const,
        wifiStrength: 85,
        ambientLight: 'good' as const,
        hitCount: 0,
        lastSeen: Date.now(),
        isOnline: true
      };
    });

    const session: GameSession = {
      gameId,
      gameName,
      duration,
      devices,
      startTime: Date.now(),
      status: 'configuring'
    };

    this.activeSessions.set(gameId, session);
    
    // Initialize device statuses
    devices.forEach(device => {
      this.deviceStatuses.set(device.deviceId, { ...device });
    });

    return session;
  }

  /**
   * Get game session
   */
  getGameSession(gameId: string): GameSession | undefined {
    return this.activeSessions.get(gameId);
  }

  /**
   * Update game session status
   */
  updateGameSessionStatus(gameId: string, status: GameSession['status']): void {
    const session = this.activeSessions.get(gameId);
    if (session) {
      session.status = status;
      if (status === 'stopped' || status === 'completed') {
        session.endTime = Date.now();
      }
      console.log(`🎮 DEMO: Game ${gameId} status updated to: ${status}`);
    }
  }

  /**
   * Subscribe to device events (mock)
   */
  subscribeToDeviceEvents(
    deviceId: string,
    callback: (event: DeviceGameEvent) => void
  ): void {
    console.log(`📡 DEMO: Subscribing to events for device ${deviceId}`);
    this.eventCallbacks.set(deviceId, callback);
    
    // Simulate initial connect event
    setTimeout(() => {
      const device = this.deviceStatuses.get(deviceId);
      if (device) {
        const connectEvent: DeviceGameEvent = {
          ts: Math.floor(Date.now() / 1000),
          values: {
            deviceId,
            event: 'connect',
            wifiStrength: device.wifiStrength,
            ambientLight: device.ambientLight
          }
        };
        callback(connectEvent);
      }
    }, 100);
  }

  /**
   * Unsubscribe from device events
   */
  unsubscribeFromDeviceEvents(deviceId: string): void {
    console.log(`📡 DEMO: Unsubscribing from events for device ${deviceId}`);
    this.eventCallbacks.delete(deviceId);
    this.stopHitSimulation(deviceId);
  }

  /**
   * Get device status
   */
  getDeviceStatus(deviceId: string): DeviceStatus | undefined {
    return this.deviceStatuses.get(deviceId);
  }

  /**
   * Get all device statuses
   */
  getAllDeviceStatuses(): DeviceStatus[] {
    return Array.from(this.deviceStatuses.values());
  }

  /**
   * Simulate game timeout
   */
  simulateGameTimeout(gameId: string, deviceIds: string[], durationMs: number): void {
    console.log(`⏰ DEMO: Setting up game timeout for ${durationMs}ms`);
    
    const timeoutId = setTimeout(() => {
      console.log(`⏰ DEMO: Game ${gameId} timed out`);
      
      deviceIds.forEach(deviceId => {
        const device = this.deviceStatuses.get(deviceId);
        if (device && device.gameStatus === 'start') {
          // Stop hit simulation
          this.stopHitSimulation(deviceId);
          
          // Send timeout event
          const timeoutEvent: DeviceGameEvent = {
            ts: Math.floor(Date.now() / 1000),
            values: {
              deviceId,
              gameId,
              event: 'timeout',
              hitCount: device.hitCount
            }
          };
          
          device.gameStatus = 'stop';
          device.lastSeen = Date.now();
          
          const callback = this.eventCallbacks.get(deviceId);
          if (callback) {
            callback(timeoutEvent);
          }
        }
      });
      
      // Update session status
      this.updateGameSessionStatus(gameId, 'completed');
    }, durationMs);
    
    this.gameIntervals.set(gameId, timeoutId);
  }

  /**
   * Clean up demo resources
   */
  cleanup(): void {
    console.log('🧹 DEMO: Cleaning up demo game flow');
    
    // Clear all intervals
    this.gameIntervals.forEach(interval => clearInterval(interval));
    this.hitSimulationIntervals.forEach(interval => clearInterval(interval));
    
    // Clear maps
    this.gameIntervals.clear();
    this.hitSimulationIntervals.clear();
    this.eventCallbacks.clear();
    this.activeSessions.clear();
    this.deviceStatuses.clear();
  }
}

// Create singleton instance
export const demoGameFlowService = new DemoGameFlowService();

export default demoGameFlowService;
