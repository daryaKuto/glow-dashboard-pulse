import { API } from '../api';
import * as thingsboard from '@/services/thingsboard';

// Mock the ThingsBoard service
jest.mock('@/services/thingsboard', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  listDevices: jest.fn(),
  latestTelemetry: jest.fn(),
  openTelemetryWS: jest.fn(),
}));

describe('API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Auth Methods', () => {
    test('signIn should call ThingsBoard login', async () => {
      const mockResponse = { token: 'test-token', refreshToken: 'refresh-token' };
      (thingsboard.login as jest.Mock).mockResolvedValue(mockResponse);

      const result = await API.signIn('test@example.com', 'password');
      
      expect(thingsboard.login).toHaveBeenCalledWith('test@example.com', 'password');
      expect(result).toEqual(mockResponse);
    });

    test('signOut should call ThingsBoard logout and clear storage', async () => {
      const mockLocalStorage = {
        removeItem: jest.fn(),
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      await API.signOut();
      
      expect(thingsboard.logout).toHaveBeenCalled();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tb_access');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tb_refresh');
    });
  });

  describe('Device Methods', () => {
    test('getTargets should call ThingsBoard listDevices', async () => {
      const mockDevices = [{ id: '1', name: 'Device 1' }];
      (thingsboard.listDevices as jest.Mock).mockResolvedValue(mockDevices);

      const result = await API.getTargets();
      
      expect(thingsboard.listDevices).toHaveBeenCalled();
      expect(result).toEqual(mockDevices);
    });

    test('connectWebSocket should call ThingsBoard openTelemetryWS', () => {
      const mockWebSocket = {} as any;
      (thingsboard.openTelemetryWS as jest.Mock).mockReturnValue(mockWebSocket);

      const result = API.connectWebSocket('test-token');
      
      expect(thingsboard.openTelemetryWS).toHaveBeenCalledWith('test-token');
      expect(result).toEqual(mockWebSocket);
    });
  });

  describe('Stats Methods', () => {
    test('getStats should return stats with device count', async () => {
      const mockDevices = [{ id: '1' }, { id: '2' }];
      (thingsboard.listDevices as jest.Mock).mockResolvedValue(mockDevices);

      const result = await API.getStats();
      
      expect(result).toEqual({
        targets: { online: 2 },
        rooms: { count: 0 },
        sessions: { latest: { score: 0 } },
        invites: [],
      });
    });

    test('getTrend7d should return empty array', async () => {
      const result = await API.getTrend7d();
      expect(result).toEqual([]);
    });
  });

  describe('Unimplemented Methods', () => {
    test('createTarget should throw error', async () => {
      await expect(API.createTarget('test', 1)).rejects.toThrow(
        'createTarget → not implemented with ThingsBoard yet'
      );
    });

    test('renameTarget should throw error', async () => {
      await expect(API.renameTarget(1, 'new-name')).rejects.toThrow(
        'renameTarget → not implemented with ThingsBoard yet'
      );
    });

    test('getRooms should throw error', async () => {
      await expect(API.getRooms()).rejects.toThrow(
        'getRooms → not implemented with ThingsBoard yet'
      );
    });
  });
}); 