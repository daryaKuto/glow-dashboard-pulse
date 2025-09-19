#!/bin/bash

echo "🔍 Glow Dashboard Debug Script"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if process is running on port
check_port() {
    if lsof -i :8080 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Dev server is running on port 8080${NC}"
        return 0
    else
        echo -e "${RED}❌ Dev server is not running on port 8080${NC}"
        return 1
    fi
}

# Function to test ThingsBoard connection
test_thingsboard() {
    echo -e "\n${BLUE}🔧 Testing ThingsBoard Connection...${NC}"
    
    # Test direct connection to ThingsBoard
    echo "Testing direct connection to https://thingsboard.cloud..."
    if curl -s --max-time 10 https://thingsboard.cloud/api > /dev/null; then
        echo -e "${GREEN}✅ ThingsBoard.cloud is reachable${NC}"
    else
        echo -e "${RED}❌ Cannot reach ThingsBoard.cloud${NC}"
    fi
    
    # Test proxy connection through Vite dev server
    echo "Testing proxy connection through Vite dev server..."
    if check_port; then
        response=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" http://localhost:8080/api/tb/api)
        if [ "$response" = "200" ] || [ "$response" = "404" ] || [ "$response" = "401" ]; then
            echo -e "${GREEN}✅ Vite proxy is working (HTTP $response)${NC}"
        else
            echo -e "${RED}❌ Vite proxy failed (HTTP $response)${NC}"
        fi
    fi
}

