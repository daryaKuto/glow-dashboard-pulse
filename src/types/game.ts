/**
 * TERMINOLOGY:
 * - Game / Game Template: Preset game configurations (e.g., "Double Tap")
 *   defined in src/data/games.ts and executed via ThingsBoard
 * - Session / Game Instance: A specific playthrough of a game by a user,
 *   stored in Supabase with complete analytics
 * - gameId: ThingsBoard's unique identifier for a game instance (e.g., "GM-001")
 */

/**
 * Scenario is a legacy name for Game. Games are preset templates that users can play.
 * @deprecated Use GameTemplate from @/data/games instead
 */
export interface Scenario {
  id: number;
  name: string;
  targetCount?: number;  // optional for backward compatibility
  difficulty?: string;   // optional for backward compatibility
  duration?: number;     // optional for backward compatibility
  description?: string;  // optional for backward compatibility
} 