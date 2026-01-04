import { describe, it, expect } from 'vitest';
import { apiOk } from '../../src/shared/lib/api-response';
import { roomsRepository } from '../../src/features/rooms/repo';
import { getRoomsWithTargets, setRoomRepository } from '../../src/features/rooms/service';

describe('rooms service repository injection', () => {
  it('uses the injected repository', async () => {
    const mockRepo = {
      getRooms: async () => apiOk({ rooms: [], unassignedTargets: [], cached: false }),
      createRoom: async () => apiOk({
        id: 'room-1',
        name: 'Room',
        room_type: 'custom',
        icon: 'home',
        order_index: 0,
        created_at: '',
        updated_at: '',
      }),
      updateRoom: async () => apiOk({
        id: 'room-1',
        name: 'Room',
        room_type: 'custom',
        icon: 'home',
        order_index: 0,
        created_at: '',
        updated_at: '',
      }),
      deleteRoom: async () => apiOk(undefined),
      updateRoomOrder: async () => apiOk(undefined),
      assignTargetToRoom: async () => apiOk(undefined),
      assignTargetsToRoom: async () => apiOk(undefined),
      unassignTargets: async () => apiOk(undefined),
      getRoomTargets: async () => apiOk([]),
    };

    setRoomRepository(mockRepo);
    const result = await getRoomsWithTargets();
    expect(result.ok).toBe(true);
    expect(result.data.rooms).toEqual([]);
    setRoomRepository(roomsRepository);
  });
});
