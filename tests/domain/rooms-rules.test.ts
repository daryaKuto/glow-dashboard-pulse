import { describe, it, expect } from 'vitest';
import {
  isRoomNameUnique,
  canRoomAcceptTargets,
  canUserCreateMoreRooms,
  areRoomOrderIndicesValid,
  canUnassignTarget,
  isTargetAlreadyAssigned,
  calculateNextOrderIndex,
  normalizeRoomOrders,
  isValidRoomName,
  type RoomSummary,
} from '../../src/domain/rooms/rules';
import { ROOM_CONSTRAINTS } from '../../src/domain/rooms/validators';

describe('rooms rules', () => {
  describe('isRoomNameUnique', () => {
    const existingRooms: RoomSummary[] = [
      { id: 'room-1', name: 'Living Room', targetCount: 2 },
      { id: 'room-2', name: 'Garage', targetCount: 1 },
      { id: 'room-3', name: 'Basement', targetCount: 0 },
    ];

    it('returns valid for unique name', () => {
      const result = isRoomNameUnique('Kitchen', existingRooms);
      expect(result.valid).toBe(true);
    });

    it('returns invalid with DUPLICATE_NAME for exact match', () => {
      const result = isRoomNameUnique('Living Room', existingRooms);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('DUPLICATE_NAME');
      }
    });

    it('returns invalid for different case match', () => {
      const result = isRoomNameUnique('living room', existingRooms);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('DUPLICATE_NAME');
      }
    });

    it('returns invalid for case variation match', () => {
      const result = isRoomNameUnique('GARAGE', existingRooms);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('DUPLICATE_NAME');
      }
    });

    it('allows updating same room with excludeRoomId', () => {
      const result = isRoomNameUnique('Living Room', existingRooms, 'room-1');
      expect(result.valid).toBe(true);
    });

    it('rejects duplicate when excludeRoomId is different room', () => {
      const result = isRoomNameUnique('Living Room', existingRooms, 'room-2');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('DUPLICATE_NAME');
      }
    });

    it('returns valid for empty room list', () => {
      const result = isRoomNameUnique('Any Name', []);
      expect(result.valid).toBe(true);
    });
  });

  describe('canRoomAcceptTargets', () => {
    it('returns valid when room has space', () => {
      const room: RoomSummary = { id: 'room-1', name: 'Room', targetCount: 5 };
      const result = canRoomAcceptTargets(room, 3, 10);
      expect(result.valid).toBe(true);
    });

    it('returns invalid with TARGET_LIMIT_EXCEEDED at limit', () => {
      const room: RoomSummary = { id: 'room-1', name: 'Room', targetCount: 10 };
      const result = canRoomAcceptTargets(room, 1, 10);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('TARGET_LIMIT_EXCEEDED');
      }
    });

    it('returns invalid when exceeding limit', () => {
      const room: RoomSummary = { id: 'room-1', name: 'Room', targetCount: 8 };
      const result = canRoomAcceptTargets(room, 5, 10);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('TARGET_LIMIT_EXCEEDED');
      }
    });

    it('returns valid when adding 0 targets', () => {
      const room: RoomSummary = { id: 'room-1', name: 'Room', targetCount: 10 };
      const result = canRoomAcceptTargets(room, 0, 10);
      expect(result.valid).toBe(true);
    });

    it('uses default maxTargets from ROOM_CONSTRAINTS', () => {
      const room: RoomSummary = { id: 'room-1', name: 'Room', targetCount: 0 };
      const result = canRoomAcceptTargets(room, ROOM_CONSTRAINTS.MAX_TARGETS_PER_ROOM + 1);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('TARGET_LIMIT_EXCEEDED');
      }
    });

    it('accepts custom maxTargets override', () => {
      const room: RoomSummary = { id: 'room-1', name: 'Room', targetCount: 3 };
      const result = canRoomAcceptTargets(room, 2, 5);
      expect(result.valid).toBe(true);
    });

    it('rejects with custom maxTargets override exceeded', () => {
      const room: RoomSummary = { id: 'room-1', name: 'Room', targetCount: 3 };
      const result = canRoomAcceptTargets(room, 3, 5);
      expect(result.valid).toBe(false);
    });
  });

  describe('canUserCreateMoreRooms', () => {
    it('returns valid when under limit', () => {
      const result = canUserCreateMoreRooms(5, 10);
      expect(result.valid).toBe(true);
    });

    it('returns invalid with ROOM_LIMIT_EXCEEDED at limit', () => {
      const result = canUserCreateMoreRooms(10, 10);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('ROOM_LIMIT_EXCEEDED');
      }
    });

    it('returns invalid when over limit', () => {
      const result = canUserCreateMoreRooms(15, 10);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('ROOM_LIMIT_EXCEEDED');
      }
    });

    it('uses default maxRooms from ROOM_CONSTRAINTS', () => {
      const result = canUserCreateMoreRooms(ROOM_CONSTRAINTS.MAX_ROOMS_PER_USER);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('ROOM_LIMIT_EXCEEDED');
      }
    });

    it('accepts custom maxRooms override', () => {
      const result = canUserCreateMoreRooms(3, 5);
      expect(result.valid).toBe(true);
    });

    it('allows zero rooms', () => {
      const result = canUserCreateMoreRooms(0, 10);
      expect(result.valid).toBe(true);
    });
  });

  describe('areRoomOrderIndicesValid', () => {
    it('returns valid for empty array', () => {
      const result = areRoomOrderIndicesValid([]);
      expect(result.valid).toBe(true);
    });

    it('returns valid for sequential indices [0, 1, 2]', () => {
      const orders = [
        { id: 'a', order_index: 0 },
        { id: 'b', order_index: 1 },
        { id: 'c', order_index: 2 },
      ];
      const result = areRoomOrderIndicesValid(orders);
      expect(result.valid).toBe(true);
    });

    it('returns valid for single item at index 0', () => {
      const result = areRoomOrderIndicesValid([{ id: 'a', order_index: 0 }]);
      expect(result.valid).toBe(true);
    });

    it('returns invalid with DUPLICATE_ORDER_INDEX for duplicate index', () => {
      const orders = [
        { id: 'a', order_index: 0 },
        { id: 'b', order_index: 0 },
        { id: 'c', order_index: 1 },
      ];
      const result = areRoomOrderIndicesValid(orders);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('DUPLICATE_ORDER_INDEX');
      }
    });

    it('returns invalid with NON_SEQUENTIAL_ORDER for gap [0, 2]', () => {
      const orders = [
        { id: 'a', order_index: 0 },
        { id: 'b', order_index: 2 },
      ];
      const result = areRoomOrderIndicesValid(orders);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('NON_SEQUENTIAL_ORDER');
      }
    });

    it('returns invalid with NON_SEQUENTIAL_ORDER for not starting at 0', () => {
      const orders = [
        { id: 'a', order_index: 1 },
        { id: 'b', order_index: 2 },
      ];
      const result = areRoomOrderIndicesValid(orders);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('NON_SEQUENTIAL_ORDER');
      }
    });

    it('returns valid for out of order but sequential values [2, 0, 1]', () => {
      const orders = [
        { id: 'c', order_index: 2 },
        { id: 'a', order_index: 0 },
        { id: 'b', order_index: 1 },
      ];
      const result = areRoomOrderIndicesValid(orders);
      expect(result.valid).toBe(true);
    });
  });

  describe('canUnassignTarget', () => {
    it('returns valid when target is in room', () => {
      const result = canUnassignTarget('target-1', ['target-1', 'target-2', 'target-3']);
      expect(result.valid).toBe(true);
    });

    it('returns invalid with TARGET_NOT_IN_ROOM when target not in room', () => {
      const result = canUnassignTarget('target-4', ['target-1', 'target-2', 'target-3']);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('TARGET_NOT_IN_ROOM');
      }
    });

    it('returns invalid for empty target list', () => {
      const result = canUnassignTarget('target-1', []);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('TARGET_NOT_IN_ROOM');
      }
    });
  });

  describe('isTargetAlreadyAssigned', () => {
    const rooms = [
      { id: 'room-1', targetIds: ['target-1', 'target-2'] },
      { id: 'room-2', targetIds: ['target-3'] },
      { id: 'room-3', targetIds: [] },
    ];

    it('returns valid when target not in any room', () => {
      const result = isTargetAlreadyAssigned('target-4', rooms);
      expect(result.valid).toBe(true);
    });

    it('returns invalid with TARGET_ALREADY_ASSIGNED when target in another room', () => {
      const result = isTargetAlreadyAssigned('target-1', rooms);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('TARGET_ALREADY_ASSIGNED');
      }
    });

    it('returns valid when target in excluded room', () => {
      const result = isTargetAlreadyAssigned('target-1', rooms, 'room-1');
      expect(result.valid).toBe(true);
    });

    it('returns invalid when target in different room than excluded', () => {
      const result = isTargetAlreadyAssigned('target-1', rooms, 'room-2');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('TARGET_ALREADY_ASSIGNED');
      }
    });

    it('returns valid for empty rooms array', () => {
      const result = isTargetAlreadyAssigned('target-1', []);
      expect(result.valid).toBe(true);
    });
  });

  describe('calculateNextOrderIndex', () => {
    it('returns 0 for empty array', () => {
      expect(calculateNextOrderIndex([])).toBe(0);
    });

    it('returns 3 for array with 3 rooms', () => {
      const rooms: RoomSummary[] = [
        { id: 'a', name: 'A', targetCount: 0 },
        { id: 'b', name: 'B', targetCount: 0 },
        { id: 'c', name: 'C', targetCount: 0 },
      ];
      expect(calculateNextOrderIndex(rooms)).toBe(3);
    });

    it('returns 1 for array with 1 room', () => {
      const rooms: RoomSummary[] = [{ id: 'a', name: 'A', targetCount: 0 }];
      expect(calculateNextOrderIndex(rooms)).toBe(1);
    });
  });

  describe('normalizeRoomOrders', () => {
    it('returns empty array for empty input', () => {
      expect(normalizeRoomOrders([])).toEqual([]);
    });

    it('returns unchanged for already sequential orders', () => {
      const rooms = [
        { id: 'a', order_index: 0 },
        { id: 'b', order_index: 1 },
        { id: 'c', order_index: 2 },
      ];
      const result = normalizeRoomOrders(rooms);
      expect(result).toEqual([
        { id: 'a', order_index: 0 },
        { id: 'b', order_index: 1 },
        { id: 'c', order_index: 2 },
      ]);
    });

    it('re-indexes out of order values [5, 2, 8] to [0, 1, 2]', () => {
      const rooms = [
        { id: 'a', order_index: 5 },
        { id: 'b', order_index: 2 },
        { id: 'c', order_index: 8 },
      ];
      const result = normalizeRoomOrders(rooms);
      expect(result).toEqual([
        { id: 'b', order_index: 0 },
        { id: 'a', order_index: 1 },
        { id: 'c', order_index: 2 },
      ]);
    });

    it('preserves sort order when normalizing', () => {
      const rooms = [
        { id: 'third', order_index: 100 },
        { id: 'first', order_index: 1 },
        { id: 'second', order_index: 50 },
      ];
      const result = normalizeRoomOrders(rooms);
      expect(result.map((r) => r.id)).toEqual(['first', 'second', 'third']);
      expect(result.map((r) => r.order_index)).toEqual([0, 1, 2]);
    });

    it('handles single item', () => {
      const rooms = [{ id: 'a', order_index: 5 }];
      const result = normalizeRoomOrders(rooms);
      expect(result).toEqual([{ id: 'a', order_index: 0 }]);
    });
  });

  describe('isValidRoomName', () => {
    it('returns valid for valid name', () => {
      const result = isValidRoomName('Living Room');
      expect(result.valid).toBe(true);
    });

    it('returns invalid with NAME_TOO_SHORT for empty string', () => {
      const result = isValidRoomName('');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('NAME_TOO_SHORT');
      }
    });

    it('returns invalid with NAME_TOO_SHORT for whitespace-only', () => {
      const result = isValidRoomName('   ');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('NAME_TOO_SHORT');
      }
    });

    it('returns invalid with NAME_TOO_LONG for name exceeding max length', () => {
      const longName = 'A'.repeat(ROOM_CONSTRAINTS.NAME_MAX_LENGTH + 1);
      const result = isValidRoomName(longName);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('NAME_TOO_LONG');
      }
    });

    it('returns valid for name at max length', () => {
      const maxName = 'A'.repeat(ROOM_CONSTRAINTS.NAME_MAX_LENGTH);
      const result = isValidRoomName(maxName);
      expect(result.valid).toBe(true);
    });

    it('returns invalid with INVALID_CHARACTERS for < character', () => {
      const result = isValidRoomName('Room <script>');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('INVALID_CHARACTERS');
      }
    });

    it('returns invalid with INVALID_CHARACTERS for > character', () => {
      const result = isValidRoomName('Room>Name');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('INVALID_CHARACTERS');
      }
    });

    it('returns invalid with INVALID_CHARACTERS for { character', () => {
      const result = isValidRoomName('Room {');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('INVALID_CHARACTERS');
      }
    });

    it('returns invalid with INVALID_CHARACTERS for } character', () => {
      const result = isValidRoomName('Room }');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('INVALID_CHARACTERS');
      }
    });

    it('returns valid for names with allowed special characters', () => {
      const result = isValidRoomName("John's Room #1 - Main (East)");
      expect(result.valid).toBe(true);
    });

    it('trims whitespace before validation', () => {
      const result = isValidRoomName('  Valid Room  ');
      expect(result.valid).toBe(true);
    });
  });
});
