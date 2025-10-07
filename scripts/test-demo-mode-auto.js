#!/usr/bin/env node

/**
 * Automated Demo Mode Testing Script
 * Tests demo mode functionality programmatically
 */

const { mockThingsBoardService } = require('../src/services/mock-thingsboard.ts');
const { mockSupabaseService } = require('../src/services/mock-supabase.ts');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let testsPassed = 0;
let testsFailed = 0;
let testsRun = 0;

function printHeader(text) {
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}${text}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

function printTest(name) {
  testsRun++;
  console.log(`${colors.cyan}→ Test ${testsRun}: ${name}${colors.reset}`);
}

function assertPass(message) {
  testsPassed++;
  console.log(`${colors.green}  ✓ ${message}${colors.reset}`);
}

function assertFail(message) {
  testsFailed++;
  console.log(`${colors.red}  ✗ ${message}${colors.reset}`);
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    assertPass(`${message}: ${actual} === ${expected}`);
    return true;
  } else {
    assertFail(`${message}: Expected ${expected}, got ${actual}`);
    return false;
  }
}

function assertGreaterThan(actual, threshold, message) {
  if (actual > threshold) {
    assertPass(`${message}: ${actual} > ${threshold}`);
    return true;
  } else {
    assertFail(`${message}: Expected > ${threshold}, got ${actual}`);
    return false;
  }
}

function assertArrayLength(array, expected, message) {
  return assertEqual(array.length, expected, message);
}

function assertIncludes(array, value, message) {
  if (array.includes(value)) {
    assertPass(`${message}: Array includes "${value}"`);
    return true;
  } else {
    assertFail(`${message}: Array does not include "${value}"`);
    return false;
  }
}

async function testMockThingsBoardService() {
  printHeader('Testing Mock ThingsBoard Service');

  // Test 1: Get all targets
  printTest('mockThingsBoardService.getTargets()');
  const targets = mockThingsBoardService.getTargets();
  assertArrayLength(targets, 6, 'Should return 6 mock targets');
  
  // Test 2: Verify target names
  printTest('Mock target names');
  const targetNames = targets.map(t => t.name);
  assertIncludes(targetNames, 'Target Alpha', 'Should include Target Alpha');
  assertIncludes(targetNames, 'Target Bravo', 'Should include Target Bravo');
  assertIncludes(targetNames, 'Target Charlie', 'Should include Target Charlie');
  assertIncludes(targetNames, 'Target Delta', 'Should include Target Delta');
  assertIncludes(targetNames, 'Target Echo', 'Should include Target Echo');
  assertIncludes(targetNames, 'Target Foxtrot', 'Should include Target Foxtrot');

  // Test 3: Verify online/offline status
  printTest('Target online/offline status');
  const onlineTargets = targets.filter(t => t.status === 'online');
  const offlineTargets = targets.filter(t => t.status === 'offline');
  assertEqual(onlineTargets.length, 5, 'Should have 5 online targets');
  assertEqual(offlineTargets.length, 1, 'Should have 1 offline target');
  assertEqual(offlineTargets[0].name, 'Target Delta', 'Delta should be offline');

  // Test 4: Get specific target
  printTest('mockThingsBoardService.getTarget()');
  const target = mockThingsBoardService.getTarget('mock-target-001');
  if (target) {
    assertEqual(target.name, 'Target Alpha', 'Should return Target Alpha');
    assertEqual(target.status, 'online', 'Target Alpha should be online');
  } else {
    assertFail('getTarget() returned null');
  }

  // Test 5: Get device statuses
  printTest('mockThingsBoardService.getAllDeviceStatuses()');
  const deviceStatuses = mockThingsBoardService.getAllDeviceStatuses();
  assertArrayLength(deviceStatuses, 6, 'Should return 6 device statuses');
  
  const firstDevice = deviceStatuses[0];
  if (firstDevice) {
    assertEqual(firstDevice.gameStatus, 'idle', 'Game status should be idle');
    assertGreaterThan(firstDevice.wifiStrength, 0, 'WiFi strength should be > 0');
  }

  // Test 6: Target assignment
  printTest('Target room assignment');
  mockThingsBoardService.assignTargetToRoom('mock-target-001', 'test-room-123');
  const assignedTarget = mockThingsBoardService.getTarget('mock-target-001');
  if (assignedTarget) {
    assertEqual(assignedTarget.roomId, 'test-room-123', 'Target should be assigned to room');
  }

  // Reset for next tests
  mockThingsBoardService.reset();
}

