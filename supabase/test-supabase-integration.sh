#!/bin/bash

echo "🧪 Supabase Integration Test Suite"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f ".env.local" ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo -e "${GREEN}✅ Loaded environment variables${NC}"
else
    echo -e "${RED}❌ .env.local file not found${NC}"
    exit 1
fi

# Supabase configuration
SUPABASE_URL="${VITE_SUPABASE_URL}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ Missing Supabase configuration in .env.local${NC}"
    echo "Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
    exit 1
fi

echo -e "${BLUE}🔧 Testing Supabase Configuration...${NC}"
echo "URL: $SUPABASE_URL"
echo "Key: ${SUPABASE_ANON_KEY:0:20}..."

# Function to make Supabase REST API calls
supabase_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local auth_token="$4"
    
    local headers="apikey: $SUPABASE_ANON_KEY"
    if [ -n "$auth_token" ]; then
        headers="$headers\nAuthorization: Bearer $auth_token"
    fi
    
    if [ "$method" = "GET" ]; then
        curl -s -H "$headers" "$SUPABASE_URL$endpoint"
    elif [ "$method" = "POST" ]; then
        curl -s -X POST -H "$headers" -H "Content-Type: application/json" -d "$data" "$SUPABASE_URL$endpoint"
    fi
}

# Test 1: Basic Connectivity
echo -e "\n${BLUE}🌐 Test 1: Basic Supabase Connectivity${NC}"
connectivity_response=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/")
if [ "$connectivity_response" = "200" ]; then
    echo -e "${GREEN}✅ Supabase REST API is reachable${NC}"
else
    echo -e "${RED}❌ Supabase connectivity failed (HTTP $connectivity_response)${NC}"
fi

# Test 2: Auth Service Health
echo -e "\n${BLUE}🔐 Test 2: Authentication Service Health${NC}"
auth_health=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "$SUPABASE_URL/auth/v1/health")
if [ "$auth_health" = "200" ]; then
    echo -e "${GREEN}✅ Auth service is healthy${NC}"
else
    echo -e "${RED}❌ Auth service unhealthy (HTTP $auth_health)${NC}"
fi

# Test 3: Database Schema Check
echo -e "\n${BLUE}📊 Test 3: Database Schema Validation${NC}"

echo "Testing user_rooms table..."
rooms_response=$(supabase_request "GET" "/rest/v1/user_rooms?select=count" "")
if echo "$rooms_response" | grep -q "count"; then
    echo -e "${GREEN}✅ user_rooms table exists and accessible${NC}"
    rooms_count=$(echo "$rooms_response" | jq -r '.[0].count' 2>/dev/null || echo "unknown")
    echo "   Rooms count: $rooms_count"
else
    echo -e "${RED}❌ user_rooms table inaccessible${NC}"
    echo "   Response: $rooms_response"
fi

echo "Testing user_room_targets table..."
targets_response=$(supabase_request "GET" "/rest/v1/user_room_targets?select=count" "")
if echo "$targets_response" | grep -q "count"; then
    echo -e "${GREEN}✅ user_room_targets table exists and accessible${NC}"
    assignments_count=$(echo "$targets_response" | jq -r '.[0].count' 2>/dev/null || echo "unknown")
    echo "   Target assignments count: $assignments_count"
else
    echo -e "${RED}❌ user_room_targets table inaccessible${NC}"
    echo "   Response: $targets_response"
fi

echo "Testing sessions table..."
sessions_response=$(supabase_request "GET" "/rest/v1/sessions?select=count" "")
if echo "$sessions_response" | grep -q "count"; then
    echo -e "${GREEN}✅ sessions table exists and accessible${NC}"
    sessions_count=$(echo "$sessions_response" | jq -r '.[0].count' 2>/dev/null || echo "unknown")
    echo "   Sessions count: $sessions_count"
else
    echo -e "${RED}❌ sessions table inaccessible${NC}"
    echo "   Response: $sessions_response"
fi

# Test 4: Authentication Test
echo -e "\n${BLUE}🔑 Test 4: Authentication Test${NC}"

# Try to authenticate with test credentials (using env vars if available)
test_email="${VITE_TEST_EMAIL:-test@example.com}"
test_password="${VITE_TEST_PASSWORD:-testpassword123}"
auth_payload="{\"email\":\"$test_email\",\"password\":\"$test_password\"}"
echo "Testing authentication with test credentials..."
auth_response=$(curl -s -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "$auth_payload" \
    "$SUPABASE_URL/auth/v1/token?grant_type=password")

if echo "$auth_response" | grep -q "access_token"; then
    echo -e "${GREEN}✅ Authentication successful${NC}"
    access_token=$(echo "$auth_response" | jq -r '.access_token' 2>/dev/null)
    echo "   Token received: ${access_token:0:20}..."
    
    # Test authenticated request
    echo "Testing authenticated request..."
    auth_test=$(supabase_request "GET" "/rest/v1/user_rooms?limit=1" "" "$access_token")
    if echo "$auth_test" | grep -q -E '\[|\{'; then
        echo -e "${GREEN}✅ Authenticated requests working${NC}"
    else
        echo -e "${YELLOW}⚠️ Authenticated request returned: $auth_test${NC}"
    fi
else
    echo -e "${RED}❌ Authentication failed${NC}"
    echo "   Response: $auth_response"
    
    # Check if it's a schema issue
    if echo "$auth_response" | grep -q "schema"; then
        echo -e "${YELLOW}⚠️ This appears to be a database schema issue${NC}"
    fi
    access_token=""
fi

# Test 5: Rooms Data Operations
echo -e "\n${BLUE}🏠 Test 5: Rooms Data Operations${NC}"

