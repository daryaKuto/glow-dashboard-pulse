const axios = require('axios');

console.log('🔍 Decoding ThingsBoard JWT Token\n');

// Test configuration
const config = {
  baseURL: 'https://thingsboard.cloud',
  username: 'andrew.tam@gmail.com',
  password: 'dryfire2025'
};

function decodeJWT(token) {
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }
    
    // Decode the payload (second part)
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
    
    console.log('\n2. Decoding JWT token...');
    const payload = decodeJWT(token);
    
    if (payload) {
      console.log('✅ Token decoded successfully!');
      console.log('\n📋 Token Payload:');
      console.log(`  User ID: ${payload.userId}`);
      console.log(`  Tenant ID: ${payload.tenantId}`);
      console.log(`  Customer ID: ${payload.customerId}`);
      console.log(`  Scopes: ${payload.scopes?.join(', ')}`);
      console.log(`  First Name: ${payload.firstName}`);
      console.log(`  Last Name: ${payload.lastName}`);
      console.log(`  Expires: ${new Date(payload.exp * 1000).toISOString()}`);
      
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

async function testCorrectEndpoints(authData) {
  if (!authData) {
    console.log('⚠️  Skipping endpoint tests - no auth data');
    return;
  }
  
  const { token, tenantId, userId } = authData;
  
  try {
    console.log('\n3. Testing Device List with correct endpoint...');
    const deviceResponse = await axios.get(`${config.baseURL}/api/tenant/${tenantId}/devices`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Device list successful!');
    console.log(`Status: ${deviceResponse.status}`);
    console.log(`Devices found: ${deviceResponse.data.data?.length || 0}`);
    
    if (deviceResponse.data.data && deviceResponse.data.data.length > 0) {
      console.log(`First device: ${deviceResponse.data.data[0].name} (${deviceResponse.data.data[0].id.id})`);
    }
    
  } catch (error) {
    console.log('❌ Device list failed:', error.response?.data || error.message);
  }
  
  try {
    console.log('\n4. Testing User List with correct endpoint...');
    const userResponse = await axios.get(`${config.baseURL}/api/tenant/${tenantId}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ User list successful!');
    console.log(`Status: ${userResponse.status}`);
    console.log(`Users found: ${userResponse.data.data?.length || 0}`);
    
    if (userResponse.data.data && userResponse.data.data.length > 0) {
      console.log(`First user: ${userResponse.data.data[0].email} (${userResponse.data.data[0].id.id})`);
    }
    
  } catch (error) {
    console.log('❌ User list failed:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Token Decode and Correct Endpoint Tests...\n');
  
  const authData = await testLoginAndDecode();
  await testCorrectEndpoints(authData);
  
  console.log('\n🏁 Tests completed!');
}

runTests(); 