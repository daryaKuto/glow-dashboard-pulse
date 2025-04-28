
import { seed, DB } from '../staticData';
import bcrypt from 'bcryptjs';
import mitt from 'mitt';

// Define the event types for our emitter
export type MockBackendEvents = { 
  hit: { targetId: number; score: number }; 
  connectionStatus: { connected: boolean };
  score_update: { userId: string; hits: number; accuracy: number };
};

// Mock WebSocket interface
export interface MockWebSocket {
  onopen: ((ev: any) => any) | null;
  onmessage: ((ev: any) => any) | null;
  onclose: ((ev: any) => any) | null;
  onerror: ((ev: any) => any) | null;
  send: (data: string) => void;
  close: () => void;
}

class StaticDb {
  db: DB;
  emitter = mitt<MockBackendEvents>();

  constructor() {
    const saved = localStorage.getItem('mockDb');
    this.db = saved ? JSON.parse(saved) : structuredClone(seed);
    if (!saved) localStorage.setItem('mockDb', JSON.stringify(this.db));
  }
  
  persist() { 
    localStorage.setItem('mockDb', JSON.stringify(this.db)); 
  }

  /* AUTH */
  async signUp(email: string, password: string, userData?: { full_name?: string }) {
    // Check for existing user
    if (this.db.users.find(u => u.email === email)) {
      throw new Error('User already exists');
    }
    
    const id = `u${Date.now()}`;
    const hash = await bcrypt.hash(password, 10);
    
    this.db.users.push({
      id,
      email,
      pass: hash,
      name: userData?.full_name || '',
      phone: ''
    });
    
    this.persist();
    
    // Return user without password
    const { pass, ...user } = this.db.users.find(u => u.id === id)!;
    return { user };
  }
  
  async signIn(email: string, password: string) {
    const user = this.db.users.find(u => u.email === email);
    
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    const isValid = await bcrypt.compare(password, user.pass);
    
    if (!isValid) {
      throw new Error('Invalid email or password');
    }
    
    // Return user without password
    const { pass, ...userData } = user;
    return { user: userData };
  }
  
  async signOut() {
    // Just a stub for API compatibility
    return;
  }
  
  updateUser(id: string, data: any) {
    const index = this.db.users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error('User not found');
    }
    
    this.db.users[index] = { ...this.db.users[index], ...data };
    this.persist();
    
