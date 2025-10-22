import { create } from 'zustand';
import { 
  deviceGameFlowService, 
  DeviceStatus, 
  GameSession, 
  GameHistory, 
  DeviceGameEvent,
  type GameCommandWarning,
} from '@/services/device-game-flow';
import { fetchGameHistory as fetchPersistedGameHistory, saveGameHistory as persistGameHistory } from '@/services/game-history';

type ConfigureDevicesResult = {
  ok: boolean;
  success: string[];
  failed: string[];
  warnings: GameCommandWarning[];
};

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
  initializeDevices: (devices: DeviceStatus[]) => Promise<void>;
  selectDevices: (deviceIds: string[]) => void;
  createGame: (gameName: string, duration: number) => Promise<boolean>;
  configureDevices: () => Promise<ConfigureDevicesResult>;
  startGame: () => Promise<boolean>;
  stopGame: () => Promise<boolean>;
  endGame: () => Promise<void>;
  
  // Device monitoring
  subscribeToDevices: () => void;
  unsubscribeFromDevices: () => void;
  
  // History management
  loadGameHistory: (isDemoMode?: boolean) => Promise<void>;
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

  initializeDevices: async (initialDevices: DeviceStatus[]) => {
    try {
      set({ error: null });
      
      const devices = initialDevices.map((device) => ({
        ...device,
        hitTimes: device.hitTimes ? [...device.hitTimes] : [],
      }));

      deviceGameFlowService.seedDeviceStatuses(devices);
      set({ devices });

      const uniqueDeviceIds = Array.from(new Set(devices.map((device) => device.deviceId)));

      uniqueDeviceIds.forEach(deviceId => {
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
    set({ error: null, isConfiguring: true });

    const { currentSession } = get();
    if (!currentSession) {
      set({ error: 'No active game session', isConfiguring: false });
      return { ok: false, success: [], failed: [], warnings: [] };
    }

    const deviceIds = currentSession.devices.map(d => d.deviceId);
    try {
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
        return { ok: false, success: results.success, failed: results.failed, warnings: results.warnings };
      }

      // Wait for device responses (info events)
      await new Promise(resolve => setTimeout(resolve, 2000));

      set({ isConfiguring: false });
      console.log(`Configured ${results.success.length} devices`);
      return { ok: true, success: results.success, failed: results.failed, warnings: results.warnings };
    } catch (error) {
      console.error('Failed to configure devices:', error);
      set({ error: 'Failed to configure devices', isConfiguring: false });
      return { ok: false, success: [], failed: deviceIds, warnings: [] };
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
      if (results.warnings.length > 0) {
        console.warn(
          '[useGameFlow] Start warnings:',
          results.warnings.map(entry => `${entry.deviceId}:${entry.warning}`).join(', ')
        );
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
      if (results.warnings.length > 0) {
        console.warn(
          '[useGameFlow] Stop warnings:',
          results.warnings.map(entry => `${entry.deviceId}:${entry.warning}`).join(', ')
        );
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
    // Pulls the canonical history from Supabase so the Zustand store mirrors what the edge layer has persisted.
    try {
      const { history } = await fetchPersistedGameHistory();
      set({ gameHistory: history });
    } catch (error) {
      console.error('Failed to load game history:', error);
      set({ gameHistory: [] });
    }
  },

  saveGameToHistory: (session: GameSession) => {
    if (!session.endTime) return;
    
    // Convert the active session into the persisted summary shape before saving locally and via Supabase.
    const targetStats = session.devices.map((device) => {
      const hitTimes = Array.isArray(device.hitTimes) ? [...device.hitTimes] : [];
      hitTimes.sort((a, b) => a - b);

      const intervals = hitTimes.slice(1).map((timestamp, idx) => (timestamp - hitTimes[idx]) / 1000);

      return {
        deviceId: device.deviceId,
        deviceName: device.name,
        hitCount: device.hitCount,
        hitTimes,
        averageInterval: intervals.length
          ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
          : 0,
        firstHitTime: hitTimes[0] ?? 0,
        lastHitTime: hitTimes[hitTimes.length - 1] ?? 0,
      };
    });

    const totalHits = targetStats.reduce((sum, stat) => sum + stat.hitCount, 0);
    const actualDurationSeconds = Math.max(0, Math.round((session.endTime - session.startTime) / 1000));

    const allHits = targetStats
      .flatMap((stat) => stat.hitTimes.map((timestamp) => ({ deviceId: stat.deviceId, timestamp })))
      .sort((a, b) => a.timestamp - b.timestamp);

    const overallIntervals = allHits
      .slice(1)
      .map((entry, idx) => (entry.timestamp - allHits[idx].timestamp) / 1000);

    const switchTimes: number[] = [];
    for (let i = 1; i < allHits.length; i++) {
      if (allHits[i].deviceId !== allHits[i - 1].deviceId) {
        switchTimes.push((allHits[i].timestamp - allHits[i - 1].timestamp) / 1000);
      }
    }

    const historyEntry: GameHistory = {
      gameId: session.gameId,
      gameName: session.gameName,
      duration: session.duration,
      startTime: session.startTime,
      endTime: session.endTime,
      deviceResults: targetStats.map(({ deviceId, deviceName, hitCount }) => ({
        deviceId,
        deviceName,
        hitCount,
      })),
      totalHits,
      actualDuration: actualDurationSeconds,
      averageHitInterval: overallIntervals.length
        ? overallIntervals.reduce((sum, value) => sum + value, 0) / overallIntervals.length
        : null,
      targetStats,
      crossTargetStats: {
        totalSwitches: switchTimes.length,
        averageSwitchTime: switchTimes.length
          ? switchTimes.reduce((sum, value) => sum + value, 0) / switchTimes.length
          : 0,
        switchTimes,
      },
    };
    
    set(state => ({
      gameHistory: [historyEntry, ...state.gameHistory]
    }));

    void persistGameHistory(historyEntry)
      .then((status) => {
        if (status) {
          console.info('[useGameFlow] Game history entry', status, historyEntry.gameId);
        }
      })
      .catch((error) => {
        console.warn('[useGameFlow] Failed to persist game history', error);
      });
  },

  addGameToHistory: (historyEntry: GameHistory) => {
    // Allows callers (e.g., admin tooling) to push externally sourced history into the shared store.
    set(state => ({
      gameHistory: [historyEntry, ...state.gameHistory]
    }));
    
    console.log('💾 Game added to history:', historyEntry);

    void persistGameHistory(historyEntry)
      .then((status) => {
        if (status) {
          console.info('[useGameFlow] Manual history entry', status, historyEntry.gameId);
        }
      })
      .catch((error) => {
        console.warn('[useGameFlow] Failed to persist manual history entry', error);
      });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  }
}));
