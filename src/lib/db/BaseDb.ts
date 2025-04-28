import { DB } from '../types';
import mitt from 'mitt';
import type { MockBackendEvents } from '../types';
import { seed } from '../../staticData';

export class BaseDb {
  db: DB;
  emitter = mitt<MockBackendEvents>();
  
  constructor() {
    const saved = localStorage.getItem('mockDb');
    this.db = saved ? JSON.parse(saved) : structuredClone(seed);
    
    if (!this.db.leaderboards) {
      this.db.leaderboards = [];
    }
    
    if (!saved) localStorage.setItem('mockDb', JSON.stringify(this.db));
  }
  
  persist() { 
    localStorage.setItem('mockDb', JSON.stringify(this.db)); 
  }
  
  on = this.emitter.on;
  off = this.emitter.off;
  
  emit(eventName: keyof MockBackendEvents, eventData: any) {
    this.emitter.emit(eventName, eventData);
  }
}
