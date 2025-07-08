import { supabase } from './integrations/supabase/client';

// Test user data
const testUser = {
  email: 'test@example.com',
  password: 'testpassword123',
  user_metadata: {
    name: 'Test User',
    avatar_url: 'https://github.com/shadcn.png'
  }
};

// Test user preferences data
const testUserPreferences = {
  houseWifi: {
    ssid: 'TestWiFi',
    password: 'testpassword123'
  },
  '1-1': {
    ipAddress: '192.168.1.100'
  },
  '1-2': {
    ipAddress: '192.168.1.101'
  },
  '2-1': {
    ipAddress: '192.168.1.200'
  }
};

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    // Test 1: Check if we can connect to Supabase
    const { data, error } = await supabase.from('user_settings').select('*').limit(1);
    
    if (error) {
      console.log('❌ Database connection test failed:', error.message);
      
      // If table doesn't exist, let's create it
      if (error.code === '42P01') { // Table doesn't exist
        console.log('📋 Table user_settings does not exist. Creating it...');
        await createUserSettingsTable();
      } else {
        throw error;
      }
    } else {
      console.log('✅ Database connection successful');
    }
    
    // Test 2: Try to sign up a test user
    console.log('👤 Testing user signup...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
      options: {
        data: testUser.user_metadata
      }
    });
    
    if (authError) {
      console.log('❌ User signup failed:', authError.message);
      
      // If user already exists, try to sign in
      if (authError.message.includes('already registered')) {
        console.log('🔄 User already exists, trying to sign in...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: testUser.email,
          password: testUser.password
        });
        
        if (signInError) {
          console.log('❌ User signin failed:', signInError.message);
        } else {
          console.log('✅ User signin successful');
          await testUserPreferencesStorage(signInData.user.id);
        }
      }
    } else {
      console.log('✅ User signup successful');
      if (authData.user) {
        await testUserPreferencesStorage(authData.user.id);
      }
    }
    
  } catch (error) {
    console.error('❌ Supabase test failed:', error);
  }
}

async function createUserSettingsTable() {
  console.log('🔨 Creating user_settings table...');
  
  // Note: This would typically be done via Supabase migrations
  // For now, we'll just log what the table structure should be
  console.log(`
    CREATE TABLE user_settings (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      target_preferences JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
  `);
  
  console.log('⚠️  Please create the user_settings table in your Supabase dashboard');
}

async function testUserPreferencesStorage(userId: string) {
  console.log('💾 Testing user preferences storage...');
  
  try {
    // Test inserting user preferences
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        target_preferences: testUserPreferences,
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.log('❌ Failed to store user preferences:', error.message);
    } else {
      console.log('✅ User preferences stored successfully');
      
      // Test retrieving user preferences
      const { data: retrievedData, error: retrieveError } = await supabase
        .from('user_settings')
        .select('target_preferences')
        .eq('user_id', userId)
        .single();
      
      if (retrieveError) {
        console.log('❌ Failed to retrieve user preferences:', retrieveError.message);
      } else {
        console.log('✅ User preferences retrieved successfully:', retrievedData);
      }
    }
  } catch (error) {
    console.log('❌ User preferences test failed:', error);
  }
}

// Run the test
testSupabaseConnection().then(() => {
  console.log('🏁 Supabase test completed');
}); 