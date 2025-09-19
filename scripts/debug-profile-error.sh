#!/bin/bash

# Script to debug "Failed to load profile data" error
# This checks the user auth status and data availability

set -e

echo "🔍 Debugging Profile Data Loading Error..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DEV_USER_EMAIL="andrew.tam@example.com"

# Check if required environment variables are set
if [ -z "$SUPABASE_PROJECT_REF" ] || [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ Missing required environment variables${NC}"
    echo "Required: SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN"
    echo "Set them in your shell or .env file"
    exit 1
fi

# Function to execute SQL and show results
debug_query() {
    local sql_command="$1"
    local description="$2"
    
    echo -e "\n${BLUE}📋 ${description}${NC}"
    echo "SQL: $sql_command"
    echo "---"
    
    result=$(echo "$sql_command" | supabase db sql --project-ref="$SUPABASE_PROJECT_REF" --linked=false --csv 2>&1)
    
    if [ $? -eq 0 ]; then
        echo "$result"
        echo -e "${GREEN}✅ Query executed successfully${NC}"
    else
        echo -e "${RED}❌ Query failed: $result${NC}"
    fi
}

# Get user information
echo -e "${YELLOW}🔍 Step 1: Checking user authentication${NC}"
debug_query "SELECT id, email, created_at, email_confirmed_at FROM auth.users WHERE email = '$DEV_USER_EMAIL';" "User authentication status"

# Get user ID for subsequent queries
USER_ID=$(echo "SELECT id FROM auth.users WHERE email = '$DEV_USER_EMAIL' LIMIT 1;" | supabase db sql --project-ref="$SUPABASE_PROJECT_REF" --linked=false --csv | tail -n +2)

if [ -z "$USER_ID" ]; then
    echo -e "${RED}❌ User not found! Cannot proceed with data checks.${NC}"
    echo "Make sure the user $DEV_USER_EMAIL exists in your Supabase project"
    exit 1
fi

echo -e "${GREEN}✅ User found: $USER_ID${NC}"

# Check sessions data
echo -e "\n${YELLOW}🔍 Step 2: Checking sessions data${NC}"
debug_query "SELECT COUNT(*) as session_count FROM sessions WHERE user_id = '$USER_ID';" "Session count"
debug_query "SELECT id, scenario_name, score, created_at FROM sessions WHERE user_id = '$USER_ID' ORDER BY created_at DESC LIMIT 3;" "Recent sessions"

# Check analytics data
echo -e "\n${YELLOW}🔍 Step 3: Checking analytics data${NC}"
debug_query "SELECT COUNT(*) as analytics_count FROM user_analytics WHERE user_id = '$USER_ID';" "Analytics count"
debug_query "SELECT period_type, total_sessions, total_hits, best_score, created_at FROM user_analytics WHERE user_id = '$USER_ID';" "Analytics details"

# Check session hits
echo -e "\n${YELLOW}🔍 Step 4: Checking session hits${NC}"
debug_query "SELECT COUNT(*) as hits_count FROM session_hits WHERE user_id = '$USER_ID';" "Session hits count"

# Check table permissions (RLS policies)
echo -e "\n${YELLOW}🔍 Step 5: Checking table permissions${NC}"
debug_query "SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('sessions', 'user_analytics', 'session_hits');" "Table RLS status"

# Test the exact query that the profile service uses
echo -e "\n${YELLOW}🔍 Step 6: Testing profile service queries${NC}"
debug_query "SELECT * FROM user_analytics WHERE user_id = '$USER_ID' AND period_type = 'all_time' ORDER BY created_at DESC LIMIT 1;" "Analytics query (exact match)"
debug_query "SELECT score, hit_count, total_shots, accuracy_percentage, duration_ms, avg_reaction_time_ms, best_reaction_time_ms FROM sessions WHERE user_id = '$USER_ID' LIMIT 5;" "Sessions query for stats calculation"

# Summary and recommendations
echo -e "\n${GREEN}🎯 Debug Summary:${NC}"
echo "1. User ID: $USER_ID"
echo "2. User Email: $DEV_USER_EMAIL"
echo "3. Run the queries above to identify the issue"

echo -e "\n${YELLOW}💡 Common Issues & Solutions:${NC}"
echo "• No data found: Run './scripts/populate-dev-data.sh' to create mock data"
echo "• RLS policies: Make sure Row Level Security allows the user to read their own data"
echo "• Authentication: Check if the user is properly authenticated in the app"
echo "• Environment: Verify SUPABASE_URL and SUPABASE_ANON_KEY in your .env.local"

echo -e "\n${BLUE}🔧 Next Steps:${NC}"
echo "1. If no data exists, run: ./scripts/populate-dev-data.sh"
echo "2. Check browser console for detailed error messages"
echo "3. Verify Supabase environment variables in .env.local"
echo "4. Test authentication in the app's dev tools"
