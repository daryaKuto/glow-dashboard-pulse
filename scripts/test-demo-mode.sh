#!/bin/bash

###############################################################################
# Demo Mode Testing Script
# Tests that demo mode properly uses mock data and live mode uses real data
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print colored output
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((TESTS_PASSED++))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_test() {
    echo -e "${BLUE}→ Testing: $1${NC}"
    ((TESTS_RUN++))
}

# Function to check if dev server is running
check_server() {
    if ! curl -s http://localhost:5173 > /dev/null; then
        print_error "Development server is not running on port 5173"
        echo "Please start the server with: npm run dev"
        exit 1
    fi
    print_success "Development server is running"
}

# Function to check browser developer console logs (requires manual verification)
check_console_logs() {
    local mode=$1
    local page=$2
    
    print_info "Manual check required for $page in $mode mode:"
    echo "   1. Open browser DevTools console"
    echo "   2. Navigate to: http://localhost:5173/$page"
    if [ "$mode" == "DEMO" ]; then
        echo "   3. Look for: '🎭 DEMO MODE:' messages in console"
        echo "   4. Verify NO real API calls to ThingsBoard/Supabase"
        echo "   5. Verify mock data is displayed"
    else
        echo "   3. Look for: '🔗 LIVE MODE:' messages in console"
        echo "   4. Verify real API calls to ThingsBoard/Supabase"
        echo "   5. Verify real data is displayed"
    fi
    echo ""
}

# Function to verify localStorage demo_mode setting
check_localstorage() {
    local expected=$1
    print_info "Check localStorage.demo_mode = '$expected'"
    echo "   Open browser console and run:"
    echo "   localStorage.getItem('demo_mode')"
    echo "   Expected: '$expected'"
    echo ""
}

###############################################################################
# Main Test Flow
###############################################################################

print_header "Demo Mode Testing Script"

# Step 1: Check if server is running
print_test "Development server status"
check_server

# Step 2: Test Instructions
print_header "Testing Instructions"
echo "This script will guide you through testing demo mode."
echo "Some tests require manual verification in the browser."
echo ""
echo "You will test the following pages:"
echo "  - Dashboard (/dashboard)"
echo "  - Games (/dashboard/games)"
echo "  - Rooms (/dashboard/rooms)"
echo "  - Profile (/dashboard/profile)"
echo "  - Targets (/dashboard/targets)"
echo ""
read -p "Press Enter to continue..."

###############################################################################
# DEMO MODE TESTS
###############################################################################

print_header "DEMO MODE TESTS (Mock Data)"

print_info "Setting Demo Mode..."
echo "1. Open browser at: http://localhost:5173/dashboard"
echo "2. Open DevTools Console"
echo "3. Run: localStorage.setItem('demo_mode', 'true')"
echo "4. Refresh the page"
echo "5. Verify header shows: '🎭 Demo' badge"
echo ""
read -p "Have you enabled Demo Mode? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Demo mode not enabled. Exiting."
    exit 1
fi
print_success "Demo mode enabled"

# Test Dashboard in Demo Mode
print_test "Dashboard - Demo Mode"
check_console_logs "DEMO" "dashboard"
print_info "Expected mock data on Dashboard:"
echo "   - Total Registered Targets: 6 (mock targets)"
echo "   - Total Rooms: 3 (Training Range A, Competition Range, Practice Zone)"
echo "   - Average Score: 56"
echo "   - Mock hit trend chart with realistic data"
echo "   - Recent sessions showing mock game data"
echo ""
read -p "Does Dashboard show mock data correctly? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Dashboard displays mock data correctly"
else
    print_error "Dashboard mock data verification failed"
fi

# Test Games in Demo Mode
print_test "Games Page - Demo Mode"
check_console_logs "DEMO" "dashboard/games"
print_info "Expected mock data on Games page:"
echo "   - Total Devices: 6 mock devices"
echo "   - Device names: Target Alpha, Bravo, Charlie, Delta, Echo, Foxtrot"
echo "   - 5 devices online, 1 offline (Target Delta)"
echo "   - Console: '🎭 DEMO MODE: Loading mock devices...'"
echo "   - Console: '✅ DEMO: Loaded 6 mock devices'"
echo ""
read -p "Does Games page show mock data correctly? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Games page displays mock data correctly"
else
    print_error "Games page mock data verification failed"
