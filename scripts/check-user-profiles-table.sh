#!/bin/bash

# Script to check user_profiles table structure and data in Supabase
# Uses real tokens to verify table exists and what data is present

set -e

echo "🔍 Checking user_profiles Table in Supabase..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Use same environment variables as test-with-real-tokens.sh
export VITE_SUPABASE_URL="https://awflbawmycauvcnmpcta.supabase.co"
export VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZmxiYXdteWNhdXZjbm1wY3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTgwOTgsImV4cCI6MjA3Mzc5NDA5OH0.K-GDdPw_Q6Z8toNtFM6SKAwOfTIJhIed-Xw_0hIxPAw"

ANDREW_USER_ID="1dca810e-7f11-4ec9-8605-8633cf2b74f0"

echo -e "${BLUE}📋 Supabase Configuration${NC}"
echo "URL: $VITE_SUPABASE_URL"
echo "Andrew User ID: $ANDREW_USER_ID"

# Function to make Supabase REST API calls
supabase_query() {
    local table="$1"
    local query_params="$2"
    
    local url="$VITE_SUPABASE_URL/rest/v1/$table"
    if [ -n "$query_params" ]; then
        url="$url?$query_params"
    fi
    
    curl -s -X GET "$url" \
        -H "apikey: $VITE_SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" 2>/dev/null || echo "ERROR"
}

# Test 1: Check if user_profiles table exists and is accessible
echo -e "\n${YELLOW}🗄️  Test 1: Checking user_profiles table accessibility...${NC}"

PROFILES_TEST=$(supabase_query "user_profiles" "select=id&limit=1")

if [[ "$PROFILES_TEST" == "ERROR" ]]; then
    echo -e "${RED}❌ user_profiles table not accessible${NC}"
    exit 1
elif [[ "$PROFILES_TEST" == *"does not exist"* ]]; then
    echo -e "${RED}❌ user_profiles table does not exist${NC}"
    exit 1
else
    echo -e "${GREEN}✅ user_profiles table is accessible${NC}"
fi

# Test 2: Check all rows in user_profiles table
echo -e "\n${YELLOW}👥 Test 2: Checking all user profiles...${NC}"

ALL_PROFILES=$(supabase_query "user_profiles" "select=*")

if [[ "$ALL_PROFILES" == "ERROR" ]]; then
    echo -e "${RED}❌ Failed to fetch user profiles${NC}"
else
    PROFILE_COUNT=$(echo "$ALL_PROFILES" | jq '. | length' 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ Found $PROFILE_COUNT user profiles${NC}"
    
    if [ "$PROFILE_COUNT" -gt 0 ]; then
        echo -e "${BLUE}📊 All user profiles:${NC}"
        echo "$ALL_PROFILES" | jq -r '.[] | "  - ID: \(.id[0:8])..., Name: \(.name // "NULL"), Email: \(.email)"' 2>/dev/null || echo "  Parse error or no data"
    fi
fi

# Test 3: Check specifically for Andrew's profile
echo -e "\n${YELLOW}👤 Test 3: Checking Andrew's specific profile...${NC}"

ANDREW_PROFILE=$(supabase_query "user_profiles" "select=*&id=eq.$ANDREW_USER_ID")

if [[ "$ANDREW_PROFILE" == "ERROR" ]]; then
    echo -e "${RED}❌ Failed to fetch Andrew's profile${NC}"
else
    ANDREW_COUNT=$(echo "$ANDREW_PROFILE" | jq '. | length' 2>/dev/null || echo "0")
    if [ "$ANDREW_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  Andrew's profile not found${NC}"
        echo "Profile needs to be created"
    else
        echo -e "${GREEN}✅ Andrew's profile found${NC}"
        echo -e "${BLUE}📊 Andrew's profile data:${NC}"
        echo "$ANDREW_PROFILE" | jq '.[0]' 2>/dev/null || echo "Parse error"
    fi
fi

# Test 4: Check user_analytics table for Andrew
echo -e "\n${YELLOW}📊 Test 4: Checking user_analytics for Andrew...${NC}"

ANDREW_ANALYTICS=$(supabase_query "user_analytics" "select=*&user_id=eq.$ANDREW_USER_ID")

if [[ "$ANDREW_ANALYTICS" == "ERROR" ]]; then
    echo -e "${RED}❌ Failed to fetch Andrew's analytics${NC}"
else
    ANALYTICS_COUNT=$(echo "$ANDREW_ANALYTICS" | jq '. | length' 2>/dev/null || echo "0")
    if [ "$ANALYTICS_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  Andrew's analytics not found${NC}"
        echo "Analytics need to be created"
    else
        echo -e "${GREEN}✅ Andrew's analytics found: $ANALYTICS_COUNT entries${NC}"
        echo -e "${BLUE}📊 Analytics summary:${NC}"
        echo "$ANDREW_ANALYTICS" | jq -r '.[] | "  - Period: \(.period_type), Sessions: \(.total_sessions), Hits: \(.total_hits), Accuracy: \(.accuracy_percentage)%"' 2>/dev/null || echo "  Parse error"
    fi
fi

# Test 5: Check what columns actually exist by trying to select all
echo -e "\n${YELLOW}🔍 Test 5: Discovering actual table structure...${NC}"

# Try to get the first profile to see what columns exist
SAMPLE_PROFILE=$(supabase_query "user_profiles" "select=*&limit=1")

if [[ "$SAMPLE_PROFILE" != "ERROR" ]] && [[ "$SAMPLE_PROFILE" != "[]" ]]; then
    echo -e "${GREEN}✅ Sample profile structure:${NC}"
    echo "$SAMPLE_PROFILE" | jq '.[0] | keys' 2>/dev/null || echo "  Could not parse structure"
else
    echo -e "${YELLOW}⚠️  No profiles exist to show structure${NC}"
fi

# Summary
echo -e "\n${BLUE}📋 Summary${NC}"
echo -e "user_profiles table: ${GREEN}✅ Accessible${NC}"
echo -e "Andrew's profile: $([ "$ANDREW_COUNT" -gt 0 ] && echo "${GREEN}✅ Exists${NC}" || echo "${YELLOW}⚠️  Missing${NC}")"
echo -e "Andrew's analytics: $([ "$ANALYTICS_COUNT" -gt 0 ] && echo "${GREEN}✅ Exists${NC}" || echo "${YELLOW}⚠️  Missing${NC}")"

echo -e "\n${GREEN}✅ Table check completed${NC}"
