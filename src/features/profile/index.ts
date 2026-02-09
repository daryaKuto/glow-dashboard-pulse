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
  // User preferences hooks (replaces Zustand useUserPrefs store)
  useUserPreferences,
  useSaveUserPreferences,
  useUpdateTargetPreference,
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

// User preferences types
export type { TargetPreferences, UserPreferences } from './hooks';

