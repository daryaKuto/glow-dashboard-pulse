
import { BaseDb } from './BaseDb';

export class TargetsDb extends BaseDb {
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
    
    if (target.roomId !== null) {
      const oldRoom = this.db.rooms.find(r => r.id === target.roomId);
      if (oldRoom) oldRoom.targetCount--;
    }
    
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
    
    const target = this.db.targets[index];
    if (target.roomId !== null) {
      const room = this.db.rooms.find(r => r.id === target.roomId);
      if (room) room.targetCount--;
    }
    
    this.db.targets.splice(index, 1);
    this.persist();
    return { success: true };
  }
}
