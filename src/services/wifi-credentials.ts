/**
 * WiFi Credentials Service
 * Handles fetching WiFi credentials from ThingsBoard and syncing to Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import { listDevices, getDeviceWifiCredentials } from './thingsboard';
import { encryptPassword, decryptPassword } from './credentials';

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
    console.log('[WiFi Service] Fetching WiFi credentials from ThingsBoard for user:', userId);
    
    // Get all devices for the user
    const devices = await listDevices();
    
    if (!devices || devices.length === 0) {
      console.log('[WiFi Service] No devices found for user');
      return null;
    }
    
    console.log(`[WiFi Service] Found ${devices.length} devices, checking first device for WiFi credentials`);
    
    // Get WiFi credentials from the first device (all devices share same WiFi)
    const firstDevice = devices[0];
    const deviceId = typeof firstDevice.id === 'string' ? firstDevice.id : firstDevice.id?.id;
    
    if (!deviceId) {
      console.log('[WiFi Service] No valid device ID found');
      return null;
    }
    
    const wifiCredentials = await getDeviceWifiCredentials(deviceId);
    
    if (!wifiCredentials || (!wifiCredentials.ssid && !wifiCredentials.password)) {
      console.log('[WiFi Service] No WiFi credentials found on device');
      return null;
    }
    
    console.log('[WiFi Service] WiFi credentials found:', { 
      ssid: wifiCredentials.ssid, 
      hasPassword: !!wifiCredentials.password 
    });
    
    return wifiCredentials;
  } catch (error) {
    console.error('[WiFi Service] Error fetching WiFi from ThingsBoard:', error);
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
    console.log('[WiFi Service] Syncing WiFi credentials to Supabase for user:', userId);
    
    // Encrypt the password
    const encryptedPassword = encryptPassword(password);
    
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
      console.error('[WiFi Service] Error syncing WiFi to Supabase:', error);
      return false;
    }
    
    console.log('[WiFi Service] WiFi credentials synced to Supabase successfully');
    return true;
  } catch (error) {
    console.error('[WiFi Service] Error syncing WiFi to Supabase:', error);
    return false;
  }
};

/**
 * Get WiFi credentials from Supabase (decrypted)
 */
export const getWifiFromSupabase = async (userId: string): Promise<WifiCredentials | null> => {
  try {
    console.log('[WiFi Service] Getting WiFi credentials from Supabase for user:', userId);
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('wifi_ssid_encrypted, wifi_password_encrypted, wifi_last_sync')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('[WiFi Service] Error fetching WiFi from Supabase:', error);
      return null;
    }
    
    if (!data.wifi_ssid_encrypted || !data.wifi_password_encrypted) {
      console.log('[WiFi Service] No WiFi credentials found in Supabase');
      return null;
    }
    
    // Decrypt the password
    const decryptedPassword = decryptPassword(data.wifi_password_encrypted);
    
    console.log('[WiFi Service] WiFi credentials retrieved from Supabase:', {
      ssid: data.wifi_ssid_encrypted,
      hasPassword: !!decryptedPassword,
      lastSync: data.wifi_last_sync
    });
    
    return {
      ssid: data.wifi_ssid_encrypted,
      password: decryptedPassword
    };
  } catch (error) {
    console.error('[WiFi Service] Error getting WiFi from Supabase:', error);
    return null;
  }
};

/**
 * Sync WiFi credentials on login
 * Fetches from ThingsBoard and stores in Supabase
 */
export const syncWifiCredentialsOnLogin = async (userId: string): Promise<boolean> => {
  try {
    console.log('[WiFi Service] Starting WiFi sync on login for user:', userId);
    
    // Fetch WiFi from ThingsBoard
    const wifiCredentials = await fetchWifiFromThingsBoard(userId);
    
    if (!wifiCredentials) {
      console.log('[WiFi Service] No WiFi credentials found in ThingsBoard, skipping sync');
      return false;
    }
    
    // Sync to Supabase
    const success = await syncWifiToSupabase(userId, wifiCredentials.ssid, wifiCredentials.password);
    
    if (success) {
      console.log('[WiFi Service] WiFi credentials synced successfully on login');
    } else {
      console.error('[WiFi Service] Failed to sync WiFi credentials on login');
    }
    
    return success;
  } catch (error) {
    console.error('[WiFi Service] Error during WiFi sync on login:', error);
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
    console.error('[WiFi Service] Error checking WiFi credentials:', error);
    return false;
  }
};