    const { pass, ...userData } = this.db.users[index];
    return { user: userData };
  }
  
  /* TARGETS */
  getTargets() {
    return [...this.db.targets];
  }
  
  renameTarget(id: number, name: string) {
    const target = this.db.targets.find(t => t.id === id);
    if (!target) throw new Error('Target not found');
    
    target.name = name;
    this.persist();
    return target;
  }
  
  assignRoom(targetId: number, roomId: number | null) {
    const target = this.db.targets.find(t => t.id === targetId);
    if (!target) throw new Error('Target not found');
    
    // If removing from a room, update the target count for that room
    if (target.roomId !== null) {
      const oldRoom = this.db.rooms.find(r => r.id === target.roomId);
      if (oldRoom) oldRoom.targetCount--;
    }
    
    // If adding to a room, update the target count for that room
    if (roomId !== null) {
      const newRoom = this.db.rooms.find(r => r.id === roomId);
      if (newRoom) newRoom.targetCount++;
    }
    
    target.roomId = roomId;
    this.persist();
    return target;
  }
  
  deleteTarget(id: number) {
    const index = this.db.targets.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Target not found');
    
    // Update room target count if needed
    const target = this.db.targets[index];
    if (target.roomId !== null) {
      const room = this.db.rooms.find(r => r.id === target.roomId);
      if (room) room.targetCount--;
    }
    
    this.db.targets.splice(index, 1);
    this.persist();
    return { success: true };
  }
  
  /* ROOMS */
  getRooms() {
    return [...this.db.rooms];
  }
  
  createRoom(name: string) {
    const id = this.db.rooms.length > 0 
      ? Math.max(...this.db.rooms.map(r => r.id)) + 1 
      : 1;
      
    const order = this.db.rooms.length > 0
      ? Math.max(...this.db.rooms.map(r => r.order)) + 1
      : 1;
    
    const newRoom = { id, name, order, targetCount: 0 };
    this.db.rooms.push(newRoom);
    this.persist();
    return newRoom;
  }
  
  updateRoom(id: number, name: string) {
    const room = this.db.rooms.find(r => r.id === id);
    if (!room) throw new Error('Room not found');
    
    room.name = name;
    this.persist();
    return room;
  }
  
  deleteRoom(id: number) {
    const index = this.db.rooms.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Room not found');
    
    // Unassign any targets in this room
    this.db.targets
      .filter(t => t.roomId === id)
      .forEach(t => t.roomId = null);
      
    this.db.rooms.splice(index, 1);
    this.persist();
    return { success: true };
  }
  
  updateRoomOrder(orderedRooms: { id: number, order: number }[]) {
    orderedRooms.forEach(update => {
      const room = this.db.rooms.find(r => r.id === update.id);
      if (room) room.order = update.order;
    });
    
    this.persist();
    return { success: true };
  }
  
  /* ROOM LAYOUTS */
  getRoomLayout(roomId: number) {
    const layout = this.db.layouts.find(l => l.roomId === roomId);
    
    if (layout) return layout;
    
    // Create empty layout if none exists
    return {
      roomId,
      targets: this.db.targets
        .filter(t => t.roomId === roomId)
        .map(t => ({ id: t.id, x: 100, y: 100 })),
      groups: []
    };
  }
  
  saveRoomLayout(roomId: number, targets: any[], groups: any[]) {
    const layoutIndex = this.db.layouts.findIndex(l => l.roomId === roomId);
    
    const layout = {
      roomId,
      targets: [...targets],
      groups: [...groups]
    };
    
    if (layoutIndex >= 0) {
      this.db.layouts[layoutIndex] = layout;
    } else {
      this.db.layouts.push(layout);
    }
    
    this.persist();
    return layout;
  }
  
  /* STATS */
  getStats() {
    return {
      targets: {
        online: this.db.targets.filter(t => t.status === 'online').length
      },
      rooms: {
        count: this.db.rooms.length
      },
      sessions: {
        latest: this.db.sessions[this.db.sessions.length - 1] || { score: 0 }
      }
    };
  }
  
  getHitStats() {
    return [...this.db.hitStats];
  }
  
  /* SCENARIOS */
  getScenarios() {
    return [...this.db.scenarios];
  }
  
  /* SESSIONS */
  getSessions() {
    return [...this.db.sessions];
  }
  
  startSession(scenarioId: number, includedRoomIds: number[]) {
    const scenario = this.db.scenarios.find(s => s.id === scenarioId);
    if (!scenario) throw new Error('Scenario not found');
    
    const id = this.db.sessions.length > 0 
      ? Math.max(...this.db.sessions.map(s => s.id)) + 1 
      : 1;
      
    const newSession = {
      id,
      name: scenario.name,
      date: new Date().toISOString(),
      duration: 0,
      score: 0,
      accuracy: 0
    };
    
    this.db.sessions.push(newSession);
    this.persist();
    return newSession;
  }
  
  endSession(sessionId: number) {
    const session = this.db.sessions.find(s => s.id === sessionId);
    if (!session) throw new Error('Session not found');
    
    // Update session stats
    session.duration = Math.floor(Math.random() * 30) + 15; // 15-45 minutes
    session.score = Math.floor(Math.random() * 100) + 50; // 50-150 score
    session.accuracy = Math.floor(Math.random() * 40) + 60; // 60-100% accuracy
    
    this.persist();
    return session;
  }
  
  /* EVENT BUS */
  on = this.emitter.on;
  off = this.emitter.off;
  
  emit(eventName: keyof MockBackendEvents, eventData: any) {
    this.emitter.emit(eventName, eventData);
  }
  
  simulateHits() {
    setInterval(() => {
      if (this.db.targets.filter(t => t.status === 'online').length) {
        const onlineTargets = this.db.targets.filter(t => t.status === 'online');
        const randomTarget = onlineTargets[Math.floor(Math.random() * onlineTargets.length)];
        const score = Math.floor(Math.random() * 10) + 1;
        
        this.emitter.emit('hit', { 
          targetId: randomTarget.id, 
          score: score
        });
        
        // Also update hit stats for today
        const today = new Date().toISOString().split('T')[0];
        const todayStat = this.db.hitStats.find(h => h.date === today);
        
        if (todayStat) {
          todayStat.hits += 1;
        } else {
          this.db.hitStats.push({ date: today, hits: 1 });
        }
        
        // Simulate score updates for active sessions
        if (this.db.players.length) {
          const randomPlayer = this.db.players[Math.floor(Math.random() * this.db.players.length)];
          randomPlayer.hits += 1;
          randomPlayer.accuracy = Math.min(100, randomPlayer.accuracy + Math.random() * 2 - 1);
          
          this.emitter.emit('score_update', {
            userId: randomPlayer.userId,
            hits: randomPlayer.hits,
            accuracy: Math.round(randomPlayer.accuracy)
          });
        }
        
        this.persist();
      }
    }, 3000);
  }

  // Create a mock WebSocket connection
  createWebSocket(): MockWebSocket {
    const socket: MockWebSocket = {
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      
      send: (data: string) => {
        console.log('Static WebSocket message sent:', data);
      },
      
      close: () => {
        this.off('hit', handleHit);
        this.off('connectionStatus', handleConnection);
        if (socket.onclose) socket.onclose({} as any);
      }
    };
    
    // Set up event handlers
    const handleHit = (event: { targetId: number; score: number }) => {
      if (socket.onmessage) {
        socket.onmessage({
          data: JSON.stringify({
            type: 'hit',
            targetId: event.targetId,
            score: event.score
          })
        } as any);
      }
    };
    
    const handleConnection = (event: { connected: boolean }) => {
      if (event.connected) {
        if (socket.onopen) socket.onopen({} as any);
      } else {
        if (socket.onclose) socket.onclose({} as any);
      }
    };
    
    // Register event handlers
    this.on('hit', handleHit);
    this.on('connectionStatus', handleConnection);
    
    // Trigger initial connection status after a short delay
    setTimeout(() => {
      this.emit('connectionStatus', { connected: true });
    }, 100);
    
    return socket;
  }
}

export const staticDb = new StaticDb();
