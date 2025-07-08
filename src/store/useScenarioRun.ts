import { create } from 'zustand';
import { ScenarioTemplate } from '@/data/scenarios';
import API             from '@/lib/api';
import { useRooms }    from '@/store/useRooms';

interface RunState {
  active:      boolean;
  current?:    ScenarioTemplate;
  error?:      string;
  start:       (tpl:ScenarioTemplate, roomId:string)=>Promise<void>;
  stop:        () => void;
}

export const useScenarioRun = create<RunState>((set) => ({
  active: false,

  start: async (tpl, roomId) => {
    // Validate room capacity
    const { rooms } = useRooms.getState();
    const room      = rooms.find(r => r.id === roomId);
    if (!room) return set({ error:'Room not found' });

    const targets   = await API.getTargets();          // live TB devices
    const roomTgts  = targets.filter(t => t.roomId === roomId);

    if (roomTgts.length < tpl.targetCount) {
      return set({ error:`Need ${tpl.targetCount} targets, found ${roomTgts.length}` });
    }

    // Build payload
    const payload = {
      scenarioId:      tpl.id,
      targetIds:       roomTgts.slice(0, tpl.targetCount).map(t=>t.id),
      shotsPerTarget:  tpl.shotsPerTarget,
      timeLimitMs:     tpl.timeLimitMs,
      startedAt:       Date.now(),
    };

    // Send to backend (ThingsBoard → shared attributes on a "controller" device)
    await API.pushScenarioConfig(payload);   // see extension in api.ts below

    set({ active:true, current:tpl, error:undefined });
  },

  stop: () => set({ active:false, current:undefined }),
})); 