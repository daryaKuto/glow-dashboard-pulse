/**
 * Game Flow Zustand Store
 *
 * Manages real-time game session state for ThingsBoard IoT device communication.
 * This store is intentionally Zustand-based (not React Query) because it handles
 * a live, latency-sensitive WebSocket pipeline during active game sessions.
 *
 * Data flow:
 * ThingsBoard WebSocket (game-telemetry.ts)
 *   → DeviceGameFlowService singleton (device-game-flow.ts)
 *     → processes events (hit, connect, info, timeout, stop, disconnect)
 *     → updates in-memory device statuses + active sessions
 *   → useGameFlow Zustand store (this file)
 *     → mirrors device statuses into reactive state
 *     → exposes actions: createGame, configureDevices, startGame, stopGame, endGame
 *   → GameFlowDashboard component (game-flow-dashboard.tsx)
 *     → renders device list, game controls, live hit counts
 *
 * Game history persistence is handled by React Query hooks:
 * - useGameHistory() for fetching history
 * - useSaveGameHistory() for saving
 * - useAddGameToHistory() for manual additions
 * See: src/features/games/hooks/use-game-history.ts
 */

import { create } from 'zustand';
import {
  deviceGameFlowService,
  DeviceStatus,
  GameSession,
  GameHistory,
  DeviceGameEvent,
  type GameCommandWarning,
} from '@/features/games/lib/device-game-flow';
import { saveGameHistory as persistGameHistory } from '@/features/games/lib/game-history';
import { logger } from '@/shared/lib/logger';

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

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;

  // Reset for logout
  reset: () => void;
}

const initialState = {
  currentSession: null,
  devices: [],
  selectedDevices: [],
  isConfiguring: false,
  isGameActive: false,
  error: null,
  periodicInfoInterval: null,
};

export const useGameFlow = create<GameFlowState>((set, get) => ({
  ...initialState,

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

      logger.debug(`Initialized ${uniqueDeviceIds.length} devices for game flow`);
    } catch (error) {
      logger.error('Failed to initialize devices:', error);
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
      logger.debug(`Created game session: ${gameId}`);
      return true;
    } catch (error) {
      logger.error('Failed to create game:', error);
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
      logger.debug(`Configured ${results.success.length} devices`);
      return { ok: true, success: results.success, failed: results.failed, warnings: results.warnings };
    } catch (error) {
      logger.error('Failed to configure devices:', error);
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
        logger.warn(
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

      logger.debug(`Started game on ${results.success.length} devices with periodic monitoring`);
      return true;
    } catch (error) {
      logger.error('Failed to start game:', error);
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
        logger.warn(
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

      logger.debug(`Stopped game on ${results.success.length} devices`);
      return true;
    } catch (error) {
      logger.error('Failed to stop game:', error);
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

      // Build game history entry for persistence
      if (currentSession.endTime) {
        const historyEntry = buildGameHistoryEntry(currentSession);

        // Persist to backend using the game-history library function
        // Note: React Query cache invalidation happens automatically in components
        // that use useGameHistory() when they refetch
        void persistGameHistory(historyEntry)
          .then(({ status, sessionPersisted, sessionPersistError }) => {
            if (status) {
              logger.info('[useGameFlow] Game history entry', status, historyEntry.gameId);
            }
            if (!sessionPersisted) {
              logger.warn('[useGameFlow] Session analytics failed to persist', {
                gameId: historyEntry.gameId,
                sessionPersistError,
              });
            }
          })
          .catch((error) => {
            logger.warn('[useGameFlow] Failed to persist game history', error);
          });
      }

      // Clean up
      deviceGameFlowService.updateGameSessionStatus(currentSession.gameId, 'completed');

      set({
        currentSession: null,
        isGameActive: false,
        isConfiguring: false,
        selectedDevices: [],
        periodicInfoInterval: null
      });

      logger.debug(`Ended game session: ${currentSession.gameId}`);
    } catch (error) {
      logger.error('Failed to end game:', error);
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

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    const { periodicInfoInterval, devices } = get();

    // Stop periodic info if running
    if (periodicInfoInterval) {
      deviceGameFlowService.stopPeriodicInfoRequests(periodicInfoInterval);
    }

    // Unsubscribe from all device events
    devices.forEach(device => {
      deviceGameFlowService.unsubscribeFromDeviceEvents(device.deviceId);
    });

    set(initialState);
    logger.debug('[useGameFlow] Store reset');
  },
}));

/**
 * Build a GameHistory entry from a completed session
 */
function buildGameHistoryEntry(session: GameSession): GameHistory {
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
        ? Number((intervals.reduce((sum, value) => sum + value, 0) / intervals.length).toFixed(2))
        : 0,
      firstHitTime: hitTimes[0] ?? 0,
      lastHitTime: hitTimes[hitTimes.length - 1] ?? 0,
    };
  });

  const totalHits = targetStats.reduce((sum, stat) => sum + stat.hitCount, 0);
  const durationMs = Math.max(0, (session.endTime ?? Date.now()) - session.startTime);
  const actualDurationSeconds = Number((durationMs / 1000).toFixed(2));

  const allHits = targetStats
    .flatMap((stat) => stat.hitTimes.map((timestamp) => ({ deviceId: stat.deviceId, timestamp })))
    .sort((a, b) => a.timestamp - b.timestamp);

  const overallIntervals = allHits
    .slice(1)
    .map((entry, idx) => (entry.timestamp - allHits[idx].timestamp) / 1000);

  const switchTimes: number[] = [];
  for (let i = 1; i < allHits.length; i++) {
    if (allHits[i].deviceId !== allHits[i - 1].deviceId) {
      const switchSpan = (allHits[i].timestamp - allHits[i - 1].timestamp) / 1000;
      switchTimes.push(Number(switchSpan.toFixed(2)));
    }
  }

  return {
    gameId: session.gameId,
    gameName: session.gameName,
    duration: session.duration,
    startTime: session.startTime,
    endTime: session.endTime ?? Date.now(),
    deviceResults: targetStats.map(({ deviceId, deviceName, hitCount }) => ({
      deviceId,
      deviceName,
      hitCount,
    })),
    totalHits,
    actualDuration: actualDurationSeconds,
    averageHitInterval: overallIntervals.length
      ? Number((overallIntervals.reduce((sum, value) => sum + value, 0) / overallIntervals.length).toFixed(2))
      : null,
    targetStats,
    crossTargetStats: {
      totalSwitches: switchTimes.length,
      averageSwitchTime: switchTimes.length
        ? Number((switchTimes.reduce((sum, value) => sum + value, 0) / switchTimes.length).toFixed(2))
        : 0,
      switchTimes,
    },
  };
}
