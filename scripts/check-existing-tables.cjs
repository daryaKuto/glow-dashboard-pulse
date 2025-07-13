const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkExistingTables() {
  console.log('🔍 Checking existing tables in Supabase...\n');

  try {
    // Try to get all tables from information_schema
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (error) {
      console.error('❌ Error querying tables:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log('📋 Existing tables:');
      data.forEach(table => {
        console.log(`   • ${table.table_name}`);
      });
    } else {
      console.log('📋 No tables found in public schema');
    }

    // Also check if we can access the auth schema
    console.log('\n🔐 Checking auth schema...');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.log('   ❌ Auth not accessible:', authError.message);
      } else {
        console.log('   ✅ Auth schema accessible');
      }
    } catch (err) {
      console.log('   ❌ Auth error:', err.message);
    }

  } catch (error) {
    console.error('❌ Failed to check tables:', error.message);
  }
}

checkExistingTables(); 