import React from 'react';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface RoomSelection {
  id: string;
  name: string;
  deviceIds: string[];
  targetCount: number;
  onlineCount: number;
}

interface RoomSelectionCardProps {
  roomsLoading: boolean;
  rooms: RoomSelection[];
  selectedDeviceIds: string[];
  isSessionLocked: boolean;
  activeRoomId?: string | null;
  onSelectAllRooms: () => void;
  onClearRooms: () => void;
  onToggleRoomTargets: (roomId: string, checked: boolean) => void;
  className?: string;
}

// Lists available rooms along with quick-select controls for bulk toggling session targets.
export const RoomSelectionCard: React.FC<RoomSelectionCardProps> = ({
  roomsLoading,
  rooms,
  selectedDeviceIds,
  isSessionLocked,
  activeRoomId = null,
  onSelectAllRooms,
  onClearRooms,
  onToggleRoomTargets,
  className,
}) => {
  const roomCount = rooms.length;
  const totalTargets = rooms.reduce((sum, room) => sum + room.targetCount, 0);

  return (
    <div className={`rounded-[var(--radius-lg)] bg-white p-4 ${className ?? ''}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-brand-primary" />
          <span className="text-label text-brand-secondary uppercase tracking-wide font-body">
            Rooms
          </span>
          <span className="text-[10px] text-brand-dark/40 font-body">
            {roomCount} rooms · {totalTargets} targets
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="text-xs text-brand-primary h-7 px-2"
            onClick={onSelectAllRooms} disabled={isSessionLocked || roomsLoading}>
            Select All
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-brand-dark/40 h-7 px-2"
            onClick={onClearRooms} disabled={isSessionLocked}>
            Clear
          </Button>
        </div>
      </div>

      {/* Content */}
      {roomsLoading ? (
        <div className="flex items-center justify-center py-6 text-sm text-brand-dark/40 font-body">
          Loading rooms…
        </div>
      ) : roomCount === 0 ? (
        <p className="text-sm text-brand-dark/40 font-body text-center py-6">
          No rooms with assigned targets available.
        </p>
      ) : (
        <div className="max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-brand-secondary/20 space-y-1.5">
          {rooms.map((room) => {
            const hasSelectedTargets = room.deviceIds.some((id) => selectedDeviceIds.includes(id));
            const isFullySelected = room.deviceIds.every((id) => selectedDeviceIds.includes(id));
            const isActiveRoom = activeRoomId === room.id;
            const isRoomSelected = isActiveRoom ? hasSelectedTargets : isFullySelected;

            return (
              <button
                key={room.id}
                onClick={() => onToggleRoomTargets(room.id, !isRoomSelected)}
                disabled={isSessionLocked}
                className={`flex items-center gap-3 w-full text-left rounded-[var(--radius)] px-3 py-2.5 transition-colors duration-200 ${
                  isRoomSelected
                    ? 'bg-[rgba(206,62,10,0.05)] border-l-[3px] border-brand-primary'
                    : 'bg-white hover:bg-brand-light'
                }`}
              >
                {/* Radio indicator */}
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isRoomSelected ? 'border-brand-primary bg-brand-primary' : 'border-brand-dark/20 bg-transparent'
                }`}>
                  {isRoomSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                {/* Room info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-brand-dark font-body truncate">{room.name}</p>
                  <p className="text-xs text-brand-dark/50 font-body">
                    {room.onlineCount}/{room.targetCount} available
                  </p>
                </div>
                {isActiveRoom && (
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

export const RoomSelectionSkeleton: React.FC = () => (
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
