import { supabase } from '@/data/supabase-client';
import { fetchTargetsWithTelemetry } from '@/lib/edge';
import type { Target } from '@/features/targets/schema';

export interface UserTargetGroup {
  id: string;
  name: string;
  room_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  target_count?: number; // Calculated field
}

export interface UserTargetGroupAssignment {
  id: string;
  user_id: string;
  group_id: string;
  target_id: string;
  target_name: string;
  assigned_at: string;
  created_at: string;
}

export interface CreateGroupData {
  name: string;
  roomId?: string | null;
  targetIds: string[];
}

export interface GroupWithTargets extends UserTargetGroup {
  targets?: Target[];
}

class SupabaseTargetGroupsService {
  // Cache for getAllGroupsWithAssignments with 30 second TTL
  private groupsWithAssignmentsCache: {
    data: GroupWithTargets[] | null;
    timestamp: number;
    userId: string | null;
  } = {
    data: null,
    timestamp: 0,
    userId: null
  };
  
  private readonly CACHE_TTL = 30000; // 30 seconds

  // Get current user ID
  private async getCurrentUserId(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Supabase auth error:', error);
      throw new Error(`Authentication error: ${error.message}`);
    }
    
    if (!user) {
      console.error('❌ No user found in Supabase session');
      throw new Error('No authenticated user found');
    }
    return user.id;
  }

  // Clear cache when mutations occur
  private clearGroupsCache(): void {
    console.log('🧹 [CACHE] Clearing groups with assignments cache');
    this.groupsWithAssignmentsCache = {
      data: null,
      timestamp: 0,
      userId: null
    };
  }

  // Check if cache is valid for current user
  private isCacheValid(userId: string): boolean {
    const now = Date.now();
    const cacheAge = now - this.groupsWithAssignmentsCache.timestamp;
    const isValid = this.groupsWithAssignmentsCache.data !== null &&
                   this.groupsWithAssignmentsCache.userId === userId &&
                   cacheAge < this.CACHE_TTL;
    
    return isValid;
  }

  // Helper function to extract target ID
  private getTargetId(target: any): string {
    if (target.id?.id) return target.id.id;
    if (target.id) return target.id;
    return 'unknown';
  }

  // Fetch latest targets from edge
  private async fetchLatestTargets(force = false): Promise<Target[]> {
    try {
      const { targets } = await fetchTargetsWithTelemetry(force);
      return targets;
    } catch (error) {
      console.warn('⚠️ [CACHE] Unable to fetch latest targets snapshot:', error);
      return [];
    }
  }

  // Get all user groups with target counts
  async getUserGroups(): Promise<UserTargetGroup[]> {
    try {
      const userId = await this.getCurrentUserId();
      
      // Get groups with target counts
      const { data: groups, error } = await supabase
        .from('user_target_groups')
        .select(`
          *,
          user_target_group_assignments(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching user groups:', error);
        throw error;
      }

      // Transform the data to include target count
      const transformedGroups = groups.map(group => ({
        ...group,
        target_count: group.user_target_group_assignments?.[0]?.count || 0
      }));

      return transformedGroups;
    } catch (error) {
      console.error('Error fetching user groups:', error);
      throw error;
    }
  }

  // Create a new group
  async createGroup(groupData: CreateGroupData): Promise<UserTargetGroup> {
    try {
      if (groupData.targetIds.length < 2) {
        throw new Error('A group must have at least 2 targets');
      }

      const userId = await this.getCurrentUserId();
      
      const { data: group, error: groupError } = await supabase
        .from('user_target_groups')
        .insert({
          user_id: userId,
          name: groupData.name,
          room_id: groupData.roomId || null
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Assign targets if provided
      if (groupData.targetIds && groupData.targetIds.length > 0) {
        await this.assignTargetsToGroup(group.id, groupData.targetIds);
      }

      this.clearGroupsCache();

      return {
        ...group,
        target_count: groupData.targetIds?.length || 0
      };
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  }

  // Update group
  async updateGroup(groupId: string, updates: Partial<CreateGroupData>): Promise<UserTargetGroup> {
    try {
      const userId = await this.getCurrentUserId();
      
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.roomId !== undefined) updateData.room_id = updates.roomId || null;
      updateData.updated_at = new Date().toISOString();

      const { data: group, error } = await supabase
        .from('user_target_groups')
        .update(updateData)
        .eq('id', groupId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      // Update targets if provided
      if (updates.targetIds !== undefined) {
        if (updates.targetIds.length < 2) {
          throw new Error('A group must have at least 2 targets');
        }
        // First unassign all current targets
        await this.unassignAllTargetsFromGroup(groupId);
        // Then assign new targets
        if (updates.targetIds.length > 0) {
          await this.assignTargetsToGroup(groupId, updates.targetIds);
        }
      }

      this.clearGroupsCache();
      return group;
    } catch (error) {
      console.error('Error updating group:', error);
      throw error;
    }
  }

  // Delete group
  async deleteGroup(groupId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      
      // First, unassign all targets from this group (cascade should handle this, but being explicit)
      await this.unassignAllTargetsFromGroup(groupId);
      
      // Then delete the group
      const { error } = await supabase
        .from('user_target_groups')
        .delete()
        .eq('id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      this.clearGroupsCache();
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }

  // Assign targets to a group
  async assignTargetsToGroup(groupId: string, targetIds: string[], targetNames?: Map<string, string>): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      
      // Get target names if not provided
      const allTargets = await this.fetchLatestTargets();
      const targetNameMap = targetNames || new Map<string, string>();
      
      // Fill in missing target names
      targetIds.forEach(targetId => {
        if (!targetNameMap.has(targetId)) {
          const target = allTargets.find(t => this.getTargetId(t) === targetId);
          targetNameMap.set(targetId, target?.name || `Target ${targetId.substring(0, 8)}`);
        }
      });

      // Create assignments
      const assignments = targetIds.map(targetId => ({
        user_id: userId,
        group_id: groupId,
        target_id: targetId,
        target_name: targetNameMap.get(targetId) || `Target ${targetId.substring(0, 8)}`
      }));

      const { error } = await supabase
        .from('user_target_group_assignments')
        .insert(assignments);

      if (error) throw error;

      this.clearGroupsCache();
    } catch (error) {
      console.error('Error assigning targets to group:', error);
      throw error;
    }
  }

  // Unassign targets from a group
  async unassignTargetsFromGroup(groupId: string, targetIds: string[]): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      
      const { error } = await supabase
        .from('user_target_group_assignments')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .in('target_id', targetIds);

      if (error) throw error;

      this.clearGroupsCache();
    } catch (error) {
      console.error('Error unassigning targets from group:', error);
      throw error;
    }
  }

  // Unassign all targets from a group
  async unassignAllTargetsFromGroup(groupId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      
      const { error } = await supabase
        .from('user_target_group_assignments')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      this.clearGroupsCache();
    } catch (error) {
      console.error('Error unassigning all targets from group:', error);
      throw error;
    }
  }

  // Assign group to room
  async assignGroupToRoom(groupId: string, roomId: string | null): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      
      const { error } = await supabase
        .from('user_target_groups')
        .update({ room_id: roomId, updated_at: new Date().toISOString() })
        .eq('id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      this.clearGroupsCache();
    } catch (error) {
      console.error('Error assigning group to room:', error);
      throw error;
    }
  }

  // Get all groups with their target assignments
  async getAllGroupsWithAssignments(forceRefresh: boolean = false): Promise<GroupWithTargets[]> {
    try {
      const userId = await this.getCurrentUserId();
      
      // Check cache first (unless force refresh is requested)
      if (!forceRefresh && this.isCacheValid(userId)) {
        return this.groupsWithAssignmentsCache.data!;
      }

      // Get all groups
      const { data: groups, error: groupsError } = await supabase
        .from('user_target_groups')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      // Get all group assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('user_target_group_assignments')
        .select('group_id, target_id, target_name')
        .eq('user_id', userId);

      if (assignmentsError) throw assignmentsError;

      // Get all targets
      const allTargets = await this.fetchLatestTargets(true);

      // Create a map of group_id -> target_ids
      const groupTargetMap = new Map<string, string[]>();
      assignments?.forEach(assignment => {
        const targetIds = groupTargetMap.get(assignment.group_id) || [];
        targetIds.push(assignment.target_id);
        groupTargetMap.set(assignment.group_id, targetIds);
      });

      // Merge groups with targets
      const groupsWithTargets: GroupWithTargets[] = (groups || []).map(group => {
        const targetIds = groupTargetMap.get(group.id) || [];
        const targets = allTargets.filter(target => 
          targetIds.includes(this.getTargetId(target))
        );

        return {
          ...group,
          target_count: targets.length,
          targets
        };
      });

      // Store in cache
      this.groupsWithAssignmentsCache = {
        data: groupsWithTargets,
        timestamp: Date.now(),
        userId: userId
      };

      return groupsWithTargets;
    } catch (error) {
      console.error('Error fetching groups with assignments:', error);
      throw error;
    }
  }

  // Get targets assigned to a specific group
  async getGroupTargets(groupId: string): Promise<Target[]> {
    try {
      const userId = await this.getCurrentUserId();
      
      // Get target assignments for this group
      const { data: assignments, error } = await supabase
        .from('user_target_group_assignments')
        .select('target_id')
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      if (!assignments || assignments.length === 0) {
        return [];
      }

      // Get all targets from cached snapshots
      const allTargets = await this.fetchLatestTargets();
      
      // Filter to only include targets that are assigned to this group
      const assignedTargetIds = assignments.map(a => a.target_id);
      const groupTargets = allTargets.filter(target => 
        assignedTargetIds.includes(this.getTargetId(target))
      );

      return groupTargets;
    } catch (error) {
      console.error('Error fetching group targets:', error);
      throw error;
    }
  }
}

export const supabaseTargetGroupsService = new SupabaseTargetGroupsService();
