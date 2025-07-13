const axios = require('axios');

console.log('🔍 Simple ThingsBoard Authentication Test\n');

// Test configuration
const config = {
  baseURL: 'https://thingsboard.cloud',
  username: 'andrew.tam@gmail.com',
  password: 'dryfire2025'
};

async function testLogin() {
  try {
    console.log('1. Testing Login...');
    const loginResponse = await axios.post(`${config.baseURL}/api/auth/login`, {
      username: config.username,
      password: config.password
    });
    
    console.log('✅ Login successful!');
    console.log(`Status: ${loginResponse.status}`);
    console.log(`Token: ${loginResponse.data.token.substring(0, 50)}...`);
    
    return loginResponse.data.token;
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data || error.message);
    return null;
  }
}

async function testDeviceList(token) {
  if (!token) {
    console.log('⚠️  Skipping device test - no token');
    return;
  }
  
  try {
    console.log('\n2. Testing Device List with Authorization header...');
    const response = await axios.get(`${config.baseURL}/api/tenant/devices`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Device list successful!');
    console.log(`Status: ${response.status}`);
    console.log(`Devices found: ${response.data.data?.length || 0}`);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log(`First device: ${response.data.data[0].name} (${response.data.data[0].id.id})`);
    }
    
  } catch (error) {
    console.log('❌ Device list failed:', error.response?.data || error.message);
  }
}

async function testDeviceListWithXAuth(token) {
  if (!token) {
    console.log('⚠️  Skipping device test - no token');
    return;
  }
  
  try {
    console.log('\n3. Testing Device List with X-Authorization header...');
    const response = await axios.get(`${config.baseURL}/api/tenant/devices`, {
      headers: {
        'X-Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Device list successful!');
    console.log(`Status: ${response.status}`);
    console.log(`Devices found: ${response.data.data?.length || 0}`);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log(`First device: ${response.data.data[0].name} (${response.data.data[0].id.id})`);
    }
    
  } catch (error) {
    console.log('❌ Device list failed:', error.response?.data || error.message);
  }
}

async function testUserList(token) {
  if (!token) {
    console.log('⚠️  Skipping user test - no token');
    return;
  }
  
  try {
    console.log('\n4. Testing User List...');
    const response = await axios.get(`${config.baseURL}/api/tenant/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ User list successful!');
    console.log(`Status: ${response.status}`);
    console.log(`Users found: ${response.data.data?.length || 0}`);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log(`First user: ${response.data.data[0].email} (${response.data.data[0].id.id})`);
    }
    
  } catch (error) {
    console.log('❌ User list failed:', error.response?.data || error.message);
  }
}

async function testCreateDevice(token) {
  if (!token) {
    console.log('⚠️  Skipping device creation - no token');
    return;
  }
  
  try {
    console.log('\n5. Testing Device Creation...');
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

async function runTests() {
  console.log('🚀 Starting Simple Authentication Tests...\n');
  
  const token = await testLogin();
  await testDeviceList(token);
  await testDeviceListWithXAuth(token);
  await testUserList(token);
  await testCreateDevice(token);
  
  console.log('\n🏁 Tests completed!');
}

runTests(); 