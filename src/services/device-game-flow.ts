import { fetchGameControlDevices, fetchGameControlInfo, invokeGameControl, type GameControlDevice } from '@/lib/edge';
import { subscribeToGameTelemetry, type TelemetryEnvelope } from '@/services/gameTelemetry';

// Device Game Flow Types based on DeviceManagement.md
export interface DeviceGameEvent {
  ts: number;
  values: {
    deviceId: string;
    event: 'connect' | 'hit' | 'info' | 'timeout' | 'stop' | 'disconnect';
    gameId?: string;
    gameStatus?: 'idle' | 'start' | 'stop';
    wifiStrength?: number;
    ambientLight?: 'good' | 'average' | 'poor';
    hitCount?: number;
  };
}

export interface DeviceStatus {
  deviceId: string;
  name: string;
  gameStatus: 'idle' | 'start' | 'stop' | 'offline';
  wifiStrength: number;
  ambientLight: 'good' | 'average' | 'poor';
  hitCount: number;
  lastSeen: number;
  isOnline: boolean;
  hitTimes?: number[]; // Array of timestamps when hits occurred
}

export interface GameSession {
  gameId: string;
  gameName: string;
  duration: number; // in minutes
  devices: DeviceStatus[];
  startTime: number;
  endTime?: number;
  status: 'configuring' | 'active' | 'stopped' | 'completed';
}

export interface SessionSplit {
  deviceId: string;
  deviceName: string;
  splitNumber: number;
  time: number;
  timestamp?: number | null;
}

export interface SessionTransition {
  fromDevice: string;
  toDevice: string;
  transitionNumber: number;
  time: number;
}

export interface SessionHitRecord {
  deviceId: string;
  deviceName: string;
  timestamp: number;
  gameId: string;
}

export interface GameHistory {
  gameId: string;
  gameName: string;
  duration: number;
  startTime: number;
  endTime: number;
  score?: number | null;
  accuracy?: number | null;
  scenarioName?: string | null;
  scenarioType?: string | null;
  roomName?: string | null;
  roomId?: string | null;
  desiredDurationSeconds?: number | null;
  presetId?: string | null;
  targetDeviceIds?: string[];
  targetDeviceNames?: string[];
  deviceResults: Array<{
    deviceId: string;
    deviceName: string;
    hitCount: number;
  }>;
  // Detailed statistics
  totalHits: number;
  actualDuration: number; // Actual game duration in seconds
  averageHitInterval: number | null;
  targetStats: Array<{
    deviceId: string;
    deviceName: string;
    hitCount: number;
    hitTimes: number[];
    averageInterval: number;
    firstHitTime: number;
    lastHitTime: number;
  }>;
  crossTargetStats: {
    totalSwitches: number;
    averageSwitchTime: number;
    switchTimes: number[];
  } | null;
  splits?: SessionSplit[];
  transitions?: SessionTransition[];
  hitHistory?: SessionHitRecord[];
  goalShotsPerTarget?: Record<string, number>;
}

export type GameCommandWarning = { deviceId: string; warning: string };

type GameCommandSummary = {
  success: string[];
  failed: string[];
  warnings: GameCommandWarning[];
  startedAt?: number;
  stoppedAt?: number;
  gameId: string;
};

class DeviceGameFlowService {
  private activeSessions: Map<string, GameSession> = new Map();
  private deviceStatuses: Map<string, DeviceStatus> = new Map();
  private telemetrySubscriptions: Map<string, () => void> = new Map();
  private eventCallbacks: Map<string, (event: DeviceGameEvent) => void> = new Map();

  seedDeviceStatuses(deviceStatuses: DeviceStatus[]): void {
    deviceStatuses.forEach((status) => {
      this.deviceStatuses.set(status.deviceId, {
        ...status,
        hitTimes: status.hitTimes ? [...status.hitTimes] : [],
      });
    });
  }

