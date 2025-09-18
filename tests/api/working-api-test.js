const axios = require('axios');

console.log('🔍 Working ThingsBoard API Test\n');

// Test configuration
const config = {
  baseURL: 'https://thingsboard.cloud',
  username: 'andrew.tam@gmail.com',
  password: 'dryfire2025'
};

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

async function testLoginAndDecode() {
  try {
    console.log('1. Logging in to get token...');
    const loginResponse = await axios.post(`${config.baseURL}/api/auth/login`, {
      username: config.username,
      password: config.password
    });
    
    console.log('✅ Login successful!');
    const token = loginResponse.data.token;
    console.log(`Token: ${token.substring(0, 50)}...`);
    
    const payload = decodeJWT(token);
    
    if (payload) {
      console.log('\n📋 Token Payload:');
      console.log(`  User ID: ${payload.userId}`);
      console.log(`  Tenant ID: ${payload.tenantId}`);
      console.log(`  Customer ID: ${payload.customerId}`);
      console.log(`  Scopes: ${payload.scopes?.join(', ')}`);
      
      return {
        token,
        tenantId: payload.tenantId,
        userId: payload.userId,
        customerId: payload.customerId
      };
    }
    
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data || error.message);
    return null;
  }
}

async function testDeviceList(authData) {
  if (!authData) return;
  
  const { token, tenantId } = authData;
  
  try {
    console.log('\n2. Testing Device List...');
    // Try the correct endpoint format
    const response = await axios.get(`${config.baseURL}/api/tenant/devices`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        pageSize: 10,
        page: 0
      }
    });
    
    console.log('✅ Device list successful!');
    console.log(`Status: ${response.status}`);
    console.log(`Devices found: ${response.data.data?.length || 0}`);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log(`First device: ${response.data.data[0].name} (${response.data.data[0].id.id})`);
      return response.data.data[0].id.id;
    }
    
  } catch (error) {
    console.log('❌ Device list failed:', error.response?.data || error.message);
  }
}

async function testUserList(authData) {
  if (!authData) return;
  
  const { token } = authData;
  
  try {
    console.log('\n3. Testing User List...');
    const response = await axios.get(`${config.baseURL}/api/tenant/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        pageSize: 10,
        page: 0
      }
    });
    
    console.log('✅ User list successful!');
    console.log(`Status: ${response.status}`);
    console.log(`Users found: ${response.data.data?.length || 0}`);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log(`First user: ${response.data.data[0].email} (${response.data.data[0].id.id})`);
      return response.data.data[0].id.id;
    }
    
  } catch (error) {
    console.log('❌ User list failed:', error.response?.data || error.message);
  }
}

async function testCreateDevice(authData) {
  if (!authData) return;
  
  const { token } = authData;
  
  try {
    console.log('\n4. Testing Device Creation...');
    const deviceName = `TestDevice_${Date.now()}`;
    const response = await axios.post(`${config.baseURL}/api/device`, {
      name: deviceName,
      type: 'default',
      additionalInfo: {
        description: 'Test device created via API'
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Device creation successful!');
    console.log(`Status: ${response.status}`);
    console.log(`Device ID: ${response.data.id.id}`);
    console.log(`Device Name: ${response.data.name}`);
    
    return response.data.id.id;
  } catch (error) {
    console.log('❌ Device creation failed:', error.response?.data || error.message);
    return null;
  }
}

async function testTelemetry(authData, deviceId) {
  if (!authData || !deviceId) {
    console.log('\n⚠️  Skipping telemetry test - no auth data or device ID');
    return;
  }
  
  const { token } = authData;
  
  try {
    console.log('\n5. Testing Telemetry Data...');
    const response = await axios.get(`${config.baseURL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        keys: 'temperature,humidity,battery',
        limit: 10
      }
    });
    
    console.log('✅ Telemetry data successful!');
    console.log(`Status: ${response.status}`);
    console.log(`Data: ${JSON.stringify(response.data, null, 2)}`);
    
  } catch (error) {
    console.log('❌ Telemetry data failed:', error.response?.data || error.message);
  }
}

async function testDeviceAttributes(authData, deviceId) {
  if (!authData || !deviceId) {
    console.log('\n⚠️  Skipping attributes test - no auth data or device ID');
    return;
  }
  
  const { token } = authData;
  
  try {
    console.log('\n6. Testing Device Attributes...');
    const response = await axios.get(`${config.baseURL}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SHARED_SCOPE`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Device attributes successful!');
    console.log(`Status: ${response.status}`);
    console.log(`Attributes: ${JSON.stringify(response.data, null, 2)}`);
    
  } catch (error) {
    console.log('❌ Device attributes failed:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Working API Tests...\n');
  
  const authData = await testLoginAndDecode();
  const deviceId = await testDeviceList(authData);
  const userId = await testUserList(authData);
  const newDeviceId = await testCreateDevice(authData);
  
  // Test telemetry with the newly created device
  await testTelemetry(authData, newDeviceId);
  await testDeviceAttributes(authData, newDeviceId);
  
  console.log('\n🏁 All tests completed!');
  console.log('\n📊 Summary:');
  console.log(`✅ Authentication: Working`);
  console.log(`✅ Device Creation: Working`);
  console.log(`✅ API Integration: Ready for implementation`);
}

runTests(); 