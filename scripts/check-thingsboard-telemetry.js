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

async function checkTelemetryData() {
  try {
    console.log('🔐 Authenticating with ThingsBoard...');
    const authResponse = await axios.post(`${thingsBoardConfig.baseURL}/api/auth/login`, {
      username: thingsBoardConfig.username,
      password: thingsBoardConfig.password
    });
    
    const { token } = authResponse.data;
    console.log('✅ Authentication successful\n');
    
    // Get target devices
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
    const targetDevices = allDevices.filter(device => 
      device.name.startsWith('Dryfire-') || 
      device.type === 'dryfire-provision' ||
      (device.additionalInfo && device.additionalInfo.roomId)
    );
    
    console.log(`🎯 Checking telemetry data for ${targetDevices.length} target devices:\n`);
    
    for (const device of targetDevices) {
      console.log(`📱 Device: ${device.name} (${device.id.id})`);
      console.log(`   Type: ${device.type}`);
      console.log(`   Created: ${new Date(device.createdTime).toLocaleString()}`);
      
      // Check device attributes
      try {
        console.log('\n   🔍 Checking device attributes...');
        const attributesResponse = await axios.get(
          `${thingsBoardConfig.baseURL}/api/plugins/telemetry/DEVICE/${device.id.id}/attributes/SHARED_SCOPE`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        const attributes = attributesResponse.data;
        if (Object.keys(attributes).length > 0) {
          console.log('   📋 Shared Attributes:');
          Object.entries(attributes).forEach(([key, value]) => {
            console.log(`      ${key}: ${JSON.stringify(value)}`);
          });
        } else {
          console.log('   📋 Shared Attributes: None');
        }
        
        // Check server attributes
        const serverAttributesResponse = await axios.get(
          `${thingsBoardConfig.baseURL}/api/plugins/telemetry/DEVICE/${device.id.id}/attributes/SERVER_SCOPE`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        const serverAttributes = serverAttributesResponse.data;
        if (Object.keys(serverAttributes).length > 0) {
          console.log('   📋 Server Attributes:');
          Object.entries(serverAttributes).forEach(([key, value]) => {
            console.log(`      ${key}: ${JSON.stringify(value)}`);
          });
        } else {
          console.log('   📋 Server Attributes: None');
        }
        
      } catch (error) {
        console.log(`   ❌ Error fetching attributes: ${error.response?.data?.message || error.message}`);
      }
      
      // Check latest telemetry
      try {
        console.log('\n   📊 Checking latest telemetry...');
        const telemetryResponse = await axios.get(
          `${thingsBoardConfig.baseURL}/api/plugins/telemetry/DEVICE/${device.id.id}/values/timeseries`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            params: {
              limit: 10
            }
          }
        );
        
        const telemetry = telemetryResponse.data;
        if (Object.keys(telemetry).length > 0) {
          console.log('   📊 Latest Telemetry:');
          Object.entries(telemetry).forEach(([key, values]) => {
            const latestValue = values[values.length - 1];
            console.log(`      ${key}: ${JSON.stringify(latestValue.value)} (${new Date(latestValue.ts).toLocaleString()})`);
          });
        } else {
          console.log('   📊 Latest Telemetry: None');
        }
        
      } catch (error) {
        console.log(`   ❌ Error fetching telemetry: ${error.response?.data?.message || error.message}`);
      }
      
      // Check device activity
      try {
        console.log('\n   ⏰ Checking device activity...');
        const activityResponse = await axios.get(
          `${thingsBoardConfig.baseURL}/api/device/${device.id.id}/credentials`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        console.log(`   ⏰ Device has credentials: ${!!activityResponse.data}`);
        
      } catch (error) {
        console.log(`   ❌ Error checking activity: ${error.response?.data?.message || error.message}`);
      }
      
      console.log('\n' + '─'.repeat(80) + '\n');
    }
    
    console.log('📋 Summary of available data:');
    console.log('- Device metadata (name, type, creation time)');
    console.log('- Additional info (gateway, description, roomId)');
    console.log('- Shared attributes (custom device properties)');
    console.log('- Server attributes (system properties)');
    console.log('- Latest telemetry values (real-time data)');
    console.log('- Device credentials (connection status)');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    if (error.response?.status === 429) {
      console.log('⚠️  Rate limited. Please wait a moment and try again.');
    }
  }
}

checkTelemetryData(); 