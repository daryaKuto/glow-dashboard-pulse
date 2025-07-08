-- Row Level Security Policies for Glow Dashboard Pulse
-- Run this in your Supabase SQL Editor to allow test data population

-- Temporarily disable RLS for testing (you can re-enable later)
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE targets DISABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_hits DISABLE ROW LEVEL SECURITY;
ALTER TABLE friends DISABLE ROW LEVEL SECURITY;
ALTER TABLE invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;

-- Alternative: Create policies that allow all operations (for development)
-- Uncomment these if you want to keep RLS enabled but allow all operations

/*
-- Rooms policies
CREATE POLICY "Allow all operations on rooms" ON rooms
  FOR ALL USING (true) WITH CHECK (true);

-- Targets policies  
CREATE POLICY "Allow all operations on targets" ON targets
  FOR ALL USING (true) WITH CHECK (true);

-- Scenarios policies
CREATE POLICY "Allow all operations on scenarios" ON scenarios
  FOR ALL USING (true) WITH CHECK (true);

-- Sessions policies
CREATE POLICY "Allow all operations on sessions" ON sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Session hits policies
CREATE POLICY "Allow all operations on session_hits" ON session_hits
  FOR ALL USING (true) WITH CHECK (true);

-- Friends policies
CREATE POLICY "Allow all operations on friends" ON friends
  FOR ALL USING (true) WITH CHECK (true);

-- Invites policies
CREATE POLICY "Allow all operations on invites" ON invites
  FOR ALL USING (true) WITH CHECK (true);

-- User settings policies
CREATE POLICY "Allow all operations on user_settings" ON user_settings
  FOR ALL USING (true) WITH CHECK (true);
*/

-- Success message
SELECT 'RLS disabled for testing. Run test data population script now.' as status; 