  /**
   * Configure devices for a game session
   * According to DeviceManagement.md: Press Create Game Button action
   */
  async configureDevices(
    deviceIds: string[], 
    gameId: string, 
    gameDuration: number
  ): Promise<{ success: string[], failed: string[]; warnings: GameCommandWarning[] }> {
    console.log(`🎮 Preparing ${deviceIds.length} devices for game ${gameId} (${gameDuration} min)`);
    const results = { success: [] as string[], failed: [] as string[] };
    const warnings: GameCommandWarning[] = [];

    try {
      const { devices } = await fetchGameControlDevices();
      const deviceMap = new Map<string, GameControlDevice>(devices.map((device) => [device.deviceId, device]));
      const now = Date.now();

      deviceIds.forEach((deviceId) => {
        const device = deviceMap.get(deviceId);
        if (!device || !device.isOnline) {
          results.failed.push(deviceId);
          return;
        }

        const existingStatus = this.deviceStatuses.get(deviceId);
        this.deviceStatuses.set(deviceId, {
          deviceId,
          name: device.name ?? existingStatus?.name ?? `Device ${deviceId}`,
          gameStatus: 'idle',
          wifiStrength: device.wifiStrength ?? existingStatus?.wifiStrength ?? 0,
          ambientLight: (device.ambientLight as DeviceStatus['ambientLight']) ?? existingStatus?.ambientLight ?? 'good',
          hitCount: device.hitCount ?? existingStatus?.hitCount ?? 0,
          lastSeen: device.lastSeen ?? now,
          isOnline: true,
          hitTimes: existingStatus?.hitTimes ? [...existingStatus.hitTimes] : [],
        });

        results.success.push(deviceId);
      });
    } catch (error) {
      console.error('❌ Failed to load device statuses from edge function:', error);
      results.failed.push(...deviceIds);
    }

    if (results.success.length > 0) {
      try {
        const response = await invokeGameControl('configure', {
          deviceIds: results.success,
          gameId,
          gameDuration,
        });

        if (Array.isArray(response.results) && response.results.length > 0) {
          response.results.forEach((commandResult) => {
            if (!commandResult.success) {
              if (!results.failed.includes(commandResult.deviceId)) {
                results.failed.push(commandResult.deviceId);
              }
              results.success = results.success.filter((id) => id !== commandResult.deviceId);
            }
            if (commandResult.warning) {
              const warningEntry: GameCommandWarning = { deviceId: commandResult.deviceId, warning: commandResult.warning };
              warnings.push(warningEntry);
              console.warn(`⚠️ configure RPC warning for ${commandResult.deviceId}: ${commandResult.warning}`);
            }
          });
        } else if ((response.failureCount ?? 0) > 0) {
          results.failed.push(...results.success);
          results.success = [];
        }
      } catch (error) {
        console.error('❌ Failed to configure devices via edge function:', error);
        results.failed.push(...results.success);
        results.success = [];
      }
    }

    console.log(`🎮 Configuration results: ${results.success.length} success, ${results.failed.length} failed, ${warnings.length} warnings`);
    return { ...results, warnings };
  }

