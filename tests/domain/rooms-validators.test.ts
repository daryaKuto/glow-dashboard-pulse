import { describe, it, expect } from 'vitest';
import {
  ROOM_CONSTRAINTS,
  validateCreateRoomInput,
  validateUpdateRoomInput,
  validateRoomOrderArray,
  validateTargetAssignment,
  validateBatchTargetAssignment,
  validateRoomId,
  validateTargetId,
  validateNullableRoomId,
} from '../../src/domain/rooms/validators';

describe('rooms validators', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';

  describe('validateCreateRoomInput', () => {
    it('validates valid input', () => {
      const result = validateCreateRoomInput({
        name: 'Living Room',
        room_type: 'living_room',
        icon: 'home',
        order_index: 0,
      });
      expect(result.success).toBe(true);
    });

    it('trims name whitespace', () => {
      const result = validateCreateRoomInput({
        name: '  Living Room  ',
        room_type: 'living_room',
        order_index: 0,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Living Room');
      }
    });

    it('applies default icon', () => {
      const result = validateCreateRoomInput({
        name: 'Room',
        room_type: 'custom',
        order_index: 0,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.icon).toBe('home');
      }
    });

    it('accepts optional assignedTargets', () => {
      const result = validateCreateRoomInput({
        name: 'Room',
        room_type: 'custom',
        order_index: 0,
        assignedTargets: [validUuid],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = validateCreateRoomInput({
        name: '',
        room_type: 'living_room',
        order_index: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects name that is too long', () => {
      const result = validateCreateRoomInput({
        name: 'a'.repeat(ROOM_CONSTRAINTS.NAME_MAX_LENGTH + 1),
        room_type: 'living_room',
        order_index: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty room_type', () => {
      const result = validateCreateRoomInput({
        name: 'Room',
        room_type: '',
        order_index: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative order_index', () => {
      const result = validateCreateRoomInput({
        name: 'Room',
        room_type: 'custom',
        order_index: -1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid assignedTargets UUIDs', () => {
      const result = validateCreateRoomInput({
        name: 'Room',
        room_type: 'custom',
        order_index: 0,
        assignedTargets: ['not-a-uuid'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateUpdateRoomInput', () => {
    it('validates valid partial update', () => {
      const result = validateUpdateRoomInput({
        name: 'New Name',
      });
      expect(result.success).toBe(true);
    });

    it('validates empty update', () => {
      const result = validateUpdateRoomInput({});
      expect(result.success).toBe(true);
    });

    it('validates all fields update', () => {
      const result = validateUpdateRoomInput({
        name: 'Updated Room',
        room_type: 'garage',
        icon: 'warehouse',
        order_index: 5,
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name when provided', () => {
      const result = validateUpdateRoomInput({
        name: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateRoomOrderArray', () => {
    it('validates valid order array', () => {
      const result = validateRoomOrderArray([
        { id: validUuid, order_index: 0 },
        { id: '223e4567-e89b-12d3-a456-426614174000', order_index: 1 },
      ]);
      expect(result.success).toBe(true);
    });

    it('rejects empty array', () => {
      const result = validateRoomOrderArray([]);
      expect(result.success).toBe(false);
    });

    it('rejects invalid room ID', () => {
      const result = validateRoomOrderArray([
        { id: 'not-a-uuid', order_index: 0 },
      ]);
      expect(result.success).toBe(false);
    });

    it('rejects negative order_index', () => {
      const result = validateRoomOrderArray([
        { id: validUuid, order_index: -1 },
      ]);
      expect(result.success).toBe(false);
    });
  });

  describe('validateTargetAssignment', () => {
    it('validates valid assignment', () => {
      const result = validateTargetAssignment({
        targetId: validUuid,
        roomId: validUuid,
      });
      expect(result.success).toBe(true);
    });

    it('validates assignment with null roomId (unassign)', () => {
      const result = validateTargetAssignment({
        targetId: validUuid,
        roomId: null,
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional targetName', () => {
      const result = validateTargetAssignment({
        targetId: validUuid,
        roomId: validUuid,
        targetName: 'My Target',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid targetId', () => {
      const result = validateTargetAssignment({
        targetId: 'invalid',
        roomId: validUuid,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid roomId (non-null)', () => {
      const result = validateTargetAssignment({
        targetId: validUuid,
        roomId: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateBatchTargetAssignment', () => {
    it('validates valid batch assignment', () => {
      const result = validateBatchTargetAssignment({
        targetIds: [validUuid],
        roomId: validUuid,
      });
      expect(result.success).toBe(true);
    });

    it('validates batch unassignment', () => {
      const result = validateBatchTargetAssignment({
        targetIds: [validUuid, '223e4567-e89b-12d3-a456-426614174000'],
        roomId: null,
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional targetNames', () => {
      const result = validateBatchTargetAssignment({
        targetIds: [validUuid],
        roomId: validUuid,
        targetNames: { [validUuid]: 'My Target' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty targetIds array', () => {
      const result = validateBatchTargetAssignment({
        targetIds: [],
        roomId: validUuid,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateRoomId', () => {
    it('validates valid UUID', () => {
      const result = validateRoomId(validUuid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(validUuid);
      }
    });

    it('rejects empty string', () => {
      const result = validateRoomId('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('required');
      }
    });

    it('rejects invalid UUID format', () => {
      const result = validateRoomId('not-a-uuid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('invalid_uuid');
      }
    });

    it('rejects null', () => {
      const result = validateRoomId(null);
      expect(result.success).toBe(false);
    });
  });

  describe('validateTargetId', () => {
    it('validates valid UUID', () => {
      const result = validateTargetId(validUuid);
      expect(result.success).toBe(true);
    });

    it('rejects empty string', () => {
      const result = validateTargetId('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('required');
      }
    });

    it('rejects invalid UUID format', () => {
      const result = validateTargetId('invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('invalid_uuid');
      }
    });
  });

  describe('validateNullableRoomId', () => {
    it('validates null', () => {
      const result = validateNullableRoomId(null);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    it('validates valid UUID', () => {
      const result = validateNullableRoomId(validUuid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(validUuid);
      }
    });

    it('rejects invalid UUID', () => {
      const result = validateNullableRoomId('invalid');
      expect(result.success).toBe(false);
    });
  });
});
