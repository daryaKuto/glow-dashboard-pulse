
import { BaseDb } from './BaseDb';
import type { ChartLeaderboardEntry } from '../types';

export class StatsDb extends BaseDb {
  getStats() {
    return {
      targets: {
        online: this.db?.targets?.filter(t => t.status === 'online')?.length || 0
      },
      rooms: {
        count: this.db?.rooms?.length || 0
      },
      sessions: {
        latest: this.db?.sessions?.[this.db.sessions.length - 1] || { score: 0 }
      }
    };
  }
  
  getHitStats() {
    return [...(this.db?.hitStats || [])];
  }
  
  getHits7d(): ChartLeaderboardEntry[] {
    if (!this.db.chartLeaderboards) {
      this.db.chartLeaderboards = [];
    }
    
    const days = [...Array(7)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().slice(0, 10);
    }).reverse();

    return days.map(day => {
      const record = this.db.chartLeaderboards.find(l => l.day === day);
      return { day, hits: record?.hits || 0 };
    });
  }

  private recordHit(targetId: number) {
    const day = new Date().toISOString().slice(0, 10);
    if (!this.db.chartLeaderboards) {
      this.db.chartLeaderboards = [];
    }
    
    const stat = this.db.chartLeaderboards.find(l => l.day === day) ||
      this.db.chartLeaderboards[this.db.chartLeaderboards.push({ day, hits: 0 }) - 1];
    stat.hits += 1;
    this.persist();
  }
  
  simulateHits() {
    const fire = () => {
      // Check if db is initialized and has targets property
      if (this.db?.targets && this.db.targets.length > 0) {
        const onlineTargets = this.db.targets.filter(t => t.status === 'online');
        if (onlineTargets.length) {
          const target = onlineTargets[Math.floor(Math.random() * onlineTargets.length)];
          this.recordHit(target.id);
          this.emit('hit', { 
            targetId: target.id,
            score: Math.floor(Math.random() * 10) + 1
          });
        }
      }
      setTimeout(fire, Math.floor(Math.random() * 9000) + 3000);
    };
    
    // Add a small delay to ensure db is initialized
    setTimeout(fire, 1000);
  }
}
