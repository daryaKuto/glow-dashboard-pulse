const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
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

async function runSqlScript(scriptPath) {
  try {
    console.log(`📄 Reading SQL script: ${scriptPath}`);
    
    if (!fs.existsSync(scriptPath)) {
      console.error(`❌ SQL file not found: ${scriptPath}`);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(scriptPath, 'utf8');
    console.log(`📝 SQL script loaded (${sqlContent.length} characters)`);

    console.log('🚀 Executing SQL script...');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`  ${i + 1}/${statements.length}: Executing statement...`);
          const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            console.error(`  ❌ Error in statement ${i + 1}:`, error.message);
            // Continue with other statements
          } else {
            console.log(`  ✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`  ❌ Exception in statement ${i + 1}:`, err.message);
        }
      }
    }

    console.log('✅ SQL script execution completed!');

  } catch (error) {
    console.error('❌ Failed to execute SQL script:', error.message);
    process.exit(1);
  }
}

// Get script path from command line argument
const scriptPath = process.argv[2];

if (!scriptPath) {
  console.error('❌ Please provide a SQL script path as an argument');
  console.error('Usage: node scripts/run-sql-script.js <path-to-sql-file>');
  process.exit(1);
}

runSqlScript(scriptPath); 