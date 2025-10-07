#!/usr/bin/env node

/**
 * Test WiFi Credentials Pull from ThingsBoard
 * This script tests the actual WiFi credentials retrieval from ThingsBoard API
 * No placeholder or fake data - uses real ThingsBoard API calls
 * 
 * Usage: node scripts/test-wifi-credentials.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Logging functions
const log = (message) => console.log(`${colors.blue}[${new Date().toISOString()}]${colors.reset} ${message}`);
const logSuccess = (message) => console.log(`${colors.green}[${new Date().toISOString()}] ✅${colors.reset} ${message}`);
const logWarning = (message) => console.log(`${colors.yellow}[${new Date().toISOString()}] ⚠️${colors.reset} ${message}`);
const logError = (message) => console.log(`${colors.red}[${new Date().toISOString()}] ❌${colors.reset} ${message}`);

// Configuration
const config = {
    tbBaseUrl: process.env.VITE_TB_BASE_URL || 'https://thingsboard.cloud',
    tbUsername: process.env.VITE_TB_USERNAME || 'andrew.tam@gmail.com',
    tbPassword: process.env.VITE_TB_PASSWORD || 'dryfire2025'
};

// Test results
let testResults = {
    devicesProcessed: 0,
    wifiCredentialsFound: 0,
    errors: [],
    devices: []
};

/**
 * Authenticate with ThingsBoard and get JWT token
 */
