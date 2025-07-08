#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

console.log('🔍 Testing basic Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseKey ? supabaseKey.length : 'undefined');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBasicConnection() {
  try {
    console.log('📡 Testing basic connection...');
    
    // Try to get the current user (this tests the connection without querying tables)
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Auth error:', error);
      
      // If auth fails, try a simple health check
      console.log('🔄 Trying health check...');
      const { data, error: healthError } = await supabase
        .from('_supabase_migrations')
        .select('*')
        .limit(1);
      
      if (healthError) {
        console.error('❌ Health check failed:', healthError);
        console.error('This suggests the API key or URL is incorrect');
        process.exit(1);
      } else {
        console.log('✅ Basic connection works!');
        console.log('The issue might be with the specific table or RLS policies');
        process.exit(0);
      }
    } else {
      console.log('✅ Auth connection successful!');
      console.log('User:', user ? 'Authenticated' : 'Not authenticated');
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

testBasicConnection(); 