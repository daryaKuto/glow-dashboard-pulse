# Supabase Setup Guide

This guide will help you set up Supabase for the Glow Dashboard Pulse application and test the connection.

## Prerequisites

1. A Supabase account (free tier available at [supabase.com](https://supabase.com))
2. Node.js installed on your system

## Setup Steps

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `glow-dashboard-pulse`
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your location
5. Click "Create new project"

### 2. Get Your Project Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (starts with `https://`)
   - **anon public** key (starts with `eyJ`)

### 3. Set Environment Variables

Create a `.env.local` file in your project root:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_KEY=your_anon_key_here
```

### 4. Create the Database Table

1. In your Supabase dashboard, go to **SQL Editor**
2. Create a new query and paste the following SQL:

```sql
-- Create user_settings table for storing user preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only see their own settings
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own settings
CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own settings
CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own settings
CREATE POLICY "Users can delete own settings" ON user_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

3. Click "Run" to execute the SQL

### 5. Test the Connection

Run the test script to verify everything is working:

```bash
npm run test:supabase
```

This will:
- Test the database connection
- Create a test user (`test@example.com` / `testpassword123`)
- Store test user preferences
- Retrieve and display the stored preferences

## Expected Output

If everything is set up correctly, you should see:

```
🔍 Testing Supabase connection...
URL: https://your-project.supabase.co
Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
✅ Database connection successful
👤 Testing user signup...
✅ User signup successful
💾 Testing user preferences storage...
✅ User preferences stored successfully
✅ User preferences retrieved successfully: {
  "target_preferences": {
    "houseWifi": {
      "ssid": "TestWiFi",
      "password": "testpassword123"
    },
    "1-1": {
      "ipAddress": "192.168.1.100"
    },
    "1-2": {
      "ipAddress": "192.168.1.101"
    },
    "2-1": {
      "ipAddress": "192.168.1.200"
    }
  }
}
🏁 Supabase test completed
```

## Troubleshooting

### Missing Environment Variables
If you see "Missing Supabase environment variables", make sure your `.env.local` file exists and contains the correct values.

### Table Doesn't Exist
If you see "Table user_settings does not exist", run the SQL migration in step 4.

### Authentication Errors
If you see authentication errors, check that your Supabase URL and key are correct.

### Network Errors
If you see network errors, check your internet connection and that the Supabase project is active.

## Next Steps

Once the test passes successfully:

1. The application will automatically use Supabase for user preferences storage
2. User authentication will work with the Supabase auth system
3. Target network preferences will be persisted in the database
4. The caching system will work with real data instead of mock data

## Security Notes

- The `anon` key is safe to use in the frontend as it has limited permissions
- Row Level Security (RLS) ensures users can only access their own data
- The test user credentials are for testing only - change them in production 