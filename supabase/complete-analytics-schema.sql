-- Complete Analytics Schema for Glow Dashboard Pulse
-- Run this in your Supabase SQL Editor

-- =========================
-- DROP EXISTING SCHEMA (if needed)
-- =========================

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS invites CASCADE;
DROP TABLE IF EXISTS friends CASCADE;
DROP TABLE IF EXISTS target_analytics CASCADE;
DROP TABLE IF EXISTS room_analytics CASCADE;
DROP TABLE IF EXISTS user_analytics CASCADE;
DROP TABLE IF EXISTS session_hits CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

-- =========================
-- CREATE TABLES
-- =========================

-- 1. Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  room_name VARCHAR(255),
  target_count INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  hit_count INTEGER DEFAULT 0,
  miss_count INTEGER DEFAULT 0,
  avg_reaction_time_ms INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Session hits table
CREATE TABLE IF NOT EXISTS session_hits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  target_name VARCHAR(255),
  room_name VARCHAR(255),
  reaction_time_ms INTEGER,
  hit_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  score INTEGER DEFAULT 0
);

-- 3. User analytics table
CREATE TABLE IF NOT EXISTS user_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  total_sessions INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  total_hits INTEGER DEFAULT 0,
  total_misses INTEGER DEFAULT 0,
  avg_reaction_time_ms INTEGER,
  best_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 4. Room analytics table
CREATE TABLE IF NOT EXISTS room_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_name VARCHAR(255) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  total_sessions INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  total_hits INTEGER DEFAULT 0,
  total_misses INTEGER DEFAULT 0,
  avg_reaction_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_name, date)
);

-- 5. Target analytics table
CREATE TABLE IF NOT EXISTS target_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_name VARCHAR(255) NOT NULL,
  room_name VARCHAR(255),
  date DATE DEFAULT CURRENT_DATE,
  total_hits INTEGER DEFAULT 0,
  total_misses INTEGER DEFAULT 0,
  avg_reaction_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(target_name, date)
);

-- 6. Friends table
CREATE TABLE IF NOT EXISTS friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- 7. Invites table
CREATE TABLE IF NOT EXISTS invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'light',
  notifications_enabled BOOLEAN DEFAULT true,
  auto_start_sessions BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =========================
-- CREATE INDEXES
-- =========================

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_session_hits_session_id ON session_hits(session_id);
CREATE INDEX IF NOT EXISTS idx_session_hits_hit_timestamp ON session_hits(hit_timestamp);
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_date ON user_analytics(date);
CREATE INDEX IF NOT EXISTS idx_room_analytics_room_name ON room_analytics(room_name);
CREATE INDEX IF NOT EXISTS idx_room_analytics_date ON room_analytics(date);
CREATE INDEX IF NOT EXISTS idx_target_analytics_target_name ON target_analytics(target_name);
CREATE INDEX IF NOT EXISTS idx_target_analytics_date ON target_analytics(date);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);
CREATE INDEX IF NOT EXISTS idx_invites_invitee_id ON invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);

-- =========================
-- ENABLE ROW LEVEL SECURITY
-- =========================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- =========================
-- CREATE RLS POLICIES
-- =========================

-- Sessions policies
CREATE POLICY "Users can view their own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Session hits policies
CREATE POLICY "Users can view hits from their sessions" ON session_hits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = session_hits.session_id 
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert hits to their sessions" ON session_hits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = session_hits.session_id 
      AND sessions.user_id = auth.uid()
    )
  );

-- User analytics policies
CREATE POLICY "Users can view their own analytics" ON user_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics" ON user_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analytics" ON user_analytics
  FOR UPDATE USING (auth.uid() = user_id);

-- Room analytics policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view room analytics" ON room_analytics
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert room analytics" ON room_analytics
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update room analytics" ON room_analytics
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Target analytics policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view target analytics" ON target_analytics
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert target analytics" ON target_analytics
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update target analytics" ON target_analytics
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Friends policies
CREATE POLICY "Users can view their own friend relationships" ON friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert friend relationships" ON friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friend relationships" ON friends
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete their own friend relationships" ON friends
  FOR DELETE USING (auth.uid() = user_id);

-- Invites policies
CREATE POLICY "Users can view invites they sent or received" ON invites
  FOR SELECT USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Users can insert invites" ON invites
  FOR INSERT WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update invites they sent or received" ON invites
  FOR UPDATE USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- User preferences policies
CREATE POLICY "Users can view their own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- =========================
-- CREATE FUNCTION
-- =========================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- =========================
-- CREATE TRIGGERS
-- =========================

DROP TRIGGER IF EXISTS update_user_analytics_updated_at ON user_analytics;
CREATE TRIGGER update_user_analytics_updated_at
  BEFORE UPDATE ON user_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_room_analytics_updated_at ON room_analytics;
CREATE TRIGGER update_room_analytics_updated_at
  BEFORE UPDATE ON room_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_target_analytics_updated_at ON target_analytics;
CREATE TRIGGER update_target_analytics_updated_at
  BEFORE UPDATE ON target_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_friends_updated_at ON friends;
CREATE TRIGGER update_friends_updated_at
  BEFORE UPDATE ON friends
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invites_updated_at ON invites;
CREATE TRIGGER update_invites_updated_at
  BEFORE UPDATE ON invites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- SUCCESS MESSAGE
-- =========================

SELECT 'Complete analytics schema created successfully!' as status; 