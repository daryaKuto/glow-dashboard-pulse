/**
 * Public API for Targets feature
 *
 * Exports only what other features/pages need to use.
 * Internal implementation details are kept private.
 */

// Hooks (main API)
export {
  useTargets,
  useTargetsSummary,
  useTargetDetails,
  useTargetsWithDetails,
  useInvalidateTargets,
  useDeviceCommand,
  useSetDeviceAttributes,
  useTargetCustomNames,
  useSetTargetCustomName,
  useRemoveTargetCustomName,
  // Permission-aware hooks
  useTargetDetailsWithPermission,
  useDeviceCommandWithPermission,
  useSetDeviceAttributesWithPermission,
  useSetTargetCustomNameWithPermission,
  useRemoveTargetCustomNameWithPermission,
  // Target groups hooks (replaces Zustand useTargetGroups store)
  useTargetGroups,
  useCreateTargetGroup,
  useUpdateTargetGroup,
  useDeleteTargetGroup,
  useAssignTargetsToGroup,
  useUnassignTargetsFromGroup,
  useAssignGroupToRoom,
  targetsKeys,
  targetGroupsKeys,
} from './hooks';

// Types
export type {
  Target,
  TargetDetail,
  TargetDetailsOptions,
  TargetsSummary,
} from './schema';

export type { TargetsWithSummary } from './repo';

// Permission types
export type { UserContext, TargetContext } from './hooks';

// Target groups types
export type { TargetGroup, CreateGroupData, GroupWithTargets } from './hooks';

// Re-export merge function for advanced use cases
export { mergeTargetDetails } from './service';
