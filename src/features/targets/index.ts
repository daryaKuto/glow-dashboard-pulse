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
  targetsKeys,
} from './hooks';

// Types
export type {
  Target,
  TargetDetail,
  TargetDetailsOptions,
  TargetsSummary,
} from './schema';

export type { TargetsWithSummary } from './repo';

// Re-export merge function for advanced use cases
export { mergeTargetDetails } from './service';
