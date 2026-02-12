/**
 * WiFi Credentials Service
 * Handles fetching WiFi credentials from ThingsBoard and syncing to Supabase
 */

import { supabase } from '@/data/supabase-client';
import { fetchTargetsWithTelemetry, fetchDeviceAttributes } from '@/lib/edge';
import { encryptPassword, decryptPassword } from '@/shared/lib/credentials';
import { logger } from '@/shared/lib/logger';

export interface WifiCredentials {
  ssid: string;
  password: string;
}

/**
 * Fetch WiFi credentials from ThingsBoard devices
 * Gets WiFi from the first available device's shared attributes
 */
export const fetchWifiFromThingsBoard = async (userId: string): Promise<WifiCredentials | null> => {
  try {
    logger.debug('[WiFi Service] Fetching WiFi credentials from ThingsBoard for user:', userId);

    const { targets } = await fetchTargetsWithTelemetry(false);

    if (!targets || targets.length === 0) {
      logger.debug('[WiFi Service] No targets/devices returned from Supabase edge');
      return null;
    }

    const primaryTarget = targets.find((target) => target.status === 'online' || target.status === 'standby') ?? targets[0];
    const rawDeviceId = primaryTarget?.id;
    const deviceId = typeof rawDeviceId === 'string'
      ? rawDeviceId
      : rawDeviceId && typeof rawDeviceId === 'object' && 'id' in rawDeviceId
        ? String((rawDeviceId as { id?: string }).id ?? '')
        : '';

    if (!deviceId) {
      logger.debug('[WiFi Service] Unable to resolve a device ID from targets payload');
      return null;
    }

    const attributes = await fetchDeviceAttributes(deviceId, {
      scope: 'SHARED_SCOPE',
      keys: ['wifi_ssid', 'wifi_password', 'ssid', 'password'],
    });

    const ssid = String(attributes.wifi_ssid ?? attributes.ssid ?? '') || '';
    const password = String(attributes.wifi_password ?? attributes.password ?? '') || '';

    if (!ssid && !password) {
      logger.debug('[WiFi Service] No WiFi credentials found on device attributes');
      return null;
    }

    logger.debug('[WiFi Service] WiFi credentials found via edge function', {
      ssid,
      hasPassword: Boolean(password),
      deviceId,
    });

    return { ssid, password };
  } catch (error) {
    logger.error('[WiFi Service] Error fetching WiFi from ThingsBoard:', error);
    return null;
  }
};

/**
 * Sync WiFi credentials to Supabase (encrypted storage)
 */
export const syncWifiToSupabase = async (
  userId: string, 
  ssid: string, 
  password: string
): Promise<boolean> => {
  try {
    logger.debug('[WiFi Service] Syncing WiFi credentials to Supabase for user:', userId);
    
    // Encrypt the password
    const encryptedPassword = await encryptPassword(password);
    
    // Update user profile with encrypted WiFi credentials
    const { error } = await supabase
      .from('user_profiles')
      .update({
        wifi_ssid_encrypted: ssid,
        wifi_password_encrypted: encryptedPassword,
        wifi_last_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (error) {
      logger.error('[WiFi Service] Error syncing WiFi to Supabase:', error);
      return false;
    }
    
    logger.debug('[WiFi Service] WiFi credentials synced to Supabase successfully');
    return true;
  } catch (error) {
    logger.error('[WiFi Service] Error syncing WiFi to Supabase:', error);
    return false;
  }
};

/**
 * Get WiFi credentials from Supabase (decrypted)
 */
export const getWifiFromSupabase = async (userId: string): Promise<WifiCredentials | null> => {
  try {
    logger.debug('[WiFi Service] Getting WiFi credentials from Supabase for user:', userId);
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('wifi_ssid_encrypted, wifi_password_encrypted, wifi_last_sync')
      .eq('id', userId)
      .single();
    
    if (error) {
      logger.error('[WiFi Service] Error fetching WiFi from Supabase:', error);
      return null;
    }
    
    if (!data.wifi_ssid_encrypted || !data.wifi_password_encrypted) {
      logger.debug('[WiFi Service] No WiFi credentials found in Supabase');
      return null;
    }
    
    // Decrypt the password
    const decryptedPassword = await decryptPassword(data.wifi_password_encrypted);
    
    logger.debug('[WiFi Service] WiFi credentials retrieved from Supabase:', {
      ssid: data.wifi_ssid_encrypted,
      hasPassword: !!decryptedPassword,
      lastSync: data.wifi_last_sync
    });
    
    return {
      ssid: data.wifi_ssid_encrypted,
      password: decryptedPassword
    };
  } catch (error) {
    logger.error('[WiFi Service] Error getting WiFi from Supabase:', error);
    return null;
  }
};

/**
 * Sync WiFi credentials on login
 * Fetches from ThingsBoard and stores in Supabase
 */
export const syncWifiCredentialsOnLogin = async (userId: string): Promise<boolean> => {
  try {
    logger.debug('[WiFi Service] Starting WiFi sync on login for user:', userId);
    
    // Fetch WiFi from ThingsBoard
    const wifiCredentials = await fetchWifiFromThingsBoard(userId);
    
    if (!wifiCredentials) {
      logger.debug('[WiFi Service] No WiFi credentials found in ThingsBoard, skipping sync');
      return false;
    }
    
    // Sync to Supabase
    const success = await syncWifiToSupabase(userId, wifiCredentials.ssid, wifiCredentials.password);
    
    if (success) {
      logger.debug('[WiFi Service] WiFi credentials synced successfully on login');
    } else {
      logger.error('[WiFi Service] Failed to sync WiFi credentials on login');
    }
    
    return success;
  } catch (error) {
    logger.error('[WiFi Service] Error during WiFi sync on login:', error);
    return false;
  }
};

/**
 * Check if WiFi credentials are available in Supabase
 */
export const hasWifiCredentials = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('wifi_ssid_encrypted, wifi_password_encrypted')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      return false;
    }
    
    return !!(data.wifi_ssid_encrypted && data.wifi_password_encrypted);
  } catch (error) {
    logger.error('[WiFi Service] Error checking WiFi credentials:', error);
    return false;
  }
};
