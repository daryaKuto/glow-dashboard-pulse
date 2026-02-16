import { useEffect, useCallback } from 'react';
import { useRoomEditorStore } from './use-room-editor-store';

interface UseKeyboardShortcutsOptions {
  onSave: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({ onSave, enabled = true }: UseKeyboardShortcutsOptions) {
  const setActiveTool = useRoomEditorStore((s) => s.setActiveTool);
  const deleteSelected = useRoomEditorStore((s) => s.deleteSelected);
  const clearSelection = useRoomEditorStore((s) => s.clearSelection);
  const clearWallDraft = useRoomEditorStore((s) => s.clearWallDraft);
  const undo = useRoomEditorStore((s) => s.undo);
  const redo = useRoomEditorStore((s) => s.redo);
  const zoomIn = useRoomEditorStore((s) => s.zoomIn);
  const zoomOut = useRoomEditorStore((s) => s.zoomOut);
  const resetZoom = useRoomEditorStore((s) => s.resetZoom);
  const addPrebuiltRoom = useRoomEditorStore((s) => s.addPrebuiltRoom);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore keyboard shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + Z → Undo
      if (mod && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl/Cmd + Shift + Z → Redo
      if (mod && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl/Cmd + S → Save
      if (mod && e.key === 's') {
        e.preventDefault();
        onSave();
        return;
      }

      // Delete / Backspace → Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
        return;
      }

      // Escape → Cancel current tool / deselect
      if (e.key === 'Escape') {
        e.preventDefault();
        clearWallDraft();
        clearSelection();
        setActiveTool('select');
        return;
      }

      // Tool shortcuts
      if (e.key === 'v' || e.key === '1') {
        setActiveTool('select');
        return;
      }
      if (e.key === 'w' || e.key === '2') {
        setActiveTool('wall');
        return;
      }
      if (e.key === 'd' || e.key === '3') {
        setActiveTool('door');
        return;
      }
      if (e.key === 'm' || e.key === '5') {
        setActiveTool('move');
        return;
      }
      if (e.key === 'r') {
        addPrebuiltRoom();
        return;
      }

      // Zoom
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        zoomIn();
        return;
      }
      if (e.key === '-') {
        e.preventDefault();
        zoomOut();
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        resetZoom();
        return;
      }
    },
    [
      enabled,
      undo,
      redo,
      onSave,
      deleteSelected,
      clearWallDraft,
      clearSelection,
      setActiveTool,
      zoomIn,
      zoomOut,
      resetZoom,
      addPrebuiltRoom,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
