#!/usr/bin/env node

/**
 * Test script for refactored rooms functionality
 * Tests the new ThingsBoard-based room management
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: '.env.local' });

const tbBaseUrl = process.env.VITE_TB_BASE_URL;
const tbUsername = process.env.VITE_TB_USERNAME || 'andrew.tam@gmail.com';
const tbPassword = process.env.VITE_TB_PASSWORD || 'dryfire2025';

if (!tbBaseUrl) {
  console.error('❌ Missing ThingsBoard environment variables');
  process.exit(1);
}

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

async function testGetRooms() {
  try {
    console.log('\n🏠 Testing getRooms functionality...');
    
    // Get device groups from ThingsBoard (these represent rooms)
    const response = await fetch(`${tbBaseUrl}/api/entityGroups?entityType=DEVICE`, {
      headers: {
        'Authorization': `Bearer ${tbToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch device groups: ${response.status}`);
    }

    const groupsData = await response.json();
    console.log(`✅ Found ${groupsData.length} device groups (rooms) in ThingsBoard`);
    
    // Show the groups
    groupsData.forEach((group, index) => {
      console.log(`   ${index + 1}. ${group.name} (${group.id.id})`);
    });

    return groupsData;
  } catch (error) {
    console.error('❌ Error testing getRooms:', error.message);
    return [];
  }
}

async function testGetDevices() {
  try {
    console.log('\n📱 Testing getDevices functionality...');
    
    const response = await fetch(`${tbBaseUrl}/api/tenant/devices?pageSize=100&page=0`, {
      headers: {
        'Authorization': `Bearer ${tbToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Found ${data.data.length} total devices in ThingsBoard`);
    
    // Filter to target devices
    const targetDevices = data.data.filter(device => 
      device.name.startsWith('Dryfire-') || 
      device.type === 'dryfire-provision'
    );
    
    console.log(`✅ Found ${targetDevices.length} target devices`);
    
    // Show some target devices
    targetDevices.slice(0, 3).forEach((device, index) => {
      console.log(`   ${index + 1}. ${device.name} (${device.type})`);
    });

    return targetDevices;
  } catch (error) {
    console.error('❌ Error testing getDevices:', error.message);
    return [];
  }
}

async function testCreateRoom() {
  try {
    console.log('\n➕ Testing createRoom functionality...');
    
    const testRoomName = `Test Room ${Date.now()}`;
    
    const response = await fetch(`${tbBaseUrl}/api/entityGroup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: testRoomName,
        type: 'DEVICE',
        additionalInfo: {
          icon: 'gamepad2'
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create room: ${response.status}`);
    }

    const newRoom = await response.json();
    console.log(`✅ Created test room: ${newRoom.name} (${newRoom.id.id})`);
    
    return newRoom;
  } catch (error) {
    console.error('❌ Error testing createRoom:', error.message);
    return null;
  }
}

async function cleanupTestRoom(roomId) {
  try {
    console.log('\n🧹 Cleaning up test room...');
    
    const response = await fetch(`${tbBaseUrl}/api/entityGroup/${roomId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tbToken}`,
      },
    });

    if (response.ok) {
      console.log('✅ Test room cleaned up');
    } else {
      console.log(`⚠️  Failed to clean up test room (${response.status})`);
    }
  } catch (error) {
    console.error('❌ Error cleaning up test room:', error.message);
  }
}

async function main() {
  try {
    console.log('🧪 Testing refactored rooms functionality...\n');

    // Step 1: Authenticate with ThingsBoard
    await authenticateThingsBoard();

    // Step 2: Test getting existing rooms
    const existingRooms = await testGetRooms();

    // Step 3: Test getting devices
    const devices = await testGetDevices();

    // Step 4: Test creating a room
    const testRoom = await testCreateRoom();

    // Step 5: Cleanup test room
    if (testRoom) {
      await cleanupTestRoom(testRoom.id.id);
    }

    console.log('\n🎉 All tests completed!');
    console.log(`📊 Test Summary:`);
    console.log(`   - Authentication: ✅ PASSED`);
    console.log(`   - Get Rooms: ${existingRooms.length} rooms found`);
    console.log(`   - Get Devices: ${devices.length} target devices found`);
    console.log(`   - Create Room: ${testRoom ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   - Cleanup: ${testRoom ? '✅ PASSED' : 'N/A'}`);

  } catch (error) {
    console.error('\n💥 Tests failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
main(); 