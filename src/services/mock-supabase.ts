/**
 * Mock Supabase Data Service
 * Provides placeholder data for demo mode - mimics Supabase database responses
 */

export interface MockRoom {
  id: string;
  name: string;
  order_index: number;
  icon: string;
  room_type: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface MockUserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface MockGameSession {
  id: string;
  user_id: string;
  game_id: string;
  game_name: string;
  start_time: number;
  end_time: number;
  duration: number;
  total_hits: number;
  created_at: string;
}

export interface MockUserAnalytics {
  id: string;
  user_id: string;
  period_type: 'all_time' | 'monthly' | 'weekly' | 'daily';
  total_sessions: number;
  total_hits: number;
  average_score: number;
  best_score: number;
  total_duration: number;
  created_at: string;
  updated_at: string;
}

export interface MockRecentSession {
  id: string;
  user_id: string;
  game_name: string;
  score: number;
  duration: number;
  created_at: string;
  game_summary?: any;
}

// Mock rooms data
const MOCK_ROOMS: MockRoom[] = [
  {
    id: 'mock-room-001',
    name: 'Training Range A',
    order_index: 1,
    icon: 'target',
    room_type: 'training',
    user_id: 'demo-user',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-room-002',
    name: 'Competition Range',
    order_index: 2,
    icon: 'trophy',
    room_type: 'competition',
    user_id: 'demo-user',
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-room-003',
    name: 'Practice Zone',
    order_index: 3,
    icon: 'dumbbell',
    room_type: 'practice',
    user_id: 'demo-user',
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Mock user profile
const MOCK_USER_PROFILE: MockUserProfile = {
  id: 'demo-user',
  email: 'demo@example.com',
  full_name: 'Demo User',
  avatar_url: undefined,
  created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date().toISOString()
};

// Mock game sessions
const MOCK_GAME_SESSIONS: MockGameSession[] = [
  {
    id: 'mock-session-001',
    user_id: 'demo-user',
    game_id: 'GM-001',
    game_name: 'Quick Practice',
    start_time: Date.now() - 5 * 24 * 60 * 60 * 1000,
    end_time: Date.now() - 5 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000,
    duration: 15,
    total_hits: 45,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-session-002',
    user_id: 'demo-user',
    game_id: 'GM-002',
    game_name: 'Accuracy Training',
    start_time: Date.now() - 3 * 24 * 60 * 60 * 1000,
    end_time: Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
    duration: 30,
    total_hits: 78,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-session-003',
    user_id: 'demo-user',
    game_id: 'GM-003',
    game_name: 'Speed Challenge',
    start_time: Date.now() - 1 * 24 * 60 * 60 * 1000,
    end_time: Date.now() - 1 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000,
    duration: 20,
    total_hits: 62,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Mock user analytics
const MOCK_USER_ANALYTICS: MockUserAnalytics = {
  id: 'mock-analytics-001',
  user_id: 'demo-user',
  period_type: 'all_time',
  total_sessions: 15,
  total_hits: 850,
  average_score: 56,
  best_score: 92,
  total_duration: 450, // minutes
  created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date().toISOString()
};

// Mock recent sessions for profile - matching Supabase sessions schema
const MOCK_RECENT_SESSIONS: MockRecentSession[] = [
  {
    id: 'mock-recent-001',
    user_id: 'demo-user',
    game_name: 'Speed Challenge',
    score: 62,
    duration: 1200,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    game_summary: {
      scenarioName: 'Speed Challenge',
      scenarioType: 'speed',
      roomName: 'Training Range A',
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 1200 * 1000).toISOString(),
      hitCount: 62,
      totalShots: 75,
      avgReactionTime: 285,
      bestReactionTime: 195
    }
  },
  {
    id: 'mock-recent-002',
    user_id: 'demo-user',
    game_name: 'Accuracy Training',
    score: 78,
    duration: 1800,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    game_summary: {
      scenarioName: 'Accuracy Training',
      scenarioType: 'accuracy',
      roomName: 'Competition Range',
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 1800 * 1000).toISOString(),
      hitCount: 78,
      totalShots: 85,
      avgReactionTime: 310,
      bestReactionTime: 175
    }
  },
  {
    id: 'mock-recent-003',
    user_id: 'demo-user',
    game_name: 'Quick Practice',
    score: 45,
    duration: 900,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    game_summary: {
      scenarioName: 'Quick Practice',
      scenarioType: 'practice',
      roomName: 'Practice Zone',
      startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 900 * 1000).toISOString(),
      hitCount: 45,
      totalShots: 60,
      avgReactionTime: 340,
      bestReactionTime: 210
    }
  },
  {
    id: 'mock-recent-004',
    user_id: 'demo-user',
    game_name: 'Endurance Test',
    score: 92,
    duration: 3600,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    game_summary: {
      scenarioName: 'Endurance Test',
      scenarioType: 'endurance',
      roomName: 'Training Range A',
      startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 3600 * 1000).toISOString(),
      hitCount: 92,
      totalShots: 100,
      avgReactionTime: 295,
      bestReactionTime: 165
    }
  },
  {
    id: 'mock-recent-005',
    user_id: 'demo-user',
    game_name: 'Precision Drill',
    score: 54,
    duration: 1500,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    game_summary: {
      scenarioName: 'Precision Drill',
      scenarioType: 'precision',
      roomName: 'Competition Range',
      startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 1500 * 1000).toISOString(),
      hitCount: 54,
      totalShots: 70,
      avgReactionTime: 325,
      bestReactionTime: 190
    }
  }
];

