import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { RoomSelectionCard } from './RoomSelectionCard';
import { GroupSelectionCard } from './GroupSelectionCard';
import { TargetSelectionCard } from './TargetSelectionCard';
import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';
import type { Target } from '@/features/targets/schema';

export type SetupStepOneProps = {
  // Room selection
  roomsLoading: boolean;
  roomSelections: Array<{
    id: string;
    name: string;
    deviceIds: string[];
    targetCount: number;
    onlineCount: number;
  }>;
  sessionRoomId: string | null;
  onSelectAllRooms: () => void;
  onClearRoomSelection: () => void;
  onToggleRoomTargets: (roomId: string, checked: boolean) => void;

  // Group selection
  groupsLoading: boolean;
  groupSelections: Array<{
    id: string;
    name: string;
    deviceIds: string[];
    targetCount: number;
    onlineCount: number;
  }>;
  sessionGroupId: string | null;
  onSelectAllGroups: () => void;
  onClearGroupSelection: () => void;
  onToggleGroupTargets: (groupId: string, checked: boolean) => void;

  // Target selection
  loadingDevices: boolean;
  isSessionLocked: boolean;
  orderedAvailableDevices: NormalizedGameDevice[];
  targetById: Map<string, Target>;
  selectedDeviceIds: string[];
  hitCounts: Record<string, number>;
  formatLastSeen: (timestamp: number) => string;
  onToggleDeviceSelection: (deviceId: string, checked: boolean) => void;
  onSelectAllDevices: () => void;
  onClearDeviceSelection: () => void;
  displayedSelectedCount: number;
  totalOnlineSelectableTargets: number;
};

// Displays the Step 1 setup card: room/group/target selection in a 3-column grid.
const _SetupStepOne: React.FC<SetupStepOneProps> = ({
  roomsLoading,
  roomSelections,
  sessionRoomId,
  onSelectAllRooms,
  onClearRoomSelection,
  onToggleRoomTargets,
  groupsLoading,
  groupSelections,
  sessionGroupId,
  onSelectAllGroups,
  onClearGroupSelection,
  onToggleGroupTargets,
  loadingDevices,
  isSessionLocked,
  orderedAvailableDevices,
  targetById,
  selectedDeviceIds,
  hitCounts,
  formatLastSeen,
  onToggleDeviceSelection,
  onSelectAllDevices,
  onClearDeviceSelection,
  displayedSelectedCount,
  totalOnlineSelectableTargets,
}) => {
  return (
    <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
      <CardContent className="p-[10px] space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-semibold text-brand-primary">
              Step 1
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">
              Targets & Room
            </span>
          </div>
          <h2 className="font-heading text-lg text-brand-dark text-left">Select targets, group, or room</h2>
          <p className="text-xs text-brand-dark/60 text-left">Choose at least one online or standby target to continue.</p>
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 md:items-start">
            <div className="h-full">
              <RoomSelectionCard
                roomsLoading={roomsLoading}
                rooms={roomSelections}
                selectedDeviceIds={selectedDeviceIds}
                isSessionLocked={isSessionLocked}
                activeRoomId={sessionRoomId}
                onSelectAllRooms={onSelectAllRooms}
                onClearRooms={onClearRoomSelection}
                onToggleRoomTargets={onToggleRoomTargets}
                className="h-full"
              />
            </div>
            <div className="h-full">
              <GroupSelectionCard
                groupsLoading={groupsLoading}
                groups={groupSelections}
                selectedDeviceIds={selectedDeviceIds}
                isSessionLocked={isSessionLocked}
                activeGroupId={sessionGroupId}
                onSelectAllGroups={onSelectAllGroups}
                onClearGroups={onClearGroupSelection}
                onToggleGroupTargets={onToggleGroupTargets}
                className="h-full"
              />
            </div>
            <div className="h-full">
              <TargetSelectionCard
                loadingDevices={loadingDevices}
                isSessionLocked={isSessionLocked}
                devices={orderedAvailableDevices}
                targetDetails={targetById}
                selectedDeviceIds={selectedDeviceIds}
                hitCounts={hitCounts}
                formatLastSeen={formatLastSeen}
                onToggleDevice={onToggleDeviceSelection}
                onSelectAll={onSelectAllDevices}
                onClearSelection={onClearDeviceSelection}
                selectedCount={displayedSelectedCount}
                totalOnlineSelectableTargets={totalOnlineSelectableTargets}
                className="h-full"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const SetupStepOne = React.memo(_SetupStepOne);
SetupStepOne.displayName = 'SetupStepOne';
