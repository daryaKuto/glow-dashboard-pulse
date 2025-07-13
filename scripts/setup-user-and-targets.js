import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const thingsBoardConfig = {
  baseURL: 'https://thingsboard.cloud',
  username: 'andrew.tam@gmail.com',
  password: 'dryfire2025'
};

console.log('Environment check:');
console.log('VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('VITE_SUPABASE_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Please set VITE_SUPABASE_URL and VITE_SUPABASE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test user data
const testUser = {
  email: 'andrew.tam@gmail.com',
  password: 'dryfire2025',
  user_metadata: {
    name: 'Andrew Tam',
    avatar_url: 'https://github.com/shadcn.png'
  }
};

async function setupUserAndTargets() {
  console.log('🚀 Setting up user and connecting to ThingsBoard targets...\n');

  try {
    // Step 1: Create/Get user in Supabase
    console.log('1. Setting up user in Supabase...');
    
    // First try to sign in (user might already exist)
    let { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password
    });

    if (signInError) {
      if (signInError.message.includes('Invalid login credentials')) {
        console.log('   User does not exist, attempting to create...');
        
        // Try to create the user
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: testUser.email,
          password: testUser.password,
          options: {
            data: testUser.user_metadata
          }
        });

        if (signUpError) {
          if (signUpError.message.includes('already registered') || signUpError.message.includes('rate limit')) {
            console.log('   ⚠️  User may already exist or rate limited, trying sign in again...');
            // Wait a moment and try sign in again
            await new Promise(resolve => setTimeout(resolve, 2000));
            const retrySignIn = await supabase.auth.signInWithPassword({
              email: testUser.email,
              password: testUser.password
            });
            
            if (retrySignIn.error) {
              throw new Error(`Sign in failed after retry: ${retrySignIn.error.message}`);
            }
            
            authData = retrySignIn.data;
            console.log('   ✅ User signed in successfully after retry');
          } else {
            throw signUpError;
          }
        } else {
          console.log('   ✅ User created successfully');
          authData = signUpData;
        }
      } else {
        throw signInError;
      }
    } else {
      console.log('   ✅ User signed in successfully');
    }

    if (authData.user) {
      await setupUserData(authData.user.id);
    }

    // Step 2: Connect to ThingsBoard and get devices
    console.log('\n2. Connecting to ThingsBoard...');
    const thingsBoardData = await connectToThingsBoard();
    
    // Step 3: Create targets in database based on ThingsBoard devices
    console.log('\n3. Creating targets in database...');
    await createTargetsFromThingsBoard(thingsBoardData.devices, thingsBoardData.tenantId);
    
    // Step 4: Create rooms and assign targets
    console.log('\n4. Setting up rooms and target assignments...');
    await setupRoomsAndAssignments();
    
    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`✅ User: ${testUser.email}`);
    console.log(`✅ ThingsBoard devices: ${thingsBoardData.devices.length}`);
    console.log(`✅ Database targets: Created from ThingsBoard devices`);
    console.log(`✅ Rooms: Created and targets assigned`);
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

async function setupUserData(userId) {
  console.log('   Setting up user preferences...');
  
  // Create user settings
  const { error: settingsError } = await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      target_preferences: {
        thingsBoard: {
          tenantId: 'd945d6c0-cf79-11ef-9de2-ff6e9ec30ba2',
          customerId: '13814000-1dd2-11b2-8080-808080808080'
        }
      }
    });

  if (settingsError) {
    console.log('   ⚠️  User settings error (may already exist):', settingsError.message);
  } else {
    console.log('   ✅ User settings created');
  }
}