class MockSupabaseService {
  private rooms: MockRoom[] = [...MOCK_ROOMS];
  private userProfile: MockUserProfile = { ...MOCK_USER_PROFILE };
  private gameSessions: MockGameSession[] = [...MOCK_GAME_SESSIONS];
  private userAnalytics: MockUserAnalytics = { ...MOCK_USER_ANALYTICS };
  private recentSessions: MockRecentSession[] = [...MOCK_RECENT_SESSIONS];
  private targetAssignments: Map<string, string> = new Map(); // targetId -> roomId

  /**
   * Get all rooms for the current user
   */
  getUserRooms(): MockRoom[] {
    console.log('🎭 DEMO: Fetching mock rooms');
    return this.rooms.map(r => ({ ...r }));
  }

  /**
   * Get a specific room by ID
   */
  getRoom(roomId: string): MockRoom | null {
    const room = this.rooms.find(r => r.id === roomId);
    return room ? { ...room } : null;
  }

  /**
   * Create a new room
   */
  createRoom(roomData: Partial<MockRoom>): MockRoom {
    console.log('🎭 DEMO: Creating mock room', roomData);
    const newRoom: MockRoom = {
      id: `mock-room-${Date.now()}`,
      name: roomData.name || 'New Room',
      order_index: this.rooms.length + 1,
      icon: roomData.icon || 'home',
      room_type: roomData.room_type || 'training',
      user_id: 'demo-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.rooms.push(newRoom);
    return { ...newRoom };
  }

  /**
   * Update a room
   */
  updateRoom(roomId: string, updates: Partial<MockRoom>): MockRoom | null {
    console.log('🎭 DEMO: Updating mock room', roomId, updates);
    const room = this.rooms.find(r => r.id === roomId);
    if (!room) return null;

    Object.assign(room, updates, { updated_at: new Date().toISOString() });
    return { ...room };
  }

  /**
   * Delete a room
   */
  deleteRoom(roomId: string): boolean {
    console.log('🎭 DEMO: Deleting mock room', roomId);
    const index = this.rooms.findIndex(r => r.id === roomId);
    if (index === -1) return false;

    this.rooms.splice(index, 1);
    
    // Remove all target assignments for this room
    for (const [targetId, assignedRoomId] of this.targetAssignments.entries()) {
      if (assignedRoomId === roomId) {
        this.targetAssignments.delete(targetId);
      }
    }
    
    return true;
  }

  /**
   * Get targets assigned to a room
   */
  getRoomTargets(roomId: string): string[] {
    const targetIds: string[] = [];
    for (const [targetId, assignedRoomId] of this.targetAssignments.entries()) {
      if (assignedRoomId === roomId) {
        targetIds.push(targetId);
      }
    }
    return targetIds;
  }

  /**
   * Assign target to room
   */
  assignTargetToRoom(targetId: string, roomId: string | null): void {
    console.log(`🎭 DEMO: Assigning target ${targetId} to room ${roomId}`);
    if (roomId === null) {
      this.targetAssignments.delete(targetId);
    } else {
      this.targetAssignments.set(targetId, roomId);
    }
  }

  /**
   * Get user profile
   */
  getUserProfile(userId: string): MockUserProfile | null {
    console.log('🎭 DEMO: Fetching mock user profile', userId);
    return { ...this.userProfile };
  }

  /**
   * Get user analytics
   */
  getUserAnalytics(userId: string): MockUserAnalytics | null {
    console.log('🎭 DEMO: Fetching mock user analytics', userId);
    return { ...this.userAnalytics };
  }

  /**
   * Get game sessions
   */
  getGameSessions(userId: string, limit: number = 10): MockGameSession[] {
    console.log(`🎭 DEMO: Fetching mock game sessions (limit: ${limit})`);
    return this.gameSessions.slice(0, limit).map(s => ({ ...s }));
  }

  /**
   * Store game summary
   */
  storeGameSummary(sessionData: Partial<MockGameSession>): string {
    console.log('🎭 DEMO: Storing mock game summary', sessionData);
    const newSession: MockGameSession = {
      id: `mock-session-${Date.now()}`,
      user_id: 'demo-user',
      game_id: sessionData.game_id || `GM-${Date.now()}`,
      game_name: sessionData.game_name || 'New Game',
      start_time: sessionData.start_time || Date.now(),
      end_time: sessionData.end_time || Date.now(),
      duration: sessionData.duration || 0,
      total_hits: sessionData.total_hits || 0,
      created_at: new Date().toISOString()
    };
    this.gameSessions.unshift(newSession);
    
    // Update analytics
    this.userAnalytics.total_sessions++;
    this.userAnalytics.total_hits += newSession.total_hits;
    this.userAnalytics.total_duration += newSession.duration;
    this.userAnalytics.average_score = Math.round(this.userAnalytics.total_hits / this.userAnalytics.total_sessions);
    if (newSession.total_hits > this.userAnalytics.best_score) {
      this.userAnalytics.best_score = newSession.total_hits;
    }
    
    return newSession.id;
  }

  /**
   * Get recent sessions for profile - matching Supabase sessions table format
   */
  getRecentSessions(userId: string, limit: number = 10): MockRecentSession[] {
    console.log(`🎭 DEMO: Fetching mock recent sessions (limit: ${limit})`);
    return this.recentSessions.slice(0, limit).map(s => {
      const hitCount = s.game_summary?.hitCount || s.score;
      const totalShots = s.game_summary?.totalShots || Math.ceil(s.score * 1.2);
      const accuracy = totalShots > 0 ? (hitCount / totalShots) * 100 : 0;
      
      return {
        ...s,
        // Add fields that Profile page expects
        scenarioName: s.game_summary?.scenarioName || s.game_name,
        scenarioType: s.game_summary?.scenarioType,
        roomName: s.game_summary?.roomName,
        startedAt: s.game_summary?.startedAt || s.created_at,
        endedAt: s.game_summary?.endedAt,
        hitCount,
        totalShots,
        accuracy,
        missCount: totalShots - hitCount,
        avgReactionTime: s.game_summary?.avgReactionTime,
        bestReactionTime: s.game_summary?.bestReactionTime
      };
    });
  }

  /**
   * Get dashboard stats
   */
  getDashboardStats(): {
    totalSessions: number;
    totalHits: number;
    averageScore: number;
    bestScore: number;
  } {
    console.log('🎭 DEMO: Fetching mock dashboard stats');
    return {
      totalSessions: this.userAnalytics.total_sessions,
      totalHits: this.userAnalytics.total_hits,
      averageScore: this.userAnalytics.average_score,
      bestScore: this.userAnalytics.best_score
    };
  }

  /**
   * Get hit trend data for charts (7 days)
   */
  getHitTrend(): Array<{ date: string; hits: number }> {
    console.log('🎭 DEMO: Generating mock hit trend data');
    const trend: Array<{ date: string; hits: number }> = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Generate realistic hit counts (higher on recent days)
      const baseHits = 20 + Math.floor(Math.random() * 30);
      const recencyBonus = (6 - i) * 5;
      const hits = baseHits + recencyBonus;
      
      trend.push({ date: dateStr, hits });
    }
    
    return trend;
  }

  /**
   * Reset all data to initial state
   */
  reset(): void {
    console.log('🎭 DEMO: Resetting mock Supabase data');
    this.rooms = [...MOCK_ROOMS];
    this.userProfile = { ...MOCK_USER_PROFILE };
    this.gameSessions = [...MOCK_GAME_SESSIONS];
    this.userAnalytics = { ...MOCK_USER_ANALYTICS };
    this.recentSessions = [...MOCK_RECENT_SESSIONS];
    this.targetAssignments.clear();
  }
}

// Export singleton instance
export const mockSupabaseService = new MockSupabaseService();

