import { useState, useCallback, useMemo, useRef } from 'react';
import type { NormalizedGameDevice } from './use-game-devices';
import type { EdgeRoom } from '@/features/rooms';
import type { TargetGroup } from '@/features/targets';
import { deriveConnectionStatus, deriveIsOnline } from '@/features/games/lib/device-status-utils';

export interface RoomSelection {
  id: string;
  name: string;
  deviceIds: string[];
  targetCount: number;
  onlineCount: number;
}

export interface GroupSelection {
  id: string;
  name: string;
  deviceIds: string[];
  targetCount: number;
  onlineCount: number;
}

interface UseDeviceSelectionOptions {
  availableDevices: NormalizedGameDevice[];
  rooms: EdgeRoom[];
  groups: TargetGroup[];
  onSelectionChange?: () => void;
}

interface UseDeviceSelectionReturn {
  // State
  selectedDeviceIds: string[];
  sessionRoomId: string | null;
  sessionGroupId: string | null;

  // Computed
  availableDeviceMap: Map<string, NormalizedGameDevice>;
  roomSelections: RoomSelection[];
  groupSelections: GroupSelection[];
  orderedAvailableDevices: NormalizedGameDevice[];
  selectedOnlineDevices: number;
  totalOnlineSelectableTargets: number;

  // Handlers
  handleToggleDeviceSelection: (deviceId: string, checked: boolean) => void;
  handleSelectAllDevices: () => void;
  handleClearDeviceSelection: () => void;
  handleToggleRoomTargets: (roomId: string, checked: boolean) => void;
  handleSelectAllRooms: () => void;
  handleClearRoomSelection: () => void;
  handleToggleGroupTargets: (groupId: string, checked: boolean) => void;
  handleSelectAllGroups: () => void;
  handleClearGroupSelection: () => void;

  // Setters for external use
  setSelectedDeviceIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSessionRoomId: React.Dispatch<React.SetStateAction<string | null>>;
  setSessionGroupId: React.Dispatch<React.SetStateAction<string | null>>;

  // Refs
  selectionManuallyModifiedRef: React.MutableRefObject<boolean>;
}

