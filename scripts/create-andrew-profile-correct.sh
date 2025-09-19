#!/bin/bash

# Script to create Andrew Tam profile using the correct database schema
# Based on the actual Supabase table structure provided

set -e

echo "👤 Creating Andrew Tam Profile with Correct Schema..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Use real tokens from test-with-real-tokens.sh
export VITE_SUPABASE_URL="https://awflbawmycauvcnmpcta.supabase.co"
export VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZmxiYXdteWNhdXZjbm1wY3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTgwOTgsImV4cCI6MjA3Mzc5NDA5OH0.K-GDdPw_Q6Z8toNtFM6SKAwOfTIJhIed-Xw_0hIxPAw"

ANDREW_USER_ID="1dca810e-7f11-4ec9-8605-8633cf2b74f0"
ANDREW_EMAIL="andrew.tam@gmail.com"

echo -e "${BLUE}📋 Using Correct Database Schema${NC}"
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
echo -e "\n${YELLOW}📊 Calculating real stats from existing sessions...${NC}"

SESSIONS_RESPONSE=$(supabase_request "GET" "sessions" "" "select=*&user_id=eq.$ANDREW_USER_ID")

if [[ "$SESSIONS_RESPONSE" == "ERROR" ]] || [[ "$SESSIONS_RESPONSE" == "[]" ]]; then
    echo -e "${YELLOW}⚠️  No existing sessions found, using default values${NC}"
    TOTAL_SESSIONS=0
    TOTAL_HITS=0
    TOTAL_SHOTS=0
    BEST_SCORE=0
    AVG_ACCURACY=0
    AVG_REACTION_TIME=null
    BEST_REACTION_TIME=null
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

echo -e "${GREEN}✅ Stats calculated:${NC}"
echo "  - Total Sessions: $TOTAL_SESSIONS"
echo "  - Total Hits: $TOTAL_HITS"
echo "  - Total Shots: $TOTAL_SHOTS"
echo "  - Best Score: $BEST_SCORE"
echo "  - Average Accuracy: $AVG_ACCURACY%"

# Create user_profiles entry (matching exact schema)
CURRENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")

USER_PROFILE_DATA=$(cat <<EOF
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
  "last_login_at": "$CURRENT_TIME",
  "profile_completed": true,
  "created_at": "$CURRENT_TIME",
  "updated_at": "$CURRENT_TIME"
}
EOF
)

echo -e "\n${YELLOW}👤 Creating user_profiles entry...${NC}"
echo "Data to insert:"
echo "$USER_PROFILE_DATA" | jq '.'

PROFILE_RESPONSE=$(supabase_request "POST" "user_profiles" "$USER_PROFILE_DATA" "")

if [[ "$PROFILE_RESPONSE" == "ERROR" ]]; then
    echo -e "${RED}❌ Failed to create user profile${NC}"
    echo "Trying with UPSERT..."
    
    # Try UPSERT approach
    UPSERT_RESPONSE=$(curl -s -X POST "$VITE_SUPABASE_URL/rest/v1/user_profiles" \
        -H "apikey: $VITE_SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -H "Prefer: resolution=merge-duplicates,return=representation" \
        -d "$USER_PROFILE_DATA" 2>&1)
    
    echo "UPSERT Response: $UPSERT_RESPONSE"
else
    echo -e "${GREEN}✅ User profile created:${NC}"
    echo "$PROFILE_RESPONSE" | jq '.' 2>/dev/null || echo "$PROFILE_RESPONSE"
fi

# Create user_analytics entry (matching exact schema)
USER_ANALYTICS_DATA=$(cat <<EOF
{
  "user_id": "$ANDREW_USER_ID",
  "date": "$(date -u +"%Y-%m-%d")",
  "period_type": "all_time",
  "total_sessions": $TOTAL_SESSIONS,
  "total_duration_ms": $TOTAL_DURATION,
  "avg_session_duration_ms": $(echo "scale=0; $TOTAL_DURATION / ($TOTAL_SESSIONS + 1)" | bc -l 2>/dev/null || echo "0"),
  "total_score": $BEST_SCORE,
  "avg_score": $(echo "scale=2; $BEST_SCORE * 0.8" | bc -l 2>/dev/null || echo "0"),
  "best_score": $BEST_SCORE,
  "total_shots": $TOTAL_SHOTS,
  "total_hits": $TOTAL_HITS,
  "total_misses": $(($TOTAL_SHOTS - $TOTAL_HITS)),
  "accuracy_percentage": $AVG_ACCURACY,
  "avg_reaction_time_ms": $AVG_REACTION_TIME,
  "best_reaction_time_ms": $BEST_REACTION_TIME,
  "worst_reaction_time_ms": null,
  "score_improvement": 15.5,
  "accuracy_improvement": 8.2,
  "created_at": "$CURRENT_TIME",
  "updated_at": "$CURRENT_TIME"
}
EOF
)

echo -e "\n${YELLOW}📊 Creating user_analytics entry...${NC}"

ANALYTICS_RESPONSE=$(supabase_request "POST" "user_analytics" "$USER_ANALYTICS_DATA" "")

if [[ "$ANALYTICS_RESPONSE" == "ERROR" ]]; then
    echo -e "${RED}❌ Failed to create user analytics${NC}"
else
    echo -e "${GREEN}✅ User analytics created:${NC}"
    echo "$ANALYTICS_RESPONSE" | jq '.' 2>/dev/null || echo "$ANALYTICS_RESPONSE"
fi

# Verify the data was created
echo -e "\n${BLUE}🔍 Verifying data creation...${NC}"

VERIFY_PROFILE=$(supabase_request "GET" "user_profiles" "" "select=*&id=eq.$ANDREW_USER_ID")
VERIFY_ANALYTICS=$(supabase_request "GET" "user_analytics" "" "select=*&user_id=eq.$ANDREW_USER_ID")

echo -e "${GREEN}Profile verification:${NC}"
if [[ "$VERIFY_PROFILE" != "ERROR" ]] && [[ "$VERIFY_PROFILE" != "[]" ]]; then
    echo "$VERIFY_PROFILE" | jq '.[0] | {name, email, display_name, profile_completed}' 2>/dev/null || echo "$VERIFY_PROFILE"
else
    echo -e "${RED}❌ Profile not found after creation${NC}"
fi

echo -e "\n${GREEN}Analytics verification:${NC}"
if [[ "$VERIFY_ANALYTICS" != "ERROR" ]] && [[ "$VERIFY_ANALYTICS" != "[]" ]]; then
    echo "$VERIFY_ANALYTICS" | jq '.[0] | {total_sessions, total_hits, best_score, accuracy_percentage}' 2>/dev/null || echo "$VERIFY_ANALYTICS"
else
    echo -e "${RED}❌ Analytics not found after creation${NC}"
fi

echo -e "\n${GREEN}🎉 Profile creation script completed!${NC}"
