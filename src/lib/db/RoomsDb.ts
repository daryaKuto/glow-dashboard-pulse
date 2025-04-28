
import { BaseDb } from './BaseDb';
import type { RoomLayoutResponse } from '../types';

export class RoomsDb extends BaseDb {
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
  
  getRoomLayout(roomId: number): RoomLayoutResponse {
    const layout = this.db.layouts.find(l => l.roomId === roomId);
    
    if (layout) return {
      targets: [...layout.targets],
      groups: [...layout.groups]
    };
    
    return {
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
}
