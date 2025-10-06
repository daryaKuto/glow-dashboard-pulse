import { create } from 'zustand';
import { ScenarioTemplate } from './scenarios';
import API from '@/lib/api';
import { useRooms } from '@/store/useRooms';
import { scenarioApiService } from './scenario-api';
import { mockScenarioService } from './scenario-mock';
import { DOUBLE_TAP_CONFIG } from './scenario-data';
import type { ScenarioSession, ScenarioResults } from './scenario-data';

interface RunState {
  active: boolean;
  current?: ScenarioTemplate;
  currentSession?: ScenarioSession;
  error?: string;
  results?: ScenarioResults;
  progress: number;
  timeRemaining: number;
  useMockData: boolean;
  
  start: (tpl: ScenarioTemplate, roomId: string, selectedTargetIds?: string[]) => Promise<void>;
  stop: () => Promise<void>;
  getStatus: () => Promise<void>;
  toggleMockMode: () => void;
}

export const useScenarioRun = create<RunState>((set, get) => ({
  active: false,
  progress: 0,
  timeRemaining: 0,
  useMockData: true, // Default to mock mode since ThingsBoard isn't implemented yet

  start: async (tpl, roomId, selectedTargetIds) => {
    try {
      // Validate room capacity
      const { rooms } = useRooms.getState();
      const room = rooms.find(r => r.id === roomId);
      if (!room) return set({ error: 'Room not found' });

      const targets = await API.getTargets();
      let selectedTargets;

      if (selectedTargetIds && selectedTargetIds.length > 0) {
        // Use user-selected targets
        selectedTargets = targets.filter(t => selectedTargetIds.includes(t.id) && t.status === 'online');
        
        if (selectedTargets.length < tpl.targetCount) {
          return set({ 
            error: `Need ${tpl.targetCount} online targets, only ${selectedTargets.length} selected targets are online` 
          });
        }
      } else {
        // Fallback to auto-selection from room
        const roomTgts = targets.filter(t => t.roomId === roomId && t.status === 'online');
        
        if (roomTgts.length < tpl.targetCount) {
          return set({ 
            error: `Need ${tpl.targetCount} online targets, found ${roomTgts.length}` 
          });
        }
        
        selectedTargets = roomTgts.slice(0, tpl.targetCount);
      }

      // Generate unique session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();

      // Create session payload
      const startPayload = {
        sessionId,
        scenarioConfig: {
          id: tpl.id,
          targetCount: tpl.targetCount,
          shotsPerTarget: tpl.shotsPerTarget,
          timeLimitMs: tpl.timeLimitMs
        },
        targetDeviceIds: selectedTargets.map(t => t.id),
        roomId,
        userId: 'current_user', // TODO: Get from auth context
        startTime
      };

      // Start the scenario session (mock or real)
      const session = get().useMockData 
        ? await mockScenarioService.startScenarioSession(startPayload)
        : await scenarioApiService.startScenarioSession(startPayload);
      
      set({ 
        active: true, 
        current: tpl, 
        currentSession: session,
        error: undefined,
        progress: 0,
        timeRemaining: tpl.timeLimitMs
      });

      // Execute scenario-specific logic (only for real API, mock handles this internally)
      if (tpl.id === 'double-tap' && !get().useMockData) {
        // Start the Double Tap sequence in the background
        scenarioApiService.executeDoubleTapScenario(
          sessionId, 
          selectedTargets.map(t => t.id), 
          DOUBLE_TAP_CONFIG
        ).catch(error => {
          console.error('Double Tap execution failed:', error);
          set({ error: 'Scenario execution failed' });
        });
      }

      // Live data monitoring will be handled by the useScenarioLiveData hook
      // in the component that uses this store
      console.log(`Scenario ${tpl.name} started successfully with session ${sessionId}`);

    } catch (error) {
      console.error('Failed to start scenario:', error);
      set({ error: 'Failed to start scenario' });
    }
  },

  stop: async () => {
    const state = get();
    if (!state.currentSession) {
      set({ active: false, current: undefined });
      return;
    }

    try {
      // End the scenario session (mock or real)
      const results = state.useMockData
        ? await mockScenarioService.endScenarioSession(
            state.currentSession.sessionId,
            state.progress >= 100 ? 'completed' : 'user_stopped'
          )
        : await scenarioApiService.endScenarioSession({
            sessionId: state.currentSession.sessionId,
            endTime: Date.now(),
            reason: state.progress >= 100 ? 'completed' : 'user_stopped'
          });

      set({ 
        active: false, 
        current: undefined,
        currentSession: undefined,
        results,
        progress: 0,
        timeRemaining: 0
      });

    } catch (error) {
      console.error('Failed to stop scenario properly:', error);
      // Force stop even if API call fails
      set({ 
        active: false, 
        current: undefined,
        currentSession: undefined,
        progress: 0,
        timeRemaining: 0
      });
    }
  },

  getStatus: async () => {
    const state = get();
    if (!state.currentSession) return;

    try {
      const status = state.useMockData
        ? await mockScenarioService.getScenarioStatus(state.currentSession.sessionId)
        : await scenarioApiService.getScenarioStatus(state.currentSession.sessionId);
        
      set({
        progress: status.currentProgress,
        timeRemaining: status.timeRemaining
      });
    } catch (error) {
      console.error('Failed to get scenario status:', error);
    }
  },

  toggleMockMode: () => {
    const state = get();
    if (state.active) {
      console.warn('Cannot toggle mock mode while scenario is active');
      return;
    }
    set({ useMockData: !state.useMockData });
    console.log(`Mock mode ${!state.useMockData ? 'enabled' : 'disabled'}`);
  }
})); 