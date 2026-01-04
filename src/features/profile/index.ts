/**
 * Public API for Profile feature
 */

// Hooks
export {
  useProfile,
  useRecentSessions,
  useStatsTrend,
  useUpdateProfile,
  useWifiCredentials,
  profileKeys,
} from './hooks';

// Types
export type {
  UserProfileData,
  RecentSession,
  UpdateProfile,
  WifiCredentials,
} from './schema';

