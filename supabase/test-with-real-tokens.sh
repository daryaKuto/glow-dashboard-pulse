#!/bin/bash

echo "🔧 Setting up environment variables from README..."

# Set environment variables from README
export VITE_TB_BASE_URL="https://thingsboard.cloud"
export VITE_SUPABASE_URL="https://awflbawmycauvcnmpcta.supabase.co"
export VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZmxiYXdteWNhdXZjbm1wY3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTgwOTgsImV4cCI6MjA3Mzc5NDA5OH0.K-GDdPw_Q6Z8toNtFM6SKAwOfTIJhIed-Xw_0hIxPAw"
export VITE_TB_USERNAME="andrew.tam@gmail.com"
export VITE_TB_PASSWORD="dryfire2025"

echo "✅ Environment variables set!"
echo ""
echo "🧪 Testing ThingsBoard Authentication..."
echo ""

# Run the test
node tests/api/simple-auth-test.js

echo ""
echo "🧪 Testing Token Decoding..."
echo ""

# Run the decode test
node tests/api/decode-token.js

echo ""
echo "🧪 Testing Full API..."
echo ""

# Run the full API test
node tests/api/working-api-test.js
