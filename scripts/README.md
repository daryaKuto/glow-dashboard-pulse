# Scripts Directory

This directory contains utility scripts for managing development data and debugging issues.

## Scripts

### 🚀 populate-dev-data.sh
Populates mock data for the dev user `andrew.tam@example.com` in Supabase.

**Creates:**
- 15 realistic training sessions with varying performance
- Aggregated analytics data (all-time stats)
- Individual hit records for each session
- Data spanning the last 30 days

**Usage:**
```bash
# Set required environment variables
export SUPABASE_PROJECT_REF="your-project-ref"
export SUPABASE_ACCESS_TOKEN="your-access-token"

# Run the script
./scripts/populate-dev-data.sh
```

**What it creates:**
- Sessions with realistic scores (540-1200 points)
- Accuracy ranging from 60% to 95%
- Reaction times between 110ms to 280ms
- Different scenarios: Quick Draw, Accuracy Test, Speed Training, etc.
- Multiple rooms: Living Room, Basement, Office, Garage

### 🔍 debug-profile-error.sh
Debugs "Failed to load profile data" errors by checking data availability and permissions.

**Checks:**
- User authentication status
- Session data existence
- Analytics data presence
- Table permissions and RLS policies
- Exact queries used by the profile service

**Usage:**
```bash
# Set required environment variables (same as above)
export SUPABASE_PROJECT_REF="your-project-ref"
export SUPABASE_ACCESS_TOKEN="your-access-token"

# Run the debug script
./scripts/debug-profile-error.sh
```

## Environment Variables

You need these environment variables set:

```bash
# Get these from your Supabase dashboard
export SUPABASE_PROJECT_REF="your-project-reference"
export SUPABASE_ACCESS_TOKEN="your-personal-access-token"
```

**Where to find them:**
1. **Project Reference**: Supabase Dashboard → Settings → General → Reference ID
2. **Access Token**: Supabase Dashboard → Settings → Access tokens → Create new token

## Prerequisites

1. **Supabase CLI installed:**
   ```bash
   npm install -g supabase
   ```

2. **User exists in Supabase Auth:**
   - Email: `andrew.tam@example.com`
   - Must be created in your Supabase project first

3. **Database tables exist:**
   - `sessions`
   - `user_analytics`  
   - `session_hits`

## Troubleshooting

### "User not found" error
- Make sure `andrew.tam@example.com` exists in your Supabase Auth users
- Check the email matches exactly

### "Missing environment variables" error
- Set `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN`
- Don't use the anon key - use your personal access token

### "Failed to insert data" error
- Check if tables exist in your database
- Verify RLS policies allow data insertion
- Run the debug script first to identify the issue

### Profile page still shows "Failed to load profile data"
1. Run the debug script to identify the exact issue
2. Check browser console for detailed error messages
3. Verify your `.env.local` file has correct Supabase credentials
4. Make sure the user is properly authenticated in the app

## Data Overview

The mock data creates a realistic user profile:

- **Total Sessions**: 15
- **Date Range**: Last 30 days
- **Performance Range**: 540-1200 points
- **Accuracy Range**: 60-95%
- **Best Session**: 1200 points, 93.33% accuracy
- **Scenarios**: 7 different types
- **Rooms**: 4 different locations
- **Total Hits**: ~400+ hits across all sessions
