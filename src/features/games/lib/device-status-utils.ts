import type { NormalizedGameDevice } from '@/features/games/hooks/use-game-devices';

/**
 * Derive the connection status of a game device from its raw ThingsBoard status.
 * Pure function — no React dependencies.
 */
export function deriveConnectionStatus(
  device: NormalizedGameDevice
): 'online' | 'standby' | 'offline' {
  const status = device.raw?.status;
  if (status === 'online' || status === 'standby' || status === 'offline') {
    return status;
  }
  return 'offline';
}

/**
 * Returns true if the device is online or standby (i.e. not offline).
 * Pure function — no React dependencies.
 */
export function deriveIsOnline(device: NormalizedGameDevice): boolean {
  return deriveConnectionStatus(device) !== 'offline';
}
