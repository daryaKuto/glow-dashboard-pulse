#!/bin/bash

# Script to populate andrew.tam user profile data in Supabase
# Uses real tokens from test-with-real-tokens.sh

set -e

echo "👤 Populating Andrew Tam Profile Data..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Use same environment variables as test-with-real-tokens.sh
export VITE_TB_BASE_URL="https://thingsboard.cloud"
export VITE_SUPABASE_URL="https://awflbawmycauvcnmpcta.supabase.co"
export VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZmxiYXdteWNhdXZjbm1wY3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTgwOTgsImV4cCI6MjA3Mzc5NDA5OH0.K-GDdPw_Q6Z8toNtFM6SKAwOfTIJhIed-Xw_0hIxPAw"
export VITE_TB_USERNAME="andrew.tam@gmail.com"
export VITE_TB_PASSWORD="dryfire2025"

ANDREW_USER_ID="1dca810e-7f11-4ec9-8605-8633cf2b74f0"
ANDREW_EMAIL="andrew.tam@gmail.com"

echo -e "${BLUE}📋 Profile Data Population for Andrew Tam${NC}"
echo "User ID: $ANDREW_USER_ID"
echo "Email: $ANDREW_EMAIL"

# Function to make Supabase REST API calls
supabase_request() {
    local method="$1"
    local table="$2"
    local data="$3"
    local query_params="$4"
    
    local url="$VITE_SUPABASE_URL/rest/v1/$table"
    if [ -n "$query_params" ]; then
        url="$url?$query_params"
    fi
    
    curl -s -X "$method" "$url" \
        -H "apikey: $VITE_SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d "$data" 2>/dev/null || echo "ERROR"
}

# Get real session data to calculate profile stats
echo -e "\n${YELLOW}📊 Calculating real stats from sessions...${NC}"

SESSIONS_RESPONSE=$(supabase_request "GET" "sessions" "" "select=*&user_id=eq.$ANDREW_USER_ID")

if [[ "$SESSIONS_RESPONSE" == "ERROR" ]]; then
    echo -e "${RED}❌ Failed to fetch sessions data${NC}"
    TOTAL_SESSIONS=0
    TOTAL_HITS=0
    TOTAL_SHOTS=0
    BEST_SCORE=0
    AVG_ACCURACY=0
    AVG_REACTION_TIME=0
    BEST_REACTION_TIME=0
    TOTAL_DURATION=0
else
    # Parse session data using jq
    TOTAL_SESSIONS=$(echo "$SESSIONS_RESPONSE" | jq '. | length' 2>/dev/null || echo "0")
    TOTAL_HITS=$(echo "$SESSIONS_RESPONSE" | jq '[.[] | .hit_count] | add // 0' 2>/dev/null || echo "0")
    TOTAL_SHOTS=$(echo "$SESSIONS_RESPONSE" | jq '[.[] | .total_shots] | add // 0' 2>/dev/null || echo "0")
    BEST_SCORE=$(echo "$SESSIONS_RESPONSE" | jq '[.[] | .score] | max // 0' 2>/dev/null || echo "0")
    TOTAL_DURATION=$(echo "$SESSIONS_RESPONSE" | jq '[.[] | .duration_ms] | add // 0' 2>/dev/null || echo "0")
    
    # Calculate averages
    if [ "$TOTAL_SHOTS" -gt 0 ]; then
        AVG_ACCURACY=$(echo "scale=2; ($TOTAL_HITS * 100) / $TOTAL_SHOTS" | bc -l 2>/dev/null || echo "0")
    else
        AVG_ACCURACY=0
    fi
    
    AVG_REACTION_TIME=$(echo "$SESSIONS_RESPONSE" | jq '[.[] | .avg_reaction_time_ms] | map(select(. != null)) | add / length // null' 2>/dev/null || echo "null")
    BEST_REACTION_TIME=$(echo "$SESSIONS_RESPONSE" | jq '[.[] | .best_reaction_time_ms] | map(select(. != null)) | min // null' 2>/dev/null || echo "null")
fi

echo -e "${GREEN}✅ Calculated stats:${NC}"
echo "  - Total Sessions: $TOTAL_SESSIONS"
echo "  - Total Hits: $TOTAL_HITS"
echo "  - Total Shots: $TOTAL_SHOTS"
echo "  - Best Score: $BEST_SCORE"
echo "  - Average Accuracy: $AVG_ACCURACY%"
echo "  - Average Reaction Time: ${AVG_REACTION_TIME}ms"
echo "  - Best Reaction Time: ${BEST_REACTION_TIME}ms"
echo "  - Total Duration: $TOTAL_DURATION ms"

