import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useRooms } from '@/features/rooms/hooks';
import { useTargets } from '@/features/targets/hooks';
import { useRoomEditorStore } from './hooks/use-room-editor-store';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useLayoutPersistence } from './hooks/use-layout-persistence';
import EditorToolbar from './EditorToolbar';
import EditorPalette from './EditorPalette';
import EditorCanvas from './EditorCanvas';

const RoomEditorPage: React.FC = () => {
  const { roomId } = useParams<{ roomId?: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSizeLocal, setCanvasSizeLocal] = useState({ width: 0, height: 0 });

  const setRoomName = useRoomEditorStore((s) => s.setRoomName);
  const setCanvasSize = useRoomEditorStore((s) => s.setCanvasSize);
  const reset = useRoomEditorStore((s) => s.reset);

  // Fetch rooms to get room metadata + all targets for the palette
  const { data: roomsData } = useRooms(false);
  const { data: targetsData } = useTargets(false);
  const currentRoom = roomsData?.rooms.find((r) => r.id === roomId);

  // Build available targets list — show ALL targets (assigned or not)
  // When editing an existing room, room-assigned targets appear first
  const availableTargets = React.useMemo(() => {
    const allTargets = targetsData?.targets ?? [];
    const roomTargetIds = new Set(
      (currentRoom?.targets ?? []).map((t) => t.deviceId)
    );

    return allTargets.map((t) => ({
      deviceId: t.id,
      name: t.customName ?? t.name ?? t.id,
      status: t.status as 'online' | 'standby' | 'offline' | undefined,
      isRoomTarget: roomTargetIds.has(t.id),
    }));
  }, [targetsData?.targets, currentRoom?.targets]);

  // Set room name from existing room
  useEffect(() => {
    if (currentRoom?.name) {
      setRoomName(currentRoom.name);
    }
  }, [currentRoom?.name, setRoomName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // Handle room creation — navigate to edit URL
  const handleRoomCreated = useCallback(
    (newRoomId: string) => {
      navigate(`/dashboard/rooms/${newRoomId}/layout`, { replace: true });
    },
    [navigate]
  );

  const { save, isSaving } = useLayoutPersistence({
    roomId,
    onRoomCreated: handleRoomCreated,
  });

  useKeyboardShortcuts({ onSave: save });

  // Measure container for responsive canvas sizing — sync to store so grid fills viewport
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize(rect.width, rect.height);
        setCanvasSizeLocal({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Mobile guard — enforcement layer #3
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-light px-6 text-center">
        <p className="text-sm text-brand-dark/50 font-body mb-4">
          Use laptop to design and customize your room layout
        </p>
        <Link
          to="/dashboard/rooms"
          className="text-sm text-brand-primary font-body font-medium flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Rooms
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-brand-light overflow-hidden z-50">
      {/* Toolbar */}
      <EditorToolbar onSave={save} isSaving={isSaving} roomId={roomId} />

      {/* Main area — palette + canvas */}
      <div className="flex flex-1 min-h-0">
        {/* Palette sidebar */}
        <EditorPalette availableTargets={availableTargets} />

        {/* Canvas area — fills remaining space, no scroll */}
        <div ref={containerRef} className="flex-1 overflow-hidden relative">
          {canvasSizeLocal.width > 0 && canvasSizeLocal.height > 0 && (
            <EditorCanvas
              containerWidth={canvasSizeLocal.width}
              containerHeight={canvasSizeLocal.height}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomEditorPage;