fi

# Test creating a game in Demo Mode
print_info "Test: Create a game in Demo Mode"
echo "   1. Click 'New Game' button"
echo "   2. Select mock devices (Target Alpha, Bravo, Charlie)"
echo "   3. Enter game name: 'Demo Test Game'"
echo "   4. Click 'Create Game'"
echo "   5. Verify console shows: '🎭 DEMO: Sending configure commands...'"
echo "   6. Verify countdown popup appears"
echo "   7. During game, verify mock hits are generated"
echo ""
read -p "Did game creation work with mock data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Game creation with mock data works"
else
    print_error "Game creation with mock data failed"
fi

# Test Rooms in Demo Mode
print_test "Rooms Page - Demo Mode"
check_console_logs "DEMO" "dashboard/rooms"
print_info "Expected mock data on Rooms page:"
echo "   - Rooms: 3 (Training Range A, Competition Range, Practice Zone)"
echo "   - Targets: 6 mock targets available"
echo "   - Console: '🎭 DEMO: Loading mock rooms...'"
echo "   - Console: '✅ Mock targets with assignments loaded: 6'"
echo ""
read -p "Does Rooms page show mock data correctly? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Rooms page displays mock data correctly"
else
    print_error "Rooms page mock data verification failed"
fi

# Test assigning targets in Demo Mode
print_info "Test: Assign target to room in Demo Mode"
echo "   1. Click on a room card to view details"
echo "   2. Select a mock target from available targets"
echo "   3. Click 'Assign Selected Targets'"
echo "   4. Verify console shows: '🎭 DEMO MODE: Assigning target...'"
echo "   5. Verify target moves to 'Assigned Targets' section"
echo "   6. Close modal and verify assignment persists"
echo ""
read -p "Did target assignment work with mock data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Target assignment with mock data works"
else
    print_error "Target assignment with mock data failed"
fi

# Test Profile in Demo Mode
print_test "Profile Page - Demo Mode"
check_console_logs "DEMO" "dashboard/profile"
print_info "Expected mock data on Profile page:"
echo "   - User: Demo User (demo@example.com)"
echo "   - Total Sessions: 15"
echo "   - Total Hits: 850"
echo "   - Average Score: 56"
echo "   - Best Score: 92"
echo "   - Recent sessions: 5 mock sessions displayed"
echo "   - Console: '🎭 DEMO MODE: Using mock user profile'"
echo ""
read -p "Does Profile page show mock data correctly? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Profile page displays mock data correctly"
else
    print_error "Profile page mock data verification failed"
fi

###############################################################################
# LIVE MODE TESTS
###############################################################################

print_header "LIVE MODE TESTS (Real Data)"

print_info "Switching to Live Mode..."
echo "1. Click 'Toggle' button next to '🎭 Demo' badge in header"
echo "2. Header should now show: '🔗 Live' badge"
echo "3. Page will reload with real data"
echo ""
read -p "Have you enabled Live Mode? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Live mode not enabled. Exiting."
    exit 1
fi
print_success "Live mode enabled"

# Test Dashboard in Live Mode
print_test "Dashboard - Live Mode"
check_console_logs "LIVE" "dashboard"
print_info "Expected real data on Dashboard:"
echo "   - Real target count from ThingsBoard"
echo "   - Real rooms from Supabase"
echo "   - Real session data from Supabase"
echo "   - Console: '🔗 LIVE MODE:' messages"
echo "   - Console: NO '🎭 DEMO MODE:' messages"
echo "   - Network tab shows API calls to ThingsBoard/Supabase"
echo ""
read -p "Does Dashboard show real data correctly? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Dashboard displays real data correctly"
else
    print_error "Dashboard real data verification failed"
fi

