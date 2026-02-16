import React from 'react';
import { Button } from '@/components/ui/button';
import { Crosshair } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import type { Target } from '@/features/targets/schema';
import { deriveConnectionStatus } from '@/features/games/lib/device-status-utils';
import { getStatusDisplay } from '@/shared/constants/target-status';

interface TargetSelectionCardProps {
  loadingDevices: boolean;
  isSessionLocked: boolean;
  devices: NormalizedGameDevice[];
  targetDetails: Map<string, Target>;
  selectedDeviceIds: string[];
  hitCounts: Record<string, number>;
  formatLastSeen: (timestamp: number) => string;
  onToggleDevice: (deviceId: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  selectedCount: number;
  totalOnlineSelectableTargets: number;
  className?: string;
}

// Presents the target selection list with per-device connectivity and hit stats.
export const TargetSelectionCard: React.FC<TargetSelectionCardProps> = ({
  loadingDevices,
  isSessionLocked,
  devices,
  targetDetails,
  selectedDeviceIds,
  hitCounts,
  formatLastSeen,
  onToggleDevice,
  onSelectAll,
  onClearSelection,
  selectedCount,
  totalOnlineSelectableTargets,
  className,
}) => {
  const scrollAreaRef = React.useRef<HTMLDivElement | null>(null);
  const previousFirstDeviceIdRef = React.useRef<string | null>(null);

  // Sort devices so online targets appear at the top
  const sortedDevices = React.useMemo(() => {
    return [...devices].sort((a, b) => {
      const aOnline = deriveConnectionStatus(a) !== 'offline';
      const bOnline = deriveConnectionStatus(b) !== 'offline';
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      return 0;
    });
  }, [devices]);

  React.useEffect(() => {
    if (sortedDevices.length === 0) {
      previousFirstDeviceIdRef.current = null;
      return;
    }

    const firstDeviceId = sortedDevices[0]?.deviceId ?? null;
    const previousFirstDeviceId = previousFirstDeviceIdRef.current;
    previousFirstDeviceIdRef.current = firstDeviceId;

    if (
      firstDeviceId &&
      previousFirstDeviceId &&
      previousFirstDeviceId !== firstDeviceId &&
      selectedDeviceIds.includes(firstDeviceId)
    ) {
      scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [sortedDevices, selectedDeviceIds]);

  return (
    <div className={`rounded-[var(--radius-lg)] bg-white p-4 ${className ?? ''}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-brand-primary" />
          <span className="text-label text-brand-secondary uppercase tracking-wide font-body">
            Targets
          </span>
          <span className="text-[10px] text-brand-dark/40 font-body">
            {selectedCount} selected · {totalOnlineSelectableTargets} available
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="text-xs text-brand-primary h-7 px-2"
            onClick={onSelectAll} disabled={isSessionLocked || loadingDevices}>
            Select All
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-brand-dark/40 h-7 px-2"
            onClick={onClearSelection}
            disabled={isSessionLocked || (!loadingDevices && selectedDeviceIds.length === 0)}>
            Clear
          </Button>
        </div>
      </div>

      {/* Content */}
      {loadingDevices ? (
        <div className="flex items-center justify-center py-6 text-sm text-brand-dark/40 font-body">
          Refreshing device list...
        </div>
      ) : sortedDevices.length === 0 ? (
        <p className="text-sm text-brand-dark/40 font-body text-center py-6">
          No ThingsBoard devices found for this tenant.
        </p>
      ) : (
        <div ref={scrollAreaRef} className="max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-brand-secondary/20 space-y-1.5">
          {sortedDevices.map((device) => {
            const connectionStatus = deriveConnectionStatus(device);
            const isOnline = connectionStatus !== 'offline';
            const targetRecord = targetDetails.get(device.deviceId);
            const displayName = targetRecord?.customName || device.name;
            const lastActivityTimestamp =
              (typeof targetRecord?.lastActivityTime === 'number' ? targetRecord.lastActivityTime : null) ??
              (typeof device.raw?.lastActivityTime === 'number' ? device.raw.lastActivityTime : null) ??
              (typeof device.lastSeen === 'number' ? device.lastSeen : 0);
            const statusCfg = getStatusDisplay(connectionStatus);
            const hits = hitCounts[device.deviceId] ?? device.hitCount ?? 0;
            const isChecked = selectedDeviceIds.includes(device.deviceId);

            return (
              <button
                key={device.deviceId}
                onClick={() => onToggleDevice(device.deviceId, !isChecked)}
                disabled={isSessionLocked || (!isOnline && !isChecked)}
                className={`flex items-center gap-3 w-full text-left rounded-[var(--radius)] px-3 py-2.5 transition-colors duration-200 ${
                  isChecked
                    ? 'bg-[rgba(206,62,10,0.05)] border-l-[3px] border-brand-primary'
                    : 'bg-white hover:bg-brand-light'
                } ${!isOnline && !isChecked ? 'opacity-50' : ''}`}
              >
                {/* Radio indicator */}
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isChecked ? 'border-brand-primary bg-brand-primary' : 'border-brand-dark/20 bg-transparent'
                }`}>
                  {isChecked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                {/* Target info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-brand-dark font-body truncate">{displayName}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-brand-dark/50 font-body">
                    <span className={`flex items-center gap-1 font-medium ${statusCfg.textColor}`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${statusCfg.dotColor}`} />
                      {statusCfg.label}
                    </span>
                    {hits > 0 && <span>Hits {hits}</span>}
                    <span>{formatLastSeen(lastActivityTimestamp ?? 0)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Placeholder while the device roster is refreshing.
export const TargetSelectionSkeleton: React.FC = () => (
  <div className="rounded-[var(--radius-lg)] bg-white p-4">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded bg-gray-200" />
        <Skeleton className="h-3 w-20 bg-gray-200" />
      </div>
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-7 w-16 rounded-full bg-gray-200" />
        <Skeleton className="h-7 w-12 rounded-full bg-gray-200" />
      </div>
    </div>
    <div className="space-y-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[var(--radius)] bg-white px-3 py-2.5">
          <Skeleton className="h-4 w-4 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32 bg-gray-200" />
            <Skeleton className="h-3 w-40 bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  </div>
);