  /**
   * Start game on configured devices
   * According to DeviceManagement.md: Press Start Game Button action
   */
  async startGame(
    deviceIds: string[], 
    gameId: string
  ): Promise<GameCommandSummary> {
    console.log(`🚀 Starting game ${gameId} on ${deviceIds.length} devices`);
    const now = Date.now();
    const summary: GameCommandSummary = {
      success: [],
      failed: [],
      warnings: [],
      gameId,
      startedAt: now,
    };

    try {
      const response = await invokeGameControl('start', { deviceIds, gameId });
      const commandResults = response.results ?? [];

      if (commandResults.length > 0) {
        commandResults.forEach((commandResult) => {
          if (commandResult.success) {
            summary.success.push(commandResult.deviceId);
            const deviceStatus = this.deviceStatuses.get(commandResult.deviceId);
            if (deviceStatus) {
              this.deviceStatuses.set(commandResult.deviceId, {
                ...deviceStatus,
                gameStatus: 'start',
                hitCount: 0,
                lastSeen: now,
                hitTimes: [],
              });
            }
            if (commandResult.warning) {
              summary.warnings.push({ deviceId: commandResult.deviceId, warning: commandResult.warning });
            }
          } else {
            summary.failed.push(commandResult.deviceId);
          }
        });
      } else if ((response.failureCount ?? 0) > 0) {
        summary.failed.push(...deviceIds);
      } else {
        summary.success.push(...deviceIds);
        deviceIds.forEach((deviceId) => {
          const deviceStatus = this.deviceStatuses.get(deviceId);
          if (deviceStatus) {
            this.deviceStatuses.set(deviceId, {
              ...deviceStatus,
              gameStatus: 'start',
              hitCount: 0,
              lastSeen: now,
              hitTimes: [],
            });
          }
        });
      }

      if (Array.isArray(response.warnings)) {
        response.warnings.forEach((entry) => {
          if (entry?.deviceId && entry.warning) {
            summary.warnings.push({ deviceId: entry.deviceId, warning: entry.warning });
          }
        });
      }

      summary.startedAt = response.startedAt ?? now;
      summary.gameId = response.gameId ?? gameId;
    } catch (error) {
      console.error('❌ Failed to start game via edge function:', error);
      summary.failed.push(...deviceIds);
    }

    console.log(`🚀 Start results: ${summary.success.length} success, ${summary.failed.length} failed`);
    return summary;
  }

  /**
   * Stop game on devices
   */
  async stopGame(
    deviceIds: string[], 
    gameId: string
  ): Promise<GameCommandSummary> {
    const now = Date.now();
    const summary: GameCommandSummary = {
      success: [],
      failed: [],
      warnings: [],
      gameId,
      stoppedAt: now,
    };

    try {
      const response = await invokeGameControl('stop', { deviceIds, gameId });
      const commandResults = response.results ?? [];

      if (commandResults.length > 0) {
        commandResults.forEach((commandResult) => {
          if (commandResult.success) {
            summary.success.push(commandResult.deviceId);
            const deviceStatus = this.deviceStatuses.get(commandResult.deviceId);
            if (deviceStatus) {
              this.deviceStatuses.set(commandResult.deviceId, {
                ...deviceStatus,
                gameStatus: 'stop',
                lastSeen: now,
              });
            }
            if (commandResult.warning) {
              summary.warnings.push({ deviceId: commandResult.deviceId, warning: commandResult.warning });
            }
          } else {
            summary.failed.push(commandResult.deviceId);
          }
        });
      } else if ((response.failureCount ?? 0) > 0) {
        summary.failed.push(...deviceIds);
      } else {
        summary.success.push(...deviceIds);
        deviceIds.forEach((deviceId) => {
          const deviceStatus = this.deviceStatuses.get(deviceId);
          if (deviceStatus) {
            this.deviceStatuses.set(deviceId, {
              ...deviceStatus,
              gameStatus: 'stop',
              lastSeen: now,
            });
          }
        });
      }

      if (Array.isArray(response.warnings)) {
        response.warnings.forEach((entry) => {
          if (entry?.deviceId && entry.warning) {
            summary.warnings.push({ deviceId: entry.deviceId, warning: entry.warning });
          }
        });
      }

      summary.stoppedAt = response.stoppedAt ?? now;
      summary.gameId = response.gameId ?? gameId;
    } catch (error) {
      console.error('❌ Failed to stop game via edge function:', error);
      summary.failed.push(...deviceIds);
    }

    return summary;
  }

