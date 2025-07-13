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

  // Device Management
  async getDevices(pageSize: number = 10, page: number = 0): Promise<ThingsBoardDeviceListResponse> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await api.get('/tenant/devices', {
        params: {
          pageSize,
          page
        }
      });

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
      const response = await api.get(`/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`, {
        params: {
          keys: keys.join(','),
          limit: 1
        }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to get latest telemetry:', error);
      throw error;
    }
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
      const response = await api.get(`/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`, {
        params: {
          keys: keys.join(','),
          startTs,
          endTs,
          limit
        }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to get historical telemetry:', error);
      throw error;
    }
  }

  // Device Attributes
  async getDeviceAttributes(deviceId: string, scope: string = 'SHARED_SCOPE'): Promise<Record<string, any>> {
    const token = localStorage.getItem('tb_access');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await api.get(`/plugins/telemetry/DEVICE/${deviceId}/values/attributes/${scope}`);

      return response.data;
    } catch (error) {
      console.error('Failed to get device attributes:', error);
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
}

// Create a singleton instance
const thingsBoardService = new ThingsBoardService();

// Export the functions that are being imported by other files
export const login = (username: string, password: string) => thingsBoardService.login(username, password);
export const logout = () => thingsBoardService.logout();
export const listDevices = async () => {
  const result = await thingsBoardService.getDevices(100, 0); // Fetch up to 100 devices
  return result.data;
};
export const latestTelemetry = (deviceId: string, keys: string[]) => thingsBoardService.getLatestTelemetry(deviceId, keys);
export const updateSharedAttributes = (deviceId: string, attributes: Record<string, any>) => 
  thingsBoardService.setDeviceAttributes(deviceId, attributes, 'SHARED_SCOPE');

// WebSocket function for telemetry - use proxy for development
export const openTelemetryWS = (token: string) => {
  // In development, use the proxy to avoid CORS issues
  const isDev = import.meta.env.DEV;
  const baseURL = isDev ? window.location.origin : 'https://thingsboard.cloud';
  const wsPath = isDev ? '/api/tb/ws/plugins/telemetry' : '/api/ws/plugins/telemetry';
  const wsUrl = baseURL.replace('http://', 'ws://').replace('https://', 'wss://') + wsPath + '?token=' + token;
  
  console.log('[ThingsBoard] Opening WebSocket connection to:', wsUrl);
  return new WebSocket(wsUrl);
};

export default thingsBoardService; 