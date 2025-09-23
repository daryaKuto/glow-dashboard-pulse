import { create } from 'zustand';
import { 
  deviceGameFlowService, 
  DeviceStatus, 
  GameSession, 
  GameHistory, 
  DeviceGameEvent 
} from '@/services/device-game-flow';

interface GameFlowState {
  // Current game session
  currentSession: GameSession | null;
  
  // Device management
  devices: DeviceStatus[];
  selectedDevices: string[];
  
  // Game history
  gameHistory: GameHistory[];
  
  // UI state
  isConfiguring: boolean;
  isGameActive: boolean;
  error: string | null;
  periodicInfoInterval: NodeJS.Timeout | null;
  
  // Actions
  initializeDevices: (deviceIds: string[]) => Promise<void>;
  selectDevices: (deviceIds: string[]) => void;
  createGame: (gameName: string, duration: number) => Promise<boolean>;
  configureDevices: () => Promise<boolean>;
  startGame: () => Promise<boolean>;
  stopGame: () => Promise<boolean>;
  endGame: () => Promise<void>;
  
  // Device monitoring
  subscribeToDevices: () => void;
  unsubscribeFromDevices: () => void;
  
  // History management
  loadGameHistory: () => Promise<void>;
  saveGameToHistory: (session: GameSession) => void;
  addGameToHistory: (historyEntry: GameHistory) => void;
  
  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useGameFlow = create<GameFlowState>((set, get) => ({
  currentSession: null,
  devices: [],
  selectedDevices: [],
  gameHistory: [],
  isConfiguring: false,
  isGameActive: false,
  error: null,
  periodicInfoInterval: null,

  initializeDevices: async (deviceIds: string[]) => {
    try {
      set({ error: null });
      
      // Initialize device statuses
      const devices: DeviceStatus[] = deviceIds.map(id => ({
        deviceId: id,
        name: `Device ${id}`,
        gameStatus: 'idle',
        wifiStrength: 0,
        ambientLight: 'good',
        hitCount: 0,
        lastSeen: 0,
        isOnline: false
      }));
      
      set({ devices });
      
      // Subscribe to device events
      deviceIds.forEach(deviceId => {
        deviceGameFlowService.subscribeToDeviceEvents(deviceId, (event: DeviceGameEvent) => {
          deviceGameFlowService.processDeviceEvent(event);
          
          // Update local state
          const updatedDevices = deviceGameFlowService.getAllDeviceStatuses();
          set({ devices: updatedDevices });
          
          // Update current session if active
          const { currentSession } = get();
          if (currentSession) {
            const updatedSession = deviceGameFlowService.getGameSession(currentSession.gameId);
            if (updatedSession) {
              set({ currentSession: updatedSession });
            }
          }
        });
      });
      
      console.log(`Initialized ${deviceIds.length} devices for game flow`);
    } catch (error) {
      console.error('Failed to initialize devices:', error);
      set({ error: 'Failed to initialize devices' });
    }
  },

  selectDevices: (deviceIds: string[]) => {
    set({ selectedDevices: deviceIds });
  },

  createGame: async (gameName: string, duration: number) => {
    try {
      set({ error: null });
      
      const { selectedDevices } = get();
      if (selectedDevices.length === 0) {
        set({ error: 'No devices selected' });
        return false;
      }
      
      const gameId = `GM-${Date.now()}`;
      const session = deviceGameFlowService.createGameSession(
        gameId,
        gameName,
        duration,
        selectedDevices
      );
      
      set({ currentSession: session });
      console.log(`Created game session: ${gameId}`);
      return true;
    } catch (error) {
      console.error('Failed to create game:', error);
      set({ error: 'Failed to create game' });
      return false;
    }
  },

  configureDevices: async () => {
    try {
      set({ error: null, isConfiguring: true });
      
      const { currentSession } = get();
      if (!currentSession) {
        set({ error: 'No active game session', isConfiguring: false });
        return false;
      }
      
      const deviceIds = currentSession.devices.map(d => d.deviceId);
      const results = await deviceGameFlowService.configureDevices(
        deviceIds,
        currentSession.gameId,
        currentSession.duration
      );
      
      if (results.failed.length > 0) {
        set({ 
          error: `Failed to configure ${results.failed.length} devices`,
          isConfiguring: false 
        });
        return false;
      }
      
      // Wait for device responses (info events)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      set({ isConfiguring: false });
      console.log(`Configured ${results.success.length} devices`);
      return true;
    } catch (error) {
      console.error('Failed to configure devices:', error);
      set({ error: 'Failed to configure devices', isConfiguring: false });
      return false;
    }
  },

  startGame: async () => {
    try {
      set({ error: null });
      
      const { currentSession } = get();
      if (!currentSession) {
        set({ error: 'No active game session' });
        return false;
      }
      
      const deviceIds = currentSession.devices.map(d => d.deviceId);
      const results = await deviceGameFlowService.startGame(
        deviceIds,
        currentSession.gameId
      );
      
      if (results.failed.length > 0) {
        set({ error: `Failed to start game on ${results.failed.length} devices` });
        return false;
      }
      
      // Update session status
      deviceGameFlowService.updateGameSessionStatus(currentSession.gameId, 'active');
      const updatedSession = deviceGameFlowService.getGameSession(currentSession.gameId);
      
      // Start periodic info requests as per DeviceManagement.md
      const intervalId = deviceGameFlowService.startPeriodicInfoRequests(
        deviceIds, 
        currentSession.gameId
      );
      
      set({ 
        currentSession: updatedSession,
        isGameActive: true,
        periodicInfoInterval: intervalId
      });
      
      console.log(`Started game on ${results.success.length} devices with periodic monitoring`);
      return true;
    } catch (error) {
      console.error('Failed to start game:', error);
      set({ error: 'Failed to start game' });
      return false;
    }
  },

  stopGame: async () => {
    try {
      set({ error: null });
      
      const { currentSession } = get();
      if (!currentSession) {
        set({ error: 'No active game session' });
        return false;
      }
      
      const deviceIds = currentSession.devices.map(d => d.deviceId);
      const results = await deviceGameFlowService.stopGame(
        deviceIds,
        currentSession.gameId
      );
      
      if (results.failed.length > 0) {
        set({ error: `Failed to stop game on ${results.failed.length} devices` });
        return false;
      }
      
      // Stop periodic info requests
      const { periodicInfoInterval } = get();
      if (periodicInfoInterval) {
        deviceGameFlowService.stopPeriodicInfoRequests(periodicInfoInterval);
      }
      
      // Update session status
      deviceGameFlowService.updateGameSessionStatus(currentSession.gameId, 'stopped');
      const updatedSession = deviceGameFlowService.getGameSession(currentSession.gameId);
      
      set({ 
        currentSession: updatedSession,
        isGameActive: false,
        periodicInfoInterval: null
      });
      
      console.log(`Stopped game on ${results.success.length} devices`);
      return true;
    } catch (error) {
      console.error('Failed to stop game:', error);
      set({ error: 'Failed to stop game' });
      return false;
    }
  },

  endGame: async () => {
    try {
      const { currentSession, periodicInfoInterval } = get();
      if (!currentSession) return;
      
      // Stop periodic info requests
      if (periodicInfoInterval) {
        deviceGameFlowService.stopPeriodicInfoRequests(periodicInfoInterval);
      }
      
      // Unsubscribe from device events
      currentSession.devices.forEach(device => {
        deviceGameFlowService.unsubscribeFromDeviceEvents(device.deviceId);
      });
      
      // Save to history
      get().saveGameToHistory(currentSession);
      
      // Clean up
      deviceGameFlowService.updateGameSessionStatus(currentSession.gameId, 'completed');
      
      set({ 
        currentSession: null,
        isGameActive: false,
        isConfiguring: false,
        selectedDevices: [],
        periodicInfoInterval: null
      });
      
      console.log(`🏁 Ended game session: ${currentSession.gameId}`);
    } catch (error) {
      console.error('Failed to end game:', error);
      set({ error: 'Failed to end game' });
    }
  },

  subscribeToDevices: () => {
    const { devices } = get();
    devices.forEach(device => {
      deviceGameFlowService.subscribeToDeviceEvents(device.deviceId, (event: DeviceGameEvent) => {
        deviceGameFlowService.processDeviceEvent(event);
        
        // Update local state
        const updatedDevices = deviceGameFlowService.getAllDeviceStatuses();
        set({ devices: updatedDevices });
      });
    });
  },

  unsubscribeFromDevices: () => {
    const { devices } = get();
    devices.forEach(device => {
      deviceGameFlowService.unsubscribeFromDeviceEvents(device.deviceId);
    });
  },

  loadGameHistory: async () => {
    try {
      // Load demo game history for testing
      const demoHistory: GameHistory[] = [
        {
          gameId: 'GM-demo-001',
          gameName: 'Training Session Alpha',
          duration: 30,
          startTime: Date.now() - (2 * 24 * 60 * 60 * 1000), // 2 days ago
          endTime: Date.now() - (2 * 24 * 60 * 60 * 1000) + (30 * 60 * 1000),
          deviceResults: [
            { deviceId: 'demo-target-alpha', deviceName: 'Training Target Alpha', hitCount: 23 },
            { deviceId: 'demo-target-beta', deviceName: 'Training Target Beta', hitCount: 18 },
            { deviceId: 'demo-target-gamma', deviceName: 'Training Target Gamma', hitCount: 15 }
          ],
          totalHits: 56,
          actualDuration: 1800, // 30 minutes in seconds
          averageHitInterval: 32.1,
          targetStats: [
            {
              deviceId: 'demo-target-alpha',
              deviceName: 'Training Target Alpha',
              hitCount: 23,
              hitTimes: [],
              averageInterval: 78.3,
              firstHitTime: 12.5,
              lastHitTime: 1789.2
            },
            {
              deviceId: 'demo-target-beta',
              deviceName: 'Training Target Beta',
              hitCount: 18,
              hitTimes: [],
              averageInterval: 99.4,
              firstHitTime: 45.8,
              lastHitTime: 1795.6
            },
            {
              deviceId: 'demo-target-gamma',
              deviceName: 'Training Target Gamma',
              hitCount: 15,
              hitTimes: [],
              averageInterval: 119.3,
              firstHitTime: 78.2,
              lastHitTime: 1798.1
            }
          ],
          crossTargetStats: {
            totalSwitches: 12,
            averageSwitchTime: 45.2,
            switchTimes: []
          }
        },
        {
          gameId: 'GM-demo-002',
          gameName: 'Quick Practice',
          duration: 15,
          startTime: Date.now() - (1 * 24 * 60 * 60 * 1000), // 1 day ago
          endTime: Date.now() - (1 * 24 * 60 * 60 * 1000) + (15 * 60 * 1000),
          deviceResults: [
            { deviceId: 'demo-target-alpha', deviceName: 'Training Target Alpha', hitCount: 12 },
            { deviceId: 'demo-target-beta', deviceName: 'Training Target Beta', hitCount: 9 }
          ],
          totalHits: 21,
          actualDuration: 900, // 15 minutes in seconds
          averageHitInterval: 42.9,
          targetStats: [
            {
              deviceId: 'demo-target-alpha',
              deviceName: 'Training Target Alpha',
              hitCount: 12,
              hitTimes: [],
              averageInterval: 75.0,
              firstHitTime: 8.3,
              lastHitTime: 892.1
            },
            {
              deviceId: 'demo-target-beta',
              deviceName: 'Training Target Beta',
              hitCount: 9,
              hitTimes: [],
              averageInterval: 100.0,
              firstHitTime: 25.7,
              lastHitTime: 896.4
            }
          ],
          crossTargetStats: {
            totalSwitches: 6,
            averageSwitchTime: 38.5,
            switchTimes: []
          }
        },
        {
          gameId: 'GM-demo-003',
          gameName: 'Accuracy Challenge',
          duration: 45,
          startTime: Date.now() - (6 * 60 * 60 * 1000), // 6 hours ago
          endTime: Date.now() - (6 * 60 * 60 * 1000) + (45 * 60 * 1000),
          deviceResults: [
            { deviceId: 'demo-target-alpha', deviceName: 'Training Target Alpha', hitCount: 34 },
            { deviceId: 'demo-target-beta', deviceName: 'Training Target Beta', hitCount: 29 },
            { deviceId: 'demo-target-gamma', deviceName: 'Training Target Gamma', hitCount: 27 },
            { deviceId: 'demo-target-delta', deviceName: 'Training Target Delta', hitCount: 21 }
          ],
          totalHits: 111,
          actualDuration: 2700, // 45 minutes in seconds
          averageHitInterval: 24.3,
          targetStats: [
            {
              deviceId: 'demo-target-alpha',
              deviceName: 'Training Target Alpha',
              hitCount: 34,
              hitTimes: [],
              averageInterval: 79.4,
              firstHitTime: 5.2,
              lastHitTime: 2695.8
            },
            {
              deviceId: 'demo-target-beta',
              deviceName: 'Training Target Beta',
              hitCount: 29,
              hitTimes: [],
              averageInterval: 93.1,
              firstHitTime: 12.8,
              lastHitTime: 2698.2
            },
            {
              deviceId: 'demo-target-gamma',
              deviceName: 'Training Target Gamma',
              hitCount: 27,
              hitTimes: [],
              averageInterval: 100.0,
              firstHitTime: 18.5,
              lastHitTime: 2699.1
            },
            {
              deviceId: 'demo-target-delta',
              deviceName: 'Training Target Delta',
              hitCount: 21,
              hitTimes: [],
              averageInterval: 128.6,
              firstHitTime: 35.2,
              lastHitTime: 2699.8
            }
          ],
          crossTargetStats: {
            totalSwitches: 28,
            averageSwitchTime: 32.1,
            switchTimes: []
          }
        }
      ];
      
      set({ gameHistory: demoHistory });
      console.log('📊 Demo game history loaded:', demoHistory.length, 'games');
    } catch (error) {
      console.error('Failed to load game history:', error);
      set({ error: 'Failed to load game history' });
    }
  },

  saveGameToHistory: (session: GameSession) => {
    if (!session.endTime) return;
    
    const historyEntry: GameHistory = {
      gameId: session.gameId,
      gameName: session.gameName,
      duration: session.duration,
      startTime: session.startTime,
      endTime: session.endTime,
      deviceResults: session.devices.map(device => ({
        deviceId: device.deviceId,
        deviceName: device.name,
        hitCount: device.hitCount
      }))
    };
    
    set(state => ({
      gameHistory: [historyEntry, ...state.gameHistory]
    }));
    
    console.log(`Saved game to history: ${session.gameId}`);
  },

  addGameToHistory: (historyEntry: GameHistory) => {
    set(state => ({
      gameHistory: [historyEntry, ...state.gameHistory]
    }));
    
    console.log('💾 Game added to history:', historyEntry);
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  }
}));
