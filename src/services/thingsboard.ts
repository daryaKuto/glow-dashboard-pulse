import api from '@/lib/tbClient';
import axios from 'axios';

// Types for ThingsBoard API responses
export interface ThingsBoardDevice {
  id: { id: string };
  name: string;
  type: string;
  createdTime: number;
  tenantId: { id: string };
  customerId: { id: string };
  additionalInfo?: Record<string, any>;
}

export interface ThingsBoardUser {
  id: { id: string };
  email: string;
  firstName?: string;
  lastName?: string;
  authority: string;
  createdTime: number;
  tenantId: { id: string };
  customerId?: { id: string };
}

export interface TelemetryData {
  [key: string]: Array<{
    ts: number;
    value: any;
  }>;
}

export interface ThingsBoardAuthResponse {
  token: string;
  refreshToken: string;
  userId: { id: string };
  scopes: string[];
}

export interface ThingsBoardDeviceListResponse {
  data: ThingsBoardDevice[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
}

// ThingsBoard API Service
class ThingsBoardService {
  private baseURL = 'https://thingsboard.cloud';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  // Authentication
  async login(username: string, password: string): Promise<ThingsBoardAuthResponse> {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ThingsBoard] Attempting login (attempt ${attempt}/${maxRetries}) with endpoint: /api/auth/login`);
        console.log('[ThingsBoard] Using Vite proxy to avoid CORS issues');
        console.log('[ThingsBoard] Username:', username);
        console.log('[ThingsBoard] Password length:', password.length);
        
        // Use Vite proxy to avoid CORS issues
        const response = await axios.post('/api/tb/auth/login', {
          username,
          password
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000, // 10 second timeout
          withCredentials: false // Don't send cookies
        });

        console.log('[ThingsBoard] Login successful:', response.status);
        
        // Store tokens in localStorage
        localStorage.setItem('tb_access', response.data.token);
        localStorage.setItem('tb_refresh', response.data.refreshToken);
        
        console.log('[ThingsBoard] Tokens stored in localStorage');
        return response.data;
      } catch (error: any) {
        console.log(`[ThingsBoard] Login failed (attempt ${attempt}/${maxRetries}):`, error);
        console.log('[ThingsBoard] Error details:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          baseURL: error.config?.baseURL
        });

        // If it's a 401 (unauthorized), don't retry - user doesn't exist
        if (error.response?.status === 401) {
          console.log('[ThingsBoard] User not found (401) - not retrying');
          throw error; // Re-throw the original 401 error
        }

        // If it's a 429 (rate limit), wait longer
        if (error.response?.status === 429) {
          console.log('[ThingsBoard] Rate limited, waiting 5 seconds...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else if (attempt < maxRetries) {
          console.log(`[ThingsBoard] Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    throw new Error('Failed to login to ThingsBoard after all retries');
  }

