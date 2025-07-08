#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

console.log('🔍 Testing Supabase tables...');
console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseKey ? supabaseKey.length : 'undefined');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTables() {
  const tables = [
    'user_settings',
    'scenarios', 
    'rooms',
    'targets',
    'sessions'
  ];

  for (const table of tables) {
    try {
      console.log(`📡 Testing table: ${table}`);
      
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`❌ ${table} error:`, error.message);
      } else {
        console.log(`✅ ${table} works! Data count:`, data ? data.length : 0);
        // If any table works, we know the connection is good
        console.log('🎉 Supabase connection is working!');
        process.exit(0);
      }
    } catch (err) {
      console.error(`❌ ${table} unexpected error:`, err.message);
    }
  }
  
  console.log('❌ All tables failed - connection issue confirmed');
  process.exit(1);
}

testTables(); 