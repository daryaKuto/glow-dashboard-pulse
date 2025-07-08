#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

console.log('🔍 Testing Supabase system connection...');
console.log('URL:', supabaseUrl);
console.log('Key (first 10 chars):', supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'undefined');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSystemConnection() {
  try {
    console.log('📡 Testing system connection...');
    
    // Try to query a system table that should always exist
    const { data, error } = await supabase
      .rpc('version')
      .single();
    
    if (error) {
      console.error('❌ System query error:', error);
      
      // Try a different approach - just test the connection
      console.log('🔄 Trying simple connection test...');
      const { data: pingData, error: pingError } = await supabase
        .from('_supabase_migrations')
        .select('*')
        .limit(1);
      
      if (pingError) {
        console.error('❌ Ping failed:', pingError);
        console.error('This confirms the API key is invalid');
        process.exit(1);
      } else {
        console.log('✅ System connection works!');
        console.log('The issue might be with specific tables or RLS');
        process.exit(0);
      }
    } else {
      console.log('✅ System connection successful!');
      console.log('Version data:', data);
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

testSystemConnection(); 