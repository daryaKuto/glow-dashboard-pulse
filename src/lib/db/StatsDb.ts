
import { BaseDb } from './BaseDb';
import type { LeaderboardEntry } from '../types';

export class StatsDb extends BaseDb {
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
  
  getHits7d(): LeaderboardEntry[] {
    if (!this.db.leaderboards) {
      this.db.leaderboards = [];
    }
    
    const days = [...Array(7)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().slice(0, 10);
    }).reverse();

    return days.map(day => {
      const record = this.db.leaderboards.find(l => l.day === day);
      return { day, hits: record?.hits || 0 };
    });
  }

  private recordHit(targetId: number) {
    const day = new Date().toISOString().slice(0, 10);
    if (!this.db.leaderboards) {
      this.db.leaderboards = [];
    }
    
    const stat = this.db.leaderboards.find(l => l.day === day) ||
      this.db.leaderboards[this.db.leaderboards.push({ day, hits: 0 }) - 1];
    stat.hits += 1;
    this.persist();
  }
  
  simulateHits() {
    const fire = () => {
      const onlineTargets = this.db.targets.filter(t => t.status === 'online');
      if (onlineTargets.length) {
        const target = onlineTargets[Math.floor(Math.random() * onlineTargets.length)];
        this.recordHit(target.id);
        this.emitter.emit('hit', { 
          targetId: target.id,
          score: Math.floor(Math.random() * 10) + 1
        });
      }
      setTimeout(fire, Math.floor(Math.random() * 9000) + 3000);
    };
    
    fire();
  }
}
