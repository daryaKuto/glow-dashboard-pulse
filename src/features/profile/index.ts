/**
 * Public API for Profile feature
 */

// Hooks
export {
  useProfile,
  useRecentSessions,
  useStatsTrend,
  useUpdateProfile,
  profileKeys,
} from './hooks';

// Types
export type {
  UserProfileData,
  RecentSession,
  UpdateProfile,
} from './schema';

