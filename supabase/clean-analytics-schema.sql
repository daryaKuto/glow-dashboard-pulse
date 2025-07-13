-- Clean Analytics Schema for Glow Dashboard Pulse
-- Run this in your Supabase SQL Editor

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

SELECT 'Analytics schema created successfully!' as status; 