# Test Games in Live Mode
print_test "Games Page - Live Mode"
check_console_logs "LIVE" "dashboard/games"
print_info "Expected real data on Games page:"
echo "   - Real devices from ThingsBoard"
echo "   - Actual online/offline status"
echo "   - Console: '🔗 LIVE MODE: Loading devices from ThingsBoard...'"
echo "   - Console: Real device count logged"
echo "   - Network tab shows calls to ThingsBoard API"
echo ""
read -p "Does Games page show real data correctly? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Games page displays real data correctly"
else
    print_error "Games page real data verification failed"
fi

# Test Rooms in Live Mode
print_test "Rooms Page - Live Mode"
check_console_logs "LIVE" "dashboard/rooms"
print_info "Expected real data on Rooms page:"
echo "   - Real rooms from Supabase"
echo "   - Real targets from ThingsBoard"
echo "   - Console: '🔗 LIVE MODE: Fetching real rooms from Supabase'"
echo "   - Console: '🔗 LIVE MODE: Fetching real targets from ThingsBoard'"
echo "   - Network tab shows API calls"
echo ""
read -p "Does Rooms page show real data correctly? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Rooms page displays real data correctly"
else
    print_error "Rooms page real data verification failed"
fi

# Test Profile in Live Mode
print_test "Profile Page - Live Mode"
check_console_logs "LIVE" "dashboard/profile"
print_info "Expected real data on Profile page:"
echo "   - Real user profile from Supabase"
echo "   - Real session statistics"
echo "   - Real recent sessions"
echo "   - Console: '🔗 LIVE MODE:' messages"
echo "   - Network tab shows Supabase API calls"
echo ""
read -p "Does Profile page show real data correctly? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Profile page displays real data correctly"
else
    print_error "Profile page real data verification failed"
fi

###############################################################################
# DATA ISOLATION TEST
###############################################################################

print_header "DATA ISOLATION TEST"

print_info "Verifying no data leakage between modes..."

print_test "Switch between modes rapidly"
echo "1. Toggle to Demo Mode"
echo "2. Navigate to Dashboard"
echo "3. Note the target count (should be 6 for mock)"
echo "4. Toggle to Live Mode"
echo "5. Verify target count changes to real count"
echo "6. Toggle back to Demo Mode"
echo "7. Verify target count returns to 6"
echo ""
read -p "Does data properly switch between modes? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Data isolation works correctly"
else
    print_error "Data isolation test failed"
fi

print_test "Verify localStorage persistence"
echo "1. Set to Demo Mode"
echo "2. Refresh the page (F5)"
echo "3. Verify '🎭 Demo' badge still shows"
echo "4. Check console: localStorage.getItem('demo_mode') should be 'true'"
echo "5. Switch to Live Mode"
echo "6. Refresh the page"
echo "7. Verify '🔗 Live' badge still shows"
echo ""
read -p "Does mode persist across page refreshes? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Mode persistence works correctly"
else
    print_error "Mode persistence test failed"
fi

###############################################################################
# SUMMARY
###############################################################################

print_header "TEST SUMMARY"

echo "Total tests: $TESTS_RUN"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    print_success "All tests passed! Demo mode is working correctly."
    echo ""
    echo "Demo Mode Features Verified:"
    echo "  ✓ Global demo mode toggle in header"
    echo "  ✓ Mock data displayed across all pages"
    echo "  ✓ Real data displayed in live mode"
    echo "  ✓ No data leakage between modes"
    echo "  ✓ Mode persists across page refreshes"
    echo "  ✓ Console logs clearly indicate current mode"
    echo ""
    echo "Mock Data Verified:"
    echo "  ✓ 6 mock targets (Alpha, Bravo, Charlie, Delta, Echo, Foxtrot)"
    echo "  ✓ 3 mock rooms (Training Range A, Competition Range, Practice Zone)"
    echo "  ✓ Mock user profile and analytics"
    echo "  ✓ Mock game sessions and statistics"
    echo ""
    exit 0
else
    print_error "Some tests failed. Please review the failures above."
    echo ""
    echo "Common issues to check:"
    echo "  - Ensure DemoModeProvider is properly wrapped in main.tsx"
    echo "  - Verify apiWrapper is being used in all pages"
    echo "  - Check that mock services have realistic data"
    echo "  - Ensure console logs use correct emoji indicators (🎭 vs 🔗)"
    echo ""
    exit 1
fi

