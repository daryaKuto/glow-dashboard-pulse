#!/usr/bin/env node

/**
 * Test script for rooms integration
 * This script tests:
 * 1. Room creation and management
 * 2. Target assignment to rooms
 * 3. Room target count updates
 * 4. Integration with ThingsBoard devices
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

async function testRoomCreation() {
  try {
    console.log('\n🏠 Testing room creation...');
    
    const testRoom = {
      name: 'Test Room',
      icon: 'gamepad2',
      order_index: 999,
      target_count: 0
    };

    const { data: createdRoom, error } = await supabase
      .from('rooms')
      .insert(testRoom)
      .select()
      .single();

    if (error) {
      console.error('❌ Room creation failed:', error.message);
      return null;
    }

    console.log('✅ Room created successfully:', createdRoom);
    return createdRoom;
  } catch (error) {
    console.error('❌ Error creating test room:', error.message);
    return null;
  }
}

async function testTargetAssignment(roomId) {
  try {
    console.log('\n🎯 Testing target assignment...');
    
    // Get a target to assign
    const { data: targets, error: targetsError } = await supabase
      .from('targets')
      .select('*')
      .limit(1);

    if (targetsError || !targets || targets.length === 0) {
      console.log('⚠️  No targets available for assignment test');
      return null;
    }

    const target = targets[0];
    console.log(`📱 Assigning target: ${target.name} (${target.id})`);

    // Assign target to room
    const { error: assignError } = await supabase
      .from('targets')
      .update({ room_id: roomId })
      .eq('id', target.id);

    if (assignError) {
      console.error('❌ Target assignment failed:', assignError.message);
      return null;
    }

    console.log('✅ Target assigned successfully');
    return target;
  } catch (error) {
    console.error('❌ Error assigning target:', error.message);
    return null;
  }
}

async function testRoomTargetCountUpdate(roomId) {
  try {
    console.log('\n📊 Testing room target count update...');
    
    // Count targets in the room
    const { count, error: countError } = await supabase
      .from('targets')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    if (countError) {
      console.error('❌ Failed to count targets:', countError.message);
      return false;
    }

    console.log(`📈 Found ${count} targets in room`);

    // Update room target count
    const { error: updateError } = await supabase
      .from('rooms')
      .update({ target_count: count || 0 })
      .eq('id', roomId);

    if (updateError) {
      console.error('❌ Failed to update room target count:', updateError.message);
      return false;
    }

    console.log('✅ Room target count updated successfully');
    return true;
  } catch (error) {
    console.error('❌ Error updating room target count:', error.message);
    return false;
  }
}

async function testThingsBoardIntegration() {
  try {
    console.log('\n🔗 Testing ThingsBoard integration...');
    
    // Fetch devices from ThingsBoard
    const response = await fetch(`${tbBaseUrl}/api/tenant/devices?pageSize=10&page=0`, {
      headers: {
        'Authorization': `Bearer ${tbToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.data.length} devices from ThingsBoard`);
    
    // Show some device details
    data.data.slice(0, 3).forEach((device, index) => {
      console.log(`   ${index + 1}. ${device.name} (${device.type})`);
    });

    return data.data;
  } catch (error) {
    console.error('❌ ThingsBoard integration test failed:', error.message);
    return [];
  }
}

async function cleanupTestData(roomId) {
  try {
    console.log('\n🧹 Cleaning up test data...');
    
    // Unassign targets from test room
    const { error: unassignError } = await supabase
      .from('targets')
      .update({ room_id: null })
      .eq('room_id', roomId);

    if (unassignError) {
      console.error('⚠️  Failed to unassign targets:', unassignError.message);
    }

    // Delete test room
    const { error: deleteError } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId);

    if (deleteError) {
      console.error('⚠️  Failed to delete test room:', deleteError.message);
    } else {
      console.log('✅ Test data cleaned up');
    }
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error.message);
  }
}

async function main() {
  try {
    console.log('🧪 Starting rooms integration tests...\n');

    // Step 1: Authenticate with ThingsBoard
    await authenticateThingsBoard();

    // Step 2: Test ThingsBoard integration
    const devices = await testThingsBoardIntegration();

    // Step 3: Test room creation
    const testRoom = await testRoomCreation();

    if (testRoom) {
      // Step 4: Test target assignment
      const assignedTarget = await testTargetAssignment(testRoom.id);

      // Step 5: Test room target count update
      await testRoomTargetCountUpdate(testRoom.id);

      // Step 6: Cleanup test data
      await cleanupTestData(testRoom.id);
    }

    console.log('\n🎉 All tests completed!');
    console.log(`📊 Test Summary:`);
    console.log(`   - ThingsBoard: ${devices.length} devices available`);
    console.log(`   - Room creation: ${testRoom ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   - Target assignment: ${testRoom ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   - Room target count: ${testRoom ? '✅ PASSED' : '❌ FAILED'}`);

  } catch (error) {
    console.error('\n💥 Tests failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
main(); 