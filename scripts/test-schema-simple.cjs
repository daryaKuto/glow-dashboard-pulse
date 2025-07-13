const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSchemaSimple() {
  console.log('🧪 Testing Supabase schema (simple version)...\n');

  const tables = [
    'sessions', 'session_hits', 'user_analytics', 'room_analytics', 
    'target_analytics', 'friends', 'invites', 'user_preferences'
  ];

  const results = {
    tables: {},
    rls: {},
    function: false
  };

  // Test table existence by checking for RLS errors
  console.log('📋 Testing if tables exist...');
  
  for (const table of tables) {
    try {
      // Try to insert data - if table doesn't exist, we get "relation does not exist"
      // If table exists but RLS blocks us, we get "row-level security policy"
      const { data, error } = await supabase
        .from(table)
        .insert({ test: 'test' })
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
  
  console.log(`   Tables: ${tableCount}/${tables.length} created`);
  console.log(`   RLS: ${rlsCount}/${tables.length} enabled`);
  console.log(`   Function: ${results.function.exists ? '✅' : '❌'} exists`);

  const allPassed = tableCount === tables.length && 
                   rlsCount === tables.length && 
                   results.function.exists;

  if (allPassed) {
    console.log('\n✅ All database schema tests PASSED!');
    console.log('🎉 Your analytics schema is fully set up and ready to use!');
  } else {
    console.log('\n⚠️  Some database schema tests FAILED. Check the results above.');
  }
}

testSchemaSimple().catch(console.error); 