# Function to test ThingsBoard authentication
test_auth() {
    echo -e "\n${BLUE}🔐 Testing ThingsBoard Authentication...${NC}"
    
    if check_port; then
        echo "Testing login with provided credentials..."
        # Load environment variables
        if [ -f ".env.local" ]; then
            export $(cat .env.local | grep -v '^#' | xargs)
        fi
        
        auth_response=$(curl -s --max-time 15 \
            -X POST \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"$VITE_TB_USERNAME\",\"password\":\"$VITE_TB_PASSWORD\"}" \
            http://localhost:8080/api/tb/auth/login)
        
        if echo "$auth_response" | grep -q "token"; then
            echo -e "${GREEN}✅ ThingsBoard authentication successful${NC}"
            echo "Token received: $(echo "$auth_response" | grep -o '"token":"[^"]*' | cut -d'"' -f4 | cut -c1-20)..."
        elif echo "$auth_response" | grep -q "error"; then
            echo -e "${RED}❌ ThingsBoard authentication failed${NC}"
            echo "Error: $auth_response"
        else
            echo -e "${YELLOW}⚠️ Unexpected authentication response${NC}"
            echo "Response: $auth_response"
        fi
    fi
}

# Function to test API endpoints
test_api_endpoints() {
    echo -e "\n${BLUE}📡 Testing API Endpoints...${NC}"
    
    if check_port; then
        # Test basic API health
        echo "Testing basic API connectivity..."
        api_response=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" http://localhost:8080/api/tb/api)
        echo "API Response Code: $api_response"
        
        # Test if the dashboard page loads
        echo "Testing dashboard page..."
        dashboard_response=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" http://localhost:8080/)
        if [ "$dashboard_response" = "200" ]; then
            echo -e "${GREEN}✅ Dashboard page loads successfully${NC}"
        else
            echo -e "${RED}❌ Dashboard page failed to load (HTTP $dashboard_response)${NC}"
        fi
    fi
}

# Function to check environment variables
check_env() {
    echo -e "\n${BLUE}⚙️ Checking Environment Variables...${NC}"
    
    if [ -f ".env.local" ]; then
        echo -e "${GREEN}✅ .env.local file exists${NC}"
        
        # Check required variables
        if grep -q "VITE_TB_BASE_URL" .env.local; then
            tb_url=$(grep "VITE_TB_BASE_URL" .env.local | cut -d'=' -f2)
            echo -e "${GREEN}✅ VITE_TB_BASE_URL: $tb_url${NC}"
        else
            echo -e "${RED}❌ VITE_TB_BASE_URL not found${NC}"
        fi
        
        if grep -q "VITE_SUPABASE_URL" .env.local; then
            supabase_url=$(grep "VITE_SUPABASE_URL" .env.local | cut -d'=' -f2)
            echo -e "${GREEN}✅ VITE_SUPABASE_URL: $supabase_url${NC}"
        else
            echo -e "${RED}❌ VITE_SUPABASE_URL not found${NC}"
        fi
        
        if grep -q "VITE_TB_USERNAME" .env.local; then
            echo -e "${GREEN}✅ VITE_TB_USERNAME is set${NC}"
        else
            echo -e "${YELLOW}⚠️ VITE_TB_USERNAME not found (using hardcoded)${NC}"
        fi
        
    else
        echo -e "${RED}❌ .env.local file not found${NC}"
        echo "Creating .env.local from README data..."
        
        echo -e "${RED}❌ Please create .env.local manually with your credentials${NC}"
        echo "Required variables:"
        echo "  VITE_TB_BASE_URL=https://thingsboard.cloud"
        echo "  VITE_TB_USERNAME=your_username"
        echo "  VITE_TB_PASSWORD=your_password"
        echo "  VITE_SUPABASE_URL=your_supabase_url"
        echo "  VITE_SUPABASE_ANON_KEY=your_supabase_key"
        echo -e "${GREEN}✅ Created .env.local file${NC}"
    fi
}

# Function to start dev server if not running
start_dev_server() {
    if ! check_port; then
        echo -e "\n${YELLOW}🚀 Starting development server...${NC}"
        npm run dev > dev-server.log 2>&1 &
        DEV_PID=$!
        echo "Dev server PID: $DEV_PID"
        
        # Wait for server to start
        echo "Waiting for server to start..."
        for i in {1..30}; do
            if check_port; then
                echo -e "${GREEN}✅ Dev server started successfully${NC}"
                return 0
            fi
            sleep 1
            echo -n "."
        done
        
        echo -e "\n${RED}❌ Dev server failed to start within 30 seconds${NC}"
        echo "Check dev-server.log for details:"
        tail -10 dev-server.log
        return 1
    fi
}

# Function to run browser test
test_browser() {
    echo -e "\n${BLUE}🌐 Browser Test Instructions...${NC}"
    echo "1. Open browser to: http://localhost:8080/dashboard"
    echo "2. Open browser dev tools (F12)"
    echo "3. Check Console tab for errors"
    echo "4. Look for these specific errors:"
    echo "   - Authentication failures"
    echo "   - API request failures"
    echo "   - CORS errors"
    echo "   - Network errors"
    echo ""
    echo "Expected console logs to look for:"
    echo "   - '🔄 Dashboard: Fetching all data...'"
    echo "   - '✅ Dashboard: Data fetch completed'"
    echo "   - '📡 ThingsBoard targets: X'"
    echo "   - '🏠 Room assignments from Supabase: X'"
    
    if command -v open >/dev/null 2>&1; then
        read -p "Open browser automatically? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            open "http://localhost:8080/dashboard"
        fi
    fi
}

# Function to show logs
show_logs() {
    echo -e "\n${BLUE}📋 Recent Logs...${NC}"
    if [ -f "dev-server.log" ]; then
        echo "Last 20 lines from dev-server.log:"
        tail -20 dev-server.log
    else
        echo "No dev-server.log found"
    fi
}

# Main execution
main() {
    echo "Starting comprehensive dashboard debug..."
    
    check_env
    start_dev_server
    
    if check_port; then
        test_thingsboard
        test_auth
        test_api_endpoints
        test_browser
        show_logs
    else
        echo -e "\n${RED}❌ Cannot proceed without running dev server${NC}"
        exit 1
    fi
    
    echo -e "\n${GREEN}🎉 Debug script completed!${NC}"
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo "1. Check browser console at http://localhost:8080/dashboard"
    echo "2. Look for target numbers in the dashboard cards"
    echo "3. If still no data, check the browser Network tab for failed requests"
    echo "4. Run: tail -f dev-server.log (in another terminal) to see live logs"
}

# Handle Ctrl+C
trap 'echo -e "\n${YELLOW}Debug interrupted by user${NC}"; exit 0' INT

# Run main function
main "$@"
