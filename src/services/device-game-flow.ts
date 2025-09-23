import api from '@/lib/tbClient';
import { openTelemetryWS } from '@/services/thingsboard';

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

export interface DeviceGameCommand {
  ts: number;
  values: {
    deviceId: string;
    event: 'configure' | 'start' | 'stop' | 'info';
    gameId?: string;
    gameDuration?: number;
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

export interface GameHistory {
  gameId: string;
  gameName: string;
  duration: number;
  startTime: number;
  endTime: number;
  deviceResults: Array<{
    deviceId: string;
    deviceName: string;
    hitCount: number;
  }>;
  // Detailed statistics
  totalHits: number;
  actualDuration: number; // Actual game duration in seconds
  averageHitInterval: number;
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
  };
}

class DeviceGameFlowService {
  private activeSessions: Map<string, GameSession> = new Map();
  private deviceStatuses: Map<string, DeviceStatus> = new Map();
  private telemetrySubscriptions: Map<string, WebSocket> = new Map();
  private eventCallbacks: Map<string, (event: DeviceGameEvent) => void> = new Map();

  /**
   * Configure devices for a game session
   * According to DeviceManagement.md: Press Create Game Button action
   */
  async configureDevices(
    deviceIds: string[], 
    gameId: string, 
    gameDuration: number
  ): Promise<{ success: string[], failed: string[] }> {
    const results = { success: [] as string[], failed: [] as string[] };
    const timestamp = Math.floor(Date.now() / 1000);

    console.log(`🎮 Configuring ${deviceIds.length} devices for game ${gameId} (${gameDuration} min)`);

    for (const deviceId of deviceIds) {
      try {
        const command = {
          method: 'configure',
          params: {
            ts: timestamp,
            values: {
              deviceId,
              event: 'configure',
              gameId,
              gameDuration
            }
          }
        };

        // Send RPC command to device according to documentation
        const response = await api.post(`/rpc/twoway/${deviceId}`, command);

        console.log(`✅ Configure command sent to device ${deviceId}:`, response.data);
        results.success.push(deviceId);

        // Store expected device response for validation
        this.deviceStatuses.set(deviceId, {
          deviceId,
          name: `Device ${deviceId}`,
          gameStatus: 'idle',
          wifiStrength: 0,
          ambientLight: 'good',
          hitCount: 0,
          lastSeen: Date.now(),
          isOnline: true
        });

      } catch (error) {
        console.error(`❌ Failed to configure device ${deviceId}:`, error);
        results.failed.push(deviceId);
      }
    }

    console.log(`🎮 Configuration results: ${results.success.length} success, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Start game on configured devices
   * According to DeviceManagement.md: Press Start Game Button action
   */
  async startGame(
    deviceIds: string[], 
    gameId: string
  ): Promise<{ success: string[], failed: string[] }> {
    const results = { success: [] as string[], failed: [] as string[] };
    const timestamp = Math.floor(Date.now() / 1000);

    console.log(`🚀 Starting game ${gameId} on ${deviceIds.length} devices`);

    for (const deviceId of deviceIds) {
      try {
        const command = {
          method: 'start',
          params: {
            ts: timestamp,
            values: {
              deviceId,
              event: 'start',
              gameId
            }
          }
        };

        // Send RPC command to device according to documentation
        const response = await api.post(`/rpc/twoway/${deviceId}`, command);

        console.log(`✅ Start command sent to device ${deviceId}:`, response.data);
        results.success.push(deviceId);

        // Update device status to starting
        const deviceStatus = this.deviceStatuses.get(deviceId);
        if (deviceStatus) {
          deviceStatus.gameStatus = 'start';
          deviceStatus.hitCount = 0; // Reset hit count for new game
          deviceStatus.lastSeen = Date.now();
        }

      } catch (error) {
        console.error(`❌ Failed to start game on device ${deviceId}:`, error);
        results.failed.push(deviceId);
      }
    }

    console.log(`🚀 Start results: ${results.success.length} success, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Stop game on devices
   */
  async stopGame(
    deviceIds: string[], 
    gameId: string
  ): Promise<{ success: string[], failed: string[] }> {
    const results = { success: [] as string[], failed: [] as string[] };
    const timestamp = Math.floor(Date.now() / 1000);

    for (const deviceId of deviceIds) {
      try {
        const command: DeviceGameCommand = {
          ts: timestamp,
          values: {
            deviceId,
            event: 'stop',
            gameId
          }
        };

        // Send RPC command to device
        await api.post(`/api/rpc/twoway/${deviceId}`, {
          method: 'stop',
          params: command
        });

        console.log(`Stop command sent to device ${deviceId}`);
        results.success.push(deviceId);
      } catch (error) {
        console.error(`Failed to stop game on device ${deviceId}:`, error);
        results.failed.push(deviceId);
      }
    }

    return results;
  }

  /**
   * Request device info (alive packet)
   * According to DeviceManagement.md: Periodic Info Request (While Game is Active)
   */
  async requestDeviceInfo(deviceIds: string[], gameId?: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);

    for (const deviceId of deviceIds) {
      try {
        const command = {
          method: 'info',
          params: {
            ts: timestamp,
            values: {
              deviceId,
              event: 'info',
              gameId
            }
          }
        };

        // Send RPC command to device according to documentation
        const response = await api.post(`/rpc/twoway/${deviceId}`, command);

        console.log(`📡 Info request sent to device ${deviceId}:`, response.data);
      } catch (error) {
        console.error(`❌ Failed to request info from device ${deviceId}:`, error);
      }
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
    const session: GameSession = {
      gameId,
      gameName,
      duration,
      devices: deviceIds.map(id => ({
        deviceId: id,
        name: `Device ${id}`,
        gameStatus: 'idle',
        wifiStrength: 0,
        ambientLight: 'good',
        hitCount: 0,
        lastSeen: 0,
        isOnline: false
      })),
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
    const token = localStorage.getItem('tb_access');
    if (!token) {
      console.error('No access token available for telemetry subscription');
      return;
    }

    // Store callback for this device
    this.eventCallbacks.set(deviceId, callback);

    // Create WebSocket connection if not exists
    if (!this.telemetrySubscriptions.has(deviceId)) {
      const ws = openTelemetryWS(token);
      
      ws.onopen = () => {
        console.log(`WebSocket connected for device ${deviceId}`);
        
        // Subscribe to telemetry updates
        const subscribeCmd = {
          cmdId: Date.now(),
          entityType: 'DEVICE',
          entityId: deviceId,
          scope: 'LATEST_TELEMETRY',
          keys: 'ts,deviceId,event,gameId,gameStatus,wifiStrength,ambientLight,hitCount'
        };
        
        ws.send(JSON.stringify(subscribeCmd));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`📨 WebSocket message received for ${deviceId}:`, data);
          
          if (data && data.data) {
            // Parse telemetry data into DeviceGameEvent format according to DeviceManagement.md
            const deviceEvent: DeviceGameEvent = {
              ts: data.data.ts || Math.floor(Date.now() / 1000),
              values: {
                deviceId: data.data.deviceId || deviceId,
                event: data.data.event || 'info',
                gameId: data.data.gameId,
                gameStatus: data.data.gameStatus,
                wifiStrength: data.data.wifiStrength,
                ambientLight: data.data.ambientLight,
                hitCount: data.data.hitCount
              }
            };
            
            console.log(`🎯 Parsed device event:`, deviceEvent);
            
            // Process the event internally
            this.processDeviceEvent(deviceEvent);
            
            // Call the registered callback
            const callback = this.eventCallbacks.get(deviceId);
            if (callback) {
              callback(deviceEvent);
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for device ${deviceId}:`, error);
      };

      ws.onclose = () => {
        console.log(`WebSocket connection closed for device ${deviceId}`);
        this.telemetrySubscriptions.delete(deviceId);
      };

      this.telemetrySubscriptions.set(deviceId, ws);
    }
  }

  /**
   * Unsubscribe from device events
   */
  unsubscribeFromDeviceEvents(deviceId: string): void {
    const ws = this.telemetrySubscriptions.get(deviceId);
    if (ws) {
      ws.close();
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

export default deviceGameFlowService;
