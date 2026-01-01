/**
 * Service layer for Games feature
 * 
 * Contains business logic and orchestration.
 * Uses repository functions and returns ApiResponse<T>.
 */

import { getGameTemplates } from './repo';
import type { GameTemplate } from './schema';

/**
 * Get all game templates
 */
export async function getGameTemplatesService(): Promise<import('@/shared/lib/api-response').ApiResponse<GameTemplate[]>> {
  return getGameTemplates();
}