  async refreshAuth(): Promise<ThingsBoardAuthResponse> {
    const refreshToken = localStorage.getItem('tb_refresh');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post('/api/tb/auth/token', {
        refreshToken: refreshToken
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      localStorage.setItem('tb_access', response.data.token);
      localStorage.setItem('tb_refresh', response.data.refreshToken);

      return response.data;
    } catch (error) {
      console.error('ThingsBoard token refresh failed:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      return;
    }

    try {
      await axios.post('/api/tb/auth/logout', {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('ThingsBoard logout failed:', error);
    } finally {
      localStorage.removeItem('tb_access');
      localStorage.removeItem('tb_refresh');
    }
  }

  // Clear invalid tokens and force re-authentication
  clearInvalidTokens(): void {
    console.log('[ThingsBoard] Clearing invalid tokens and forcing re-authentication');
    localStorage.removeItem('tb_access');
    localStorage.removeItem('tb_refresh');
    this.accessToken = null;
    this.refreshToken = null;
  }

  // Device Management
  async getDevices(pageSize: number = 100, page: number = 0, type?: string, textSearch?: string, sortProperty?: string, sortOrder?: 'ASC' | 'DESC', fetchTelemetry: boolean = true): Promise<ThingsBoardDeviceListResponse> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const params: any = {
        pageSize,
        page
      };

      // Add optional parameters as per SwaggerUI documentation
      if (type) params.type = type;
      if (textSearch) params.textSearch = textSearch;
      if (sortProperty) params.sortProperty = sortProperty;
      if (sortOrder) params.sortOrder = sortOrder;

      const response = await api.get('/tenant/devices', { params });

      // Return devices with real status information based on telemetry data
      if (response.data && response.data.data) {
        const devices = response.data.data;
        
        // Only fetch telemetry if requested (expensive operation)
        if (fetchTelemetry) {
          // Fetch telemetry for all devices in parallel to determine real status
          console.log(`🔍 [ThingsBoard] Fetching status for ${devices.length} devices in parallel`);
          const statusPromises = devices.map(device => 
            this.getLatestTelemetry(device.id.id, [
              'hits',           // Total shot count
              'hit_ts',         // Last hit timestamp
              'battery',        // Battery level
              'wifiStrength',   // WiFi signal strength
              'event',          // Last event type
              'gameStatus'      // Current game status
            ]).then(telemetry => {
              // Check last activity timestamp - look for any recent telemetry data
              console.log(`🔍 [ThingsBoard] Raw telemetry for ${device.name}:`, telemetry);
              
              // Check for ANY telemetry key with a timestamp for connection status
              let lastActivity = 0;
              if (telemetry?.hit_ts?.[0]?.ts) {
                lastActivity = telemetry.hit_ts[0].ts;
              } else if (telemetry?.hits?.[0]?.ts) {
                lastActivity = telemetry.hits[0].ts;
              } else if (telemetry) {
                // Check for any telemetry key with a timestamp
                const telemetryKeys = Object.keys(telemetry);
                for (const key of telemetryKeys) {
                  if (Array.isArray(telemetry[key]) && telemetry[key].length > 0 && telemetry[key][0].ts) {
                    lastActivity = Math.max(lastActivity, telemetry[key][0].ts);
                  }
                }
              }
              
              // Extract real telemetry values (no defaults!)
              const battery = telemetry?.battery?.[0]?.value || null;
              const wifiStrength = telemetry?.wifiStrength?.[0]?.value || null;
              const lastEvent = telemetry?.event?.[0]?.value || null;
              const gameStatus = telemetry?.gameStatus?.[0]?.value || null;
              
              const now = Date.now();
              const timeDiff = now - lastActivity;
              const isOnline = lastActivity > 0 && timeDiff < 600000; // 10 min
              
              console.log(`📊 [ThingsBoard] Device ${device.name} status calculation:`, {
                lastActivity,
                lastActivityReadable: lastActivity ? new Date(lastActivity).toISOString() : 'never',
                now: new Date(now).toISOString(),
                timeDiffMinutes: Math.round(timeDiff / 60000),
                isOnline,
                battery,
                wifiStrength,
                lastEvent,
                gameStatus,
                telemetryKeys: telemetry ? Object.keys(telemetry) : 'none'
              });
              
              return { 
                deviceId: device.id.id, 
                status: isOnline ? 'online' : 'offline', 
                lastActivityTime: lastActivity,
                battery: battery,
                wifiStrength: wifiStrength,
                lastEvent: lastEvent,
                gameStatus: gameStatus
              };
            })
            .catch(error => {
              console.warn(`⚠️ [ThingsBoard] Failed to get status for device ${device.name}:`, error);
              return { 
                deviceId: device.id.id, 
                status: 'offline', 
                lastActivityTime: null 
              };
            })
        );

        const statusResults = await Promise.allSettled(statusPromises);
        const statusMap = new Map();
        statusResults.forEach(result => {
          if (result.status === 'fulfilled') {
            statusMap.set(result.value.deviceId, result.value);
          }
        });

        // Apply real status to devices
        const enhancedDevices = devices.map(device => {
          const deviceStatus = statusMap.get(device.id.id);
          return {
            ...device,
            status: deviceStatus?.status || 'offline',
            lastActivityTime: deviceStatus?.lastActivityTime || null,
            active: deviceStatus?.status === 'online',
            gameStatus: deviceStatus?.gameStatus || null,
            gameId: null,
            battery: deviceStatus?.battery || null,  // Real battery or null
            wifiStrength: deviceStatus?.wifiStrength || null,  // Real WiFi or null
            lastEvent: deviceStatus?.lastEvent || null,
            ambientLight: null  // Only show if we have real data
          };
        });
        
        console.log(`✅ [ThingsBoard] Status determination complete:`, enhancedDevices.map(d => ({
          name: d.name,
          status: d.status,
          lastActivity: d.lastActivityTime ? new Date(d.lastActivityTime).toISOString() : 'never'
        })));
        
        return {
          ...response.data,
          data: enhancedDevices
        };
        } else {
          // Return devices without telemetry data (faster)
          console.log(`🔍 [ThingsBoard] Skipping telemetry fetch for ${devices.length} devices (fetchTelemetry=false)`);
          const basicDevices = devices.map(device => ({
            ...device,
            status: 'unknown', // Default status when no telemetry
            lastActivityTime: null,
            active: false,
            gameStatus: null,
            gameId: null,
            battery: null,
            wifiStrength: null,
            lastEvent: null,
            ambientLight: null
          }));
          
          return {
            ...response.data,
            data: basicDevices
          };
        }
      }

      return response.data;
    } catch (error) {
      console.error('Failed to get devices:', error);
      throw error;
    }
  }

  async getDevice(deviceId: string): Promise<ThingsBoardDevice> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await api.get(`/device/${deviceId}`);

      return response.data;
    } catch (error) {
      console.error('Failed to get device:', error);
      throw error;
    }
  }

