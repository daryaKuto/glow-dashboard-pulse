import React from 'react';
import { Button } from '@/components/ui/button';
import type { GamePreset } from '@/features/games';
import { GamePresetsCard } from './GamePresetsCard';

export type PresetBannerProps = {
  presets: GamePreset[];
  presetsLoading: boolean;
  presetsError: string | null;
  isSessionLocked: boolean;
  applyingId: string | null;
  deletingId: string | null;
  selectedDeviceCount: number;
  onApply: (preset: GamePreset) => Promise<void>;
  onDelete: (preset: GamePreset) => Promise<void>;
  onRefresh: () => Promise<void>;
  onRequestSavePreset: () => void;
};

const _PresetBanner: React.FC<PresetBannerProps> = ({
  presets,
  presetsLoading,
  presetsError,
  isSessionLocked,
  applyingId,
  deletingId,
  selectedDeviceCount,
  onApply,
  onDelete,
  onRefresh,
  onRequestSavePreset,
}) => {
  if (presetsLoading) {
    return (
      <GamePresetsCard
        presets={presets}
        isLoading
        isSessionLocked={isSessionLocked}
        applyingId={applyingId}
        deletingId={deletingId}
        onApply={onApply}
        onDelete={onDelete}
      />
    );
  }

  if (presetsError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <span>We couldn&apos;t load your presets. Try again in a moment.</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (presets.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-brand-primary/40 bg-brand-primary/10 px-4 py-3 text-sm text-brand-dark/80 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <span>No presets yet</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={onRequestSavePreset}
            disabled={isSessionLocked || selectedDeviceCount === 0}
          >
            Save current setup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <GamePresetsCard
      presets={presets}
      isLoading={false}
      isSessionLocked={isSessionLocked}
      applyingId={applyingId}
      deletingId={deletingId}
      onApply={onApply}
      onDelete={onDelete}
    />
  );
};

export const PresetBanner = React.memo(_PresetBanner);
PresetBanner.displayName = 'PresetBanner';
