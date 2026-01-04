/**
 * Games Domain Mappers
 *
 * Transform data between layers.
 * Pure functions - no React or Supabase imports.
 */

/**
 * Database row shape (snake_case).
 */
export type GameDbRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  target_count: number | null;
  shots_per_target: number | null;
  time_limit_ms: number | null;
  is_active: boolean | null;
  is_public: boolean | null;
  thingsboard_config: unknown | null;
  rules: unknown | null;
  created_at: string | null;
  updated_at: string | null;
};

/**
 * Domain model (camelCase).
 */
export type GameTemplateDomainModel = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  targetCount: number;
  shotsPerTarget: number;
  timeLimitMs: number | null;
  isActive: boolean;
  isPublic: boolean;
  thingsboardConfig: Record<string, unknown> | null;
  rules: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const toBoolean = (value: unknown, fallback = false): boolean => {
  return typeof value === 'boolean' ? value : fallback;
};

const toRecordOrNull = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

/**
 * Map game row to domain model.
 */
export function mapGameRowToDomain(row: GameDbRow): GameTemplateDomainModel {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    difficulty: row.difficulty,
    targetCount: toNumber(row.target_count),
    shotsPerTarget: toNumber(row.shots_per_target),
    timeLimitMs: row.time_limit_ms ?? 0,
    isActive: toBoolean(row.is_active),
    isPublic: toBoolean(row.is_public),
    thingsboardConfig: toRecordOrNull(row.thingsboard_config),
    rules: toRecordOrNull(row.rules),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}
