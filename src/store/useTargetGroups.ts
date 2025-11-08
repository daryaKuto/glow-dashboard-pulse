import { create } from 'zustand';
import { supabaseTargetGroupsService, type UserTargetGroup, type CreateGroupData, type GroupWithTargets } from '@/services/supabase-target-groups';
import { useTargets, type Target } from '@/store/useTargets';
import { toast } from "@/components/ui/sonner";

export type Group = {
  id: string;
  name: string;
  roomId?: string | null;
  targetCount: number;
  targets?: Target[];
};

interface TargetGroupsState {
  groups: Group[];
  isLoading: boolean;
  error: string | null;
  fetchGroups: () => Promise<void>;
  createGroup: (groupData: CreateGroupData) => Promise<void>;
  updateGroup: (id: string, updates: Partial<CreateGroupData>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  assignTargetsToGroup: (groupId: string, targetIds: string[]) => Promise<void>;
  unassignTargetsFromGroup: (groupId: string, targetIds: string[]) => Promise<void>;
  assignGroupToRoom: (groupId: string, roomId: string | null) => Promise<void>;
  getGroupTargets: (groupId: string) => Promise<Target[]>;
  getAllGroupsWithAssignments: (forceRefresh?: boolean) => Promise<GroupWithTargets[]>;
  setGroups: (groups: Group[]) => void;
}

export const useTargetGroups = create<TargetGroupsState>((set, get) => ({
  groups: [],
  isLoading: false,
  error: null,
  
  fetchGroups: async () => {
    set({ isLoading: true, error: null });
    try {
      const groupsWithTargets = await supabaseTargetGroupsService.getAllGroupsWithAssignments(true);

      const groups: Group[] = groupsWithTargets.map(group => ({
        id: group.id,
        name: group.name,
        roomId: group.room_id || null,
        targetCount: group.target_count || 0,
        targets: group.targets,
      }));

      set({ groups, isLoading: false, error: null });
    } catch (error) {
      console.error('❌ useTargetGroups: Error fetching groups:', error);
      
      set({ 
        groups: [],
        error: error instanceof Error ? error.message : 'Failed to fetch groups',
        isLoading: false 
      });
      
      toast.error('Failed to load groups from database');
    }
  },
  
  createGroup: async (groupData: CreateGroupData) => {
    try {
      if (groupData.targetIds.length < 2) {
        toast.error('A group must have at least 2 targets');
        return;
      }

      await supabaseTargetGroupsService.createGroup(groupData);

      await get().fetchGroups();

      const targetsStore = useTargets.getState();
      targetsStore.clearCache();
      await targetsStore.refresh();

      toast.success('Group created successfully');
    } catch (error) {
      console.error('Error creating group:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create group';
      toast.error(errorMessage);
    }
  },
  
  updateGroup: async (id: string, updates: Partial<CreateGroupData>) => {
    try {
      if (updates.targetIds !== undefined && updates.targetIds.length < 2) {
        toast.error('A group must have at least 2 targets');
        return;
      }

      await supabaseTargetGroupsService.updateGroup(id, updates);
      
      // Update the group in state
      set(state => ({
        groups: state.groups.map(group => 
          group.id === id ? { ...group, ...updates } : group
        )
      }));

      await get().fetchGroups();

      const targetsStore = useTargets.getState();
      targetsStore.clearCache();
      try {
        await targetsStore.refresh();
      } catch (error) {
        console.warn('⚠️ useTargetGroups: Failed to refresh targets after group update', error);
      }
      
      toast.success('Group updated successfully');
    } catch (error) {
      console.error('Error updating group:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update group';
      toast.error(errorMessage);
    }
  },
  
  deleteGroup: async (id: string) => {
    try {
      await supabaseTargetGroupsService.deleteGroup(id);
      
      // Remove the group from state
      set(state => ({
        groups: state.groups.filter(group => group.id !== id)
      }));

      const targetsStore = useTargets.getState();
      targetsStore.clearCache();
      try {
        await targetsStore.refresh();
      } catch (error) {
        console.warn('⚠️ useTargetGroups: Failed to refresh targets after group deletion', error);
      }
      
      toast.success('Group deleted successfully');
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group');
    }
  },
  
  assignTargetsToGroup: async (groupId: string, targetIds: string[]) => {
    try {
      await supabaseTargetGroupsService.assignTargetsToGroup(groupId, targetIds);
      
      await get().fetchGroups();

      const targetsStore = useTargets.getState();
      targetsStore.clearCache();
      try {
        await targetsStore.refresh();
      } catch (error) {
        console.warn('⚠️ useTargetGroups: Failed to refresh targets after assignment', error);
      }
      
      toast.success(`${targetIds.length} target${targetIds.length > 1 ? 's' : ''} assigned to group successfully`);
    } catch (error) {
      console.error('Error assigning targets to group:', error);
      toast.error('Failed to assign targets to group');
      throw error;
    }
  },
  
  unassignTargetsFromGroup: async (groupId: string, targetIds: string[]) => {
    try {
      await supabaseTargetGroupsService.unassignTargetsFromGroup(groupId, targetIds);
      
      await get().fetchGroups();

      const targetsStore = useTargets.getState();
      targetsStore.clearCache();
      try {
        await targetsStore.refresh();
      } catch (error) {
        console.warn('⚠️ useTargetGroups: Failed to refresh targets after unassignment', error);
      }
      
      toast.success(`${targetIds.length} target${targetIds.length > 1 ? 's' : ''} unassigned from group successfully`);
    } catch (error) {
      console.error('Error unassigning targets from group:', error);
      toast.error('Failed to unassign targets from group');
      throw error;
    }
  },
  
  assignGroupToRoom: async (groupId: string, roomId: string | null) => {
    try {
      await supabaseTargetGroupsService.assignGroupToRoom(groupId, roomId);
      
      // Update the group in state
      set(state => ({
        groups: state.groups.map(group => 
          group.id === groupId ? { ...group, roomId } : group
        )
      }));

      await get().fetchGroups();
      
      toast.success(`Group ${roomId === null ? 'unassigned from' : 'assigned to'} room successfully`);
    } catch (error) {
      console.error('Error assigning group to room:', error);
      toast.error(`Failed to ${roomId === null ? 'unassign group from' : 'assign group to'} room`);
      throw error;
    }
  },
  
  getGroupTargets: async (groupId: string) => {
    try {
      const state = get();
      const group = state.groups.find(g => g.id === groupId);
      if (group?.targets) {
        return group.targets;
      }
      await state.fetchGroups();
      return get().groups.find(g => g.id === groupId)?.targets ?? [];
    } catch (error) {
      console.error('Error fetching group targets:', error);
      return [];
    }
  },

  getAllGroupsWithAssignments: async (forceRefresh: boolean = false) => {
    try {
      if (forceRefresh || get().groups.length === 0) {
        await get().fetchGroups();
      }

      const groupsWithTargets = await supabaseTargetGroupsService.getAllGroupsWithAssignments(forceRefresh);
      return groupsWithTargets;
    } catch (error) {
      console.error('❌ [ERROR] State: Error fetching groups with assignments:', error);
      return [];
    }
  },

  setGroups: (groups: Group[]) => {
    set({ groups, isLoading: false, error: null });
  }
}));

