#!/bin/bash

# Script to populate mock data for dev user andrew.tam in Supabase
# This creates realistic session and analytics data for testing the Profile page

set -e  # Exit on any error

echo "🚀 Starting dev data population for andrew.tam..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Dev user details
DEV_USER_EMAIL="andrew.tam@example.com"
DEV_USER_NAME="Andrew Tam"

# Check if required environment variables are set
if [ -z "$SUPABASE_PROJECT_REF" ] || [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ Missing required environment variables${NC}"
    echo "Required: SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN"
    echo "You can get these from your Supabase dashboard"
    exit 1
fi

# Function to execute SQL commands
execute_sql() {
    local sql_command="$1"
    local description="$2"
    
    echo -e "${BLUE}📋 ${description}${NC}"
    
    # Use Supabase CLI to execute SQL
    echo "$sql_command" | supabase db sql --project-ref="$SUPABASE_PROJECT_REF" --linked=false
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${description} completed${NC}"
    else
        echo -e "${RED}❌ ${description} failed${NC}"
        exit 1
    fi
}

# Function to get user ID
get_user_id() {
    echo -e "${BLUE}📋 Getting user ID for ${DEV_USER_EMAIL}${NC}"
    
    # Get user ID from auth.users table
    USER_ID=$(echo "SELECT id FROM auth.users WHERE email = '$DEV_USER_EMAIL' LIMIT 1;" | supabase db sql --project-ref="$SUPABASE_PROJECT_REF" --linked=false --csv | tail -n +2)
    
    if [ -z "$USER_ID" ]; then
        echo -e "${RED}❌ User $DEV_USER_EMAIL not found in Supabase Auth${NC}"
        echo "Please make sure the user exists in your Supabase project"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Found user: $DEV_USER_EMAIL (${USER_ID})${NC}"
}

# Function to clean existing data
clean_existing_data() {
    local sql="
    -- Clean existing data for user
    DELETE FROM session_hits WHERE user_id = '$USER_ID';
    DELETE FROM sessions WHERE user_id = '$USER_ID';
    DELETE FROM user_analytics WHERE user_id = '$USER_ID';
    "
    
    execute_sql "$sql" "Cleaning existing data"
}

# Function to create mock sessions
create_mock_sessions() {
    local sql="
    -- Insert mock sessions for the last 30 days
    INSERT INTO sessions (
        id, user_id, room_name, scenario_name, scenario_type, score, duration_ms,
        hit_count, miss_count, total_shots, accuracy_percentage,
        avg_reaction_time_ms, best_reaction_time_ms, worst_reaction_time_ms,
        started_at, ended_at, created_at, thingsboard_data, raw_sensor_data
    ) VALUES 
    -- Session 1: Recent high score
    ('session-1-$USER_ID', '$USER_ID', 'Living Room', 'Quick Draw Challenge', 'training', 890, 120000, 28, 7, 35, 80.00, 180, 145, 220, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '2 minutes', NOW() - INTERVAL '2 days', '{\"targetIds\": [\"target-1\"], \"sensorReadings\": 85}', '{\"device_id\": \"dryfire-1\", \"shots\": 35, \"hits\": 28}'),
    
    -- Session 2: Speed training
    ('session-2-$USER_ID', '$USER_ID', 'Basement', 'Speed Training', 'training', 720, 95000, 22, 8, 30, 73.33, 165, 130, 210, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '1 minute 35 seconds', NOW() - INTERVAL '4 days', '{\"targetIds\": [\"target-2\"], \"sensorReadings\": 78}', '{\"device_id\": \"dryfire-2\", \"shots\": 30, \"hits\": 22}'),
    
    -- Session 3: Accuracy focus
    ('session-3-$USER_ID', '$USER_ID', 'Office', 'Accuracy Test', 'training', 950, 180000, 38, 2, 40, 95.00, 220, 180, 280, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' + INTERVAL '3 minutes', NOW() - INTERVAL '6 days', '{\"targetIds\": [\"target-3\"], \"sensorReadings\": 92}', '{\"device_id\": \"dryfire-3\", \"shots\": 40, \"hits\": 38}'),
    
    -- Session 4: Mixed performance
    ('session-4-$USER_ID', '$USER_ID', 'Garage', 'Target Practice', 'training', 650, 140000, 20, 12, 32, 62.50, 195, 160, 250, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days' + INTERVAL '2 minutes 20 seconds', NOW() - INTERVAL '8 days', '{\"targetIds\": [\"target-1\"], \"sensorReadings\": 68}', '{\"device_id\": \"dryfire-1\", \"shots\": 32, \"hits\": 20}'),
    
    -- Session 5: Reaction time test
    ('session-5-$USER_ID', '$USER_ID', 'Living Room', 'Reaction Time Test', 'training', 780, 85000, 25, 5, 30, 83.33, 155, 120, 195, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '1 minute 25 seconds', NOW() - INTERVAL '10 days', '{\"targetIds\": [\"target-2\"], \"sensorReadings\": 82}', '{\"device_id\": \"dryfire-2\", \"shots\": 30, \"hits\": 25}'),
    
    -- Session 6: Advanced training
    ('session-6-$USER_ID', '$USER_ID', 'Basement', 'Advanced Training', 'training', 820, 165000, 32, 8, 40, 80.00, 175, 140, 220, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days' + INTERVAL '2 minutes 45 seconds', NOW() - INTERVAL '12 days', '{\"targetIds\": [\"target-4\"], \"sensorReadings\": 79}', '{\"device_id\": \"dryfire-4\", \"shots\": 40, \"hits\": 32}'),
    
    -- Session 7: Precision challenge
    ('session-7-$USER_ID', '$USER_ID', 'Office', 'Precision Challenge', 'training', 910, 200000, 35, 5, 40, 87.50, 210, 170, 260, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days' + INTERVAL '3 minutes 20 seconds', NOW() - INTERVAL '15 days', '{\"targetIds\": [\"target-3\"], \"sensorReadings\": 87}', '{\"device_id\": \"dryfire-3\", \"shots\": 40, \"hits\": 35}'),
    
    -- Session 8: Quick session
    ('session-8-$USER_ID', '$USER_ID', 'Living Room', 'Quick Draw Challenge', 'training', 540, 65000, 15, 10, 25, 60.00, 190, 155, 240, NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days' + INTERVAL '1 minute 5 seconds', NOW() - INTERVAL '18 days', '{\"targetIds\": [\"target-1\"], \"sensorReadings\": 62}', '{\"device_id\": \"dryfire-1\", \"shots\": 25, \"hits\": 15}'),
    
    -- Session 9: Long training session
    ('session-9-$USER_ID', '$USER_ID', 'Garage', 'Extended Practice', 'training', 1150, 300000, 45, 15, 60, 75.00, 185, 150, 230, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days' + INTERVAL '5 minutes', NOW() - INTERVAL '20 days', '{\"targetIds\": [\"target-5\"], \"sensorReadings\": 76}', '{\"device_id\": \"dryfire-5\", \"shots\": 60, \"hits\": 45}'),
    
    -- Session 10: Recent practice
    ('session-10-$USER_ID', '$USER_ID', 'Basement', 'Target Practice', 'training', 690, 110000, 24, 6, 30, 80.00, 170, 135, 205, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '1 minute 50 seconds', NOW() - INTERVAL '1 day', '{\"targetIds\": [\"target-2\"], \"sensorReadings\": 81}', '{\"device_id\": \"dryfire-2\", \"shots\": 30, \"hits\": 24}'),
    
    -- Session 11: Older session
    ('session-11-$USER_ID', '$USER_ID', 'Office', 'Accuracy Test', 'training', 830, 155000, 29, 6, 35, 82.86, 165, 140, 200, NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days' + INTERVAL '2 minutes 35 seconds', NOW() - INTERVAL '22 days', '{\"targetIds\": [\"target-3\"], \"sensorReadings\": 83}', '{\"device_id\": \"dryfire-3\", \"shots\": 35, \"hits\": 29}'),
    
    -- Session 12: Speed focus
    ('session-12-$USER_ID', '$USER_ID', 'Living Room', 'Speed Training', 'training', 760, 75000, 20, 5, 25, 80.00, 145, 110, 180, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days' + INTERVAL '1 minute 15 seconds', NOW() - INTERVAL '25 days', '{\"targetIds\": [\"target-1\"], \"sensorReadings\": 79}', '{\"device_id\": \"dryfire-1\", \"shots\": 25, \"hits\": 20}'),
    
    -- Session 13: Mixed results
    ('session-13-$USER_ID', '$USER_ID', 'Garage', 'General Training', 'training', 590, 90000, 18, 12, 30, 60.00, 200, 165, 255, NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days' + INTERVAL '1 minute 30 seconds', NOW() - INTERVAL '28 days', '{\"targetIds\": [\"target-4\"], \"sensorReadings\": 61}', '{\"device_id\": \"dryfire-4\", \"shots\": 30, \"hits\": 18}'),
    
    -- Session 14: Best performance
    ('session-14-$USER_ID', '$USER_ID', 'Basement', 'Precision Challenge', 'training', 1200, 220000, 42, 3, 45, 93.33, 160, 125, 195, NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days' + INTERVAL '3 minutes 40 seconds', NOW() - INTERVAL '16 days', '{\"targetIds\": [\"target-2\"], \"sensorReadings\": 94}', '{\"device_id\": \"dryfire-2\", \"shots\": 45, \"hits\": 42}'),
    
    -- Session 15: Training session
    ('session-15-$USER_ID', '$USER_ID', 'Office', 'Advanced Training', 'training', 880, 145000, 31, 9, 40, 77.50, 180, 145, 225, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '2 minutes 25 seconds', NOW() - INTERVAL '5 days', '{\"targetIds\": [\"target-5\"], \"sensorReadings\": 78}', '{\"device_id\": \"dryfire-5\", \"shots\": 40, \"hits\": 31}');
    "
    
    execute_sql "$sql" "Creating mock sessions"
}

# Function to create aggregated analytics
create_analytics() {
    local sql="
    -- Insert aggregated analytics based on sessions
    INSERT INTO user_analytics (
        id, user_id, date, period_type, total_sessions, total_duration_ms, avg_session_duration_ms,
        total_score, avg_score, best_score, total_shots, total_hits, total_misses,
        accuracy_percentage, avg_reaction_time_ms, best_reaction_time_ms, worst_reaction_time_ms,
        score_improvement, accuracy_improvement, created_at, updated_at
    )
    SELECT 
        'analytics-' || '$USER_ID' as id,
        '$USER_ID' as user_id,
        CURRENT_DATE as date,
        'all_time' as period_type,
        COUNT(*) as total_sessions,
        SUM(duration_ms) as total_duration_ms,
        AVG(duration_ms)::integer as avg_session_duration_ms,
        SUM(score) as total_score,
        AVG(score)::integer as avg_score,
        MAX(score) as best_score,
        SUM(total_shots) as total_shots,
        SUM(hit_count) as total_hits,
        SUM(miss_count) as total_misses,
        ROUND(AVG(accuracy_percentage), 2) as accuracy_percentage,
        AVG(avg_reaction_time_ms)::integer as avg_reaction_time_ms,
        MIN(best_reaction_time_ms) as best_reaction_time_ms,
        MAX(worst_reaction_time_ms) as worst_reaction_time_ms,
        8.5 as score_improvement,
        2.3 as accuracy_improvement,
        NOW() as created_at,
        NOW() as updated_at
    FROM sessions 
    WHERE user_id = '$USER_ID';
    "
    
    execute_sql "$sql" "Creating analytics data"
}

# Function to create session hits
create_session_hits() {
    local sql="
    -- Insert individual hits for each session
    INSERT INTO session_hits (
        id, session_id, user_id, target_name, room_name, hit_type, 
        reaction_time_ms, score, hit_timestamp, hit_position, sensor_data
    )
    SELECT 
        'hit-' || s.id || '-' || generate_series as id,
        s.id as session_id,
        s.user_id,
        'Target ' || (((generate_series - 1) % 5) + 1) as target_name,
        s.room_name,
        CASE 
            WHEN random() < 0.6 THEN 'center'
            WHEN random() < 0.8 THEN 'inner'
            ELSE 'outer'
        END as hit_type,
        (150 + random() * 150)::integer as reaction_time_ms,
        (5 + random() * 10)::integer as score,
        s.started_at + (random() * EXTRACT(EPOCH FROM (s.ended_at - s.started_at))) * INTERVAL '1 second' as hit_timestamp,
        json_build_object(
            'x', random() * 100,
            'y', random() * 100,
            'zone', CASE WHEN random() < 0.6 THEN 'center' ELSE 'outer' END
        ) as hit_position,
        json_build_object(
            'pressure', random() * 100,
            'angle', random() * 360,
            'velocity', random() * 50
        ) as sensor_data
    FROM sessions s
    CROSS JOIN generate_series(1, s.hit_count) 
    WHERE s.user_id = '$USER_ID';
    "
    
    execute_sql "$sql" "Creating session hits"
}

# Function to verify data
verify_data() {
    echo -e "${BLUE}📊 Verifying created data...${NC}"
    
    local verification_sql="
    SELECT 
        'Sessions' as data_type,
        COUNT(*) as count
    FROM sessions WHERE user_id = '$USER_ID'
    UNION ALL
    SELECT 
        'Analytics' as data_type,
        COUNT(*) as count
    FROM user_analytics WHERE user_id = '$USER_ID'
    UNION ALL
    SELECT 
        'Session Hits' as data_type,
        COUNT(*) as count
    FROM session_hits WHERE user_id = '$USER_ID';
    "
    
    echo "$verification_sql" | supabase db sql --project-ref="$SUPABASE_PROJECT_REF" --linked=false
}

# Function to show summary
show_summary() {
    echo -e "\n${GREEN}🎉 Dev data population completed successfully!${NC}"
    echo -e "${BLUE}📊 Summary:${NC}"
    echo "   • User: $DEV_USER_EMAIL"
    echo "   • User ID: $USER_ID"
    
    # Get summary stats
    local summary_sql="
    SELECT 
        COUNT(*) as total_sessions,
        SUM(hit_count) as total_hits,
        MAX(score) as best_score,
        ROUND(AVG(accuracy_percentage), 1) as avg_accuracy
    FROM sessions WHERE user_id = '$USER_ID';
    "
    
    echo -e "${BLUE}   • Stats from generated data:${NC}"
    echo "$summary_sql" | supabase db sql --project-ref="$SUPABASE_PROJECT_REF" --linked=false --csv | tail -n +2 | while IFS=',' read -r sessions hits score accuracy; do
        echo "     - Sessions: $sessions"
        echo "     - Total Hits: $hits"
        echo "     - Best Score: $score"
        echo "     - Avg Accuracy: $accuracy%"
    done
    
    echo -e "\n${GREEN}✨ You can now test the Profile page with real data!${NC}"
    echo -e "${YELLOW}💡 Remember to refresh your browser to see the new data${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🔧 Checking Supabase CLI...${NC}"
    if ! command -v supabase &> /dev/null; then
        echo -e "${RED}❌ Supabase CLI is not installed${NC}"
        echo "Install it with: npm install -g supabase"
        exit 1
    fi
    
    get_user_id
    clean_existing_data
    create_mock_sessions
    create_analytics
    create_session_hits
    verify_data
    show_summary
}

# Run main function
main "$@"
