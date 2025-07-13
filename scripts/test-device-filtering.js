#!/usr/bin/env node

import dotenv from 'dotenv';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const thingsBoardConfig = {
  baseURL: 'https://thingsboard.cloud',
  username: 'andrew.tam@gmail.com',
  password: 'dryfire2025'
};

async function testDeviceFiltering() {
  try {
    console.log('🔐 Authenticating with ThingsBoard...');
    const authResponse = await axios.post(`${thingsBoardConfig.baseURL}/api/auth/login`, {
      username: thingsBoardConfig.username,
      password: thingsBoardConfig.password
    });
    
    const { token } = authResponse.data;
    console.log('✅ Authentication successful');
    
    console.log('📱 Fetching all devices...');
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
    
    const allDevices = devicesResponse.data.data || [];
    console.log(`📊 Total devices found: ${allDevices.length}\n`);
    
    // Apply the same filtering logic as in the API
    const targetDevices = allDevices.filter(device => 
      device.name.startsWith('Dryfire-') || 
      device.type === 'dryfire-provision' ||
      (device.additionalInfo && device.additionalInfo.roomId)
    );
    
    console.log('🎯 Target devices (after filtering):');
    console.log(`Found ${targetDevices.length} target devices:\n`);
    
    targetDevices.forEach((device, index) => {
      console.log(`${index + 1}. ${device.name}`);
      console.log(`   ID: ${device.id.id}`);
      console.log(`   Type: ${device.type}`);
      console.log(`   Room ID: ${device.additionalInfo?.roomId || 'None'}`);
      console.log('');
    });
    
    // Show what was filtered out
    const filteredOut = allDevices.filter(device => 
      !device.name.startsWith('Dryfire-') && 
      device.type !== 'dryfire-provision' &&
      (!device.additionalInfo || !device.additionalInfo.roomId)
    );
    
    console.log('🚫 Filtered out devices:');
    filteredOut.forEach(device => {
      console.log(`   - ${device.name} (${device.type})`);
    });
    
    console.log(`\n📋 Summary:`);
    console.log(`- Total devices: ${allDevices.length}`);
    console.log(`- Target devices: ${targetDevices.length}`);
    console.log(`- Filtered out: ${filteredOut.length}`);
    console.log(`- Filtering ratio: ${((targetDevices.length / allDevices.length) * 100).toFixed(1)}% targets`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    if (error.response?.status === 429) {
      console.log('⚠️  Rate limited. Please wait a moment and try again.');
    }
  }
}

testDeviceFiltering(); 