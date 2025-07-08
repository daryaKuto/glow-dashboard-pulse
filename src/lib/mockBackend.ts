import mitt from 'mitt';
import { MockBackendEvents } from './types';

// Define the database shape from the mock-data.json file
type Target = {
  id: number;
  name: string;
  roomId: number | null;
  status: 'online' | 'offline';
  battery: number;
};

type Room = {
  id: number;
  name: string;
  order: number;
  targetCount: number;
};

type Group = {
  id: number;
  name: string;
  targetIds: number[];
};

type TargetLayout = {
  id: number;
  x: number;
  y: number;
};

type RoomLayout = {
  roomId: number;
  targets: TargetLayout[];
  groups: Group[];
};

type Session = {
  id: number;
  name: string;
  date: string;
  duration: number;
  score: number;
  accuracy: number;
};

type Scenario = {
  id: number;
  name: string;
  difficulty: string;
};

type Invite = {
  id: string;
  sessionId: number;
  token: string;
  createdAt: string;
};

type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  avatar: string;
};

type Friend = {
  id: string;
  name: string;
  status: "accepted" | "pending";
  score: number;
  avatar: string;
};

type Stats = {
  targets: {
    online: number;
    total: number;
  };
  rooms: {
    count: number;
  };
  sessions: {
    latest: {
      id: number;
      score: number;
    };
  };
  hits: Array<{
    date: string;
    hits: number;
  }>;
};

type DB = {
  targets: Target[];
  rooms: Room[];
  groups: Group[];
  layouts: RoomLayout[];
  sessions: Session[];
  scenarios: Scenario[];
  invites: Invite[];
  leaderboards: {
    global: LeaderboardEntry[];
    weekly: LeaderboardEntry[];
  };
  friends: Friend[];
  stats: Stats;
};

class MockBackend {
  private db!: DB;
  private emitter = mitt<MockBackendEvents>();
  private hitInterval: number | null = null;

  async init() {
    const saved = localStorage.getItem('mock-db');
    try {
      this.db = saved
        ? JSON.parse(saved)
        : await fetch('/mock-data.json').then(r => r.json());
        
      // Emit connection status
      this.emitter.emit('connectionStatus', { connected: true });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize mock backend:', error);
      return false;
    }
  }

  private persist() {
    localStorage.setItem('mock-db', JSON.stringify(this.db));
  }
  
  reset() {
    localStorage.removeItem('mock-db');
    return this.init();
  }
  
  // Event handling
  on<E extends keyof MockBackendEvents>(type: E, callback: (event: MockBackendEvents[E]) => void) {
    this.emitter.on(type, callback as any);
    return () => this.emitter.off(type, callback as any);
  }
  
  off<E extends keyof MockBackendEvents>(type: E, callback: (event: MockBackendEvents[E]) => void) {
    this.emitter.off(type, callback as any);
  }
  
  // simulateHits() method removed

  stopSimulation() {
    if (this.hitInterval) {
      clearInterval(this.hitInterval);
      this.hitInterval = null;
    }
  }
  
  // Targets API
  getTargets(): Target[] {
    return [...this.db.targets];
  }
  
  renameTarget(id: number, name: string): Target {
    const target = this.db.targets.find(t => t.id === id);
    if (!target) throw new Error(`Target ${id} not found`);
    
    target.name = name;
    this.persist();
    return { ...target };
  }
  
  assignRoom(targetId: number, roomId: number | null): Target {
    const target = this.db.targets.find(t => t.id === targetId);
    if (!target) throw new Error(`Target ${targetId} not found`);
    
    // Update the old room's target count if assigned
    if (target.roomId) {
      const oldRoom = this.db.rooms.find(r => r.id === target.roomId);
      if (oldRoom) {
        oldRoom.targetCount = Math.max(0, oldRoom.targetCount - 1);
      }
    }
    
    // Update the new room's target count
    if (roomId) {
      const newRoom = this.db.rooms.find(r => r.id === roomId);
      if (newRoom) {
        newRoom.targetCount += 1;
      }
    }
    
    target.roomId = roomId;
    this.persist();
    return { ...target };
  }
  