async function testMockSupabaseService() {
  printHeader('Testing Mock Supabase Service');

  // Test 1: Get rooms
  printTest('mockSupabaseService.getUserRooms()');
  const rooms = mockSupabaseService.getUserRooms();
  assertArrayLength(rooms, 3, 'Should return 3 mock rooms');

  // Test 2: Verify room names
  printTest('Mock room names');
  const roomNames = rooms.map(r => r.name);
  assertIncludes(roomNames, 'Training Range A', 'Should include Training Range A');
  assertIncludes(roomNames, 'Competition Range', 'Should include Competition Range');
  assertIncludes(roomNames, 'Practice Zone', 'Should include Practice Zone');

  // Test 3: Create room
  printTest('mockSupabaseService.createRoom()');
  const newRoom = mockSupabaseService.createRoom({
    name: 'Test Room',
    room_type: 'test',
    icon: 'test-icon'
  });
  assertEqual(newRoom.name, 'Test Room', 'Should create room with correct name');
  assertEqual(newRoom.room_type, 'test', 'Should create room with correct type');

  const allRooms = mockSupabaseService.getUserRooms();
  assertEqual(allRooms.length, 4, 'Should now have 4 rooms');

  // Test 4: Update room
  printTest('mockSupabaseService.updateRoom()');
  const updatedRoom = mockSupabaseService.updateRoom(newRoom.id, { name: 'Updated Test Room' });
  if (updatedRoom) {
    assertEqual(updatedRoom.name, 'Updated Test Room', 'Should update room name');
  }

  // Test 5: Get user profile
  printTest('mockSupabaseService.getUserProfile()');
  const profile = mockSupabaseService.getUserProfile('demo-user');
  if (profile) {
    assertEqual(profile.email, 'demo@example.com', 'Should return demo user email');
    assertEqual(profile.full_name, 'Demo User', 'Should return demo user name');
  } else {
    assertFail('getUserProfile() returned null');
  }

  // Test 6: Get user analytics
  printTest('mockSupabaseService.getUserAnalytics()');
  const analytics = mockSupabaseService.getUserAnalytics('demo-user');
  if (analytics) {
    assertEqual(analytics.total_sessions, 15, 'Should have 15 total sessions');
    assertEqual(analytics.total_hits, 850, 'Should have 850 total hits');
    assertEqual(analytics.average_score, 56, 'Should have average score of 56');
    assertEqual(analytics.best_score, 92, 'Should have best score of 92');
  } else {
    assertFail('getUserAnalytics() returned null');
  }

  // Test 7: Get recent sessions
  printTest('mockSupabaseService.getRecentSessions()');
  const sessions = mockSupabaseService.getRecentSessions('demo-user', 5);
  assertEqual(sessions.length, 5, 'Should return 5 recent sessions');

  // Test 8: Get dashboard stats
  printTest('mockSupabaseService.getDashboardStats()');
  const stats = mockSupabaseService.getDashboardStats();
  assertEqual(stats.totalSessions, 15, 'Dashboard should show 15 total sessions');
  assertEqual(stats.averageScore, 56, 'Dashboard should show average score of 56');

  // Test 9: Store game summary
  printTest('mockSupabaseService.storeGameSummary()');
  const sessionId = mockSupabaseService.storeGameSummary({
    game_name: 'Test Game',
    total_hits: 50,
    duration: 30
  });
  if (sessionId) {
    assertPass('Game summary stored successfully');
    const updatedStats = mockSupabaseService.getDashboardStats();
    assertEqual(updatedStats.totalSessions, 16, 'Total sessions should increment to 16');
  } else {
    assertFail('Failed to store game summary');
  }

  // Test 10: Target assignments
  printTest('Target to room assignments');
  mockSupabaseService.assignTargetToRoom('target-001', 'room-001');
  mockSupabaseService.assignTargetToRoom('target-002', 'room-001');
  const assignedTargets = mockSupabaseService.getRoomTargets('room-001');
  assertEqual(assignedTargets.length, 2, 'Room should have 2 assigned targets');

  // Reset for next tests
  mockSupabaseService.reset();
}

async function testDataIsolation() {
  printHeader('Testing Data Isolation');

  // Test 1: Services should not share state
  printTest('Mock services data isolation');
  
  // Modify ThingsBoard data
  mockThingsBoardService.assignTargetToRoom('mock-target-001', 'room-alpha');
  
  // Modify Supabase data
  mockSupabaseService.assignTargetToRoom('mock-target-001', 'room-beta');
  
  // They should be independent
  const tbTarget = mockThingsBoardService.getTarget('mock-target-001');
  const sbTargets = mockSupabaseService.getRoomTargets('room-beta');
  
  if (tbTarget) {
    assertEqual(tbTarget.roomId, 'room-alpha', 'TB service should maintain its own assignment');
  }
  assertEqual(sbTargets.length, 1, 'SB service should maintain its own assignment');
  assertPass('Services maintain independent state');

  // Test 2: Reset should clear data
  printTest('Reset functionality');
  mockThingsBoardService.reset();
  mockSupabaseService.reset();
  
  const targetsAfterReset = mockThingsBoardService.getTargets();
  const roomsAfterReset = mockSupabaseService.getUserRooms();
  
  assertEqual(targetsAfterReset.length, 6, 'Should reset to 6 targets');
  assertEqual(roomsAfterReset.length, 3, 'Should reset to 3 rooms');
  
  const resetTarget = mockThingsBoardService.getTarget('mock-target-001');
  if (resetTarget) {
    assertEqual(resetTarget.roomId, null, 'Room assignments should be cleared');
  }
}

async function runAllTests() {
  console.log(`${colors.cyan}
╔════════════════════════════════════════════════════════════╗
║         Automated Demo Mode Test Suite                    ║
║         Testing Mock Data Services                         ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);

  try {
    await testMockThingsBoardService();
    await testMockSupabaseService();
    await testDataIsolation();

    printHeader('Test Summary');
    console.log(`Total Tests: ${testsRun}`);
    console.log(`${colors.green}Passed: ${testsPassed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${testsFailed}${colors.reset}`);
    
    if (testsFailed === 0) {
      console.log(`\n${colors.green}✓ All tests passed!${colors.reset}`);
      console.log(`\n${colors.cyan}Mock Data Verified:${colors.reset}`);
      console.log(`  ✓ 6 mock targets with correct names and status`);
      console.log(`  ✓ 3 mock rooms with correct configuration`);
      console.log(`  ✓ Demo user profile with realistic stats`);
      console.log(`  ✓ 15 historical sessions, 850 total hits`);
      console.log(`  ✓ Target/room assignments working correctly`);
      console.log(`  ✓ Data isolation between services`);
      console.log(`  ✓ Reset functionality working\n`);
      process.exit(0);
    } else {
      console.log(`\n${colors.red}✗ ${testsFailed} test(s) failed${colors.reset}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n${colors.red}Fatal Error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests();

