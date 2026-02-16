import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Gamepad2, ChevronDown, Building2, Clock3, Crosshair, Trash2, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GamePreset } from '@/features/games';
import { renderPresetDuration } from '@/features/games/lib/telemetry-utils';
import { Skeleton } from '@/components/ui/skeleton';

export type PresetBannerProps = {
  presets: GamePreset[];
  presetsLoading: boolean;
  presetsError: string | null;
  isSessionLocked: boolean;
  applyingId: string | null;
  deletingId: string | null;
  activePresetId: string | null;
  onApply: (preset: GamePreset) => Promise<void>;
  onDelete: (preset: GamePreset) => Promise<void>;
  onRefresh: () => Promise<void>;
};

const PresetMiniCard: React.FC<{ icon: LucideIcon; label: string; value: string }> = ({
  icon: Icon, label, value
}) => (
  <div className="rounded-[var(--radius)] bg-brand-primary/5 px-3 py-2 shadow-subtle">
    <div className="flex items-center gap-1.5 mb-0.5">
      <Icon className="h-3 w-3 text-brand-primary" />
      <span className="text-label text-brand-secondary font-body uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-sm font-bold text-brand-dark font-body">{value}</p>
  </div>
);

const _PresetBanner: React.FC<PresetBannerProps> = ({
  presets,
  presetsLoading,
  presetsError,
  isSessionLocked,
  applyingId,
  deletingId,
  activePresetId,
  onApply,
  onDelete,
  onRefresh,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const effectiveSelectedId = selectedPresetId ?? activePresetId;
  const selectedPreset = presets.find((p) => p.id === effectiveSelectedId) ?? null;

  // Loading state
  if (presetsLoading) {
    return (
      <div className="shadow-card bg-white rounded-[var(--radius-lg)] px-5 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded bg-gray-200" />
          <Skeleton className="h-3 w-14 bg-gray-200" />
          <div className="flex-1 flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (presetsError) {
    return (
      <div className="shadow-card bg-white rounded-[var(--radius-lg)] px-5 py-3 flex items-center gap-3">
        <Gamepad2 className="h-4 w-4 text-red-500" />
        <span className="text-sm text-red-600 font-body flex-1">Couldn&apos;t load presets</span>
        <Button variant="ghost" size="sm" className="text-brand-primary text-xs" onClick={onRefresh}>
          Retry
        </Button>
      </div>
    );
  }

  // Empty state
  if (presets.length === 0) {
    return (
      <div className="shadow-card bg-white rounded-[var(--radius-lg)] px-5 py-3 flex items-center gap-3">
        <Gamepad2 className="h-4 w-4 text-brand-dark/30" />
        <span className="text-sm text-brand-dark/40 font-body flex-1">No presets saved yet</span>
      </div>
    );
  }

  const isDeleteLoading = selectedPreset ? deletingId === selectedPreset.id : false;

  return (
    <div className="shadow-card bg-white rounded-[var(--radius-lg)] px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Gamepad2 className="h-4 w-4 text-brand-primary" />
          <span className="text-label text-brand-secondary uppercase tracking-wide font-body">Presets</span>
        </div>
        {/* Horizontal scrollable preset pills */}
        <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-none">
          {presets.map((preset) => {
            const isActive = activePresetId === preset.id;
            const isApplying = applyingId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  setSelectedPresetId(preset.id);
                  if (!isActive) {
                    onApply(preset);
                  }
                }}
                disabled={isSessionLocked || isApplying}
                className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium font-body transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'bg-brand-primary/[0.05] text-brand-dark hover:bg-brand-primary/[0.1]'
                }`}
              >
                {isApplying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {preset.name}
                {preset.targetIds.length > 0 && (
                  <span className="text-[10px] opacity-70">{preset.targetIds.length}t</span>
                )}
              </button>
            );
          })}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-brand-dark/40 hover:text-brand-dark">
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }} className="overflow-hidden">
            <div className="pt-3 mt-3 border-t border-[rgba(28,25,43,0.06)] space-y-3">
              {selectedPreset ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <PresetMiniCard icon={Building2} label="Room" value={selectedPreset.roomName ?? 'Any'} />
                    <PresetMiniCard icon={Clock3} label="Duration" value={renderPresetDuration(selectedPreset.durationSeconds)} />
                    <PresetMiniCard icon={Crosshair} label="Targets" value={String(selectedPreset.targetIds.length)} />
                  </div>
                  <div className="flex items-center justify-end">
                    <Button variant="ghost" size="sm" className="text-red-500 text-xs"
                      onClick={() => onDelete(selectedPreset)} disabled={isSessionLocked || isDeleteLoading}>
                      {isDeleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Delete
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-brand-dark/40 font-body text-center py-2">
                  Select a preset to view details
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const PresetBanner = React.memo(_PresetBanner);
PresetBanner.displayName = 'PresetBanner';