  /**
   * Request device info (alive packet)
   * According to DeviceManagement.md: Periodic Info Request (While Game is Active)
   */
  async requestDeviceInfo(deviceIds: string[], gameId?: string): Promise<void> {
    try {
      if (deviceIds.length === 0) {
        return;
      }
      const response = await fetchGameControlInfo(deviceIds);
      const infoAt = response.infoAt ?? Date.now();
      const infoById = new Map<string, Record<string, unknown>>();

      for (const result of response.results ?? []) {
        if (result?.success) {
          infoById.set(result.deviceId, (result.data ?? {}) as Record<string, unknown>);
        }
      }

      if (infoById.size === 0) {
        return;
      }

      deviceIds.forEach((deviceId) => {
        const status = this.deviceStatuses.get(deviceId);
        if (!status) {
          return;
        }

        const info = infoById.get(deviceId);
        if (!info) {
          return;
        }

        let wifiStrength = status.wifiStrength;
        if (typeof info.wifiStrength === 'number') {
          wifiStrength = Math.max(0, Math.round(info.wifiStrength));
        } else if (typeof info.wifiStrength === 'string') {
          const numeric = Number(info.wifiStrength);
          if (Number.isFinite(numeric)) {
            wifiStrength = Math.max(0, Math.round(numeric));
          }
        }

        let ambientLight = status.ambientLight;
        if (typeof info.ambientLight === 'string') {
          const light = info.ambientLight.toLowerCase();
          if (light === 'good' || light === 'average' || light === 'poor') {
            ambientLight = light as DeviceStatus['ambientLight'];
          }
        }

        let gameStatus = status.gameStatus;
        const statusSource = typeof info.gameStatus === 'string'
          ? info.gameStatus
          : typeof info.status === 'string'
            ? info.status
            : null;

        if (statusSource) {
          const lowered = statusSource.toLowerCase();
          if (lowered === 'start' || lowered === 'busy') {
            gameStatus = 'start';
          } else if (lowered === 'stop') {
            gameStatus = 'stop';
          } else if (lowered === 'idle') {
            gameStatus = 'idle';
          }
        }

        const isOnline = typeof info.isOnline === 'boolean' ? info.isOnline : status.isOnline;
        const lastSeen = typeof info.lastSeen === 'number' ? info.lastSeen : infoAt;
        const hitCount = typeof info.hitCount === 'number'
          ? info.hitCount
          : typeof info.hits === 'number'
            ? info.hits
            : status.hitCount;

        this.deviceStatuses.set(deviceId, {
          ...status,
          wifiStrength,
          ambientLight,
          hitCount: Number.isFinite(hitCount) ? hitCount : status.hitCount,
          gameStatus,
          lastSeen,
          isOnline,
        });
      });
    } catch (error) {
      console.error('❌ Failed to refresh device info from edge function:', error);
    }
  }

  /**
   * Start periodic info requests during active games
   * According to DeviceManagement.md: Every 5 seconds by the Rule Engine
   */
  startPeriodicInfoRequests(deviceIds: string[], gameId: string): NodeJS.Timeout {
    console.log(`⏰ Starting periodic info requests for game ${gameId}`);
    
    return setInterval(() => {
      this.requestDeviceInfo(deviceIds, gameId);
    }, 5000); // Every 5 seconds as per documentation
  }

  /**
   * Stop periodic info requests
   */
  stopPeriodicInfoRequests(intervalId: NodeJS.Timeout): void {
    console.log(`⏰ Stopping periodic info requests`);
    clearInterval(intervalId);
  }

  /**
   * Create a new game session
   */
  createGameSession(
    gameId: string, 
    gameName: string, 
    duration: number, 
    deviceIds: string[]
  ): GameSession {
    const sessionDevices = deviceIds.map((id) => {
      const existing = this.deviceStatuses.get(id);
      if (existing) {
        return {
          ...existing,
          gameStatus: 'idle',
          hitCount: existing.hitCount ?? 0,
          hitTimes: existing.hitTimes ? [...existing.hitTimes] : [],
        };
      }
      return {
        deviceId: id,
        name: `Device ${id}`,
        gameStatus: 'idle' as const,
        wifiStrength: 0,
        ambientLight: 'good' as const,
        hitCount: 0,
        lastSeen: 0,
        isOnline: false,
        hitTimes: [],
      };
    });

    const session: GameSession = {
      gameId,
      gameName,
      duration,
      devices: sessionDevices,
      startTime: Date.now(),
      status: 'configuring'
    };

    this.activeSessions.set(gameId, session);
    return session;
  }

