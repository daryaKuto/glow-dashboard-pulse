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

async function checkDevices() {
  try {
    console.log('🔐 Authenticating with ThingsBoard...');
    const authResponse = await axios.post(`${thingsBoardConfig.baseURL}/api/auth/login`, {
      username: thingsBoardConfig.username,
      password: thingsBoardConfig.password
    });
    
    const { token } = authResponse.data;
    console.log('✅ Authentication successful');
    
    console.log('📱 Fetching devices...');
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
    console.log(`📊 Found ${devices.length} devices:\n`);
    
    if (devices.length === 0) {
      console.log('❌ No devices found in ThingsBoard');
      return;
    }
    
    devices.forEach((device, index) => {
      console.log(`${index + 1}. Device Details:`);
      console.log(`   ID: ${device.id.id}`);
      console.log(`   Name: "${device.name}"`);
      console.log(`   Type: ${device.type}`);
      console.log(`   Created: ${new Date(device.createdTime).toLocaleString()}`);
      
      if (device.additionalInfo && Object.keys(device.additionalInfo).length > 0) {
        console.log(`   Additional Info: ${JSON.stringify(device.additionalInfo, null, 4)}`);
      } else {
        console.log(`   Additional Info: None`);
      }
      
      // Check if device has any attributes
      console.log(`   Has Attributes: ${device.additionalInfo ? 'Yes' : 'No'}`);
      console.log('');
    });
    
    // Summary
    console.log('📋 Summary:');
    console.log(`- Total devices: ${devices.length}`);
    console.log(`- Devices with custom names: ${devices.filter(d => d.name !== 'Device').length}`);
    console.log(`- Default named devices: ${devices.filter(d => d.name === 'Device').length}`);
    
    const uniqueTypes = [...new Set(devices.map(d => d.type))];
    console.log(`- Device types: ${uniqueTypes.join(', ')}`);
    
    // Check naming patterns
    const namePatterns = devices.map(d => d.name);
    console.log(`- Name patterns: ${[...new Set(namePatterns)].join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    if (error.response?.status === 429) {
      console.log('⚠️  Rate limited. Please wait a moment and try again.');
    }
  }
}

checkDevices(); 