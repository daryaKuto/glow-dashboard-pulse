#!/bin/bash

# Script to populate user_profiles table with real data
# This script should be run with proper Supabase permissions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Populating user_profiles table with real data...${NC}"

# Load environment variables from .env.local
if [ -f ".env.local" ]; then
    export $(grep -v '^#' .env.local | xargs)
fi

# Check if we have the required environment variables
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}Error: Missing Supabase environment variables${NC}"
    echo "Please make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local"
    exit 1
fi

# User profile data
USER_ID="1dca810e-7f11-4ec9-8605-8633cf2b74f0"
USER_EMAIL="andrew.tam@gmail.com"

echo -e "${YELLOW}Creating user profile for: $USER_EMAIL${NC}"

# Create user profile
RESPONSE=$(curl -s -X POST "$VITE_SUPABASE_URL/rest/v1/user_profiles" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"id\": \"$USER_ID\",
    \"email\": \"$USER_EMAIL\",
    \"name\": \"Andrew Tam\",
    \"first_name\": \"Andrew\",
    \"last_name\": \"Tam\",
    \"display_name\": \"Andrew Tam\",
    \"avatar_url\": null,
    \"phone\": null,
    \"timezone\": \"UTC\",
    \"language\": \"en\",
    \"units\": \"metric\",
    \"is_active\": true,
    \"last_login_at\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",
    \"profile_completed\": true
  }")

echo "Response: $RESPONSE"

# Check if the response contains an error
if echo "$RESPONSE" | grep -q '"code"'; then
    echo -e "${RED}Error creating user profile:${NC}"
    echo "$RESPONSE" | jq .
    exit 1
else
    echo -e "${GREEN}User profile created successfully!${NC}"
    echo "$RESPONSE" | jq .
fi

echo -e "${GREEN}User profile population completed!${NC}"