  /**
   * Get active game session
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
    }
  }

  /**
   * Subscribe to device telemetry events
   */
  subscribeToDeviceEvents(
    deviceId: string, 
    callback: (event: DeviceGameEvent) => void
  ): void {
    this.eventCallbacks.set(deviceId, callback);

    if (this.telemetrySubscriptions.has(deviceId)) {
      return;
    }

    const unsubscribe = subscribeToGameTelemetry([deviceId], (envelope: TelemetryEnvelope) => {
      if (!envelope?.data) {
        return;
      }

      const data = envelope.data as Record<string, unknown>;
      const event: DeviceGameEvent = {
        ts: Date.now(),
        values: {
          deviceId,
          event: (data.event as DeviceGameEvent['values']['event']) ?? 'info',
          gameId: typeof data.gameId === 'string' ? data.gameId : undefined,
          gameStatus: typeof data.gameStatus === 'string' ? (data.gameStatus as DeviceGameEvent['values']['gameStatus']) : undefined,
          wifiStrength: typeof data.wifiStrength === 'number' ? data.wifiStrength : undefined,
          ambientLight: typeof data.ambientLight === 'string' ? (data.ambientLight as DeviceGameEvent['values']['ambientLight']) : undefined,
          hitCount: typeof data.hits === 'number' ? data.hits : undefined,
        },
      };

      this.processDeviceEvent(event);
      const registered = this.eventCallbacks.get(deviceId);
      registered?.(event);
    }, { realtime: true });

    this.telemetrySubscriptions.set(deviceId, unsubscribe);
  }

  /**
   * Unsubscribe from device events
   */
  unsubscribeFromDeviceEvents(deviceId: string): void {
    const unsubscribe = this.telemetrySubscriptions.get(deviceId);
    if (unsubscribe) {
      unsubscribe();
      this.telemetrySubscriptions.delete(deviceId);
    }
    this.eventCallbacks.delete(deviceId);
  }

