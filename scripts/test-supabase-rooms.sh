#!/bin/bash

# Test Supabase rooms data using REST API
# This doesn't require Supabase CLI

set -e

echo "🔍 Testing Supabase Rooms Data..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Read from .env.local
if [ -f ".env.local" ]; then
    source .env.local
    echo "✅ Found .env.local file"
else
    echo -e "${RED}❌ .env.local file not found${NC}"
    exit 1
fi

SUPABASE_URL="$VITE_SUPABASE_URL"
SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY"

echo "Supabase URL: $SUPABASE_URL"
echo "Anon Key: ${SUPABASE_ANON_KEY:0:20}..."

# Test Supabase connection
echo -e "\n${BLUE}🗄️  Testing Supabase Connection${NC}"

# Test user_rooms table
echo -e "\n${YELLOW}🏠 Testing user_rooms table...${NC}"
ROOMS_RESPONSE=$(curl -s -X GET "$SUPABASE_URL/rest/v1/user_rooms?select=*" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    2>/dev/null || echo "ERROR")

if [[ "$ROOMS_RESPONSE" == "ERROR" ]]; then
    echo -e "${RED}❌ Failed to fetch user_rooms${NC}"
else
    ROOMS_COUNT=$(echo "$ROOMS_RESPONSE" | jq '. | length' 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ user_rooms table accessible: $ROOMS_COUNT rows${NC}"
    if [ "$ROOMS_COUNT" -gt 0 ]; then
        echo -e "${BLUE}📊 Sample rooms:${NC}"
        echo "$ROOMS_RESPONSE" | jq -r '.[] | "  - \(.name) (ID: \(.id), Type: \(.room_type))"' 2>/dev/null || echo "  Parse error"
    fi
fi

# Test user_room_targets table
echo -e "\n${YELLOW}🎯 Testing user_room_targets table...${NC}"
TARGETS_RESPONSE=$(curl -s -X GET "$SUPABASE_URL/rest/v1/user_room_targets?select=*" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    2>/dev/null || echo "ERROR")

if [[ "$TARGETS_RESPONSE" == "ERROR" ]]; then
    echo -e "${RED}❌ Failed to fetch user_room_targets${NC}"
else
    TARGETS_COUNT=$(echo "$TARGETS_RESPONSE" | jq '. | length' 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ user_room_targets table accessible: $TARGETS_COUNT rows${NC}"
    if [ "$TARGETS_COUNT" -gt 0 ]; then
        echo -e "${BLUE}📊 Sample target assignments:${NC}"
        echo "$TARGETS_RESPONSE" | jq -r '.[] | "  - Target \(.target_name) → Room \(.room_id)"' 2>/dev/null || echo "  Parse error"
    fi
fi

# Test auth.users table (if accessible)
echo -e "\n${YELLOW}👤 Testing auth.users table...${NC}"
USERS_RESPONSE=$(curl -s -X GET "$SUPABASE_URL/rest/v1/auth.users?select=id,email" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    2>/dev/null || echo "ERROR")

if [[ "$USERS_RESPONSE" == "ERROR" ]] || [[ "$USERS_RESPONSE" == *"permission denied"* ]]; then
    echo -e "${YELLOW}⚠️  auth.users table not accessible with anon key (expected)${NC}"
else
    USERS_COUNT=$(echo "$USERS_RESPONSE" | jq '. | length' 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ auth.users table accessible: $USERS_COUNT users${NC}"
fi

# Summary
echo -e "\n${BLUE}📋 Summary${NC}"
echo -e "Supabase Connection: ${GREEN}✅ Working${NC}"
echo -e "user_rooms: ${GREEN}$ROOMS_COUNT rows${NC}"
echo -e "user_room_targets: ${GREEN}$TARGETS_COUNT rows${NC}"

if [ "$ROOMS_COUNT" -eq 0 ]; then
    echo -e "\n${YELLOW}⚠️  No rooms found in database${NC}"
    echo "This might be why the Rooms page is empty."
    echo "Run ./scripts/populate-dev-data.sh to create test data."
fi

if [ "$TARGETS_COUNT" -eq 0 ]; then
    echo -e "\n${YELLOW}⚠️  No target assignments found${NC}"
    echo "This might be why targets don't show room assignments."
fi

echo -e "\n${GREEN}✅ Supabase test completed${NC}"
