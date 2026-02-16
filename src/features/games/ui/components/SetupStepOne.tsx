import React, { useState, useMemo } from 'react';
import { RoomSelectionCard } from './RoomSelectionCard';
import { GroupSelectionCard } from './GroupSelectionCard';
import { TargetSelectionCard } from './TargetSelectionCard';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';
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

  // Warning state: preset was applied but none of its targets are available
  presetTargetWarning?: boolean;
  onRefreshDevices?: () => void;
};

type TabKey = 'Rooms' | 'Groups' | 'Targets';

// Step 1 content: tabbed room/group/target selection.
// Rendered inside the SetupStep accordion wrapper in games-page.tsx.
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
  presetTargetWarning,
  onRefreshDevices,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>(
    roomSelections.length > 0 ? 'Rooms' : 'Targets'
  );

  const tabCounts = useMemo(() => {
    // Count how many selected devices belong to each category
    const roomSelectedCount = roomSelections.reduce((count, room) => {
      const allSelected = room.deviceIds.every((id) => selectedDeviceIds.includes(id));
      return count + (allSelected ? 1 : 0);
    }, 0);
    const groupSelectedCount = groupSelections.reduce((count, group) => {
      const allSelected = group.deviceIds.every((id) => selectedDeviceIds.includes(id));
      return count + (allSelected ? 1 : 0);
    }, 0);
    return {
      Rooms: roomSelectedCount,
      Groups: groupSelectedCount,
      Targets: displayedSelectedCount,
    };
  }, [roomSelections, groupSelections, selectedDeviceIds, displayedSelectedCount]);

  const tabs: TabKey[] = ['Rooms', 'Groups', 'Targets'];

  return (
    <div>
      {/* Preset target warning */}
      {presetTargetWarning && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-brand-primary/30 bg-brand-primary/[0.04] p-3">
          <AlertTriangle className="h-4 w-4 text-brand-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-brand-dark font-body">
              Preset targets aren't available
            </p>
            <p className="text-xs text-brand-dark/60 font-body mt-0.5">
              Select different targets below or refresh your devices.
            </p>
          </div>
          {onRefreshDevices && (
            <button
              onClick={onRefreshDevices}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium font-body text-brand-primary hover:bg-brand-primary/[0.08] transition-colors shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-brand-light rounded-full p-1 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium font-body transition-all duration-200 ${
              activeTab === tab
                ? 'bg-brand-primary text-white'
                : 'text-brand-dark/60 hover:text-brand-dark'
            }`}
          >
            {tab}
            {tabCounts[tab] > 0 && activeTab !== tab && (
              <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'Rooms' && (
            <RoomSelectionCard
              roomsLoading={roomsLoading}
              rooms={roomSelections}
              selectedDeviceIds={selectedDeviceIds}
              isSessionLocked={isSessionLocked}
              activeRoomId={sessionRoomId}
              onSelectAllRooms={onSelectAllRooms}
              onClearRooms={onClearRoomSelection}
              onToggleRoomTargets={onToggleRoomTargets}
            />
          )}
          {activeTab === 'Groups' && (
            <GroupSelectionCard
              groupsLoading={groupsLoading}
              groups={groupSelections}
              selectedDeviceIds={selectedDeviceIds}
              isSessionLocked={isSessionLocked}
              activeGroupId={sessionGroupId}
              onSelectAllGroups={onSelectAllGroups}
              onClearGroups={onClearGroupSelection}
              onToggleGroupTargets={onToggleGroupTargets}
            />
          )}
          {activeTab === 'Targets' && (
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
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export const SetupStepOne = React.memo(_SetupStepOne);
SetupStepOne.displayName = 'SetupStepOne';
