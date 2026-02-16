import React from 'react';
import { motion } from 'framer-motion';
import {
  MousePointer2,
  Move,
  Minus,
  DoorOpen,
  SquareStack,
  Target,
  Trash2,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRoomEditorStore } from './hooks/use-room-editor-store';
import type { ToolType } from './lib/constants';
import type { PlacedTargetData } from './lib/types';

interface TargetDevice {
  deviceId: string;
  name: string;
  status?: 'online' | 'standby' | 'offline';
  isRoomTarget?: boolean;
}

interface EditorPaletteProps {
  availableTargets: TargetDevice[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

interface ToolButtonProps {
  tool: ToolType;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  hint?: string;
}

const ToolButton: React.FC<ToolButtonProps> = ({ tool, icon, label, shortcut, hint }) => {
  const activeTool = useRoomEditorStore((s) => s.activeTool);
  const setActiveTool = useRoomEditorStore((s) => s.setActiveTool);
  const isActive = activeTool === tool;

  const titleText = [label, shortcut ? `(${shortcut})` : '', hint ? `— ${hint}` : ''].filter(Boolean).join(' ');

  return (
    <div className="relative group">
      <button
        onClick={() => setActiveTool(tool)}
        className={`flex items-center gap-2 w-full rounded-lg p-2 text-sm font-body transition-colors ${
          isActive
            ? 'bg-brand-primary/10 text-brand-primary'
            : 'text-brand-dark/50 hover:bg-brand-dark/5'
        }`}
        title={titleText}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {shortcut && (
          <span className="text-[10px] text-brand-dark/30">{shortcut}</span>
        )}
      </button>
      {hint && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 rounded-lg bg-brand-dark text-white text-[11px] font-body leading-tight whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg max-w-[200px] whitespace-normal">
          {hint}
        </div>
      )}
    </div>
  );
};

import { getStatusDisplay, TARGET_STATUS_SORT_ORDER } from '@/shared/constants/target-status';

const EditorPalette: React.FC<EditorPaletteProps> = ({ availableTargets }) => {
  const targets = useRoomEditorStore((s) => s.targets);
  const addTarget = useRoomEditorStore((s) => s.addTarget);
  const addPrebuiltRoom = useRoomEditorStore((s) => s.addPrebuiltRoom);
  const stageScale = useRoomEditorStore((s) => s.stageScale);
  const zoomIn = useRoomEditorStore((s) => s.zoomIn);
  const zoomOut = useRoomEditorStore((s) => s.zoomOut);
  const resetZoom = useRoomEditorStore((s) => s.resetZoom);
  const gridSize = useRoomEditorStore((s) => s.gridSize);

  // Filter out already-placed targets, sort online/standby first
  const placedDeviceIds = new Set(targets.map((t) => t.targetDeviceId));
  const unplacedTargets = availableTargets
    .filter((t) => !placedDeviceIds.has(t.deviceId))
    .sort((a, b) => {
      const aOrder = TARGET_STATUS_SORT_ORDER[a.status ?? 'offline'] ?? 2;
      const bOrder = TARGET_STATUS_SORT_ORDER[b.status ?? 'offline'] ?? 2;
      return aOrder - bOrder;
    });

  const handlePlaceTarget = (device: TargetDevice) => {
    const newTarget: PlacedTargetData = {
      id: crypto.randomUUID(),
      targetDeviceId: device.deviceId,
      x: 200,
      y: 200,
      rotation: 0,
      label: device.name,
    };
    addTarget(newTarget);
  };

  return (
    <div className="w-52 bg-white border-r border-[rgba(28,25,43,0.08)] flex flex-col overflow-hidden shrink-0">
      <motion.div
        className="p-3 space-y-4 flex-1 overflow-y-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Tools Section */}
        <motion.div variants={itemVariants}>
          <h4 className="text-label text-brand-secondary uppercase tracking-wide font-body mb-2">
            Tools
          </h4>
          <div className="space-y-0.5">
            <ToolButton tool="select" icon={<MousePointer2 className="w-4 h-4" />} label="Select" shortcut="V" hint="Click to select, Shift+click for multi-select" />
            <ToolButton tool="move" icon={<Move className="w-4 h-4" />} label="Move" shortcut="M" hint="Drag to move all selected objects" />
            <ToolButton tool="wall" icon={<Minus className="w-4 h-4" />} label="Wall" shortcut="W" />
            <div className="relative group">
              <button
                onClick={() => addPrebuiltRoom()}
                className="flex items-center gap-2 w-full rounded-lg p-2 text-sm font-body text-brand-dark/50 hover:bg-brand-dark/5 transition-colors"
                title="Room (R) — Drop a rectangular room onto the canvas"
              >
                <Square className="w-4 h-4" />
                <span className="flex-1 text-left">Room</span>
                <span className="text-[10px] text-brand-dark/30">R</span>
              </button>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 rounded-lg bg-brand-dark text-white text-[11px] font-body leading-tight opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg max-w-[200px] whitespace-normal">
                Drops a pre-built rectangular room. Drag corners to resize.
              </div>
            </div>
            <ToolButton tool="delete" icon={<Trash2 className="w-4 h-4" />} label="Delete" shortcut="Del" />
          </div>
        </motion.div>

        {/* Place Section */}
        <motion.div variants={itemVariants}>
          <h4 className="text-label text-brand-secondary uppercase tracking-wide font-body mb-2">
            Place
          </h4>
          <div className="space-y-0.5">
            <ToolButton tool="door" icon={<DoorOpen className="w-4 h-4" />} label="Door" shortcut="D" hint="Select, then click on a wall to place" />
            <ToolButton tool="window" icon={<SquareStack className="w-4 h-4" />} label="Window" hint="Select, then click on a wall to place" />
          </div>
        </motion.div>

        {/* Targets Section */}
        <motion.div variants={itemVariants}>
          <h4 className="text-label text-brand-secondary uppercase tracking-wide font-body mb-2">
            Targets
          </h4>
          {unplacedTargets.length === 0 && targets.length === 0 && availableTargets.length === 0 && (
            <p className="text-xs text-brand-dark/40 font-body">
              No targets found
            </p>
          )}
          {unplacedTargets.length === 0 && targets.length > 0 && (
            <p className="text-xs text-brand-dark/40 font-body">
              All targets placed
            </p>
          )}
          <div className="space-y-1 max-h-[280px] overflow-y-auto">
            {unplacedTargets.map((device) => (
              <button
                key={device.deviceId}
                onClick={() => handlePlaceTarget(device)}
                className="flex items-center gap-2 w-full rounded-lg p-2 text-sm font-body text-brand-dark/70 hover:bg-brand-primary/[0.03] transition-colors"
              >
                <Target className="w-4 h-4 text-brand-primary shrink-0" />
                <span className="flex-1 text-left truncate">{device.name}</span>
                {device.status && (
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDisplay(device.status).dotColor}`} />
                )}
                <Plus className="w-3 h-3 text-brand-dark/30 shrink-0" />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Info Section */}
        <motion.div variants={itemVariants}>
          <h4 className="text-label text-brand-secondary uppercase tracking-wide font-body mb-2">
            Info
          </h4>
          <div className="space-y-1 text-xs font-body text-brand-dark/50">
            <div className="flex justify-between">
              <span>Grid</span>
              <span className="text-brand-dark tabular-nums">{gridSize}px</span>
            </div>
            <div className="flex justify-between">
              <span>Zoom</span>
              <span className="text-brand-dark tabular-nums">{Math.round(stageScale * 100)}%</span>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={zoomOut}
              className="text-brand-dark/40 hover:bg-brand-dark/5 h-7 w-7"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={zoomIn}
              className="text-brand-dark/40 hover:bg-brand-dark/5 h-7 w-7"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={resetZoom}
              className="text-brand-dark/40 hover:bg-brand-dark/5 h-7 w-7"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default EditorPalette;
