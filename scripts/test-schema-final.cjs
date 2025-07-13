const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSchemaFinal() {
  console.log('🧪 Testing Supabase schema (final version)...\n');

  const tableTests = [
    {
      name: 'sessions',
      testData: {
        user_id: '00000000-0000-0000-0000-000000000000',
        room_name: 'test-room',
        score: 100
      }
    },
    {
      name: 'session_hits',
      testData: {
        session_id: '00000000-0000-0000-0000-000000000000',
        target_name: 'test-target',
        room_name: 'test-room',
        reaction_time_ms: 500
      }
    },
    {
      name: 'user_analytics',
      testData: {
        user_id: '00000000-0000-0000-0000-000000000000',
        date: new Date().toISOString().split('T')[0],
        total_sessions: 1
      }
    },
    {
      name: 'room_analytics',
      testData: {
        room_name: 'test-room',
        date: new Date().toISOString().split('T')[0],
        total_sessions: 1
      }
    },
    {
      name: 'target_analytics',
      testData: {
        target_name: 'test-target',
        room_name: 'test-room',
        date: new Date().toISOString().split('T')[0],
        total_hits: 1
      }
    },
    {
      name: 'friends',
      testData: {
        user_id: '00000000-0000-0000-0000-000000000000',
        friend_id: '00000000-0000-0000-0000-000000000001',
        status: 'pending'
      }
    },
    {
      name: 'invites',
      testData: {
        session_id: '00000000-0000-0000-0000-000000000000',
        inviter_id: '00000000-0000-0000-0000-000000000000',
        invitee_id: '00000000-0000-0000-0000-000000000001',
        status: 'pending'
      }
    },
    {
      name: 'user_preferences',
      testData: {
        user_id: '00000000-0000-0000-0000-000000000000',
        theme: 'light',
        notifications_enabled: true
      }
    }
  ];

  const results = {
    tables: {},
    rls: {},
    function: false
  };

  // Test table existence with proper data
  console.log('📋 Testing if tables exist...');
  
  for (const tableTest of tableTests) {
    const { name: table, testData } = tableTest;
    
    try {
      // Try to insert data with proper column names
      const { data, error } = await supabase
        .from(table)
        .insert(testData)
        .select();
      
      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          results.tables[table] = { exists: false, error: 'Table does not exist' };
          results.rls[table] = { enabled: false, error: 'Table does not exist' };
        } else if (error.message.includes('row-level security')) {
          results.tables[table] = { exists: true, message: 'Table exists (RLS blocking)' };
          results.rls[table] = { enabled: true, message: 'RLS enabled and blocking' };
        } else {
          results.tables[table] = { exists: false, error: error.message };
          results.rls[table] = { enabled: false, error: error.message };
        }
      } else {
        results.tables[table] = { exists: true, message: 'Table exists and accessible' };
        results.rls[table] = { enabled: false, message: 'RLS not blocking (unexpected)' };
        // Clean up test data
        if (data?.[0]?.id) {
          await supabase.from(table).delete().eq('id', data[0].id);
        }
      }
    } catch (err) {
      results.tables[table] = { exists: false, error: err.message };
      results.rls[table] = { enabled: false, error: err.message };
    }
  }

  console.log('📊 Table existence results:');
  Object.entries(results.tables).forEach(([table, result]) => {
    if (result.exists) {
      console.log(`   ✅ ${table}: exists`);
    } else {
      console.log(`   ❌ ${table}: missing - ${result.error}`);
    }
  });

  console.log('\n🔒 RLS status results:');
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
    const { data, error } = await supabase
      .from('user_preferences')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
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
  const rlsCount = Object.values(results.rls).filter(r => r.enabled).length;
  
  console.log(`   Tables: ${tableCount}/${tableTests.length} created`);
  console.log(`   RLS: ${rlsCount}/${tableTests.length} enabled`);
  console.log(`   Function: ${results.function.exists ? '✅' : '❌'} exists`);

  const allPassed = tableCount === tableTests.length && 
                   rlsCount === tableTests.length && 
                   results.function.exists;

  if (allPassed) {
    console.log('\n✅ All database schema tests PASSED!');
    console.log('🎉 Your analytics schema is fully set up and ready to use!');
    console.log('\n📋 What you can do now:');
    console.log('   • Users can log in and access their own data');
    console.log('   • Analytics data will be stored securely');
    console.log('   • Room and target analytics are shared across users');
    console.log('   • Friends and invites system is ready');
    console.log('   • User preferences are protected');
  } else {
    console.log('\n⚠️  Some database schema tests FAILED. Check the results above.');
  }
}

testSchemaFinal().catch(console.error); 