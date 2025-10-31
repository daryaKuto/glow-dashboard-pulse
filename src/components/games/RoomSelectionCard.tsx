import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <Card className={`bg-gray-50 border-gray-200 shadow-sm rounded-md md:rounded-lg flex h-full flex-col ${className ?? ''}`}>
      <CardContent className="flex flex-1 flex-col space-y-3 p-4 md:p-5">
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-heading text-lg text-brand-dark truncate">Room Selection</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onSelectAllRooms} disabled={isSessionLocked || roomsLoading}>
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={onClearRooms} disabled={isSessionLocked}>
                Clear
              </Button>
            </div>
          </div>
          <p className="text-xs text-brand-dark/60">
            {roomCount} rooms • {totalTargets} targets
          </p>
        </div>

        {roomsLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-brand-dark/60">
            Loading rooms…
          </div>
        ) : roomCount === 0 ? (
          <p className="flex-1 text-sm text-brand-dark/60">No rooms with assigned targets available.</p>
        ) : (
          <ScrollArea className="flex-1 pr-2 max-h-[280px]">
            <div className="space-y-2">
              {rooms.map((room) => {
                const hasSelectedTargets = room.deviceIds.some((id) => selectedDeviceIds.includes(id));
                const isFullySelected = room.deviceIds.every((id) => selectedDeviceIds.includes(id));
                const isActiveRoom = activeRoomId === room.id;
                const isRoomSelected = isActiveRoom ? hasSelectedTargets : isFullySelected;
                const partialSelection = !isRoomSelected && hasSelectedTargets;
                const checkboxState = isRoomSelected ? true : partialSelection ? 'indeterminate' : false;
                return (
                  <div
                    key={room.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                      isActiveRoom
                        ? 'border-brand-primary bg-brand-primary/10 shadow-sm'
                        : isRoomSelected
                          ? 'border-brand-primary/40 bg-brand-primary/5'
                          : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`room-${room.id}`}
                        checked={checkboxState}
                        onCheckedChange={(checked) => onToggleRoomTargets(room.id, Boolean(checked))}
                        disabled={isSessionLocked}
                      />
                      <label htmlFor={`room-${room.id}`} className="cursor-pointer select-none space-y-0.5">
                        <p className="font-medium text-sm text-brand-dark">{room.name}</p>
                        <p className="text-xs text-brand-dark/60">
                          {room.onlineCount}/{room.targetCount} online
                        </p>
                        {isActiveRoom && (
                          <p className="text-[11px] uppercase tracking-wide text-brand-primary/70 font-semibold">
                            Active room
                          </p>
                        )}
                      </label>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onToggleRoomTargets(room.id, !isRoomSelected)}
                      disabled={isSessionLocked}
                    >
                      {isRoomSelected ? 'Remove' : 'Select'}
                    </Button>
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

export const RoomSelectionSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg flex h-full flex-col">
    <CardContent className="flex flex-1 flex-col space-y-3 p-4 md:p-5">
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-5 w-36 bg-gray-200" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-md bg-gray-200" />
            <Skeleton className="h-9 w-24 rounded-md bg-gray-200" />
          </div>
        </div>
        <Skeleton className="h-3 w-36 bg-gray-200" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-sm bg-gray-200" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28 bg-gray-200" />
                <Skeleton className="h-3 w-20 bg-gray-200" />
              </div>
            </div>
            <Skeleton className="h-8 w-20 rounded-md bg-gray-200" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);