export function useDeviceSelection(options: UseDeviceSelectionOptions): UseDeviceSelectionReturn {
  const { availableDevices, rooms, groups, onSelectionChange } = options;

  // State
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [sessionRoomId, setSessionRoomId] = useState<string | null>(null);
  const [sessionGroupId, setSessionGroupId] = useState<string | null>(null);

  // Refs
  const selectionManuallyModifiedRef = useRef(false);
  const availableDevicesRef = useRef<NormalizedGameDevice[]>([]);
  availableDevicesRef.current = availableDevices;

  // ---------- Computed ----------

  const availableDeviceMap = useMemo(() => {
    const map = new Map<string, NormalizedGameDevice>();
    availableDevices.forEach((device) => {
      map.set(device.deviceId, device);
    });
    return map;
  }, [availableDevices]);

  const roomSelections = useMemo(() => {
    return rooms
      .map((room) => {
        const targets = Array.isArray(room.targets) ? room.targets : [];
        const deviceIds = targets
          .map((target) => target.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        if (deviceIds.length === 0) {
          return null;
        }
        let onlineCount = 0;
        deviceIds.forEach((deviceId) => {
          const device = availableDeviceMap.get(deviceId);
          if (device && deriveConnectionStatus(device) !== 'offline') {
            onlineCount += 1;
          }
        });
        return {
          id: room.id,
          name: room.name,
          deviceIds,
          targetCount: deviceIds.length,
          onlineCount,
        };
      })
      .filter((room): room is RoomSelection => room !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rooms, availableDeviceMap]);

  const groupSelections = useMemo(() => {
    return groups
      .map((group) => {
        const targets = Array.isArray(group.targets) ? group.targets : [];
        const deviceIds = targets
          .map((target) => target.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        if (deviceIds.length === 0) {
          return null;
        }
        let onlineCount = 0;
        deviceIds.forEach((deviceId) => {
          const device = availableDeviceMap.get(deviceId);
          if (device && deriveConnectionStatus(device) !== 'offline') {
            onlineCount += 1;
          }
        });
        return {
          id: group.id,
          name: group.name,
          deviceIds,
          targetCount: deviceIds.length,
          onlineCount,
        };
      })
      .filter((group): group is GroupSelection => group !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groups, availableDeviceMap]);

  const selectedOnlineDevices = useMemo(() => {
    if (selectedDeviceIds.length === 0) {
      return 0;
    }

    return selectedDeviceIds.filter((id) => {
      const device = availableDevices.find((item) => item.deviceId === id);
      return device ? deriveIsOnline(device) : false;
    }).length;
  }, [availableDevices, selectedDeviceIds]);

  const totalOnlineSelectableTargets = useMemo(() => {
    return availableDevices.filter((device) => deriveIsOnline(device)).length;
  }, [availableDevices]);

  const orderedAvailableDevices = useMemo(() => {
    const selectedIdSet = new Set(selectedDeviceIds);

    const selectedDevicesOrdered = availableDevices.filter((device) => selectedIdSet.has(device.deviceId));

    if (!sessionRoomId) {
      const remainingDevices = availableDevices.filter((device) => !selectedIdSet.has(device.deviceId));
      return [...selectedDevicesOrdered, ...remainingDevices];
    }

    const selectedRoom = roomSelections.find((room) => room.id === sessionRoomId);
    if (!selectedRoom) {
      const remainingDevices = availableDevices.filter((device) => !selectedIdSet.has(device.deviceId));
      return [...selectedDevicesOrdered, ...remainingDevices];
    }

    const prioritizedIds = new Set(selectedRoom.deviceIds);
    const remainingDevices = availableDevices.filter((device) => !selectedIdSet.has(device.deviceId));
    const inRoom = remainingDevices.filter((device) => prioritizedIds.has(device.deviceId));
    const notInRoom = remainingDevices.filter((device) => !prioritizedIds.has(device.deviceId));

    return [...selectedDevicesOrdered, ...inRoom, ...notInRoom];
  }, [availableDevices, roomSelections, sessionRoomId, selectedDeviceIds]);

  // ---------- Handlers ----------

  const handleToggleDeviceSelection = useCallback(
    (deviceId: string, checked: boolean) => {
      selectionManuallyModifiedRef.current = true;
      onSelectionChange?.();
      setSelectedDeviceIds((prev) => {
        let next: string[];
        if (checked) {
          next = prev.includes(deviceId) ? prev : [...prev, deviceId];
        } else {
          next = prev.filter((id) => id !== deviceId);
        }

        setSessionRoomId((currentRoomId) => {
          if (!currentRoomId) {
            return null;
          }
          const currentRoom = roomSelections.find((room) => room.id === currentRoomId);
          if (!currentRoom) {
            return null;
          }
          const hasAnySelected = currentRoom.deviceIds.some((id) => next.includes(id));
          return hasAnySelected ? currentRoomId : null;
        });

        setSessionGroupId((currentGroupId) => {
          if (!currentGroupId) {
            return null;
          }
          const currentGroup = groupSelections.find((group) => group.id === currentGroupId);
          if (!currentGroup) {
            return null;
          }
          const hasAnySelected = currentGroup.deviceIds.some((id) => next.includes(id));
          return hasAnySelected ? currentGroupId : null;
        });

        return next;
      });
    },
    [roomSelections, groupSelections, onSelectionChange],
  );

  const handleSelectAllDevices = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    setSessionRoomId(null);
    setSessionGroupId(null);
    onSelectionChange?.();
    const next = availableDevicesRef.current
      .filter((device) => deriveIsOnline(device))
      .map((device) => device.deviceId);
    setSelectedDeviceIds(next);
  }, [onSelectionChange]);

  const handleClearDeviceSelection = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    setSessionRoomId(null);
    setSessionGroupId(null);
    onSelectionChange?.();
    setSelectedDeviceIds([]);
  }, [onSelectionChange]);

  const handleToggleRoomTargets = useCallback(
    (roomId: string, checked: boolean) => {
      selectionManuallyModifiedRef.current = true;
      onSelectionChange?.();
      const room = roomSelections.find((entry) => entry.id === roomId);
      if (!room) {
        return;
      }
      const roomDeviceIds = room.deviceIds;
      if (roomDeviceIds.length === 0) {
        return;
      }
      setSelectedDeviceIds((prev) => {
        if (checked) {
          const merged = new Set(prev);
          roomDeviceIds.forEach((id) => merged.add(id));
          return Array.from(merged);
        }
        const deviceIdsToRemove = new Set(roomDeviceIds);
        return prev.filter((id) => !deviceIdsToRemove.has(id));
      });
      if (checked) {
        setSessionRoomId(roomId);
        setSessionGroupId(null); // Clear group selection when room is selected
      } else if (sessionRoomId === roomId) {
        setSessionRoomId(null);
      }
    },
    [roomSelections, sessionRoomId, onSelectionChange],
  );

  const handleSelectAllRooms = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    setSessionRoomId(null);
    setSessionGroupId(null);
    onSelectionChange?.();
    const roomDeviceIds = roomSelections.flatMap((room) => room.deviceIds);
    if (roomDeviceIds.length === 0) {
      return;
    }
    setSelectedDeviceIds((prev) => Array.from(new Set([...prev, ...roomDeviceIds])));
  }, [roomSelections, onSelectionChange]);

  const handleClearRoomSelection = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    setSessionRoomId(null);
    setSessionGroupId(null);
    onSelectionChange?.();
    const roomDeviceIds = roomSelections.flatMap((room) => room.deviceIds);
    if (roomDeviceIds.length === 0) {
      return;
    }
    const deviceIdsToRemove = new Set(roomDeviceIds);
    setSelectedDeviceIds((prev) => prev.filter((id) => !deviceIdsToRemove.has(id)));
  }, [roomSelections, onSelectionChange]);

  const handleToggleGroupTargets = useCallback(
    (groupId: string, checked: boolean) => {
      selectionManuallyModifiedRef.current = true;
      onSelectionChange?.();
      const group = groupSelections.find((entry) => entry.id === groupId);
      if (!group) {
        return;
      }
      const groupDeviceIds = group.deviceIds;
      if (groupDeviceIds.length === 0) {
        return;
      }
      setSelectedDeviceIds((prev) => {
        if (checked) {
          const merged = new Set(prev);
          groupDeviceIds.forEach((id) => merged.add(id));
          return Array.from(merged);
        }
        const deviceIdsToRemove = new Set(groupDeviceIds);
        return prev.filter((id) => !deviceIdsToRemove.has(id));
      });
      if (checked) {
        setSessionGroupId(groupId);
        setSessionRoomId(null); // Clear room selection when group is selected
      } else if (sessionGroupId === groupId) {
        setSessionGroupId(null);
      }
    },
    [groupSelections, sessionGroupId, onSelectionChange],
  );

  const handleSelectAllGroups = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    setSessionGroupId(null);
    setSessionRoomId(null);
    onSelectionChange?.();
    const groupDeviceIds = groupSelections.flatMap((group) => group.deviceIds);
    if (groupDeviceIds.length === 0) {
      return;
    }
    setSelectedDeviceIds((prev) => Array.from(new Set([...prev, ...groupDeviceIds])));
  }, [groupSelections, onSelectionChange]);

  const handleClearGroupSelection = useCallback(() => {
    selectionManuallyModifiedRef.current = true;
    setSessionGroupId(null);
    onSelectionChange?.();
    const groupDeviceIds = groupSelections.flatMap((group) => group.deviceIds);
    if (groupDeviceIds.length === 0) {
      return;
    }
    const deviceIdsToRemove = new Set(groupDeviceIds);
    setSelectedDeviceIds((prev) => prev.filter((id) => !deviceIdsToRemove.has(id)));
  }, [groupSelections, onSelectionChange]);

  return {
    selectedDeviceIds,
    sessionRoomId,
    sessionGroupId,
    availableDeviceMap,
    roomSelections,
    groupSelections,
    orderedAvailableDevices,
    selectedOnlineDevices,
    totalOnlineSelectableTargets,
    handleToggleDeviceSelection,
    handleSelectAllDevices,
    handleClearDeviceSelection,
    handleToggleRoomTargets,
    handleSelectAllRooms,
    handleClearRoomSelection,
    handleToggleGroupTargets,
    handleSelectAllGroups,
    handleClearGroupSelection,
    setSelectedDeviceIds,
    setSessionRoomId,
    setSessionGroupId,
    selectionManuallyModifiedRef,
  };
}
