#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

console.log('🔍 Debugging Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key (first 20 chars):', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'undefined');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('📡 Testing connection...');
    
    // Try a simple query to test the connection
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      process.exit(1);
    } else {
      console.log('✅ Connection successful!');
      console.log('Data:', data);
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    console.error('Error type:', err.constructor.name);
    process.exit(1);
  }
}

testConnection(); 