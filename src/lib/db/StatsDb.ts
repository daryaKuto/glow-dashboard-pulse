
import { BaseDb } from './BaseDb';
import type { ChartLeaderboardEntry } from '../types';
import { WebSocketDb } from './WebSocketDb';

export class StatsDb extends WebSocketDb {
  getStats() {
    // Ensure we have stats data
    if (!this.db.stats) {
      this.db.stats = {
        targets: {
          total: this.db.targets?.length || 0,
          online: this.db.targets?.filter(t => t.status === 'online')?.length || 0
        },
        rooms: {
          count: this.db.rooms?.length || 0
        },
        sessions: {
          latest: this.db.sessions?.[0] || { score: 0, id: 0 }
        }
      };
      this.persist();
    }
    
    // Calculate current stats
    return {
      targets: {
        total: this.db.targets?.length || 0,
        online: this.db.targets?.filter(t => t.status === 'online')?.length || 0
      },
      rooms: {
        count: this.db.rooms?.length || 0
      },
      sessions: {
        latest: this.db.sessions?.[0] || { score: 0, id: 0 }
      },
      invites: this.db.friends?.filter(f => f.status === "pending")?.length || 0
    };
  }
  
  getHitStats() {
    if (!this.db.chartLeaderboards) {
      // Initialize with sample data for the last 7 days
      const days = [...Array(7)].map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i)); // Last 7 days with today
        return date.toISOString().split('T')[0];
      });
      
      this.db.chartLeaderboards = days.map(day => ({
        day, 
        hits: Math.floor(Math.random() * 70) + 30 // Random hits between 30-100
      }));
      
      this.persist();
    }
    
    return [...(this.db.chartLeaderboards || [])];
  }
  
  getHits7d(): ChartLeaderboardEntry[] {
    if (!this.db.chartLeaderboards || this.db.chartLeaderboards.length === 0) {
      this.getHitStats(); // Initialize if empty
    }
    
    const days = [...Array(7)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i)); // Last 7 days with today
      return date.toISOString().split('T')[0];
    });

    return days.map(day => {
      const record = this.db.chartLeaderboards.find(l => l.day === day);
      return { day, hits: record?.hits || 0 };
    });
  }
}
