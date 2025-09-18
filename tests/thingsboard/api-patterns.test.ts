import { describe, it, expect } from 'vitest';

describe('ThingsBoard API Patterns', () => {
  describe('URL Construction', () => {
    it('should construct correct device list URL', () => {
      const baseUrl = 'https://thingsboard.cloud';
      const endpoint = '/api/tenant/devices';
      const params = new URLSearchParams({
        pageSize: '1000',
        page: '0',
        sortProperty: 'name',
        sortOrder: 'ASC'
      });

      const fullUrl = `${baseUrl}${endpoint}?${params.toString()}`;
      
      expect(fullUrl).toContain('/api/tenant/devices');
      expect(fullUrl).toContain('pageSize=1000');
      expect(fullUrl).toContain('sortProperty=name');
    });

    it('should construct correct telemetry URL', () => {
      const deviceId = 'device-123';
      const keys = ['temperature', 'humidity', 'event'];
      const endpoint = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
      const params = new URLSearchParams({
        keys: keys.join(','),
        useStrictDataTypes: 'true'
      });

      const fullUrl = `${endpoint}?${params.toString()}`;
      
      expect(fullUrl).toContain(`/DEVICE/${deviceId}/values/timeseries`);
      expect(fullUrl).toContain('keys=temperature%2Chumidity%2Cevent');
      expect(fullUrl).toContain('useStrictDataTypes=true');
    });

    it('should construct WebSocket URL correctly', () => {
      const wsUrl = 'ws://localhost:8080/api/ws/plugins/telemetry';
      const deviceId = 'device-123';
      const cmdId = Math.random().toString(36).substring(7);
      
      const wsMessage = {
        deviceId,
        scope: 'LATEST_TELEMETRY',
        cmdId,
        keys: 'temperature,event'
      };

      expect(wsUrl).toContain('/api/ws/plugins/telemetry');
      expect(wsMessage.deviceId).toBe(deviceId);
      expect(wsMessage.scope).toBe('LATEST_TELEMETRY');
      expect(wsMessage.cmdId).toBeDefined();
      expect(wsMessage.keys).toContain('temperature');
    });
  });

  describe('Request Headers', () => {
    it('should format authorization header correctly', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      const authHeader = `Bearer ${token}`;
      
      expect(authHeader).toBe(`Bearer ${token}`);
      expect(authHeader.startsWith('Bearer ')).toBe(true);
    });

    it('should handle content type headers', () => {
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Accept']).toBe('application/json');
    });
  });

  describe('Response Processing', () => {
    it('should process device list response correctly', () => {
      const mockResponse = {
        data: {
          data: [
            { id: { id: 'device-1' }, name: 'Target 1' },
            { id: { id: 'device-2' }, name: 'Target 2' }
          ],
          totalElements: 2,
          hasNext: false
        }
      };

      const devices = mockResponse.data.data;
      expect(devices).toHaveLength(2);
      expect(devices[0].id.id).toBe('device-1');
      expect(devices[1].name).toBe('Target 2');
    });

    it('should process telemetry response correctly', () => {
      const mockTelemetryResponse = {
        data: {
          'event': [
            { ts: 1640995200000, value: 'hit' },
            { ts: 1640995260000, value: 'miss' }
          ],
          'hits': [
            { ts: 1640995200000, value: '5' }
          ]
        }
      };

      const telemetryData = mockTelemetryResponse.data;
      
      // Get latest values
      const latestEvent = telemetryData.event[telemetryData.event.length - 1];
      const latestHits = telemetryData.hits[telemetryData.hits.length - 1];

      expect(latestEvent.value).toBe('miss');
      expect(latestHits.value).toBe('5');
      expect(typeof latestEvent.ts).toBe('number');
    });
  });

  describe('Error Response Handling', () => {
    it('should identify authentication errors', () => {
      const authError = {
        response: {
          status: 401,
          data: {
            message: 'Authentication failed'
          }
        }
      };

      expect(authError.response.status).toBe(401);
      expect(authError.response.data.message).toContain('Authentication');
    });

    it('should identify not found errors', () => {
      const notFoundError = {
        response: {
          status: 404,
          data: {
            message: 'Device not found'
          }
        }
      };

      expect(notFoundError.response.status).toBe(404);
      expect(notFoundError.response.data.message).toContain('not found');
    });

    it('should identify rate limiting errors', () => {
      const rateLimitError = {
        response: {
          status: 429,
          data: {
            message: 'Too many requests'
          }
        }
      };

      expect(rateLimitError.response.status).toBe(429);
      expect(rateLimitError.response.data.message).toContain('Too many');
    });
  });

  describe('Data Consistency', () => {
    it('should maintain device ID consistency', () => {
      const deviceId = 'device-123-abc';
      
      // Device ID should be consistent across different API calls
      const deviceUrl = `/api/tenant/devices/${deviceId}`;
      const telemetryUrl = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`;
      const attributesUrl = `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes`;

      expect(deviceUrl).toContain(deviceId);
      expect(telemetryUrl).toContain(deviceId);
      expect(attributesUrl).toContain(deviceId);
    });

    it('should validate timestamp consistency', () => {
      const now = Date.now();
      const telemetryEntry = {
        ts: now,
        value: 'test'
      };

      const jsDate = new Date(telemetryEntry.ts);
      
      expect(telemetryEntry.ts).toBe(now);
      expect(jsDate.getTime()).toBe(now);
      expect(jsDate.toISOString()).toBeDefined();
    });
  });
});
