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
  useUpdateWifiCredentials,
  profileKeys,
} from './hooks';

// Types
export type {
  UserProfileData,
  RecentSession,
  UpdateProfile,
  WifiCredentials,
  UpdateWifiCredentials,
} from './schema';

