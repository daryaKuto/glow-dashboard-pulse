import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://tqzeqgwxeprobejzpynn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxemVxZ3d4ZXByb2JlanpweW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzQxMTEsImV4cCI6MjA2NzUxMDExMX0.XljQDCBT9lA7xp43JShjXgpxqGl6J8z4SFgIy6UkHt4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupUser() {
  try {
    console.log('Setting up user in Supabase...');
    
    // Create user in Supabase
    const { data, error } = await supabase.auth.signUp({
      email: 'andrew.tam@gmail.com',
      password: 'dryfire2025',
      options: {
        data: {
          first_name: 'Andrew',
          last_name: 'Tam',
          phone: null
        }
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log('User already exists in Supabase');
        return;
      }
      throw error;
    }

    console.log('User created successfully in Supabase:', data.user?.email);
    
    // Sign in to verify the account works
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'andrew.tam@gmail.com',
      password: 'dryfire2025'
    });

    if (signInError) {
      throw signInError;
    }

    console.log('User can sign in successfully:', signInData.user?.email);
    
  } catch (error) {
    console.error('Error setting up user:', error);
  }
}

setupUser(); 