async function connectToThingsBoard() {
  try {
    // Login to ThingsBoard
    const loginResponse = await axios.post(`${thingsBoardConfig.baseURL}/api/auth/login`, {
      username: thingsBoardConfig.username,
      password: thingsBoardConfig.password
    });

    const { token, refreshToken } = loginResponse.data;
    console.log('   ✅ ThingsBoard login successful');

    // Get devices
    const devicesResponse = await axios.get(`${thingsBoardConfig.baseURL}/api/tenant/devices`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        pageSize: 50,
        page: 0
      }
    });

    const devices = devicesResponse.data.data || [];
    console.log(`   ✅ Found ${devices.length} devices in ThingsBoard`);

    // Decode token to get tenant ID
    const tokenPayload = decodeJWT(token);
    const tenantId = tokenPayload.tenantId;

    return {
      devices,
      tenantId,
      token,
      refreshToken
    };

  } catch (error) {
    console.error('   ❌ ThingsBoard connection failed:', error.response?.data || error.message);
    throw error;
  }
}

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    console.error('Error decoding JWT:', error.message);
    return null;
  }
}

async function createTargetsFromThingsBoard(devices, tenantId) {
  // First, let's clear existing targets (for testing)
  const { error: deleteError } = await supabase
    .from('targets')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all except dummy

  if (deleteError) {
    console.log('   ⚠️  Could not clear existing targets:', deleteError.message);
  }

  // Create targets from ThingsBoard devices
  const targetsToInsert = devices.map((device, index) => ({
    name: device.name,
    room_id: null, // Will be assigned later
    status: 'online', // Default status
    battery_level: 100, // Default battery
    ip_address: null,
    last_seen: new Date().toISOString(),
    additional_info: {
      thingsBoardId: device.id.id,
      thingsBoardType: device.type,
      tenantId: tenantId,
      createdTime: device.createdTime
    }
  }));

  const { data: insertedTargets, error: insertError } = await supabase
    .from('targets')
    .insert(targetsToInsert)
    .select();

  if (insertError) {
    console.error('   ❌ Failed to create targets:', insertError.message);
    throw insertError;
  }

  console.log(`   ✅ Created ${insertedTargets.length} targets in database`);
  return insertedTargets;
}

async function setupRoomsAndAssignments() {
  // Create some default rooms
  const rooms = [
    { name: 'Living Room', icon: 'home', order_index: 0 },
    { name: 'Bedroom', icon: 'bed', order_index: 1 },
    { name: 'Kitchen', icon: 'utensils', order_index: 2 },
    { name: 'Office', icon: 'briefcase', order_index: 3 }
  ];

  const { data: insertedRooms, error: roomsError } = await supabase
    .from('rooms')
    .upsert(rooms, { onConflict: 'name' })
    .select();

  if (roomsError) {
    console.error('   ❌ Failed to create rooms:', roomsError.message);
    throw roomsError;
  }

  console.log(`   ✅ Created/updated ${insertedRooms.length} rooms`);

  // Get all targets and assign them to rooms
  const { data: targets, error: targetsError } = await supabase
    .from('targets')
    .select('*');

  if (targetsError) {
    console.error('   ❌ Failed to get targets:', targetsError.message);
    throw targetsError;
  }

  // Assign targets to rooms (round-robin assignment)
  const roomAssignments = targets.map((target, index) => ({
    id: target.id,
    room_id: insertedRooms[index % insertedRooms.length].id
  }));

  // Update targets with room assignments
  for (const assignment of roomAssignments) {
    const { error: updateError } = await supabase
      .from('targets')
      .update({ room_id: assignment.room_id })
      .eq('id', assignment.id);

    if (updateError) {
      console.error(`   ⚠️  Failed to assign target ${assignment.id} to room:`, updateError.message);
    }
  }

  console.log(`   ✅ Assigned ${roomAssignments.length} targets to rooms`);

  // Update room target counts
  for (const room of insertedRooms) {
    const targetCount = roomAssignments.filter(a => a.room_id === room.id).length;
    
    const { error: countError } = await supabase
      .from('rooms')
      .update({ target_count: targetCount })
      .eq('id', room.id);

    if (countError) {
      console.error(`   ⚠️  Failed to update room ${room.id} target count:`, countError.message);
    }
  }

  console.log('   ✅ Updated room target counts');
}

// Run the setup
setupUserAndTargets(); 