  /**
   * Process device event and update status
   * According to DeviceManagement.md: Handle all device events (connect, hit, info, timeout, stop, disconnect)
   */
  processDeviceEvent(event: DeviceGameEvent): void {
    const { deviceId, event: eventType, gameId, gameStatus, wifiStrength, ambientLight, hitCount } = event.values;
    
    console.log(`📨 Processing device event: ${eventType} from ${deviceId}`, event.values);
    
    // Update device status
    const currentStatus = this.deviceStatuses.get(deviceId) || {
      deviceId,
      name: `Device ${deviceId}`,
      gameStatus: 'idle',
      wifiStrength: 0,
      ambientLight: 'good',
      hitCount: 0,
      lastSeen: 0,
      isOnline: false,
      hitTimes: []
    };

    // Update status based on event type according to documentation
    switch (eventType) {
      case 'connect':
        // Connect (Power-On/Restart): Device connects to the MQTT broker
        console.log(`🔗 Device ${deviceId} connected`);
        currentStatus.isOnline = true;
        currentStatus.gameStatus = 'idle';
        currentStatus.wifiStrength = wifiStrength || 0;
        currentStatus.ambientLight = ambientLight || 'good';
        break;
      
      case 'info':
        // Info (Alive Packet): Device periodically sends status
        console.log(`📡 Device ${deviceId} info update`);
        currentStatus.isOnline = true;
        currentStatus.lastSeen = Date.now();
        if (gameStatus) currentStatus.gameStatus = gameStatus;
        if (wifiStrength !== undefined) currentStatus.wifiStrength = wifiStrength;
        if (ambientLight) currentStatus.ambientLight = ambientLight;
        break;
      
      case 'hit':
        // Target Hit (Asynchronous): Device sends a hit event
        console.log(`🎯 Device ${deviceId} registered hit! Count: ${hitCount || currentStatus.hitCount + 1}`);
        currentStatus.isOnline = true;
        currentStatus.lastSeen = Date.now();
        if (hitCount !== undefined) {
          currentStatus.hitCount = hitCount;
        } else {
          currentStatus.hitCount += 1; // Increment if not provided
        }
        
        // Track hit times for detailed statistics
        if (!currentStatus.hitTimes) {
          currentStatus.hitTimes = [];
        }
        currentStatus.hitTimes.push(Date.now());
        break;
      
      case 'timeout':
        // Game Timeout: Device detects timeout based on gameDuration
        console.log(`⏰ Device ${deviceId} game timeout. Final hits: ${hitCount}`);
        currentStatus.gameStatus = 'stop';
        currentStatus.lastSeen = Date.now();
        if (hitCount !== undefined) currentStatus.hitCount = hitCount;
        break;
      
      case 'stop':
        // Game Stop: Device responds to stop command or completes game
        console.log(`🛑 Device ${deviceId} game stopped. Final hits: ${hitCount}`);
        currentStatus.gameStatus = 'stop';
        currentStatus.lastSeen = Date.now();
        if (hitCount !== undefined) currentStatus.hitCount = hitCount;
        break;
      
      case 'disconnect':
        // Device disconnected (power-off or network issue)
        console.log(`❌ Device ${deviceId} disconnected`);
        currentStatus.isOnline = false;
        currentStatus.gameStatus = 'offline';
        break;
    }

    this.deviceStatuses.set(deviceId, currentStatus);

    // Update game session if applicable
    if (gameId) {
      const session = this.activeSessions.get(gameId);
      if (session) {
        const deviceIndex = session.devices.findIndex(d => d.deviceId === deviceId);
        if (deviceIndex !== -1) {
          session.devices[deviceIndex] = { ...currentStatus };
        }

        // Check if game should end (all devices stopped or timeout)
        if (eventType === 'timeout' || eventType === 'stop') {
          const allStopped = session.devices.every(d => d.gameStatus === 'stop');
          if (allStopped) {
            console.log(`🏁 Game ${gameId} completed - all devices stopped`);
            session.status = 'completed';
            session.endTime = Date.now();
          }
        }
      }
    }

    console.log(`✅ Device ${deviceId} status updated:`, currentStatus);
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
   * Clean up resources
   */
  cleanup(): void {
    // Close all WebSocket connections
    this.telemetrySubscriptions.forEach(ws => ws.close());
    this.telemetrySubscriptions.clear();
    this.eventCallbacks.clear();
    this.activeSessions.clear();
    this.deviceStatuses.clear();
  }
}

// Create singleton instance
export const deviceGameFlowService = new DeviceGameFlowService();

// Export convenience functions
export const configureDevices = (deviceIds: string[], gameId: string, gameDuration: number) =>
  deviceGameFlowService.configureDevices(deviceIds, gameId, gameDuration);

export const startGame = (deviceIds: string[], gameId: string) =>
  deviceGameFlowService.startGame(deviceIds, gameId);

export const stopGame = (deviceIds: string[], gameId: string) =>
  deviceGameFlowService.stopGame(deviceIds, gameId);

export const requestDeviceInfo = (deviceIds: string[], gameId?: string) =>
  deviceGameFlowService.requestDeviceInfo(deviceIds, gameId);

export const createGameSession = (gameId: string, gameName: string, duration: number, deviceIds: string[]) =>
  deviceGameFlowService.createGameSession(gameId, gameName, duration, deviceIds);

export const subscribeToDeviceEvents = (deviceId: string, callback: (event: DeviceGameEvent) => void) =>
  deviceGameFlowService.subscribeToDeviceEvents(deviceId, callback);

export const unsubscribeFromDeviceEvents = (deviceId: string) =>
  deviceGameFlowService.unsubscribeFromDeviceEvents(deviceId);

export const processDeviceEvent = (event: DeviceGameEvent) =>
  deviceGameFlowService.processDeviceEvent(event);

export const getDeviceStatus = (deviceId: string) =>
  deviceGameFlowService.getDeviceStatus(deviceId);

export const getAllDeviceStatuses = () =>
  deviceGameFlowService.getAllDeviceStatuses();

export const seedDeviceStatuses = (deviceStatuses: DeviceStatus[]) =>
  deviceGameFlowService.seedDeviceStatuses(deviceStatuses);

export default deviceGameFlowService;
