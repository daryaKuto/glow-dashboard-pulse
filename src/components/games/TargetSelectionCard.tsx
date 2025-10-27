import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wifi, WifiOff } from 'lucide-react';
import type { NormalizedGameDevice } from '@/hooks/useGameDevices';
import type { DeviceStatus } from '@/services/device-game-flow';
import type { Target } from '@/store/useTargets';

interface TargetSelectionCardProps {
  loadingDevices: boolean;
  isSessionLocked: boolean;
  devices: NormalizedGameDevice[];
  targetDetails: Map<string, Target>;
  selectedDeviceIds: string[];
  hitCounts: Record<string, number>;
  deriveConnectionStatus: (device: NormalizedGameDevice) => 'online' | 'standby' | 'offline';
  deriveIsOnline: (device: NormalizedGameDevice) => boolean;
  formatLastSeen: (timestamp: number) => string;
  onToggleDevice: (deviceId: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  selectedCount: number;
  totalOnlineSelectableTargets: number;
  className?: string;
}

// Derives the wifi glyph + color for a device row.
const wifiIndicator = (strength: number | null, connectionStatus: 'online' | 'standby' | 'offline') => {
  if (connectionStatus === 'offline') {
    return <WifiOff className="h-4 w-4 text-red-500" />;
  }
  if (strength === null || Number.isNaN(strength)) {
    return <Wifi className="h-4 w-4 text-gray-400" />;
  }
  if (strength >= 75) {
    return <Wifi className="h-4 w-4 text-green-500" />;
  }
  if (strength >= 40) {
    return <Wifi className="h-4 w-4 text-amber-500" />;
  }
  return <Wifi className="h-4 w-4 text-red-500" />;
};

// Emits the badge that summarizes the ThingsBoard status for a device.
const deviceStatusBadge = (device: DeviceStatus, isOnline: boolean) => {
  if (!isOnline) {
    return <Badge variant="destructive" className="text-xs">Offline</Badge>;
  }
  switch (device.gameStatus) {
    case 'start':
      return <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Active</Badge>;
    case 'stop':
      return <Badge variant="secondary" className="text-xs">Stopped</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">Idle</Badge>;
  }
};

// Presents the target selection list with per-device connectivity and hit stats.
export const TargetSelectionCard: React.FC<TargetSelectionCardProps> = ({
  loadingDevices,
  isSessionLocked,
  devices,
  targetDetails,
  selectedDeviceIds,
  hitCounts,
  deriveConnectionStatus,
  deriveIsOnline,
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

  React.useEffect(() => {
    // Snap to the top when room-driven ordering pulls a selected target into the lead slot.
    if (devices.length === 0) {
      previousFirstDeviceIdRef.current = null;
      return;
    }

    const firstDeviceId = devices[0]?.deviceId ?? null;
    const previousFirstDeviceId = previousFirstDeviceIdRef.current;
    previousFirstDeviceIdRef.current = firstDeviceId;

    if (
      firstDeviceId &&
      previousFirstDeviceId &&
      previousFirstDeviceId !== firstDeviceId &&
      selectedDeviceIds.includes(firstDeviceId)
    ) {
      const viewport = scrollAreaRef.current?.querySelector(
        '[data-radix-scroll-area-viewport]',
      ) as HTMLDivElement | null;

      viewport?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [devices, selectedDeviceIds]);

  return (
    <Card className={`bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg flex h-full flex-col ${className ?? ''}`}>
      <CardContent className="flex flex-1 flex-col space-y-4 p-4 md:p-5">
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-heading text-lg text-brand-dark">Target Selection</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onSelectAll}
                disabled={isSessionLocked || loadingDevices}
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                disabled={isSessionLocked || (!loadingDevices && selectedDeviceIds.length === 0)}
              >
                Clear
              </Button>
            </div>
          </div>
          <p className="text-xs text-brand-dark/60">
            {selectedCount} selected • {totalOnlineSelectableTargets} online
          </p>
        </div>

        {loadingDevices ? (
          <div className="flex flex-1 items-center justify-center text-sm text-brand-dark/60">
            Refreshing device list...
          </div>
        ) : devices.length === 0 ? (
          <p className="flex-1 text-sm text-brand-dark/60">No ThingsBoard devices found for this tenant.</p>
        ) : (
          <ScrollArea ref={scrollAreaRef} className="flex-1 pr-2 max-h-[280px]">
            <div className="space-y-2">
              {devices.map((device) => {
                const checkboxId = `target-${device.deviceId}`;
                const connectionStatus = deriveConnectionStatus(device);
                const isOnline = connectionStatus !== 'offline';
                const targetRecord = targetDetails.get(device.deviceId);
                const wifiStrength = Math.max(
                  0,
                  Math.round((targetRecord?.wifiStrength ?? device.raw?.wifiStrength ?? device.wifiStrength ?? 0) as number),
                );
                const lastActivityTimestamp =
                  (typeof targetRecord?.lastActivityTime === 'number' ? targetRecord.lastActivityTime : null) ??
                  (typeof device.raw?.lastActivityTime === 'number' ? device.raw.lastActivityTime : null) ??
                  (typeof device.lastSeen === 'number' ? device.lastSeen : 0);
                const connectionLabel =
                  connectionStatus === 'online'
                    ? 'Online'
                    : connectionStatus === 'standby'
                      ? 'Standby'
                      : 'Offline';
                const connectionColor =
                  connectionStatus === 'online'
                    ? 'text-green-600'
                    : connectionStatus === 'standby'
                      ? 'text-amber-600'
                      : 'text-red-600';
                const hits = hitCounts[device.deviceId] ?? device.hitCount ?? 0;
                const isChecked = selectedDeviceIds.includes(device.deviceId);

                return (
                  <div
                    key={device.deviceId}
                    className={`flex items-start justify-between rounded-lg border px-3 py-2 transition-colors overflow-hidden ${
                      isChecked ? 'border-brand-primary/40 bg-brand-primary/5' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={checkboxId}
                        checked={isChecked}
                        disabled={isSessionLocked || !isOnline}
                        onCheckedChange={(value) => onToggleDevice(device.deviceId, Boolean(value))}
                      />
                      <div className="space-y-1 min-w-0">
                        <label htmlFor={checkboxId} className="font-heading text-sm text-brand-dark leading-tight">
                          <span className="block truncate max-w-[180px] text-left">{device.name}</span>
                        </label>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-dark/60">
                          <span className={`flex items-center gap-1 font-medium ${connectionColor}`}>
                            <span className="inline-block h-2 w-2 rounded-full bg-current" />
                            {connectionLabel}
                          </span>
                          <span className="flex items-center gap-1">
                            {wifiIndicator(wifiStrength, connectionStatus)}
                            {wifiStrength}%
                          </span>
                          <span>Hits {hits}</span>
                          <span>{formatLastSeen(lastActivityTimestamp ?? 0)}</span>
                        </div>
                      </div>
                    </div>
                    {deviceStatusBadge(device as DeviceStatus, deriveIsOnline(device))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

// Placeholder while the device roster is refreshing.
export const TargetSelectionSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32 bg-gray-200" />
          <Skeleton className="h-3 w-44 bg-gray-200" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 bg-gray-200 rounded-md" />
          <Skeleton className="h-9 w-16 bg-gray-200 rounded-md" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 bg-gray-200 rounded-sm" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 bg-gray-200" />
                <Skeleton className="h-3 w-40 bg-gray-200" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);