  deleteTarget(id: number): void {
    const index = this.db.targets.findIndex(t => t.id === id);
    if (index === -1) throw new Error(`Target ${id} not found`);
    
    // Update room target count
    const target = this.db.targets[index];
    if (target.roomId) {
      const room = this.db.rooms.find(r => r.id === target.roomId);
      if (room) {
        room.targetCount = Math.max(0, room.targetCount - 1);
      }
    }
    
    // Remove from any groups
    this.db.groups.forEach(group => {
      group.targetIds = group.targetIds.filter(tid => tid !== id);
    });
    
    // Remove from layouts
    this.db.layouts.forEach(layout => {
      layout.targets = layout.targets.filter(t => t.id !== id);
    });
    
    this.db.targets.splice(index, 1);
    this.persist();
  }
  
  // Rooms API
  getRooms(): Room[] {
    return [...this.db.rooms];
  }
  
  createRoom(name: string): Room {
    const id = Math.max(0, ...this.db.rooms.map(r => r.id)) + 1;
    const newRoom: Room = {
      id,
      name,
      order: this.db.rooms.length + 1,
      targetCount: 0
    };
    
    this.db.rooms.push(newRoom);
    this.persist();
    return { ...newRoom };
  }
  
  updateRoom(id: number, name: string): Room {
    const room = this.db.rooms.find(r => r.id === id);
    if (!room) throw new Error(`Room ${id} not found`);
    
    room.name = name;
    this.persist();
    return { ...room };
  }
  
  updateRoomOrder(orderedRooms: { id: number, order: number }[]): Room[] {
    orderedRooms.forEach(({ id, order }) => {
      const room = this.db.rooms.find(r => r.id === id);
      if (room) room.order = order;
    });
    
    this.persist();
    return this.db.rooms.map(r => ({ ...r }));
  }
  
  deleteRoom(id: number): void {
    const index = this.db.rooms.findIndex(r => r.id === id);
    if (index === -1) throw new Error(`Room ${id} not found`);
    
    // Unassign targets in this room
    this.db.targets.forEach(target => {
      if (target.roomId === id) {
        target.roomId = null;
      }
    });
    
    // Remove room layout
    const layoutIndex = this.db.layouts.findIndex(l => l.roomId === id);
    if (layoutIndex !== -1) {
      this.db.layouts.splice(layoutIndex, 1);
    }
    
    this.db.rooms.splice(index, 1);
    this.persist();
  }
  
  // Layout API
  getRoomLayout(roomId: number): { targets: TargetLayout[], groups: Group[] } {
    const layout = this.db.layouts.find(l => l.roomId === roomId);
    
    if (!layout) {
      return { targets: [], groups: [] };
    }
    
    return {
      targets: [...layout.targets],
      groups: [...layout.groups]
    };
  }
  
  saveRoomLayout(roomId: number, targets: TargetLayout[], groups: Group[]): boolean {
    let layout = this.db.layouts.find(l => l.roomId === roomId);
    
    if (!layout) {
      layout = { roomId, targets: [], groups: [] };
      this.db.layouts.push(layout);
    }
    
    layout.targets = [...targets];
    layout.groups = [...groups];
    this.persist();
    return true;
  }
  
  // Stats API
  getStats() {
    return JSON.parse(JSON.stringify(this.db.stats));
  }
  
  getHitStats() {
    return [...this.db.stats.hits];
  }
  
  // Sessions API
  getSessions(): Session[] {
    return [...this.db.sessions];
  }
  
  getScenarios(): Scenario[] {
    return [...this.db.scenarios];
  }
  
  // Additional APIs can be implemented as needed
}

export const mockBackend = new MockBackend();