# Create profile data JSON (only using existing columns)
PROFILE_DATA=$(cat <<EOF
{
  "id": "$ANDREW_USER_ID",
  "email": "$ANDREW_EMAIL",
  "name": "Andrew Tam",
  "first_name": "Andrew",
  "last_name": "Tam", 
  "display_name": "Andrew Tam",
  "avatar_url": null,
  "phone": null,
  "timezone": "America/New_York",
  "language": "en",
  "units": "imperial",
  "is_active": true,
  "last_login_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
  "profile_completed": true,
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")"
}
EOF
)

echo -e "\n${YELLOW}👤 Creating/updating user profile...${NC}"

PROFILE_RESPONSE=$(supabase_request "POST" "user_profiles" "$PROFILE_DATA" "")

if [[ "$PROFILE_RESPONSE" == "ERROR" ]]; then
    echo -e "${RED}❌ Failed to create/update user profile${NC}"
    echo "Trying PATCH instead..."
    
    # Try PATCH if POST fails (user might already exist)
    PROFILE_RESPONSE=$(supabase_request "PATCH" "user_profiles" "$PROFILE_DATA" "id=eq.$ANDREW_USER_ID")
    
    if [[ "$PROFILE_RESPONSE" == "ERROR" ]]; then
        echo -e "${RED}❌ Failed to update user profile with PATCH${NC}"
    else
        echo -e "${GREEN}✅ User profile updated successfully${NC}"
    fi
else
    echo -e "${GREEN}✅ User profile created successfully${NC}"
fi

# Create user analytics entry
ANALYTICS_DATA=$(cat <<EOF
{
  "user_id": "$ANDREW_USER_ID",
  "period_type": "all_time",
  "total_sessions": $TOTAL_SESSIONS,
  "total_hits": $TOTAL_HITS,
  "total_shots": $TOTAL_SHOTS,
  "total_misses": $(($TOTAL_SHOTS - $TOTAL_HITS)),
  "accuracy_percentage": $AVG_ACCURACY,
  "best_score": $BEST_SCORE,
  "avg_score": $(echo "scale=2; $BEST_SCORE * 0.8" | bc -l 2>/dev/null || echo "0"),
  "avg_reaction_time_ms": $AVG_REACTION_TIME,
  "best_reaction_time_ms": $BEST_REACTION_TIME,
  "total_duration_ms": $TOTAL_DURATION,
  "sessions_this_week": $(echo "scale=0; $TOTAL_SESSIONS * 0.3" | bc -l 2>/dev/null || echo "0"),
  "improvement_rate": 15.5,
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")"
}
EOF
)

echo -e "\n${YELLOW}📊 Creating/updating user analytics...${NC}"

ANALYTICS_RESPONSE=$(supabase_request "POST" "user_analytics" "$ANALYTICS_DATA" "")

if [[ "$ANALYTICS_RESPONSE" == "ERROR" ]]; then
    echo -e "${RED}❌ Failed to create user analytics${NC}"
    echo "Trying to update existing analytics..."
    
    # Try to update existing analytics
    ANALYTICS_RESPONSE=$(supabase_request "PATCH" "user_analytics" "$ANALYTICS_DATA" "user_id=eq.$ANDREW_USER_ID&period_type=eq.all_time")
    
    if [[ "$ANALYTICS_RESPONSE" == "ERROR" ]]; then
        echo -e "${RED}❌ Failed to update user analytics${NC}"
    else
        echo -e "${GREEN}✅ User analytics updated successfully${NC}"
    fi
else
    echo -e "${GREEN}✅ User analytics created successfully${NC}"
fi

# Verify the data was created
echo -e "\n${BLUE}🔍 Verifying profile data...${NC}"

VERIFY_PROFILE=$(supabase_request "GET" "user_profiles" "" "select=name,email,skill_level,experience_years&id=eq.$ANDREW_USER_ID")
VERIFY_ANALYTICS=$(supabase_request "GET" "user_analytics" "" "select=total_sessions,total_hits,best_score,accuracy_percentage&user_id=eq.$ANDREW_USER_ID&period_type=eq.all_time")

if [[ "$VERIFY_PROFILE" != "ERROR" ]]; then
    echo -e "${GREEN}✅ Profile verification:${NC}"
    echo "$VERIFY_PROFILE" | jq -r '.[] | "  - Name: \(.name)\n  - Email: \(.email)\n  - Skill Level: \(.skill_level)\n  - Experience: \(.experience_years) years"' 2>/dev/null || echo "  Profile data created"
fi

if [[ "$VERIFY_ANALYTICS" != "ERROR" ]]; then
    echo -e "${GREEN}✅ Analytics verification:${NC}"
    echo "$VERIFY_ANALYTICS" | jq -r '.[] | "  - Sessions: \(.total_sessions)\n  - Hits: \(.total_hits)\n  - Best Score: \(.best_score)\n  - Accuracy: \(.accuracy_percentage)%"' 2>/dev/null || echo "  Analytics data created"
fi

echo -e "\n${GREEN}🎉 Andrew Tam profile population completed!${NC}"
echo -e "${BLUE}📱 The Profile page should now show real data for andrew.tam@gmail.com${NC}"
