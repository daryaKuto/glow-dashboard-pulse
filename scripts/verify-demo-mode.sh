#!/bin/bash

###############################################################################
# Demo Mode Data Isolation Verification Script
# Verifies that Demo mode uses ONLY mock data and Live mode uses ONLY real data
###############################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Demo Mode Data Isolation Verification                 ║"
echo "║     Automated Console Log Testing                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Check if dev server is running
echo -e "${BLUE}→ Checking development server...${NC}"
if curl -s http://localhost:8081 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server running on http://localhost:8081${NC}\n"
else
    echo -e "${RED}✗ Server not running. Please start with: npm run dev${NC}"
    exit 1
fi

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  DEMO MODE VERIFICATION${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"

echo -e "${BLUE}Instructions:${NC}"
echo "1. Open browser DevTools Console (F12)"
echo "2. Navigate to: http://localhost:8081/dashboard"
echo "3. In console, run: localStorage.setItem('demo_mode', 'true'); location.reload();"
echo "4. Or click 'Toggle' button to enable Demo mode (🎭 Demo badge)"
echo ""

echo -e "${CYAN}Expected Console Logs for DEMO MODE:${NC}"
echo ""
echo -e "${GREEN}Dashboard:${NC}"
echo "  🎭 Demo Mode ENABLED - Using placeholder data"
echo "  🔄 Dashboard: Fetching all data (DEMO mode)..."
echo "  🎭 DEMO: Using mock data for all dashboard stats"
echo "  ✅ DEMO: Loaded mock targets: 6"
echo "  ✅ DEMO: Loaded mock sessions: 5"
echo ""
echo -e "${GREEN}Targets Page:${NC}"
echo "  🔄 Targets page: Fetching targets (DEMO mode)..."
echo "  ✅ DEMO: Loaded mock targets: 6"
echo "  🔄 Polling targets data (DEMO mode)..."
echo ""
echo -e "${GREEN}Games Page:${NC}"
echo "  🎭 DEMO MODE: Loading mock devices..."
echo "  ✅ DEMO: Loaded 6 mock devices"
echo "  🎭 Demo mode: 5 mock devices loaded"
echo ""
echo -e "${GREEN}Rooms Page:${NC}"
echo "  🔄 Rooms page: Starting data fetch (DEMO mode)..."
echo "  🎭 DEMO: Loading mock rooms..."
echo "  ✅ DEMO: Loaded mock rooms: 3"
echo "  ✅ Mock targets with assignments loaded: 6"
echo ""

echo -e "${RED}MUST NOT see in DEMO mode:${NC}"
echo "  ✗ 🔗 LIVE MODE:"
echo "  ✗ Fetching real targets from ThingsBoard"
echo "  ✗ Fetching real rooms from Supabase"
echo "  ✗ API calls in Network tab to ThingsBoard/Supabase"
echo ""

read -p "Press Enter after verifying DEMO mode console logs..."

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  LIVE MODE VERIFICATION${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"

echo -e "${BLUE}Instructions:${NC}"
echo "1. Click 'Toggle' button in header to switch to Live mode (🔗 Live badge)"
echo "2. Or in console, run: localStorage.setItem('demo_mode', 'false'); location.reload();"
echo ""

echo -e "${CYAN}Expected Console Logs for LIVE MODE:${NC}"
echo ""
echo -e "${GREEN}Dashboard:${NC}"
echo "  🔄 Dashboard: Fetching all data (LIVE mode)..."
echo "  🔗 LIVE: Merged targets loaded: [N]"
echo "  🔗 LIVE: Recent sessions loaded: [N]"
echo "  Network tab: API calls to ThingsBoard/Supabase"
echo ""
echo -e "${GREEN}Targets Page:${NC}"
echo "  🔄 Targets page: Fetching targets (LIVE mode)..."
echo "  🔗 LIVE: Loaded real targets: [N]"
echo "  🔄 Polling targets data (LIVE mode)..."
echo "  Network tab: ThingsBoard API calls"
echo ""
echo -e "${GREEN}Games Page:${NC}"
echo "  🔄 LIVE MODE: Loading devices from ThingsBoard..."
echo "  📊 Raw targets data: [real target count]"
echo "  ✅ Loaded [N] devices from ThingsBoard"
echo ""
echo -e "${GREEN}Rooms Page:${NC}"
echo "  🔄 Rooms page: Starting data fetch (LIVE mode)..."
echo "  🔄 Fetching rooms from Supabase..."
echo "  ✅ Rooms fetched successfully"
echo "  🔄 Refreshing targets from ThingsBoard..."
echo "  ✅ Targets refreshed successfully"
echo ""

echo -e "${RED}MUST NOT see in LIVE mode:${NC}"
echo "  ✗ 🎭 DEMO MODE:"
echo "  ✗ Using mock data"
echo "  ✗ Loaded mock targets/rooms/sessions"
echo ""

read -p "Press Enter after verifying LIVE mode console logs..."

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  DATA ISOLATION TEST${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"

echo -e "${BLUE}Test: Toggle between modes rapidly${NC}"
echo "1. Toggle to Demo mode → count targets → should be 6"
echo "2. Toggle to Live mode → count targets → should be real count (different from 6)"
echo "3. Toggle back to Demo → count targets → should be 6 again"
echo ""
read -p "Does target count change correctly when toggling? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}✓ Data isolation verified${NC}\n"
else
    echo -e "${RED}✗ Data isolation FAILED - targets not switching properly${NC}\n"
    echo "Debugging tips:"
    echo "  1. Check console for both 🎭 DEMO and 🔗 LIVE logs"
    echo "  2. Verify apiWrapper is being used in all data fetching functions"
    echo "  3. Check Network tab - should show NO API calls in demo mode"
    echo ""
    exit 1
fi

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  ✓ VERIFICATION COMPLETE                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

echo "Demo Mode Implementation:"
echo -e "  ${GREEN}✓${NC} Demo mode shows only mock data (no ThingsBoard/Supabase calls)"
echo -e "  ${GREEN}✓${NC} Live mode shows only real data (ThingsBoard + Supabase)"
echo -e "  ${GREEN}✓${NC} Console logs clearly indicate current mode (🎭 vs 🔗)"
echo -e "  ${GREEN}✓${NC} Data properly switches when toggling modes"
echo -e "  ${GREEN}✓${NC} No data leakage between modes"
echo ""
echo "Mock Data Available in Demo Mode:"
echo "  • 6 mock targets (Alpha, Bravo, Charlie, Delta, Echo, Foxtrot)"
echo "  • 3 mock rooms (Training Range A, Competition Range, Practice Zone)"
echo "  • 5 recent game sessions"
echo "  • User analytics (850 hits, 15 sessions, avg score 56)"
echo ""

