#!/usr/bin/env node

/**
 * Setup script for ThingsBoard rooms (device groups)
 * This script:
 * 1. Authenticates with ThingsBoard
 * 2. Creates device groups for rooms
 * 3. Assigns existing devices to rooms
 * 4. Keeps Supabase only for analytics data
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

async function createDeviceGroups() {
  try {
    console.log('🏠 Creating device groups (rooms) in ThingsBoard...');
    
    const defaultRooms = [
      { name: 'Living Room', icon: 'sofa' },
      { name: 'Bedroom', icon: 'bed' },
      { name: 'Kitchen', icon: 'chef-hat' },
      { name: 'Office', icon: 'briefcase' },
      { name: 'Game Room', icon: 'gamepad2' },
      { name: 'Basement', icon: 'building' }
    ];

    const createdGroups = [];

    for (const room of defaultRooms) {
      try {
        const response = await fetch(`${tbBaseUrl}/api/entityGroup`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tbToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: room.name,
            type: 'DEVICE',
            additionalInfo: {
              icon: room.icon
            }
          }),
        });

        if (response.ok) {
          const group = await response.json();
          createdGroups.push(group);
          console.log(`✅ Created device group: ${room.name}`);
        } else {
          console.log(`⚠️  Device group ${room.name} might already exist (${response.status})`);
        }
      } catch (error) {
        console.error(`❌ Failed to create device group ${room.name}:`, error.message);
      }
    }

    console.log(`✅ Created/verified ${createdGroups.length} device groups`);
    return createdGroups;
  } catch (error) {
    console.error('❌ Error creating device groups:', error.message);
    throw error;
  }
}

async function assignDevicesToGroups(devices, groups) {
  try {
    console.log('🎯 Assigning devices to device groups...');
    
    // Round-robin assignment of devices to groups
    let assignedCount = 0;
    
    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      const group = groups[i % groups.length];
      
      try {
        const response = await fetch(`${tbBaseUrl}/api/entityGroup/${group.id.id}/entities/${device.id.id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tbToken}`,
          },
        });

        if (response.ok) {
          assignedCount++;
          console.log(`✅ Assigned ${device.name} to ${group.name}`);
        } else {
          console.log(`⚠️  Failed to assign ${device.name} to ${group.name} (${response.status})`);
        }
      } catch (error) {
        console.error(`❌ Error assigning ${device.name}:`, error.message);
      }
    }

    console.log(`✅ Assigned ${assignedCount} devices to groups`);
  } catch (error) {
    console.error('❌ Error assigning devices to groups:', error.message);
    throw error;
  }
}

async function verifySetup() {
  try {
    console.log('🔍 Verifying setup...');
    
    // Get all device groups
    const groupsResponse = await fetch(`${tbBaseUrl}/api/entityGroups?entityType=DEVICE`, {
      headers: {
        'Authorization': `Bearer ${tbToken}`,
      },
    });

    if (groupsResponse.ok) {
      const groups = await groupsResponse.json();
      console.log(`📊 Found ${groups.length} device groups:`);
      
      for (const group of groups) {
        // Get devices in this group
        const devicesResponse = await fetch(`${tbBaseUrl}/api/entityGroup/${group.id.id}/entities?pageSize=100&page=0`, {
          headers: {
            'Authorization': `Bearer ${tbToken}`,
          },
        });
        
        if (devicesResponse.ok) {
          const devices = await devicesResponse.json();
          console.log(`   - ${group.name}: ${devices.data?.length || 0} devices`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error verifying setup:', error.message);
  }
}

async function main() {
  try {
    console.log('🚀 Starting ThingsBoard rooms setup...\n');

    // Step 1: Authenticate with ThingsBoard
    await authenticateThingsBoard();

    // Step 2: Fetch devices from ThingsBoard
    const devices = await fetchThingsBoardDevices();

    // Step 3: Create device groups (rooms)
    const groups = await createDeviceGroups();

    // Step 4: Assign devices to groups
    await assignDevicesToGroups(devices, groups);

    // Step 5: Verify setup
    await verifySetup();

    console.log('\n🎉 Setup completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - ${groups.length} device groups (rooms) created in ThingsBoard`);
    console.log(`   - ${devices.length} devices available for assignment`);
    console.log(`   - No data stored in Supabase (analytics only)`);

  } catch (error) {
    console.error('\n💥 Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
main(); 