async function authenticate() {
    log('Authenticating with ThingsBoard...');
    
    try {
        const response = await fetch(`${config.tbBaseUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: config.tbUsername,
                password: config.tbPassword
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.token) {
            throw new Error('No token received from ThingsBoard');
        }
        
        logSuccess('Successfully authenticated with ThingsBoard');
        log(`Token: ${data.token.substring(0, 20)}...`);
        
        return data.token;
    } catch (error) {
        logError(`Failed to authenticate with ThingsBoard: ${error.message}`);
        throw error;
    }
}

/**
 * Get list of devices from ThingsBoard
 */
async function getDevices(jwtToken) {
    log('Fetching devices from ThingsBoard...');
    
    try {
        const response = await fetch(`${config.tbBaseUrl}/api/tenant/devices?pageSize=100&page=0`, {
            headers: {
                'Authorization': `Bearer ${jwtToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const devices = data.data || data;
        
        if (!Array.isArray(devices) || devices.length === 0) {
            logWarning('No devices found in ThingsBoard');
            return [];
        }
        
        logSuccess(`Found ${devices.length} devices`);
        return devices;
    } catch (error) {
        logError(`Failed to fetch devices from ThingsBoard: ${error.message}`);
        throw error;
    }
}

/**
 * Get WiFi credentials from a specific device
 */
async function getDeviceWifiCredentials(deviceId, deviceName, jwtToken) {
    log(`Checking WiFi credentials for device: ${deviceName} (${deviceId})`);
    
    try {
        const response = await fetch(`${config.tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SHARED_SCOPE`, {
            headers: {
                'Authorization': `Bearer ${jwtToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const attributes = await response.json();
        
        if (!attributes || Object.keys(attributes).length === 0) {
            logWarning(`No attributes found for device ${deviceName}`);
            return null;
        }
        
        // Extract WiFi credentials - ThingsBoard returns attributes as array
        let wifiCredentials = { ssid: '', password: '' };
        
        if (Array.isArray(attributes)) {
            // Parse array format: [{key: 'wifi_ssid', value: 'MyWiFi'}, ...]
            for (const attr of attributes) {
                if (attr.key === 'wifi_ssid' || attr.key === 'ssid') {
                    wifiCredentials.ssid = attr.value || '';
                } else if (attr.key === 'wifi_password' || attr.key === 'password') {
                    wifiCredentials.password = attr.value || '';
                }
            }
        } else if (attributes && typeof attributes === 'object') {
            // Fallback for object format (if API changes)
            wifiCredentials = {
                ssid: attributes.wifi_ssid || attributes.ssid || '',
                password: attributes.wifi_password || attributes.password || ''
            };
        }
        
        // Check if WiFi credentials exist
        if (!wifiCredentials.ssid && !wifiCredentials.password) {
            logWarning(`No WiFi credentials found for device ${deviceName}`);
            return null;
        }
        
        // Display WiFi credentials (mask password for security)
        logSuccess(`WiFi credentials found for device: ${deviceName}`);
        console.log(`  Device ID: ${deviceId}`);
        console.log(`  WiFi SSID: ${wifiCredentials.ssid}`);
        
        if (wifiCredentials.password) {
            const maskedPassword = '*'.repeat(wifiCredentials.password.length);
            console.log(`  WiFi Password: ${maskedPassword} (${wifiCredentials.password.length} characters)`);
        } else {
            console.log(`  WiFi Password: Not set`);
        }
        
        // Store device info
        testResults.devices.push({
            id: deviceId,
            name: deviceName,
            wifiCredentials: wifiCredentials,
            hasCredentials: true
        });
        
        testResults.wifiCredentialsFound++;
        return wifiCredentials;
    } catch (error) {
        logError(`Failed to fetch WiFi credentials for device ${deviceName}: ${error.message}`);
        testResults.errors.push({
            deviceId,
            deviceName,
            error: error.message
        });
        return null;
    }
}

/**
 * Test setting WiFi credentials (optional)
 */
async function testSetWifiCredentials(deviceId, deviceName, jwtToken) {
    log(`Testing WiFi credentials setting for device: ${deviceName}`);
    
    try {
        const testSsid = `TestWiFi_${Date.now()}`;
        const testPassword = 'TestPassword123';
        
        // Set WiFi credentials
        const setResponse = await fetch(`${config.tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SHARED_SCOPE`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${jwtToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                wifi_ssid: testSsid,
                wifi_password: testPassword
            })
        });
        
        if (!setResponse.ok) {
            throw new Error(`HTTP ${setResponse.status}: ${setResponse.statusText}`);
        }
        
        logSuccess(`Successfully set test WiFi credentials for device ${deviceName}`);
        console.log(`  Test SSID: ${testSsid}`);
        console.log(`  Test Password: ${testPassword}`);
        
        // Verify the credentials were set
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const verifyResponse = await fetch(`${config.tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SHARED_SCOPE`, {
            headers: {
                'Authorization': `Bearer ${jwtToken}`
            }
        });
        
        if (!verifyResponse.ok) {
            throw new Error(`HTTP ${verifyResponse.status}: ${verifyResponse.statusText}`);
        }
        
        const verifyAttributes = await verifyResponse.json();
        const retrievedSsid = verifyAttributes.wifi_ssid || verifyAttributes.ssid;
        
        if (retrievedSsid === testSsid) {
            logSuccess('WiFi credentials verification successful');
            return true;
        } else {
            logError('WiFi credentials verification failed');
            return false;
        }
    } catch (error) {
        logError(`Failed to set WiFi credentials for device ${deviceName}: ${error.message}`);
        return false;
    }
}

/**
 * Generate detailed test report
 */
function generateReport() {
    const report = {
        timestamp: new Date().toISOString(),
        config: {
            tbBaseUrl: config.tbBaseUrl,
            tbUsername: config.tbUsername
        },
        summary: {
            devicesProcessed: testResults.devicesProcessed,
            wifiCredentialsFound: testResults.wifiCredentialsFound,
            errorCount: testResults.errors.length
        },
        devices: testResults.devices,
        errors: testResults.errors
    };
    
    const reportPath = path.join(__dirname, '..', 'test-results', 'wifi-credentials-test-report.json');
    const reportDir = path.dirname(reportPath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    logSuccess(`Detailed test report saved to: ${reportPath}`);
    
    return report;
}

/**
 * Main test function
 */
async function main() {
    console.log('==========================================');
    console.log('🔍 ThingsBoard WiFi Credentials Test');
    console.log('==========================================');
    console.log('');
    
    try {
        // Authenticate
        const jwtToken = await authenticate();
        
        // Get devices
        const devices = await getDevices(jwtToken);
        
        if (devices.length === 0) {
            logError('No devices available for testing');
            process.exit(1);
        }
        
        console.log('');
        log('Processing devices for WiFi credentials...');
        console.log('');
        
        // Process each device
        for (const device of devices) {
            const deviceId = device.id?.id || device.id;
            const deviceName = device.name || 'Unknown';
            
            if (deviceId) {
                testResults.devicesProcessed++;
                await getDeviceWifiCredentials(deviceId, deviceName, jwtToken);
                console.log('');
            }
        }
        
        // Generate report
        const report = generateReport();
        
        // Summary
        console.log('==========================================');
        console.log('📊 Test Summary');
        console.log('==========================================');
        console.log(`Devices processed: ${testResults.devicesProcessed}`);
        console.log(`Devices with WiFi credentials: ${testResults.wifiCredentialsFound}`);
        console.log(`Errors encountered: ${testResults.errors.length}`);
        console.log('');
        
        if (testResults.wifiCredentialsFound > 0) {
            logSuccess('WiFi credentials test completed successfully!');
            logSuccess(`Found WiFi credentials in ${testResults.wifiCredentialsFound} out of ${testResults.devicesProcessed} devices`);
        } else {
            logWarning('No WiFi credentials found in any devices');
            logWarning('This might be expected if devices haven\'t been provisioned with WiFi credentials yet');
        }
        
        if (testResults.errors.length > 0) {
            console.log('');
            logWarning('Errors encountered:');
            testResults.errors.forEach(error => {
                console.log(`  - ${error.deviceName} (${error.deviceId}): ${error.error}`);
            });
        }
        
        console.log('');
        console.log('==========================================');
        console.log('✅ Test completed');
        console.log('==========================================');
        
    } catch (error) {
        logError(`Test failed: ${error.message}`);
        process.exit(1);
    }
}

// Run main function
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logError(`Unexpected error: ${error.message}`);
        process.exit(1);
    });
}

export {
    authenticate,
    getDevices,
    getDeviceWifiCredentials,
    testSetWifiCredentials
};
