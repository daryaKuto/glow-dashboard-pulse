import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type UserAnalytics = Database['public']['Tables']['user_analytics']['Row'];
type Session = Database['public']['Tables']['sessions']['Row'];
type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

export interface UserProfileData {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  totalHits: number;
  totalShots: number;
  bestScore: number;
  totalSessions: number;
  avgAccuracy: number;
  avgReactionTime: number | null;
  bestReactionTime: number | null;
  totalDuration: number; // in milliseconds
  scoreImprovement: number;
  accuracyImprovement: number;
}

export interface RecentSession {
  id: string;
  scenarioName: string | null;
  score: number;
  accuracy: number;
  duration: number;
  hitCount: number;
  startedAt: string;
  endedAt: string | null;
}

/**
 * Fetch user profile data including aggregated analytics
 */
export const fetchUserProfileData = async (userId: string): Promise<UserProfileData | null> => {
  try {
    console.log('[Profile Service] Fetching profile data for user:', userId);
    
    // First try to get user info from user_profiles table
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    console.log('[Profile Service] User profile query result:', { userProfile, error: profileError?.message });

    // If no profile found, return null - no fake data
    if (profileError || !userProfile) {
      console.log('[Profile Service] No user profile found');
      return null;
    }

    const userInfo = userProfile;

    // Fetch latest user analytics (aggregated data)
    const { data: analytics, error: analyticsError } = await supabase
      .from('user_analytics')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', 'all_time') // Get all-time stats
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('[Profile Service] Analytics query result:', { analytics, error: analyticsError?.message });

    if (analyticsError && analyticsError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine for new users
      console.error('[Profile Service] Analytics error:', analyticsError);
      throw analyticsError;
    }

    // If no analytics exist, calculate from sessions
    if (!analytics) {
      console.log('[Profile Service] No analytics found, calculating from sessions');
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          score,
          hit_count,
          total_shots,
          accuracy_percentage,
          duration_ms,
          avg_reaction_time_ms,
          best_reaction_time_ms
        `)
        .eq('user_id', userId);

      console.log('[Profile Service] Sessions query result:', { sessions: sessions?.length, error: sessionsError?.message });
      if (sessionsError) throw sessionsError;

      // If no sessions exist, return null - no fake data
      if (!sessions || sessions.length === 0) {
        console.log('[Profile Service] No sessions found for user');
        return null;
      }

      // Calculate basic stats from sessions
      const totalSessions = sessions.length;
      const totalHits = sessions.reduce((sum, s) => sum + (s.hit_count || 0), 0);
      const totalShots = sessions.reduce((sum, s) => sum + (s.total_shots || 0), 0);
      const bestScore = sessions.reduce((max, s) => Math.max(max, s.score || 0), 0);
      const avgAccuracy = sessions.reduce((sum, s) => sum + (s.accuracy_percentage || 0), 0) / totalSessions;
      const totalDuration = sessions.reduce((sum, s) => sum + (s.duration_ms || 0), 0);

      // Calculate reaction times (filter out nulls)
      const reactionTimes = sessions.map(s => s.avg_reaction_time_ms).filter(rt => rt !== null) as number[];
      const avgReactionTime = reactionTimes.length > 0 
        ? reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length 
        : null;

      const bestReactionTimes = sessions.map(s => s.best_reaction_time_ms).filter(rt => rt !== null) as number[];
      const bestReactionTime = bestReactionTimes.length > 0 
        ? Math.min(...bestReactionTimes)
        : null;

      return {
        userId,
        email: userInfo.email || '',
        name: userInfo.display_name || userInfo.name || userInfo.email?.split('@')[0] || 'User',
        avatarUrl: userInfo.avatar_url,
        totalHits,
        totalShots,
        bestScore,
        totalSessions,
        avgAccuracy: Math.round(avgAccuracy * 100) / 100,
        avgReactionTime,
        bestReactionTime,
        totalDuration,
        scoreImprovement: 0, // Can't calculate without historical data
        accuracyImprovement: 0, // Can't calculate without historical data
      };
    }

    return {
      userId,
      email: userInfo.email || '',
      name: userInfo.display_name || userInfo.name || userInfo.email?.split('@')[0] || 'User',
      avatarUrl: userInfo.avatar_url,
      totalHits: analytics.total_hits,
      totalShots: analytics.total_shots,
      bestScore: analytics.best_score,
      totalSessions: analytics.total_sessions,
      avgAccuracy: Math.round(analytics.accuracy_percentage * 100) / 100,
      avgReactionTime: analytics.avg_reaction_time_ms,
      bestReactionTime: analytics.best_reaction_time_ms,
      totalDuration: analytics.total_duration_ms,
      scoreImprovement: analytics.score_improvement,
      accuracyImprovement: analytics.accuracy_improvement,
    };
  } catch (error) {
    console.error('Error fetching user profile data:', error);
    return null;
  }
};

/**
 * Fetch recent user sessions
 */
export const fetchRecentSessions = async (userId: string, limit = 10): Promise<RecentSession[]> => {
  try {
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        scenario_name,
        score,
        accuracy_percentage,
        duration_ms,
        hit_count,
        started_at,
        ended_at
      `)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return sessions?.map(session => ({
      id: session.id,
      scenarioName: session.scenario_name,
      score: session.score,
      accuracy: Math.round(session.accuracy_percentage * 100) / 100,
      duration: session.duration_ms,
      hitCount: session.hit_count,
      startedAt: session.started_at,
      endedAt: session.ended_at,
    })) || [];
  } catch (error) {
    console.error('Error fetching recent sessions:', error);
    return [];
  }
};

/**
 * Update user profile metadata (name, avatar, etc.)
 */
export const updateUserProfile = async (updates: {
  name?: string;
  avatarUrl?: string;
}): Promise<boolean> => {
  try {
    // Get current user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('No authenticated user found');
      return false;
    }

    // Update user_profiles table
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        name: updates.name,
        display_name: updates.name,
        avatar_url: updates.avatarUrl,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error updating user profile in database:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    return false;
  }
};

/**
 * Get user statistics trend over time
 */
export const getUserStatsTrend = async (
  userId: string, 
  periodType: 'daily' | 'weekly' | 'monthly' = 'daily',
  days = 30
): Promise<UserAnalytics[]> => {
  try {
    const { data: analytics, error } = await supabase
      .from('user_analytics')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', periodType)
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;
    return analytics || [];
  } catch (error) {
    console.error('Error fetching user stats trend:', error);
    return [];
  }
};
