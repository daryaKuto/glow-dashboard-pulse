-- Check what room assignments exist in Supabase
SELECT 
  urt.target_id,
  urt.room_id,
  urt.target_name,
  ur.name as room_name,
  urt.assigned_at
FROM user_room_targets urt
LEFT JOIN user_rooms ur ON urt.room_id = ur.id
ORDER BY urt.assigned_at DESC;

-- Check what rooms exist
SELECT id, name, room_type FROM user_rooms ORDER BY order_index;

-- Check what targets are assigned to specific rooms
SELECT 
  ur.name as room_name,
  urt.target_id,
  urt.target_name,
  urt.assigned_at
FROM user_rooms ur
LEFT JOIN user_room_targets urt ON ur.id = urt.room_id
ORDER BY ur.name, urt.assigned_at;
