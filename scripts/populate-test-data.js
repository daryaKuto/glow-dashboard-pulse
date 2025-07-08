#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

console.log('🚀 Populating Supabase with test data...');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateTestData() {
  try {
    console.log('📝 Starting data population...');

    // 1. Insert rooms
    console.log('🏠 Creating rooms...');
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .insert([
        { name: 'Living Room', icon: 'home', order_index: 1, target_count: 3 },
        { name: 'Bedroom', icon: 'bed', order_index: 2, target_count: 2 },
        { name: 'Kitchen', icon: 'utensils', order_index: 3, target_count: 1 },
        { name: 'Office', icon: 'briefcase', order_index: 4, target_count: 2 }
      ])
      .select();

    if (roomsError) {
      console.error('❌ Rooms error:', roomsError);
      return;
    }
    console.log('✅ Rooms created:', rooms.length);

    // 2. Insert targets
    console.log('🎯 Creating targets...');
    const targets = [];
    rooms.forEach((room, roomIndex) => {
      for (let i = 1; i <= room.target_count; i++) {
        targets.push({
          name: `Target ${i} - ${room.name}`,
          room_id: room.id,
          status: i % 2 === 0 ? 'online' : 'offline',
          battery_level: Math.floor(Math.random() * 100) + 1,
          ip_address: `192.168.1.${100 + roomIndex * 10 + i}`,
          last_seen: new Date().toISOString()
        });
      }
    });

    const { data: insertedTargets, error: targetsError } = await supabase
      .from('targets')
      .insert(targets)
      .select();

    if (targetsError) {
      console.error('❌ Targets error:', targetsError);
      return;
    }
    console.log('✅ Targets created:', insertedTargets.length);

    // 3. Insert scenarios
    console.log('🎮 Creating scenarios...');
    const { data: scenarios, error: scenariosError } = await supabase
      .from('scenarios')
      .insert([
        {
          name: 'Quick Draw',
          description: 'Fast-paced target practice with 3 targets',
          target_count: 3,
          time_limit_ms: 30000,
          shots_per_target: 2
        },
        {
          name: 'Precision Training',
          description: 'Slow and steady accuracy training',
          target_count: 2,
          time_limit_ms: 60000,
          shots_per_target: 3
        },
        {
          name: 'Speed Challenge',
          description: 'Rapid-fire challenge with 5 targets',
          target_count: 5,
          time_limit_ms: 45000,
          shots_per_target: 1
        },
        {
          name: 'Endurance Test',
          description: 'Long-duration accuracy challenge',
          target_count: 4,
          time_limit_ms: 120000,
          shots_per_target: 2
        }
      ])
      .select();

    if (scenariosError) {
      console.error('❌ Scenarios error:', scenariosError);
      return;
    }
    console.log('✅ Scenarios created:', scenarios.length);

    // 4. Update room target counts
    console.log('🔄 Updating room target counts...');
    for (const room of rooms) {
      const targetCount = insertedTargets.filter(t => t.room_id === room.id).length;
      await supabase
        .from('rooms')
        .update({ target_count: targetCount })
        .eq('id', room.id);
    }

    console.log('🎉 Test data populated successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Rooms: ${rooms.length}`);
    console.log(`- Targets: ${insertedTargets.length}`);
    console.log(`- Scenarios: ${scenarios.length}`);
    console.log('\n💡 Note: Sessions and user data require real user authentication.');
    console.log('   These will be created when users sign up and use the app.');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

populateTestData(); 