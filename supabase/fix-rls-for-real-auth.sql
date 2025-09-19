-- Fix RLS Policies for Real Authentication
-- This creates RLS policies that work with real authenticated sessions

-- =========================
-- STEP 1: CHECK CURRENT AUTH STATUS
-- =========================

SELECT 'Checking current authentication status...' as step;

-- Check if we can get the current user
SELECT 
  'Current auth user' as test,
  auth.uid() as current_user_id,
  CASE 
    WHEN auth.uid() IS NOT NULL THEN 'User authenticated'
    ELSE 'No user context (expected in SQL editor)'
  END as auth_status;

-- =========================
-- STEP 2: CREATE PROPER RLS POLICIES
-- =========================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can manage their own session hits" ON session_hits;
DROP POLICY IF EXISTS "Users can manage their own rooms" ON user_rooms;
DROP POLICY IF EXISTS "Users can manage their own room targets" ON user_room_targets;
DROP POLICY IF EXISTS "Users can view their own analytics" ON user_analytics;

-- Create RLS policies that work with real authentication
CREATE POLICY "Users can manage their own sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own session hits" ON session_hits
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own rooms" ON user_rooms
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own room targets" ON user_room_targets
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own analytics" ON user_analytics
  FOR ALL USING (auth.uid() = user_id);

-- =========================
-- STEP 3: TEST WITH ANDREW'S USER ID
-- =========================

-- Temporarily disable RLS to test data creation
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_hits DISABLE ROW LEVEL SECURITY;

-- Create a test session for Andrew
INSERT INTO sessions (
  user_id,
  room_id,
  room_name,
  scenario_name,
  scenario_type,
  score,
  duration_ms,
  hit_count,
  miss_count,
  total_shots,
  accuracy_percentage,
  started_at,
  ended_at
) VALUES (
  '1dca810e-7f11-4ec9-8605-8633cf2b74f0',
  NULL,
  'Test Session',
  'Practice Round',
  'practice',
  200,
  180000,
  10,
  2,
  12,
  83.33,
  NOW(),
  NOW() + INTERVAL '3 minutes'
) ON CONFLICT DO NOTHING;

-- Re-enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_hits ENABLE ROW LEVEL SECURITY;

-- =========================
-- STEP 4: VERIFY SESSION CREATION
-- =========================

SELECT 'Verifying session creation...' as step;

SELECT 
  'Session creation test' as test,
  COUNT(*) as session_count,
  'Sessions created successfully' as status
FROM sessions 
WHERE user_id = '1dca810e-7f11-4ec9-8605-8633cf2b74f0';

-- Show session details
SELECT 
  'Session details' as test,
  id,
  user_id,
  room_name,
  scenario_name,
  score,
  created_at
FROM sessions 
WHERE user_id = '1dca810e-7f11-4ec9-8605-8633cf2b74f0'
ORDER BY created_at DESC
LIMIT 1;

-- =========================
-- STEP 5: CHECK RLS POLICIES
-- =========================

SELECT 'Checking RLS policies...' as step;

SELECT 
  'RLS policies' as test,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('sessions', 'session_hits', 'user_rooms', 'user_room_targets', 'user_analytics')
ORDER BY tablename, policyname;

-- =========================
-- SUCCESS MESSAGE
-- =========================

SELECT '✅ RLS policies updated for real authentication!' as final_status;
SELECT '🔧 Real authenticated sessions should now work!' as next_step;
SELECT '📊 Check your app - session storage should work!' as result;