  async createDevice(deviceData: {
    name: string;
    type: string;
    additionalInfo?: Record<string, any>;
  }): Promise<ThingsBoardDevice> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await api.post('/device', deviceData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to create device:', error);
      throw error;
    }
  }

  async updateDevice(deviceId: string, deviceData: Partial<ThingsBoardDevice>): Promise<ThingsBoardDevice> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await api.put(`/device/${deviceId}`, deviceData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to update device:', error);
      throw error;
    }
  }

  async deleteDevice(deviceId: string): Promise<void> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      await api.delete(`/device/${deviceId}`);
    } catch (error) {
      console.error('Failed to delete device:', error);
      throw error;
    }
  }

  // Telemetry Data
  async getLatestTelemetry(deviceId: string, keys: string[]): Promise<TelemetryData> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      console.log(`🔍 [ThingsBoard] Getting latest telemetry for device: ${deviceId}`);
      console.log(`🔍 [ThingsBoard] Requested keys: ${keys.join(', ')}`);
      
      const response = await api.get(`/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`, {
        params: {
          keys: keys.join(','),
          limit: 1
        }
      });

      console.log(`📊 [ThingsBoard] Raw telemetry response for ${deviceId}:`, response.data);
      
      // Log parsed telemetry data for shot verification
      if (response.data) {
        Object.entries(response.data).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0) {
            const latestValue = value[value.length - 1];
            console.log(`📊 [ThingsBoard] ${deviceId} - ${key}:`, {
              value: latestValue.value,
              timestamp: latestValue.ts,
              readableTime: new Date(latestValue.ts).toISOString()
            });
          } else {
            console.log(`📊 [ThingsBoard] ${deviceId} - ${key}: No data`);
          }
        });
      } else {
        console.log(`📊 [ThingsBoard] ${deviceId} - No telemetry data received`);
      }

      return response.data;
    } catch (error) {
      console.error(`❌ [ThingsBoard] Failed to get latest telemetry for ${deviceId}:`, error);
      throw error;
    }
  }

  // Batch telemetry for multiple devices - optimized for shooting activity polling
  async getBatchTelemetry(deviceIds: string[], keys: string[]): Promise<Map<string, TelemetryData>> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      console.log(`🔍 [ThingsBoard] Getting batch telemetry for ${deviceIds.length} devices`);
      console.log(`🔍 [ThingsBoard] Requested keys: ${keys.join(', ')}`);
      
      // Use ThingsBoard batch API for better performance
      const response = await api.post('/plugins/telemetry/DEVICE/values/timeseries', {
        deviceIds: deviceIds,
        keys: keys,
        limit: 1
      });

      console.log(`📊 [ThingsBoard] Batch telemetry response:`, response.data);
      
      // Convert response to Map for easy lookup
      const telemetryMap = new Map<string, TelemetryData>();
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((item: any) => {
          if (item.deviceId && item.telemetry) {
            telemetryMap.set(item.deviceId, item.telemetry);
          }
        });
      }
      
      return telemetryMap;
    } catch (error) {
      console.error(`Failed to get batch telemetry:`, error);
      // Fallback to individual requests if batch fails
      console.log('🔄 [ThingsBoard] Batch telemetry failed, falling back to individual requests');
      return this.getBatchTelemetryFallback(deviceIds, keys);
    }
  }

  // Fallback method for batch telemetry using individual requests
  private async getBatchTelemetryFallback(deviceIds: string[], keys: string[]): Promise<Map<string, TelemetryData>> {
    const telemetryMap = new Map<string, TelemetryData>();
    
    // Process in smaller batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < deviceIds.length; i += batchSize) {
      const batch = deviceIds.slice(i, i + batchSize);
      const promises = batch.map(async (deviceId) => {
        try {
          const telemetry = await this.getLatestTelemetry(deviceId, keys);
          return { deviceId, telemetry };
        } catch (error) {
          console.warn(`Failed to get telemetry for device ${deviceId}:`, error);
          return { deviceId, telemetry: {} };
        }
      });
      
      const results = await Promise.allSettled(promises);
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          telemetryMap.set(result.value.deviceId, result.value.telemetry);
        }
      });
    }
    
    return telemetryMap;
  }

  async getHistoricalTelemetry(
    deviceId: string,
    keys: string[],
    startTs: number,
    endTs: number,
    limit: number = 100
  ): Promise<TelemetryData> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      console.log(`🔍 [ThingsBoard] Getting historical telemetry for device: ${deviceId}`);
      console.log(`🔍 [ThingsBoard] Time range: ${new Date(startTs).toISOString()} to ${new Date(endTs).toISOString()}`);
      console.log(`🔍 [ThingsBoard] Requested keys: ${keys.join(', ')}`);
      
      const response = await api.get(`/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`, {
        params: {
          keys: keys.join(','),
          startTs,
          endTs,
          limit
        }
      });

      console.log(`📊 [ThingsBoard] Historical telemetry response for ${deviceId}:`, response.data);
      
      // Log summary of historical data for shot verification
      if (response.data) {
        Object.entries(response.data).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0) {
            console.log(`📊 [ThingsBoard] ${deviceId} - ${key} (${value.length} records):`, {
              firstValue: value[0]?.value,
              firstTimestamp: value[0]?.ts,
              lastValue: value[value.length - 1]?.value,
              lastTimestamp: value[value.length - 1]?.ts,
              readableFirstTime: value[0] ? new Date(value[0].ts).toISOString() : 'N/A',
              readableLastTime: value[value.length - 1] ? new Date(value[value.length - 1].ts).toISOString() : 'N/A'
            });
          } else {
            console.log(`📊 [ThingsBoard] ${deviceId} - ${key}: No historical data`);
          }
        });
      } else {
        console.log(`📊 [ThingsBoard] ${deviceId} - No historical telemetry data received`);
      }

      return response.data;
    } catch (error) {
      console.error(`❌ [ThingsBoard] Failed to get historical telemetry for ${deviceId}:`, error);
      throw error;
    }
  }

  // Device Attributes
  async getDeviceAttributes(deviceId: string, scope: string = 'SHARED_SCOPE'): Promise<any[]> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      // Use the correct API endpoint for device attributes
      const response = await api.get(`/plugins/telemetry/DEVICE/${deviceId}/values/attributes`);

      return response.data;
    } catch (error) {
      console.error('Failed to get device attributes:', error);
      throw error;
    }
  }

  // Get WiFi credentials from device attributes
  async getDeviceWifiCredentials(deviceId: string): Promise<{ ssid: string; password: string } | null> {
    try {
      const attributes = await this.getDeviceAttributes(deviceId, 'SHARED_SCOPE');
      
      // ThingsBoard returns attributes as an array of {key, value} objects
      let wifiCredentials = { ssid: '', password: '' };
      
      if (Array.isArray(attributes)) {
        // Parse array format: [{key: 'wifi_ssid', value: 'MyWiFi'}, ...]
        for (const attr of attributes) {
          if (attr.key === 'wifi_ssid' || attr.key === 'ssid') {
            wifiCredentials.ssid = attr.value || '';
          } else if (attr.key === 'wifi_password' || attr.key === 'password') {
            wifiCredentials.password = attr.value || '';
          }
        }
      } else if (attributes && typeof attributes === 'object') {
        // Fallback for object format (if API changes)
        wifiCredentials = {
          ssid: attributes.wifi_ssid || attributes.ssid || '',
          password: attributes.wifi_password || attributes.password || ''
        };
      }

      // Return null if no credentials found
      if (!wifiCredentials.ssid && !wifiCredentials.password) {
        return null;
      }

      return wifiCredentials;
    } catch (error) {
      console.error(`Failed to get WiFi credentials for device ${deviceId}:`, error);
      return null;
    }
  }

  // Set WiFi credentials to device attributes
  async setDeviceWifiCredentials(deviceId: string, ssid: string, password: string): Promise<void> {
    try {
      await this.setDeviceAttributes(deviceId, {
        wifi_ssid: ssid,
        wifi_password: password
      }, 'SHARED_SCOPE');
      
      console.log(`WiFi credentials set for device ${deviceId}`);
    } catch (error) {
      console.error(`Failed to set WiFi credentials for device ${deviceId}:`, error);
      throw error;
    }
  }

  async setDeviceAttributes(
    deviceId: string,
    attributes: Record<string, any>,
    scope: string = 'SHARED_SCOPE'
  ): Promise<void> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      await api.post(`/plugins/telemetry/DEVICE/${deviceId}/values/attributes/${scope}`, attributes, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Failed to set device attributes:', error);
      throw error;
    }
  }

  // User Management (as per SwaggerUI documentation)
  async getUsers(pageSize: number = 100, page: number = 0, textSearch?: string, sortProperty?: string, sortOrder?: 'ASC' | 'DESC'): Promise<{ data: ThingsBoardUser[] }> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const params: any = {
        pageSize,
        page
      };

      if (textSearch) params.textSearch = textSearch;
      if (sortProperty) params.sortProperty = sortProperty;
      if (sortOrder) params.sortOrder = sortOrder;

      const response = await api.get('/customer/users', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to get users:', error);
      throw error;
    }
  }

  async getUser(userId: string): Promise<ThingsBoardUser> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await api.get(`/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get user:', error);
      throw error;
    }
  }

  // Telemetry Keys (as per SwaggerUI documentation)
  async getTelemetryKeys(entityType: string, entityId: string): Promise<string[]> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await api.get(`/plugins/telemetry/${entityType}/${entityId}/keys/timeseries`);
      return response.data;
    } catch (error) {
      console.error('Failed to get telemetry keys:', error);
      throw error;
    }
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!localStorage.getItem('tb_access');
  }

  getAccessToken(): string | null {
    return localStorage.getItem('tb_access');
  }

  setAccessToken(token: string): void {
    localStorage.setItem('tb_access', token);
  }

  /**
   * Send RPC command to device
   */
  async sendRpcCommand(deviceId: string, method: string, params: Record<string, any>): Promise<any> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    try {
      const response = await api.post(`/api/plugins/rpc/oneway/${deviceId}`, {
        method,
        params,
        timeout: 5000 // 5 second timeout
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`RPC command sent to ${deviceId}:`, { method, params });
      return response.data;
    } catch (error) {
      console.error(`Failed to send RPC command to ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Send telemetry data to device
   */
  async sendTelemetry(deviceId: string, telemetry: Record<string, any>): Promise<void> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    try {
      const response = await api.post(`/api/plugins/telemetry/${deviceId}/timeseries/DEVICE_SCOPE`, 
        telemetry,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`Telemetry sent to ${deviceId}:`, telemetry);
      return response.data;
    } catch (error) {
      console.error(`Failed to send telemetry to ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get telemetry data for specific time range
   */
  async getTelemetryHistory(
    deviceId: string, 
    keys: string[], 
    startTime: number, 
    endTime: number,
    limit: number = 1000
  ): Promise<TelemetryData> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    try {
      const keysParam = keys.join(',');
      const response = await api.get(
        `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${keysParam}&startTs=${startTime}&endTs=${endTime}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Failed to get telemetry history for ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time telemetry updates via WebSocket
   */
  subscribeToTelemetry(deviceId: string, keys: string[], callback: (data: any) => void): WebSocket | null {
    const token = this.getAccessToken();
    if (!token) {
      console.error('No access token available for WebSocket subscription');
      return null;
    }

    try {
      const ws = openTelemetryWS(token);
      
      ws.onopen = () => {
        console.log(`WebSocket connected for device ${deviceId}`);
        
        // Subscribe to telemetry updates
        const subscribeCmd = {
          cmdId: Date.now(),
          entityType: 'DEVICE',
          entityId: deviceId,
          scope: 'LATEST_TELEMETRY',
          keys: keys.join(',')
        };
        
        ws.send(JSON.stringify(subscribeCmd));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          callback(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for device ${deviceId}:`, error);
      };

      ws.onclose = () => {
        console.log(`WebSocket connection closed for device ${deviceId}`);
      };

      return ws;
    } catch (error) {
      console.error(`Failed to create WebSocket subscription for ${deviceId}:`, error);
      return null;
    }
  }
}

// Create a singleton instance
const thingsBoardService = new ThingsBoardService();

// Export the service instance and functions
export { thingsBoardService };
export const login = (username: string, password: string) => thingsBoardService.login(username, password);
export const logout = () => thingsBoardService.logout();
export const listDevices = async () => {
  const result = await thingsBoardService.getDevices(100, 0); // Fetch up to 100 devices
  return result.data;
};
export const latestTelemetry = (deviceId: string, keys: string[]) => thingsBoardService.getLatestTelemetry(deviceId, keys);
export const batchTelemetry = (deviceIds: string[], keys: string[]) => thingsBoardService.getBatchTelemetry(deviceIds, keys);
export const updateSharedAttributes = (deviceId: string, attributes: Record<string, any>) => 
  thingsBoardService.setDeviceAttributes(deviceId, attributes, 'SHARED_SCOPE');
export const getDeviceWifiCredentials = (deviceId: string) => thingsBoardService.getDeviceWifiCredentials(deviceId);
export const setDeviceWifiCredentials = (deviceId: string, ssid: string, password: string) => 
  thingsBoardService.setDeviceWifiCredentials(deviceId, ssid, password);

// WebSocket function for telemetry - enabled in development with proper fallback
export const openTelemetryWS = (token: string) => {
  const isDev = import.meta.env.DEV;
  
  // In development, try to use WebSocket with fallback to polling
  if (isDev) {
    console.log('[ThingsBoard] Attempting WebSocket connection in development mode');
    
    try {
      // Try to create WebSocket connection
      const baseURL = 'https://thingsboard.cloud';
      const wsPath = '/api/ws/plugins/telemetry';
      const wsUrl = baseURL.replace('https://', 'wss://') + wsPath + '?token=' + token;
      
      console.log('[ThingsBoard] Opening WebSocket connection to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      // Add error handling with fallback
      ws.onerror = (error) => {
        console.warn('[ThingsBoard] WebSocket error in dev mode, falling back to polling:', error);
      };
      
      ws.onclose = (event) => {
        console.log('[ThingsBoard] WebSocket closed in dev mode:', event.code, event.reason || 'No reason provided');
      };
      
      ws.onopen = () => {
        console.log('[ThingsBoard] WebSocket connected successfully in dev mode');
      };
      
      return ws;
    } catch (error) {
      console.warn('[ThingsBoard] WebSocket creation failed in dev mode, using polling only:', error);
      
      // Return a mock WebSocket as fallback
      return {
        readyState: WebSocket.CLOSED,
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
        send: () => {
          console.log('[ThingsBoard] Mock WebSocket: send() called (WebSocket failed in dev)');
        },
        close: () => {
          console.log('[ThingsBoard] Mock WebSocket: close() called');
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
        url: '',
        protocol: '',
        extensions: '',
        bufferedAmount: 0,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
      } as WebSocket;
    }
  }
  
  // In production, use direct WebSocket connection
  const baseURL = 'https://thingsboard.cloud';
  const wsPath = '/api/ws/plugins/telemetry';
  const wsUrl = baseURL.replace('https://', 'wss://') + wsPath + '?token=' + token;
  
  console.log('[ThingsBoard] Opening WebSocket connection to:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  
  // Add error handling to prevent unhandled errors
  ws.onerror = (error) => {
    console.warn('[ThingsBoard] WebSocket error (non-fatal):', error);
  };
  
  ws.onclose = (event) => {
    console.log('[ThingsBoard] WebSocket closed:', event.code, event.reason || 'No reason provided');
  };
  
  ws.onopen = () => {
    console.log('[ThingsBoard] WebSocket connected successfully');
  };
  
  return ws;
};

// Security: No global token manipulation functions exposed

export default thingsBoardService; 