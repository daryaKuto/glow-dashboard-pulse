import { fetchTargetsWithTelemetry, fetchTargetDetails, type TargetDetailsOptions } from '@/lib/edge';
import { supabase } from '@/data/supabase-client';
import { apiOk, apiErr, type ApiResponse } from '@/shared/lib/api-response';
import type { TargetRepository } from '@/domain/targets/ports';
import type { Target, TargetDetail, TargetsSummary } from './schema';

/**
 * Repository layer for Targets feature
 * 
 * Handles all data access operations (edge function calls, ThingsBoard queries).
 * Returns ApiResponse<T> for consistent error handling.
 */

export interface TargetsWithSummary {
  targets: Target[];
  summary: TargetsSummary | null;
  cached: boolean;
}

const getCurrentUserId = async (): Promise<string> => {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Authentication error: ${error.message}`);
  }

  if (!user) {
    throw new Error('No authenticated user found');
  }

  return user.id;
};

/**
 * Get all targets with telemetry from edge function
 */
export async function getTargets(force = false): Promise<ApiResponse<TargetsWithSummary>> {
  try {
    const result = await fetchTargetsWithTelemetry(force);
    return apiOk({
      targets: result.targets,
      summary: result.summary,
      cached: result.cached,
    });
  } catch (error) {
    console.error('[Targets Repo] Error fetching targets:', error);
    return apiErr(
      'FETCH_TARGETS_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch targets',
      error
    );
  }
}

/**
 * Get target details (telemetry, history) for specific devices
 */
export async function getTargetDetails(
  deviceIds: string[],
  options?: TargetDetailsOptions
): Promise<ApiResponse<TargetDetail[]>> {
  try {
    if (deviceIds.length === 0) {
      return apiOk([]);
    }

    const { details } = await fetchTargetDetails(deviceIds, options);
    return apiOk(details);
  } catch (error) {
    console.error('[Targets Repo] Error fetching target details:', error);
    return apiErr(
      'FETCH_TARGET_DETAILS_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch target details',
      error
    );
  }
}

/**
 * Get targets summary only
 */
export async function getTargetsSummary(force = false): Promise<ApiResponse<TargetsSummary | null>> {
  try {
    const { fetchTargetsSummary } = await import('@/lib/edge');
    const result = await fetchTargetsSummary(force);
    return apiOk(result.summary);
  } catch (error) {
    console.error('[Targets Repo] Error fetching targets summary:', error);
    return apiErr(
      'FETCH_TARGETS_SUMMARY_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch targets summary',
      error
    );
  }
}

/**
 * Send RPC command to devices via edge function
 */
export async function sendDeviceCommand(
  deviceIds: string[],
  method: string,
  params?: Record<string, unknown>
): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase.functions.invoke('device-command', {
      body: {
        action: 'rpc',
        rpc: {
          deviceIds,
          method,
          params: params || {},
        },
      },
    });

    if (error) {
      console.error('[Targets Repo] Error sending device command:', error);
      return apiErr(
        'DEVICE_COMMAND_ERROR',
        error.message || 'Failed to send device command',
        error
      );
    }

    return apiOk(undefined);
  } catch (error) {
    console.error('[Targets Repo] Error sending device command:', error);
    return apiErr(
      'DEVICE_COMMAND_ERROR',
      error instanceof Error ? error.message : 'Failed to send device command',
      error
    );
  }
}

/**
 * Set device attributes via edge function
 */
export async function setDeviceAttributes(
  deviceIds: string[],
  attributes: Record<string, unknown>
): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase.functions.invoke('device-command', {
      body: {
        action: 'set-attributes',
        setAttributes: {
          deviceIds,
          attributes,
        },
      },
    });

    if (error) {
      console.error('[Targets Repo] Error setting device attributes:', error);
      return apiErr(
        'SET_ATTRIBUTES_ERROR',
        error.message || 'Failed to set device attributes',
        error
      );
    }

    return apiOk(undefined);
  } catch (error) {
    console.error('[Targets Repo] Error setting device attributes:', error);
    return apiErr(
      'SET_ATTRIBUTES_ERROR',
      error instanceof Error ? error.message : 'Failed to set device attributes',
      error
    );
  }
}

/**
 * Get all target custom names for the current user
 */
export async function getTargetCustomNames(): Promise<ApiResponse<Map<string, string>>> {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('user_target_custom_names')
      .select('target_id, custom_name')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    const customNamesMap = new Map<string, string>();
    data?.forEach((record) => {
      customNamesMap.set(record.target_id, record.custom_name);
    });

    return apiOk(customNamesMap);
  } catch (error) {
    console.error('[Targets Repo] Error fetching target custom names:', error);
    return apiErr(
      'FETCH_TARGET_CUSTOM_NAMES_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch target custom names',
      error
    );
  }
}

/**
 * Set a custom name for a target
 */
export async function setTargetCustomName(
  targetId: string,
  originalName: string,
  customName: string
): Promise<ApiResponse<void>> {
  try {
    if (!customName.trim()) {
      return apiErr('VALIDATION_ERROR', 'Custom name cannot be empty');
    }

    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('user_target_custom_names')
      .upsert({
        user_id: userId,
        target_id: targetId,
        original_name: originalName,
        custom_name: customName.trim(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,target_id',
      });

    if (error) {
      throw error;
    }

    return apiOk(undefined);
  } catch (error) {
    console.error('[Targets Repo] Error setting target custom name:', error);
    return apiErr(
      'SET_TARGET_CUSTOM_NAME_ERROR',
      error instanceof Error ? error.message : 'Failed to set target custom name',
      error
    );
  }
}

/**
 * Remove a custom name for a target
 */
export async function removeTargetCustomName(targetId: string): Promise<ApiResponse<void>> {
  try {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('user_target_custom_names')
      .delete()
      .eq('user_id', userId)
      .eq('target_id', targetId);

    if (error) {
      throw error;
    }

    return apiOk(undefined);
  } catch (error) {
    console.error('[Targets Repo] Error removing target custom name:', error);
    return apiErr(
      'REMOVE_TARGET_CUSTOM_NAME_ERROR',
      error instanceof Error ? error.message : 'Failed to remove target custom name',
      error
    );
  }
}

/**
 * Repository adapter (ports & adapters pattern)
 */
export const targetsRepository: TargetRepository = {
  getTargets,
  getTargetDetails,
  getTargetsSummary,
  sendDeviceCommand,
  setDeviceAttributes,
  getTargetCustomNames,
  setTargetCustomName,
  removeTargetCustomName,
};
