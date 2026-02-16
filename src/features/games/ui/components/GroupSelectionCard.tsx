import React from 'react';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface GroupSelection {
  id: string;
  name: string;
  deviceIds: string[];
  targetCount: number;
  onlineCount: number;
}

interface GroupSelectionCardProps {
  groupsLoading: boolean;
  groups: GroupSelection[];
  selectedDeviceIds: string[];
  isSessionLocked: boolean;
  activeGroupId?: string | null;
  onSelectAllGroups: () => void;
  onClearGroups: () => void;
  onToggleGroupTargets: (groupId: string, checked: boolean) => void;
  className?: string;
}

// Lists available groups along with quick-select controls for bulk toggling session targets.
export const GroupSelectionCard: React.FC<GroupSelectionCardProps> = ({
  groupsLoading,
  groups,
  selectedDeviceIds,
  isSessionLocked,
  activeGroupId = null,
  onSelectAllGroups,
  onClearGroups,
  onToggleGroupTargets,
  className,
}) => {
  const groupCount = groups.length;
  const totalTargets = groups.reduce((sum, group) => sum + group.targetCount, 0);

  return (
    <div className={`rounded-[var(--radius-lg)] bg-white p-4 ${className ?? ''}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-primary" />
          <span className="text-label text-brand-secondary uppercase tracking-wide font-body">
            Groups
          </span>
          <span className="text-[10px] text-brand-dark/40 font-body">
            {groupCount} groups · {totalTargets} targets
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="text-xs text-brand-primary h-7 px-2"
            onClick={onSelectAllGroups} disabled={isSessionLocked || groupsLoading}>
            Select All
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-brand-dark/40 h-7 px-2"
            onClick={onClearGroups} disabled={isSessionLocked}>
            Clear
          </Button>
        </div>
      </div>

      {/* Content */}
      {groupsLoading ? (
        <div className="flex items-center justify-center py-6 text-sm text-brand-dark/40 font-body">
          Loading groups…
        </div>
      ) : groupCount === 0 ? (
        <p className="text-sm text-brand-dark/40 font-body text-center py-6">
          No groups with assigned targets available.
        </p>
      ) : (
        <div className="max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-brand-secondary/20 space-y-1.5">
          {groups.map((group) => {
            const hasSelectedTargets = group.deviceIds.some((id) => selectedDeviceIds.includes(id));
            const isFullySelected = group.deviceIds.every((id) => selectedDeviceIds.includes(id));
            const isActiveGroup = activeGroupId === group.id;
            const isGroupSelected = isActiveGroup ? hasSelectedTargets : isFullySelected;

            return (
              <button
                key={group.id}
                onClick={() => onToggleGroupTargets(group.id, !isGroupSelected)}
                disabled={isSessionLocked}
                className={`flex items-center gap-3 w-full text-left rounded-[var(--radius)] px-3 py-2.5 transition-colors duration-200 ${
                  isGroupSelected
                    ? 'bg-[rgba(206,62,10,0.05)] border-l-[3px] border-brand-primary'
                    : 'bg-white hover:bg-brand-light'
                }`}
              >
                {/* Radio indicator */}
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isGroupSelected ? 'border-brand-primary bg-brand-primary' : 'border-brand-dark/20 bg-transparent'
                }`}>
                  {isGroupSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                {/* Group info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-brand-dark font-body truncate">{group.name}</p>
                  <p className="text-xs text-brand-dark/50 font-body">
                    {group.onlineCount}/{group.targetCount} available
                  </p>
                </div>
                {isActiveGroup && (
                  <span className="text-[10px] uppercase tracking-wide text-brand-primary font-semibold font-body shrink-0">
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const GroupSelectionSkeleton: React.FC = () => (
  <div className="rounded-[var(--radius-lg)] bg-white p-4">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded bg-gray-200" />
        <Skeleton className="h-3 w-16 bg-gray-200" />
      </div>
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-7 w-16 rounded-full bg-gray-200" />
        <Skeleton className="h-7 w-12 rounded-full bg-gray-200" />
      </div>
    </div>
    <div className="space-y-1.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[var(--radius)] bg-white px-3 py-2.5">
          <Skeleton className="h-4 w-4 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-28 bg-gray-200" />
            <Skeleton className="h-3 w-20 bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  </div>
);
