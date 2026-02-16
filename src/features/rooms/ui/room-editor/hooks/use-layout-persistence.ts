import { useEffect, useRef, useCallback } from 'react';
import { useRoomEditorStore } from './use-room-editor-store';
import { useSaveRoomLayout, useCreateRoomWithLayout, useRoomLayout, useAssignTargetsToRoom } from '@/features/rooms/hooks';
import { serializeLayout, deserializeLayout } from '../lib/serialization';
import { AUTO_SAVE_DELAY } from '../lib/constants';
import type { CreateRoomData } from '@/features/rooms/schema';

interface UseLayoutPersistenceOptions {
  roomId: string | undefined; // undefined = new room
  onRoomCreated?: (newRoomId: string) => void;
}

export function useLayoutPersistence({ roomId, onRoomCreated }: UseLayoutPersistenceOptions) {
  const isDirty = useRoomEditorStore((s) => s.isDirty);
  const getDocumentSnapshot = useRoomEditorStore((s) => s.getDocumentSnapshot);
  const canvasWidth = useRoomEditorStore((s) => s.canvasWidth);
  const canvasHeight = useRoomEditorStore((s) => s.canvasHeight);
  const gridSize = useRoomEditorStore((s) => s.gridSize);
  const stageScale = useRoomEditorStore((s) => s.stageScale);
  const stagePosition = useRoomEditorStore((s) => s.stagePosition);
  const roomName = useRoomEditorStore((s) => s.roomName);
  const markClean = useRoomEditorStore((s) => s.markClean);
  const loadDocument = useRoomEditorStore((s) => s.loadDocument);
  const setRoomName = useRoomEditorStore((s) => s.setRoomName);

  const saveLayoutMutation = useSaveRoomLayout();
  const createRoomMutation = useCreateRoomWithLayout();
  const assignTargetsMutation = useAssignTargetsToRoom();
  const { data: existingLayout } = useRoomLayout(roomId);

  // Track the actual persisted room ID (may change after creation)
  const persistedRoomIdRef = useRef(roomId);
  useEffect(() => {
    persistedRoomIdRef.current = roomId;
  }, [roomId]);

  // Load existing layout on mount
  useEffect(() => {
    if (existingLayout && existingLayout.layout_data) {
      const { snapshot, canvasWidth: cw, canvasHeight: ch, gridSize: gs } =
        deserializeLayout(existingLayout.layout_data as any);
      loadDocument(snapshot, cw, ch, gs);
    }
  }, [existingLayout, loadDocument]);

  const save = useCallback(async () => {
    const snapshot = getDocumentSnapshot();
    const layout = serializeLayout(snapshot, canvasWidth, canvasHeight, gridSize);
    const viewport = { scale: stageScale, x: stagePosition.x, y: stagePosition.y };

    // Collect placed target device IDs and names for room assignment
    const placedTargetIds = snapshot.targets.map((t) => t.targetDeviceId);
    const placedTargetNames = new Map(
      snapshot.targets.map((t) => [t.targetDeviceId, t.label ?? t.targetDeviceId])
    );

    if (persistedRoomIdRef.current) {
      // Update existing room layout
      await saveLayoutMutation.mutateAsync({
        roomId: persistedRoomIdRef.current,
        layoutData: layout as unknown as Record<string, unknown>,
        viewport,
        canvasWidth,
        canvasHeight,
      });

      // Sync placed targets to user_room_targets
      if (placedTargetIds.length > 0) {
        await assignTargetsMutation.mutateAsync({
          targetIds: placedTargetIds,
          roomId: persistedRoomIdRef.current,
          targetNames: placedTargetNames,
        });
      }

      // Clean up localStorage draft
      try { localStorage.removeItem(`room-editor-draft-${persistedRoomIdRef.current}`); } catch { /* ignore */ }

      markClean();
    } else {
      // Create new room + layout (targets assigned separately with names below)
      const roomData: CreateRoomData = {
        name: roomName || 'Untitled Room',
        room_type: 'custom',
        icon: 'home',
        order_index: 0,
      };

      const newRoom = await createRoomMutation.mutateAsync({
        roomData,
        layoutData: layout as unknown as Record<string, unknown>,
        viewport,
        canvasWidth,
        canvasHeight,
      });

      // Assign placed targets with display names
      if (placedTargetIds.length > 0) {
        await assignTargetsMutation.mutateAsync({
          targetIds: placedTargetIds,
          roomId: newRoom.id,
          targetNames: placedTargetNames,
        });
      }

      // Clean up localStorage draft for "new" room
      try { localStorage.removeItem('room-editor-draft-new'); } catch { /* ignore */ }

      persistedRoomIdRef.current = newRoom.id;
      markClean();
      onRoomCreated?.(newRoom.id);
    }
  }, [
    getDocumentSnapshot,
    canvasWidth,
    canvasHeight,
    gridSize,
    stageScale,
    stagePosition,
    roomName,
    saveLayoutMutation,
    createRoomMutation,
    assignTargetsMutation,
    markClean,
    onRoomCreated,
  ]);

  // Auto-save with debounce
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!isDirty || !persistedRoomIdRef.current) return;

    autoSaveTimerRef.current = setTimeout(() => {
      save();
    }, AUTO_SAVE_DELAY);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [isDirty, save]);

  // Save on beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Also save to localStorage as crash recovery
  useEffect(() => {
    if (!isDirty) return;
    const snapshot = getDocumentSnapshot();
    const layout = serializeLayout(snapshot, canvasWidth, canvasHeight, gridSize);
    const key = `room-editor-draft-${roomId ?? 'new'}`;
    try {
      localStorage.setItem(key, JSON.stringify({ layout, roomName, ts: Date.now() }));
    } catch {
      // localStorage full — ignore
    }
  }, [isDirty, getDocumentSnapshot, canvasWidth, canvasHeight, gridSize, roomId, roomName]);

  // Recover from localStorage on mount (existing rooms only).
  // New rooms always start blank — clear any stale draft.
  useEffect(() => {
    if (!roomId) {
      try { localStorage.removeItem('room-editor-draft-new'); } catch { /* ignore */ }
      return;
    }
    if (existingLayout) return; // Don't overwrite server data
    const key = `room-editor-draft-${roomId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const { layout, roomName: savedName } = JSON.parse(raw);
        const { snapshot, canvasWidth: cw, canvasHeight: ch, gridSize: gs } =
          deserializeLayout(layout);
        loadDocument(snapshot, cw, ch, gs);
        if (savedName) setRoomName(savedName);
      }
    } catch {
      // corrupt data — ignore
    }
  // Only on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    save,
    isSaving: saveLayoutMutation.isPending || createRoomMutation.isPending || assignTargetsMutation.isPending,
  };
}
