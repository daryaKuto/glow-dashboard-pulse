const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load the collection and environment
const collectionPath = path.join(__dirname, '../../postman/ThingsBoard_API_Collection_Fixed.json');
const environmentPath = path.join(__dirname, '../../postman/ThingsBoard_Environment.json');

let collection, environment;

try {
  collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
  environment = JSON.parse(fs.readFileSync(environmentPath, 'utf8'));
} catch (error) {
  console.error('❌ Error loading files:', error.message);
  process.exit(1);
}

// Extract environment variables
const envVars = {};
environment.values.forEach(variable => {
  envVars[variable.key] = variable.value;
});

// Replace variables in URLs
function replaceVariables(url) {
  return url.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
    return envVars[variable] || match;
  });
}

// Create axios instance
const api = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let accessToken = '';
let refreshToken = '';

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to log results
function logResult(testName, success, response = null, error = null) {
  const status = success ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${testName}`);
  
  if (success && response) {
    console.log(`   Status: ${response.status}`);
    if (response.data && typeof response.data === 'object') {
      console.log(`   Response: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`);
    }
  } else if (error) {
    console.log(`   Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response: ${JSON.stringify(error.response.data, null, 2).substring(0, 200)}...`);
    }
  }
  
  results.tests.push({
    name: testName,
    success,
    status: response?.status || error?.response?.status,
    error: error?.message
  });
  
  if (success) results.passed++;
  else results.failed++;
  
  console.log('');
}

// Test functions
async function testPublicEndpoints() {
  console.log('🔍 Testing Public Endpoints...\n');
  
  const publicTests = collection.item.find(item => item.name === '🔍 Public Endpoints (No Auth)');
  
  for (const test of publicTests.item) {
    try {
      const url = replaceVariables(test.request.url.raw);
      console.log(`Testing: ${test.name}`);
      console.log(`URL: ${url}`);
      
      const response = await api.get(url);
      logResult(test.name, true, response);
    } catch (error) {
      logResult(test.name, false, null, error);
    }
  }
}

async function testAuthentication() {
  console.log('🔐 Testing Authentication...\n');
  
  const authTests = collection.item.find(item => item.name === '🔐 Authentication');
  
  for (const test of authTests.item) {
    try {
      const url = replaceVariables(test.request.url.raw);
      const method = test.request.method.toLowerCase();
      const headers = {};
      const body = test.request.body?.raw ? JSON.parse(test.request.body.raw) : {};
      
      // Replace variables in body
      const bodyStr = JSON.stringify(body);
      const replacedBodyStr = replaceVariables(bodyStr);
      const finalBody = JSON.parse(replacedBodyStr);
      
      console.log(`Testing: ${test.name}`);
      console.log(`URL: ${url}`);
      console.log(`Method: ${method}`);
      console.log(`Body: ${JSON.stringify(finalBody)}`);
      
      const response = await api[method](url, finalBody, { headers });
      
      // Handle login success
      if (test.name === 'Login - Standard' && response.status === 200) {
        accessToken = response.data.token;
        refreshToken = response.data.refreshToken;
        console.log('   🔑 Token saved successfully!');
        console.log(`   Token: ${accessToken.substring(0, 50)}...`);
      }
      
      logResult(test.name, true, response);
    } catch (error) {
      logResult(test.name, false, null, error);
    }
  }
}

async function testDeviceManagement() {
  if (!accessToken) {
    console.log('⚠️  Skipping device tests - no access token available');
    return;
  }
  
  console.log('📱 Testing Device Management...\n');
  
  const deviceTests = collection.item.find(item => item.name === '📱 Device Management');
  
  for (const test of deviceTests.item) {
    try {
      const url = replaceVariables(test.request.url.raw);
      const method = test.request.method.toLowerCase();
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      
      let body = {};
      if (test.request.body?.raw) {
        const bodyStr = replaceVariables(test.request.body.raw);
        body = JSON.parse(bodyStr);
      }
      
      console.log(`Testing: ${test.name}`);
      console.log(`URL: ${url}`);
      console.log(`Method: ${method}`);
      console.log(`Headers: ${JSON.stringify(headers)}`);
      
      const response = await api[method](url, method === 'get' ? undefined : body, { headers });
      
      // Handle device list success
      if (test.name === 'Get All Devices' && response.status === 200) {
        const devices = response.data.data || response.data;
        if (devices && devices.length > 0) {
          const deviceId = devices[0].id.id;
          console.log(`   📱 First device ID: ${deviceId}`);
          // Update environment variable for subsequent tests
          envVars.deviceId = deviceId;
        }
      }
      
      logResult(test.name, true, response);
    } catch (error) {
      logResult(test.name, false, null, error);
    }
  }
}

async function testUserManagement() {
  if (!accessToken) {
    console.log('⚠️  Skipping user tests - no access token available');
    return;
  }
  
  console.log('👥 Testing User Management...\n');
  
  const userTests = collection.item.find(item => item.name === '👥 User Management');
  
  for (const test of userTests.item) {
    try {
      const url = replaceVariables(test.request.url.raw);
      const method = test.request.method.toLowerCase();
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      
      let body = {};
      if (test.request.body?.raw) {
        const bodyStr = replaceVariables(test.request.body.raw);
        body = JSON.parse(bodyStr);
      }
      
      console.log(`Testing: ${test.name}`);
      console.log(`URL: ${url}`);
      console.log(`Method: ${method}`);
      
      const response = await api[method](url, method === 'get' ? undefined : body, { headers });
      
      // Handle user list success
      if (test.name === 'Get All Users' && response.status === 200) {
        const users = response.data.data || response.data;
        if (users && users.length > 0) {
          const userId = users[0].id.id;
          console.log(`   👤 First user ID: ${userId}`);
          // Update environment variable for subsequent tests
          envVars.userId = userId;
        }
      }
      
      logResult(test.name, true, response);
    } catch (error) {
      logResult(test.name, false, null, error);
    }
  }
}

async function testTelemetry() {
  if (!accessToken || !envVars.deviceId) {
    console.log('⚠️  Skipping telemetry tests - no access token or device ID available');
    return;
  }
  
  console.log('📊 Testing Telemetry...\n');
  
  const telemetryTests = collection.item.find(item => item.name === '📊 Telemetry');
  
  for (const test of telemetryTests.item) {
    try {
      const url = replaceVariables(test.request.url.raw);
      const method = test.request.method.toLowerCase();
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      
      console.log(`Testing: ${test.name}`);
      console.log(`URL: ${url}`);
      console.log(`Method: ${method}`);
      
      const response = await api[method](url, undefined, { headers });
      logResult(test.name, true, response);
    } catch (error) {
      logResult(test.name, false, null, error);
    }
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting ThingsBoard API Tests (Fixed)...\n');
  console.log('Environment Variables:');
  console.log(`  Base URL: ${envVars.baseUrl}`);
  console.log(`  Username: ${envVars.username}`);
  console.log(`  Password: ${envVars.password ? '***' : 'NOT SET'}\n`);
  
  try {
    await testPublicEndpoints();
    await testAuthentication();
    await testDeviceManagement();
    await testUserManagement();
    await testTelemetry();
    
    // Final results
    console.log('📊 Test Results Summary:');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    
    if (results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.tests.filter(t => !t.success).forEach(test => {
        console.log(`  - ${test.name}: ${test.error}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Test runner error:', error.message);
  }
}

// Run the tests
runAllTests(); 