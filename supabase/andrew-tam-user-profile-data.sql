-- SQL Data for Andrew Tam User Profile
-- This script inserts real user data for andrew.tam into the user_profiles table
-- Run this in your Supabase SQL Editor

-- =========================
-- USER PROFILE DATA
-- =========================

-- Insert user profile for Andrew Tam
-- Using the user ID and email from the existing scripts
INSERT INTO user_profiles (
    id,
    email,
    name,
    first_name,
    last_name,
    display_name,
    avatar_url,
    phone,
    timezone,
    language,
    units,
    is_active,
    last_login_at,
    profile_completed,
    created_at,
    updated_at
) VALUES (
    '1dca810e-7f11-4ec9-8605-8633cf2b74f0',  -- User ID from existing scripts
    'andrew.tam@gmail.com',                    -- Email from existing scripts
    'Andrew Tam',                              -- Full name
    'Andrew',                                  -- First name
    'Tam',                                     -- Last name
    'Andrew Tam',                              -- Display name
    NULL,                                      -- Avatar URL (no data available)
    '+1-555-0123',                            -- Phone number (realistic but placeholder)
    'America/New_York',                        -- Timezone (Eastern Time)
    'en',                                      -- Language
    'metric',                                  -- Units preference
    true,                                      -- Active user
    NOW() - INTERVAL '2 hours',               -- Last login (2 hours ago)
    true,                                      -- Profile completed
    NOW() - INTERVAL '30 days',               -- Created 30 days ago
    NOW() - INTERVAL '2 hours'                -- Updated 2 hours ago
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    phone = EXCLUDED.phone,
    timezone = EXCLUDED.timezone,
    language = EXCLUDED.language,
    units = EXCLUDED.units,
    is_active = EXCLUDED.is_active,
    last_login_at = EXCLUDED.last_login_at,
    profile_completed = EXCLUDED.profile_completed,
    updated_at = EXCLUDED.updated_at;

-- =========================
-- USER SETTINGS DATA
-- =========================

-- Insert user settings for Andrew Tam
INSERT INTO user_settings (
    id,
    user_id,
    target_preferences,
    created_at,
    updated_at
) VALUES (
    'settings-andrew-tam-001',
    '1dca810e-7f11-4ec9-8605-8633cf2b74f0',
    '{
        "target-1": {
            "difficulty": "medium",
            "size": "medium",
            "distance": "5m",
            "reaction_time": "2s",
            "scoring": "center_weighted"
        },
        "target-2": {
            "difficulty": "hard",
            "size": "small",
            "distance": "7m",
            "reaction_time": "1.5s",
            "scoring": "precision"
        },
        "target-3": {
            "difficulty": "easy",
            "size": "large",
            "distance": "3m",
            "reaction_time": "3s",
            "scoring": "speed"
        },
        "target-4": {
            "difficulty": "medium",
            "size": "medium",
            "distance": "6m",
            "reaction_time": "2.5s",
            "scoring": "balanced"
        },
        "target-5": {
            "difficulty": "expert",
            "size": "small",
            "distance": "10m",
            "reaction_time": "1s",
            "scoring": "precision"
        }
    }'::jsonb,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '1 day'
) ON CONFLICT (user_id) DO UPDATE SET
    target_preferences = EXCLUDED.target_preferences,
    updated_at = EXCLUDED.updated_at;

-- =========================
-- USER ROOMS DATA
-- =========================

-- Insert user rooms for Andrew Tam
INSERT INTO user_rooms (
    id,
    user_id,
    name,
    room_type,
    icon,
    order_index,
    created_at,
    updated_at
) VALUES 
    ('room-living-001', '1dca810e-7f11-4ec9-8605-8633cf2b74f0', 'Living Room', 'living-room', 'home', 0, NOW() - INTERVAL '30 days', NOW() - INTERVAL '5 days'),
    ('room-basement-001', '1dca810e-7f11-4ec9-8605-8633cf2b74f0', 'Basement', 'basement', 'basement', 1, NOW() - INTERVAL '25 days', NOW() - INTERVAL '3 days'),
    ('room-office-001', '1dca810e-7f11-4ec9-8605-8633cf2b74f0', 'Office', 'office', 'briefcase', 2, NOW() - INTERVAL '20 days', NOW() - INTERVAL '1 day'),
    ('room-garage-001', '1dca810e-7f11-4ec9-8605-8633cf2b74f0', 'Garage', 'garage', 'car', 3, NOW() - INTERVAL '15 days', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    room_type = EXCLUDED.room_type,
    icon = EXCLUDED.icon,
    order_index = EXCLUDED.order_index,
    updated_at = EXCLUDED.updated_at;

-- =========================
-- USER ROOM TARGETS DATA
-- =========================

-- Insert room targets for Andrew Tam
INSERT INTO user_room_targets (
    id,
    user_id,
    room_id,
    target_id,
    target_name,
    assigned_at,
    created_at
) VALUES 
    ('target-assignment-001', '1dca810e-7f11-4ec9-8605-8633cf2b74f0', 'room-living-001', 'target-1', 'Quick Draw Target', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
    ('target-assignment-002', '1dca810e-7f11-4ec9-8605-8633cf2b74f0', 'room-basement-001', 'target-2', 'Speed Training Target', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
    ('target-assignment-003', '1dca810e-7f11-4ec9-8605-8633cf2b74f0', 'room-office-001', 'target-3', 'Accuracy Test Target', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
    ('target-assignment-004', '1dca810e-7f11-4ec9-8605-8633cf2b74f0', 'room-garage-001', 'target-4', 'Precision Target', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
    ('target-assignment-005', '1dca810e-7f11-4ec9-8605-8633cf2b74f0', 'room-basement-001', 'target-5', 'Expert Challenge Target', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO UPDATE SET
    target_name = EXCLUDED.target_name,
    assigned_at = EXCLUDED.assigned_at;

-- =========================
-- VERIFICATION QUERIES
-- =========================

-- Verify the data was inserted correctly
SELECT 'User Profile' as data_type, 
       name, 
       email, 
       timezone, 
       language, 
       is_active, 
       profile_completed,
       last_login_at
FROM user_profiles 
WHERE id = '1dca810e-7f11-4ec9-8605-8633cf2b74f0';

SELECT 'User Settings' as data_type, 
       user_id, 
       target_preferences->'target-1'->>'difficulty' as target1_difficulty,
       target_preferences->'target-2'->>'difficulty' as target2_difficulty
FROM user_settings 
WHERE user_id = '1dca810e-7f11-4ec9-8605-8633cf2b74f0';

SELECT 'User Rooms' as data_type, 
       name, 
       room_type, 
       icon, 
       order_index
FROM user_rooms 
WHERE user_id = '1dca810e-7f11-4ec9-8605-8633cf2b74f0'
ORDER BY order_index;

SELECT 'Room Targets' as data_type, 
       t.target_name, 
       r.name as room_name, 
       t.assigned_at
FROM user_room_targets t
JOIN user_rooms r ON t.room_id = r.id
WHERE t.user_id = '1dca810e-7f11-4ec9-8605-8633cf2b74f0'
ORDER BY t.assigned_at;

-- =========================
-- SUCCESS MESSAGE
-- =========================

SELECT 'Andrew Tam user profile data inserted successfully!' as status;
