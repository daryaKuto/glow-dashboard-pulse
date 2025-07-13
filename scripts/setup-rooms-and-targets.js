#!/usr/bin/env node

/**
 * Setup script for rooms and targets integration
 * This script:
 * 1. Creates default rooms in Supabase
 * 2. Fetches devices from ThingsBoard
 * 3. Syncs devices as targets in Supabase
 * 4. Assigns targets to rooms
 * 5. Updates room target counts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const tbBaseUrl = process.env.VITE_TB_BASE_URL;
const tbUsername = process.env.VITE_TB_USERNAME || 'andrew.tam@gmail.com';
const tbPassword = process.env.VITE_TB_PASSWORD || 'dryfire2025';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

if (!tbBaseUrl) {
  console.error('❌ Missing ThingsBoard environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ThingsBoard authentication
let tbToken = null;

async function authenticateThingsBoard() {
  try {
    console.log('🔐 Authenticating with ThingsBoard...');
    
    const response = await fetch(`${tbBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: tbUsername,
        password: tbPassword,
      }),
    });

    if (!response.ok) {
      throw new Error(`ThingsBoard login failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    tbToken = data.token;
    
    console.log('✅ ThingsBoard authentication successful');
    return data;
  } catch (error) {
    console.error('❌ ThingsBoard authentication failed:', error.message);
    throw error;
  }
}

async function fetchThingsBoardDevices() {
  try {
    console.log('📱 Fetching devices from ThingsBoard...');
    
    const response = await fetch(`${tbBaseUrl}/api/tenant/devices?pageSize=100&page=0`, {
      headers: {
        'Authorization': `Bearer ${tbToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.data.length} devices from ThingsBoard`);
    
    // Filter to only show Dryfire targets (exclude system devices)
    const targetDevices = data.data.filter(device => 
      device.name.startsWith('Dryfire-') || 
      device.type === 'dryfire-provision' ||
      (device.additionalInfo && device.additionalInfo.roomId)
    );
    
    console.log(`✅ Filtered to ${targetDevices.length} target devices`);
    return targetDevices;
  } catch (error) {
    console.error('❌ Failed to fetch ThingsBoard devices:', error.message);
    throw error;
  }
}

async function createDefaultRooms() {
  try {
    console.log('🏠 Creating default rooms...');
    
    const defaultRooms = [
      { name: 'Living Room', icon: 'sofa', order_index: 0 },
      { name: 'Bedroom', icon: 'bed', order_index: 1 },
      { name: 'Kitchen', icon: 'chef-hat', order_index: 2 },
      { name: 'Office', icon: 'briefcase', order_index: 3 },
      { name: 'Game Room', icon: 'gamepad2', order_index: 4 },
      { name: 'Basement', icon: 'building', order_index: 5 }
    ];

    const { data: insertedRooms, error } = await supabase
      .from('rooms')
      .upsert(defaultRooms, { onConflict: 'name' })
      .select();

    if (error) {
      console.error('❌ Failed to create rooms:', error.message);
      throw error;
    }

    console.log(`✅ Created/updated ${insertedRooms.length} rooms`);
    return insertedRooms;
  } catch (error) {
    console.error('❌ Error creating rooms:', error.message);
    throw error;
  }
}

async function syncDevicesAsTargets(devices) {
  try {
    console.log('🔄 Syncing devices as targets...');
    
    const targets = devices.map(device => ({
      id: device.id.id, // Use ThingsBoard device ID as target ID
      name: device.name,
      status: 'online', // Default status
      battery_level: 100, // Default battery level
      room_id: null, // Will be assigned later
      last_seen: new Date().toISOString()
    }));

    // Upsert targets (insert or update if exists)
    const { data: insertedTargets, error } = await supabase
      .from('targets')
      .upsert(targets, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('❌ Failed to sync targets:', error.message);
      throw error;
    }

    console.log(`✅ Synced ${insertedTargets.length} targets`);
    return insertedTargets;
  } catch (error) {
    console.error('❌ Error syncing targets:', error.message);
    throw error;
  }
}

async function assignTargetsToRooms(targets, rooms) {
  try {
    console.log('🎯 Assigning targets to rooms...');
    
    // Round-robin assignment of targets to rooms
    const assignments = targets.map((target, index) => ({
      targetId: target.id,
      roomId: rooms[index % rooms.length].id
    }));

    let assignedCount = 0;
    for (const assignment of assignments) {
      const { error } = await supabase
        .from('targets')
        .update({ room_id: assignment.roomId })
        .eq('id', assignment.targetId);

      if (error) {
        console.error(`⚠️  Failed to assign target ${assignment.targetId}:`, error.message);
      } else {
        assignedCount++;
      }
    }

    console.log(`✅ Assigned ${assignedCount} targets to rooms`);
  } catch (error) {
    console.error('❌ Error assigning targets:', error.message);
    throw error;
  }
}

async function updateRoomTargetCounts(rooms) {
  try {
    console.log('📊 Updating room target counts...');
    
    for (const room of rooms) {
      // Count targets in this room
      const { count, error: countError } = await supabase
        .from('targets')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id);

      if (countError) {
        console.error(`⚠️  Failed to count targets for room ${room.id}:`, countError.message);
        continue;
      }

      // Update room target count
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ target_count: count || 0 })
        .eq('id', room.id);

      if (updateError) {
        console.error(`⚠️  Failed to update target count for room ${room.id}:`, updateError.message);
      }
    }

    console.log('✅ Updated room target counts');
  } catch (error) {
    console.error('❌ Error updating room target counts:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting rooms and targets setup...\n');

    // Step 1: Authenticate with ThingsBoard
    await authenticateThingsBoard();

    // Step 2: Fetch devices from ThingsBoard
    const devices = await fetchThingsBoardDevices();

    // Step 3: Create default rooms
    const rooms = await createDefaultRooms();

    // Step 4: Sync devices as targets
    const targets = await syncDevicesAsTargets(devices);

    // Step 5: Assign targets to rooms
    await assignTargetsToRooms(targets, rooms);

    // Step 6: Update room target counts
    await updateRoomTargetCounts(rooms);

    console.log('\n🎉 Setup completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - ${rooms.length} rooms created`);
    console.log(`   - ${targets.length} targets synced from ThingsBoard`);
    console.log(`   - Room target counts updated`);

  } catch (error) {
    console.error('\n💥 Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
main(); 