#!/bin/bash

# Script to debug Rooms page data loading
# Tests both ThingsBoard and Supabase data sources

set -e

echo "🔍 Debugging Rooms Page Data Loading..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DEV_USER_EMAIL="andrew.tam@gmail.com"

echo -e "${BLUE}📋 Environment Check${NC}"
echo "NODE_ENV: ${NODE_ENV:-development}"
echo "DEV_USER_EMAIL: $DEV_USER_EMAIL"

# Check ThingsBoard authentication
echo -e "\n${BLUE}🔐 Testing ThingsBoard Authentication${NC}"

# Read credentials from .env.local
if [ -f ".env.local" ]; then
    source .env.local
    echo "✅ Found .env.local file"
    echo "TB_BASE_URL: $VITE_TB_BASE_URL"
    echo "TB_USERNAME: $VITE_TB_USERNAME"
    echo "TB_PASSWORD: $(echo $VITE_TB_PASSWORD | sed 's/./*/g')"
else
    echo -e "${RED}❌ .env.local file not found${NC}"
    exit 1
fi

# Test ThingsBoard login
echo -e "\n${YELLOW}🔑 Testing ThingsBoard Login...${NC}"
TB_LOGIN_RESPONSE=$(curl -s -X POST "$VITE_TB_BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$VITE_TB_USERNAME\",\"password\":\"$VITE_TB_PASSWORD\"}" \
    2>/dev/null || echo "ERROR")

if [[ "$TB_LOGIN_RESPONSE" == "ERROR" ]]; then
    echo -e "${RED}❌ ThingsBoard login failed - network error${NC}"
    exit 1
fi

# Extract token from response
TB_TOKEN=$(echo "$TB_LOGIN_RESPONSE" | jq -r '.token // empty' 2>/dev/null || echo "")

if [ -z "$TB_TOKEN" ]; then
    echo -e "${RED}❌ ThingsBoard login failed - no token received${NC}"
    echo "Response: $TB_LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ ThingsBoard login successful${NC}"
echo "Token length: ${#TB_TOKEN}"

# Test ThingsBoard devices endpoint
echo -e "\n${YELLOW}🎯 Testing ThingsBoard Devices...${NC}"
TB_DEVICES_RESPONSE=$(curl -s -X GET "$VITE_TB_BASE_URL/api/tenant/devices?pageSize=10&page=0" \
    -H "Authorization: Bearer $TB_TOKEN" \
    2>/dev/null || echo "ERROR")

if [[ "$TB_DEVICES_RESPONSE" == "ERROR" ]]; then
    echo -e "${RED}❌ ThingsBoard devices fetch failed${NC}"
    exit 1
fi

DEVICE_COUNT=$(echo "$TB_DEVICES_RESPONSE" | jq '.data | length' 2>/dev/null || echo "0")
echo -e "${GREEN}✅ ThingsBoard devices fetched: $DEVICE_COUNT devices${NC}"

# Show sample devices
echo -e "\n${BLUE}📊 Sample ThingsBoard Devices:${NC}"
echo "$TB_DEVICES_RESPONSE" | jq -r '.data[0:3] | .[] | "  - \(.name) (ID: \(.id.id[0:8])..., Type: \(.type))"' 2>/dev/null || echo "  No devices or parsing error"

# Test Supabase connection
echo -e "\n${BLUE}🗄️  Testing Supabase Connection${NC}"

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Supabase CLI not found, skipping database tests${NC}"
    echo "Install with: npm install -g supabase"
else
    # Test Supabase connection (if configured)
    if [ -n "$SUPABASE_PROJECT_REF" ] && [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
        echo -e "${YELLOW}🏠 Testing Supabase Rooms...${NC}"
        
        # Query user_rooms table
        ROOMS_QUERY="SELECT id, name, room_type, icon, order_index FROM user_rooms WHERE user_id = (SELECT id FROM auth.users WHERE email = '$DEV_USER_EMAIL') ORDER BY order_index;"
        
        ROOMS_RESULT=$(supabase db query --project-ref "$SUPABASE_PROJECT_REF" --access-token "$SUPABASE_ACCESS_TOKEN" "$ROOMS_QUERY" 2>/dev/null || echo "ERROR")
        
        if [[ "$ROOMS_RESULT" == "ERROR" ]]; then
            echo -e "${RED}❌ Supabase rooms query failed${NC}"
        else
            ROOMS_COUNT=$(echo "$ROOMS_RESULT" | wc -l | tr -d ' ')
            echo -e "${GREEN}✅ Supabase rooms found: $((ROOMS_COUNT - 1)) rooms${NC}"
            echo "$ROOMS_RESULT"
        fi

        echo -e "\n${YELLOW}🎯 Testing Supabase Target Assignments...${NC}"
        
        # Query user_room_targets table
        ASSIGNMENTS_QUERY="SELECT room_id, target_id, target_name FROM user_room_targets WHERE user_id = (SELECT id FROM auth.users WHERE email = '$DEV_USER_EMAIL');"
        
        ASSIGNMENTS_RESULT=$(supabase db query --project-ref "$SUPABASE_PROJECT_REF" --access-token "$SUPABASE_ACCESS_TOKEN" "$ASSIGNMENTS_QUERY" 2>/dev/null || echo "ERROR")
        
        if [[ "$ASSIGNMENTS_RESULT" == "ERROR" ]]; then
            echo -e "${RED}❌ Supabase assignments query failed${NC}"
        else
            ASSIGNMENTS_COUNT=$(echo "$ASSIGNMENTS_RESULT" | wc -l | tr -d ' ')
            echo -e "${GREEN}✅ Supabase target assignments found: $((ASSIGNMENTS_COUNT - 1)) assignments${NC}"
            echo "$ASSIGNMENTS_RESULT"
        fi
    else
        echo -e "${YELLOW}⚠️  Supabase credentials not set, skipping database tests${NC}"
        echo "Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN to test database"
    fi
fi

# Summary
echo -e "\n${BLUE}📋 Summary${NC}"
echo -e "ThingsBoard Status: ${GREEN}✅ Connected${NC}"
echo -e "ThingsBoard Devices: ${GREEN}$DEVICE_COUNT found${NC}"

if [ -n "$ROOMS_COUNT" ]; then
    echo -e "Supabase Rooms: ${GREEN}$((ROOMS_COUNT - 1)) found${NC}"
fi

if [ -n "$ASSIGNMENTS_COUNT" ]; then
    echo -e "Target Assignments: ${GREEN}$((ASSIGNMENTS_COUNT - 1)) found${NC}"
fi

echo -e "\n${GREEN}✅ Debug completed successfully${NC}"
echo "If Rooms page is still empty, check browser console for JavaScript errors."
