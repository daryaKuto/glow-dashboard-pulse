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

async function testEnhancedTargets() {
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
    
    console.log(`🎯 Processing ${targetDevices.length} target devices with enhanced data:\n`);
    
    for (const device of targetDevices) {
      const deviceId = device.id.id;
      console.log(`📱 Device: ${device.name} (${deviceId})`);
      
      // Fetch telemetry data
      let telemetryData = {};
      try {
        const telemetryResponse = await axios.get(
          `${thingsBoardConfig.baseURL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            params: {
              keys: 'event,gameId,game_name,hits,device_name,created_at,method,params',
              limit: 10
            }
          }
        );
        
        const telemetry = telemetryResponse.data;
        Object.entries(telemetry).forEach(([key, values]) => {
          if (values && values.length > 0) {
            telemetryData[key] = values[values.length - 1].value;
          }
        });
        
        console.log('   📊 Telemetry Data:');
        if (Object.keys(telemetryData).length > 0) {
          Object.entries(telemetryData).forEach(([key, value]) => {
            console.log(`      ${key}: ${JSON.stringify(value)}`);
          });
        } else {
          console.log('      No telemetry data available');
        }
        
        // Simulate the enhanced target object
        const enhancedTarget = {
          id: deviceId,
          name: device.name,
          status: 'online',
          battery: 100,
          roomId: device.additionalInfo?.roomId || null,
          telemetry: telemetryData,
          lastEvent: telemetryData.event || null,
          lastGameId: telemetryData.gameId || telemetryData.game_id || null,
          lastGameName: telemetryData.game_name || null,
          lastHits: telemetryData.hits ? parseInt(telemetryData.hits) : null,
          lastActivity: telemetryData.created_at || null,
          deviceName: telemetryData.device_name || device.name,
          deviceType: device.type,
          createdTime: device.createdTime,
          additionalInfo: device.additionalInfo || {},
        };
        
        console.log('\n   🎯 Enhanced Target Object:');
        console.log(`      Name: ${enhancedTarget.name}`);
        console.log(`      Device Type: ${enhancedTarget.deviceType}`);
        console.log(`      Last Event: ${enhancedTarget.lastEvent || 'None'}`);
        console.log(`      Last Game: ${enhancedTarget.lastGameName || 'None'} (${enhancedTarget.lastGameId || 'No ID'})`);
        console.log(`      Last Hits: ${enhancedTarget.lastHits || 0}`);
        console.log(`      Last Activity: ${enhancedTarget.lastActivity || 'None'}`);
        console.log(`      Room ID: ${enhancedTarget.roomId || 'None'}`);
        console.log(`      Created: ${new Date(enhancedTarget.createdTime).toLocaleDateString()}`);
        
      } catch (error) {
        console.log(`   ❌ Error fetching telemetry: ${error.response?.data?.message || error.message}`);
      }
      
      console.log('\n' + '─'.repeat(80) + '\n');
    }
    
    console.log('📋 Summary of Enhanced Data Available:');
    console.log('✅ Device metadata (name, type, creation time)');
    console.log('✅ Telemetry data (events, game info, hits)');
    console.log('✅ Game information (game ID, game name, events)');
    console.log('✅ Activity tracking (last activity, hits count)');
    console.log('✅ Device status and connectivity');
    console.log('✅ Room assignments and additional info');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    if (error.response?.status === 429) {
      console.log('⚠️  Rate limited. Please wait a moment and try again.');
    }
  }
}

testEnhancedTargets(); 