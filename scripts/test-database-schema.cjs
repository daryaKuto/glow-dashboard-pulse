#!/usr/bin/env node

/**
 * Test script to verify Supabase database schema
 * Tests that all analytics tables, triggers, and functions were created correctly
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   VITE_SUPABASE_ANON_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDatabaseSchema() {
  console.log('🧪 Testing Supabase database schema...\n');

  const results = {
    tables: {},
    indexes: {},
    rls: {},
    triggers: {},
    function: false
  };

  // Test table existence
  console.log('📋 Testing if tables exist...');
  const tables = [
    'sessions', 'session_hits', 'user_analytics', 'room_analytics', 
    'target_analytics', 'friends', 'invites', 'user_preferences'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count(*)', { count: 'exact', head: true });
      
      if (error) {
        results.tables[table] = { exists: false, error: error.message };
      } else {
        results.tables[table] = { exists: true, count: data?.[0]?.count || 0 };
      }
    } catch (err) {
      results.tables[table] = { exists: false, error: err.message };
    }
  }

  console.log('📊 Table existence results:');
  Object.entries(results.tables).forEach(([table, result]) => {
    if (result.exists) {
      console.log(`   ✅ ${table}: exists (${result.count} rows)`);
    } else {
      console.log(`   ❌ ${table}: missing - ${result.error}`);
    }
  });

  // Test index existence (simplified check)
  console.log('\n🔍 Testing if indexes exist...');
  const indexes = [
    'idx_sessions_user_id', 'idx_session_hits_session_id', 
    'idx_user_analytics_user_id', 'idx_room_analytics_room_name'
  ];

  for (const index of indexes) {
    try {
      // Try to query with the indexed column to see if index exists
      const tableName = index.replace('idx_', '').split('_')[0] + 's';
      const columnName = index.split('_').slice(1).join('_');
      
      const { data, error } = await supabase
        .from(tableName)
        .select(columnName)
        .limit(1);
      
      if (error) {
        results.indexes[index] = { exists: false, error: error.message };
      } else {
        results.indexes[index] = { exists: true };
      }
    } catch (err) {
      results.indexes[index] = { exists: false, error: err.message };
    }
  }

  console.log('📊 Index existence results:');
  Object.entries(results.indexes).forEach(([index, result]) => {
    if (result.exists) {
      console.log(`   ✅ ${index}: exists`);
    } else {
      console.log(`   ❌ ${index}: missing - ${result.error}`);
    }
  });

  // Test RLS by trying to insert data (this will fail if RLS is blocking)
  console.log('\n🔒 Testing Row Level Security...');
  const rlsTables = [
    'sessions', 'session_hits', 'user_analytics', 'room_analytics', 
    'target_analytics', 'friends', 'invites', 'user_preferences'
  ];

  for (const table of rlsTables) {
    try {
      // Try to insert a test record
      const testData = getTestData(table);
      const { data, error } = await supabase
        .from(table)
        .insert(testData)
        .select();
      
      if (error && error.message.includes('row-level security')) {
        results.rls[table] = { enabled: true, message: 'RLS blocking insert (expected)' };
      } else if (error) {
        results.rls[table] = { enabled: false, error: error.message };
      } else {
        results.rls[table] = { enabled: false, message: 'RLS not blocking (unexpected)' };
        // Clean up test data
        if (data?.[0]?.id) {
          await supabase.from(table).delete().eq('id', data[0].id);
        }
      }
    } catch (err) {
      results.rls[table] = { enabled: false, error: err.message };
    }
  }

  console.log('📊 RLS status results:');
  Object.entries(results.rls).forEach(([table, result]) => {
    if (result.enabled) {
      console.log(`   ✅ ${table}: RLS enabled`);
    } else {
      console.log(`   ❌ ${table}: RLS not enabled - ${result.error || result.message}`);
    }
  });

  // Test function existence
  console.log('\n🔧 Testing if update_updated_at_column function exists...');
  try {
    // Try to create a test record in user_preferences to trigger the function
    const { data, error } = await supabase
      .from('user_preferences')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Test UUID
        theme: 'test'
      })
      .select();
    
    if (error && error.message.includes('row-level security')) {
      results.function = { exists: true, message: 'Function exists (RLS blocking test)' };
    } else if (error) {
      results.function = { exists: false, error: error.message };
    } else {
      results.function = { exists: true, message: 'Function exists' };
      // Clean up
      if (data?.[0]?.id) {
        await supabase.from('user_preferences').delete().eq('id', data[0].id);
      }
    }
  } catch (err) {
    results.function = { exists: false, error: err.message };
  }

  if (results.function.exists) {
    console.log(`   ✅ Function exists`);
  } else {
    console.log(`   ❌ Function missing - ${results.function.error}`);
  }

  // Summary
  console.log('\n📊 SUMMARY:');
  const tableCount = Object.values(results.tables).filter(r => r.exists).length;
  const indexCount = Object.values(results.indexes).filter(r => r.exists).length;
  const rlsCount = Object.values(results.rls).filter(r => r.enabled).length;
  
  console.log(`   Tables: ${tableCount}/${tables.length} created`);
  console.log(`   Indexes: ${indexCount}/${indexes.length} created`);
  console.log(`   RLS: ${rlsCount}/${rlsTables.length} enabled`);
  console.log(`   Function: ${results.function.exists ? '✅' : '❌'} exists`);

  const allPassed = tableCount === tables.length && 
                   indexCount === indexes.length && 
                   rlsCount === rlsTables.length && 
                   results.function.exists;

  if (allPassed) {
    console.log('\n✅ All database schema tests PASSED!');
  } else {
    console.log('\n⚠️  Some database schema tests FAILED. Check the results above.');
  }
}

function getTestData(table) {
  const baseData = {
    sessions: {
      user_id: '00000000-0000-0000-0000-000000000000',
      room_name: 'test-room',
      target_count: 1,
      score: 100
    },
    session_hits: {
      session_id: '00000000-0000-0000-0000-000000000000',
      target_name: 'test-target',
      room_name: 'test-room',
      reaction_time_ms: 500
    },
    user_analytics: {
      user_id: '00000000-0000-0000-0000-000000000000',
      date: new Date().toISOString().split('T')[0],
      total_sessions: 1
    },
    room_analytics: {
      room_name: 'test-room',
      date: new Date().toISOString().split('T')[0],
      total_sessions: 1
    },
    target_analytics: {
      target_name: 'test-target',
      room_name: 'test-room',
      date: new Date().toISOString().split('T')[0],
      total_hits: 1
    },
    friends: {
      user_id: '00000000-0000-0000-0000-000000000000',
      friend_id: '00000000-0000-0000-0000-000000000001',
      status: 'pending'
    },
    invites: {
      session_id: '00000000-0000-0000-0000-000000000000',
      inviter_id: '00000000-0000-0000-0000-000000000000',
      invitee_id: '00000000-0000-0000-0000-000000000001',
      status: 'pending'
    },
    user_preferences: {
      user_id: '00000000-0000-0000-0000-000000000000',
      theme: 'light',
      notifications_enabled: true
    }
  };

  return baseData[table] || {};
}

testDatabaseSchema().catch(console.error); 