-- User-Specific Schema for Glow Dashboard Pulse
-- This schema stores ALL user data while ThingsBoard handles real-time scenarios
-- Run this in your Supabase SQL Editor

-- =========================
-- DROP EXISTING TABLES (if needed)
-- =========================

DROP TABLE IF EXISTS session_hits CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS user_room_targets CASCADE;
DROP TABLE IF EXISTS user_rooms CASCADE;
DROP TABLE IF EXISTS user_analytics CASCADE;
DROP TABLE IF EXISTS room_analytics CASCADE;
DROP TABLE IF EXISTS target_analytics CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS friends CASCADE;
DROP TABLE IF EXISTS invites CASCADE;

-- =========================
-- USER-SPECIFIC ROOMS & TARGETS
-- =========================

-- 1. User Rooms (each user has their own rooms)
CREATE TABLE user_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  room_type VARCHAR(50) DEFAULT 'living-room', -- living-room, bedroom, kitchen, etc.
  icon VARCHAR(50) DEFAULT 'home',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name) -- Users can't have duplicate room names
);

-- 2. User Room Targets (targets assigned to user's rooms)
CREATE TABLE user_room_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES user_rooms(id) ON DELETE CASCADE,
  target_id VARCHAR(255) NOT NULL, -- ThingsBoard target ID
  target_name VARCHAR(255) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, target_id) -- Each target can only be assigned to one room per user
);

-- =========================
-- ANALYTICS & SESSION DATA
-- =========================

-- 3. Sessions (all shooting sessions with full details)
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES user_rooms(id) ON DELETE SET NULL,
  room_name VARCHAR(255), -- Store name for historical data even if room is deleted
  scenario_name VARCHAR(255),
  scenario_type VARCHAR(100),
  
  -- Session metrics
  score INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  hit_count INTEGER DEFAULT 0,
  miss_count INTEGER DEFAULT 0,
  total_shots INTEGER DEFAULT 0,
  accuracy_percentage DECIMAL(5,2) DEFAULT 0,
  avg_reaction_time_ms INTEGER,
  best_reaction_time_ms INTEGER,
  worst_reaction_time_ms INTEGER,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- ThingsBoard data (JSON for flexibility)
  thingsboard_data JSONB DEFAULT '{}',
  raw_sensor_data JSONB DEFAULT '{}'
);

-- 4. Session Hits (detailed shot-by-shot data)
CREATE TABLE session_hits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Target info
  target_id VARCHAR(255),
  target_name VARCHAR(255),
  room_name VARCHAR(255),
  
  -- Hit metrics
  hit_type VARCHAR(50) DEFAULT 'hit', -- hit, miss, timeout
  reaction_time_ms INTEGER,
  score INTEGER DEFAULT 0,
  hit_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Position data (if available from sensors)
  hit_position JSONB DEFAULT '{}', -- {x, y, zone, etc}
  
  -- Raw ThingsBoard data
  sensor_data JSONB DEFAULT '{}'
);

-- =========================
-- ANALYTICS AGGREGATIONS
-- =========================

-- 5. User Analytics (daily/weekly/monthly aggregations)
CREATE TABLE user_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  period_type VARCHAR(20) DEFAULT 'daily', -- daily, weekly, monthly
  
  -- Session metrics
  total_sessions INTEGER DEFAULT 0,
  total_duration_ms BIGINT DEFAULT 0,
  avg_session_duration_ms INTEGER DEFAULT 0,
  
  -- Performance metrics
  total_score INTEGER DEFAULT 0,
  avg_score DECIMAL(10,2) DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  total_shots INTEGER DEFAULT 0,
  total_hits INTEGER DEFAULT 0,
  total_misses INTEGER DEFAULT 0,
  accuracy_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Reaction time metrics
  avg_reaction_time_ms INTEGER,
  best_reaction_time_ms INTEGER,
  worst_reaction_time_ms INTEGER,
  
  -- Improvement tracking
  score_improvement DECIMAL(10,2) DEFAULT 0,
  accuracy_improvement DECIMAL(5,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date, period_type)
);

-- =========================
-- CREATE INDEXES
-- =========================

-- User rooms indexes
CREATE INDEX idx_user_rooms_user_id ON user_rooms(user_id);
CREATE INDEX idx_user_rooms_order ON user_rooms(user_id, order_index);

-- User room targets indexes
CREATE INDEX idx_user_room_targets_user_id ON user_room_targets(user_id);
CREATE INDEX idx_user_room_targets_room_id ON user_room_targets(room_id);
CREATE INDEX idx_user_room_targets_target_id ON user_room_targets(target_id);

-- Sessions indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_room_id ON sessions(room_id);
CREATE INDEX idx_sessions_started_at ON sessions(started_at);

-- Session hits indexes
CREATE INDEX idx_session_hits_session_id ON session_hits(session_id);
CREATE INDEX idx_session_hits_user_id ON session_hits(user_id);

-- Analytics indexes
CREATE INDEX idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX idx_user_analytics_date ON user_analytics(date);

-- =========================
-- ENABLE ROW LEVEL SECURITY
-- =========================

ALTER TABLE user_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_room_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_analytics ENABLE ROW LEVEL SECURITY;

-- =========================
-- CREATE RLS POLICIES
-- =========================

-- User Rooms Policies
CREATE POLICY "Users can manage their own rooms" ON user_rooms
  FOR ALL USING (auth.uid() = user_id);

-- User Room Targets Policies
CREATE POLICY "Users can manage their own room targets" ON user_room_targets
  FOR ALL USING (auth.uid() = user_id);

-- Sessions Policies
CREATE POLICY "Users can manage their own sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id);

-- Session Hits Policies
CREATE POLICY "Users can manage their own session hits" ON session_hits
  FOR ALL USING (auth.uid() = user_id);

-- User Analytics Policies
CREATE POLICY "Users can view their own analytics" ON user_analytics
  FOR ALL USING (auth.uid() = user_id);

-- =========================
-- CREATE FUNCTIONS
-- =========================

-- Function to update updated_at timestamp
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

-- Updated_at triggers
CREATE TRIGGER update_user_rooms_updated_at
  BEFORE UPDATE ON user_rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_analytics_updated_at
  BEFORE UPDATE ON user_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- SUCCESS MESSAGE
-- =========================

SELECT 'User-specific schema with comprehensive analytics created successfully!' as status;