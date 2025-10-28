/**
 * Countdown Service for Scenario Start Sequences
 * Handles countdown signals that sync with ThingsBoard beep signals
 */

export interface CountdownSignalPayload {
  signal: 'start_countdown' | 'countdown_3' | 'countdown_2' | 'countdown_1' | 'go';
  timestamp: number;
  sessionId: string;
  scenarioId: string;
  targetDeviceIds: string[];
  roomId: string;
  userId: string;
}

export interface CountdownConfig {
  sessionId: string;
  scenarioId: string;
  targetDeviceIds: string[];
  roomId: string;
  userId: string;
  useMockData: boolean;
}

class CountdownService {
  /**
   * Send countdown signal to ThingsBoard devices
   * This will trigger synchronized beeps on all target devices
   */
  async sendCountdownSignal(
    config: CountdownConfig, 
    signal: CountdownSignalPayload['signal']
  ): Promise<void> {
    const payload: CountdownSignalPayload = {
      signal,
      timestamp: Date.now(),
      sessionId: config.sessionId,
      scenarioId: config.scenarioId,
      targetDeviceIds: config.targetDeviceIds,
      roomId: config.roomId,
      userId: config.userId
    };

    if (config.useMockData) {
      console.log(`[Mock Countdown] Signal: ${signal}`, payload);
      this.mockCountdownAPI(payload);
      return;
    }

    try {
      await this.sendViaEdge(payload);
      console.log(`[Live Countdown] Signal sent: ${signal}`, payload);
    } catch (error) {
      console.error('Failed to send countdown signal:', error);
      throw error;
    }
  }

  /**
   * Mock API simulation - shows exactly how we'll structure ThingsBoard calls
   */
  private async mockCountdownAPI(payload: CountdownSignalPayload): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log(`[Mock API] POST /api/scenario/countdown`, {
      method: 'POST',
      endpoint: '/api/scenario/countdown',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer <token>'
      },
      body: payload
    });

    // Simulate sending to each target device
    payload.targetDeviceIds.forEach(deviceId => {
      console.log(`[Mock Device Signal] Device ${deviceId}:`, {
        deviceId,
        signal: payload.signal,
        timestamp: payload.timestamp,
        beepFrequency: this.getBeepFrequency(payload.signal),
        beepDuration: this.getBeepDuration(payload.signal)
      });
    });
  }

  /**
   * Real ThingsBoard implementation structure
   */
  private async sendViaEdge(payload: CountdownSignalPayload): Promise<void> {
    const telemetryData = {
      countdown_signal: payload.signal,
      countdown_timestamp: payload.timestamp,
      session_id: payload.sessionId,
      scenario_id: payload.scenarioId,
      beep_frequency: this.getBeepFrequency(payload.signal),
      beep_duration: this.getBeepDuration(payload.signal),
      beep_enabled: true,
      room_id: payload.roomId,
      user_id: payload.userId,
      target_count: payload.targetDeviceIds.length,
    };

    const { error: telemetryError } = await supabase.functions.invoke('device-command', {
      body: {
        action: 'send-telemetry',
        sendTelemetry: {
          deviceIds: payload.targetDeviceIds,
          telemetry: telemetryData,
        },
      },
    });

    if (telemetryError) {
      throw new Error(telemetryError.message ?? 'Failed to send countdown telemetry');
    }

    if (payload.signal === 'go') {
      const { error: rpcError } = await supabase.functions.invoke('device-command', {
        body: {
          action: 'send-rpc-batch',
          rpcBatch: {
            deviceIds: payload.targetDeviceIds,
            method: 'startScenario',
            params: {
              sessionId: payload.sessionId,
              scenarioId: payload.scenarioId,
              startTime: payload.timestamp,
              targetDeviceIds: payload.targetDeviceIds,
            },
          },
        },
      });

      if (rpcError) {
        throw new Error(rpcError.message ?? 'Failed to send startScenario command');
      }
    }
  }

  /**
   * Get beep frequency for each countdown phase
   */
  private getBeepFrequency(signal: CountdownSignalPayload['signal']): number {
    switch (signal) {
      case 'countdown_3': return 600;
      case 'countdown_2': return 700;
      case 'countdown_1': return 800;
      case 'go': return 1000;
      default: return 500;
    }
  }

  /**
   * Get beep duration for each countdown phase
   */
  private getBeepDuration(signal: CountdownSignalPayload['signal']): number {
    switch (signal) {
      case 'countdown_3':
      case 'countdown_2':
      case 'countdown_1':
        return 300; // Short beeps for countdown
      case 'go':
        return 500; // Longer beep for GO
      default:
        return 200;
    }
  }

  /**
   * Cancel countdown sequence (emergency stop)
   */
  async cancelCountdown(config: CountdownConfig): Promise<void> {
    const payload: CountdownSignalPayload = {
      signal: 'start_countdown', // Reuse start_countdown as cancel signal
      timestamp: Date.now(),
      sessionId: config.sessionId,
      scenarioId: config.scenarioId,
      targetDeviceIds: config.targetDeviceIds,
      roomId: config.roomId,
      userId: config.userId
    };

    if (config.useMockData) {
      console.log('[Mock] Countdown cancelled', payload);
      return;
    }

    try {
      const { error: rpcError } = await supabase.functions.invoke('device-command', {
        body: {
          action: 'send-rpc-batch',
          rpcBatch: {
            deviceIds: config.targetDeviceIds,
            method: 'cancelCountdown',
            params: {
              sessionId: config.sessionId,
              timestamp: payload.timestamp,
            },
          },
        },
      });

      if (rpcError) {
        throw new Error(rpcError.message ?? 'Failed to cancel countdown');
      }
    } catch (error) {
      console.error('Failed to cancel countdown:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const countdownService = new CountdownService();

import { supabase } from '@/integrations/supabase/client';
