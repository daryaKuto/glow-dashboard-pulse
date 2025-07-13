const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Debugging Supabase Connection...\n');
console.log('Environment Variables:');
console.log('  VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('  VITE_SUPABASE_ANON_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
console.log('  URL Preview:', supabaseUrl ? supabaseUrl.substring(0, 50) + '...' : 'N/A');
console.log('  Key Preview:', supabaseServiceKey ? supabaseServiceKey.substring(0, 20) + '...' : 'N/A');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('\n❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugConnection() {
  console.log('\n🧪 Testing basic connection...');

  try {
    // Test 1: Basic connection
    console.log('1. Testing basic connection...');
    const { data, error } = await supabase.from('sessions').select('count(*)', { count: 'exact', head: true });
    
    if (error) {
      console.log('   ❌ Error:', error.message);
      console.log('   Error code:', error.code);
      console.log('   Error details:', error.details);
    } else {
      console.log('   ✅ Success! Count:', data?.[0]?.count || 0);
    }

    // Test 2: Try to list all tables (if possible)
    console.log('\n2. Trying to list tables...');
    try {
      const { data: tables, error: tablesError } = await supabase
        .rpc('get_tables')
        .select('*');
      
      if (tablesError) {
        console.log('   ❌ Cannot list tables:', tablesError.message);
      } else {
        console.log('   ✅ Tables found:', tables);
      }
    } catch (err) {
      console.log('   ❌ RPC not available:', err.message);
    }

    // Test 3: Try a simple insert to see what happens
    console.log('\n3. Testing insert permission...');
    try {
      const { data: insertData, error: insertError } = await supabase
        .from('sessions')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000',
          room_name: 'test',
          score: 100
        })
        .select();
      
      if (insertError) {
        console.log('   ❌ Insert failed:', insertError.message);
        if (insertError.message.includes('relation') && insertError.message.includes('does not exist')) {
          console.log('   💡 This confirms the table does not exist in this database');
        }
      } else {
        console.log('   ✅ Insert succeeded!');
        // Clean up
        if (insertData?.[0]?.id) {
          await supabase.from('sessions').delete().eq('id', insertData[0].id);
        }
      }
    } catch (err) {
      console.log('   ❌ Insert exception:', err.message);
    }

    // Test 4: Check auth
    console.log('\n4. Testing auth...');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.log('   ❌ Auth error:', authError.message);
      } else {
        console.log('   ✅ Auth working, user:', authData.user ? 'Logged in' : 'Not logged in');
      }
    } catch (err) {
      console.log('   ❌ Auth exception:', err.message);
    }

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

debugConnection(); 