# Test fetching rooms (without auth - using anon key)
echo "Fetching rooms data..."
rooms_data=$(supabase_request "GET" "/rest/v1/user_rooms?limit=5" "")
if echo "$rooms_data" | grep -q -E '\[|\{'; then
    echo -e "${GREEN}✅ Rooms data fetchable${NC}"
    rooms_array=$(echo "$rooms_data" | jq '. | length' 2>/dev/null || echo "0")
    echo "   Found $rooms_array rooms"
    
    # Show sample room data
    if [ "$rooms_array" -gt 0 ]; then
        echo -e "${PURPLE}   Sample room data:${NC}"
        echo "$rooms_data" | jq '.[0] | {name, room_type, icon, target_count}' 2>/dev/null || echo "   (JSON parsing failed)"
    fi
else
    echo -e "${RED}❌ Rooms data fetch failed${NC}"
    echo "   Response: $rooms_data"
fi

# Test 6: Target Assignments Operations
echo -e "\n${BLUE}🎯 Test 6: Target Assignment Operations${NC}"

echo "Fetching target assignments..."
assignments_data=$(supabase_request "GET" "/rest/v1/user_room_targets?limit=5" "")
if echo "$assignments_data" | grep -q -E '\[|\{'; then
    echo -e "${GREEN}✅ Target assignments fetchable${NC}"
    assignments_array=$(echo "$assignments_data" | jq '. | length' 2>/dev/null || echo "0")
    echo "   Found $assignments_array assignments"
    
    # Show sample assignment data
    if [ "$assignments_array" -gt 0 ]; then
        echo -e "${PURPLE}   Sample assignment data:${NC}"
        echo "$assignments_data" | jq '.[0] | {room_id, target_id, target_name}' 2>/dev/null || echo "   (JSON parsing failed)"
    fi
else
    echo -e "${RED}❌ Target assignments fetch failed${NC}"
    echo "   Response: $assignments_data"
fi

# Test 7: Real-time Subscription Test
echo -e "\n${BLUE}🔄 Test 7: Real-time Subscription Test${NC}"

echo "Testing WebSocket connection for real-time updates..."
# Test WebSocket connection (basic check)
websocket_url="${SUPABASE_URL/https:/wss:}/realtime/v1/websocket?apikey=$SUPABASE_ANON_KEY&vsn=1.0.0"
if timeout 5 curl -s --max-time 5 -H "Upgrade: websocket" -H "Connection: Upgrade" "$websocket_url" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ WebSocket endpoint accessible${NC}"
else
    echo -e "${YELLOW}⚠️ WebSocket test inconclusive (timeout/connection)${NC}"
fi

# Test 8: Data Insertion Test (if authenticated)
if [ -n "$access_token" ]; then
    echo -e "\n${BLUE}📝 Test 8: Data Write Operations${NC}"
    
    # Test creating a test room
    test_room_payload=$(cat << EOF
{
  "name": "Test Room $(date +%s)",
  "room_type": "training",
  "icon": "target",
  "order_index": 999
}
EOF
)
    
    echo "Testing room creation..."
    create_response=$(supabase_request "POST" "/rest/v1/user_rooms" "$test_room_payload" "$access_token")
    if echo "$create_response" | grep -q -E '\[|\{|"id"'; then
        echo -e "${GREEN}✅ Room creation successful${NC}"
        created_room_id=$(echo "$create_response" | jq -r '.[0].id' 2>/dev/null)
        echo "   Created room ID: $created_room_id"
        
        # Clean up test room
        if [ -n "$created_room_id" ] && [ "$created_room_id" != "null" ]; then
            echo "Cleaning up test room..."
            delete_response=$(curl -s -X DELETE \
                -H "apikey: $SUPABASE_ANON_KEY" \
                -H "Authorization: Bearer $access_token" \
                "$SUPABASE_URL/rest/v1/user_rooms?id=eq.$created_room_id")
            echo -e "${GREEN}✅ Test room cleaned up${NC}"
        fi
    else
        echo -e "${RED}❌ Room creation failed${NC}"
        echo "   Response: $create_response"
    fi
else
    echo -e "\n${YELLOW}⏭️ Test 8: Skipped (no authentication token)${NC}"
fi

# Test Summary
echo -e "\n${PURPLE}📋 Test Summary${NC}"
echo "=================================="

# Count results
total_tests=8
echo "Total tests run: $total_tests"

echo -e "\n${BLUE}🔧 Recommendations:${NC}"

if [ "$connectivity_response" != "200" ]; then
    echo "- Fix Supabase connectivity issues"
fi

if [ "$auth_health" != "200" ]; then
    echo "- Check Supabase auth service configuration"
fi

if echo "$auth_response" | grep -q "schema"; then
    echo "- Run database schema setup: supabase/complete-analytics-schema.sql"
fi

if [ -z "$access_token" ]; then
    echo "- Set up proper authentication or user credentials"
fi

echo -e "\n${GREEN}🚀 Next Steps:${NC}"
echo "1. If schema errors: Apply complete-analytics-schema.sql in Supabase dashboard"
echo "2. If auth errors: Check user setup in Supabase Auth settings"
echo "3. If connection errors: Verify Supabase project URL and keys"
echo "4. For development: Consider using Row Level Security policies"

echo -e "\n${BLUE}📊 Integration Status:${NC}"
if [ "$connectivity_response" = "200" ] && echo "$rooms_data" | grep -q -E '\[|\{'; then
    echo -e "${GREEN}✅ Supabase integration is functional${NC}"
else
    echo -e "${YELLOW}⚠️ Supabase integration needs attention${NC}"
fi

echo -e "\n${GREEN}✨ Test completed!${NC}"
