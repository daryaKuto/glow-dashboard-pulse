/**
 * Shared device status derivation for edge functions.
 *
 * 12 hours – must match:
 *   - scripts/check-online-targets-thingsboard.sh  RECENT_MS
 *   - src/lib/edge.ts                              RECENT_THRESHOLD_MS
 *   - src/features/games/lib/thingsboard-targets.ts RECENT_THRESHOLD_MS
 */
export const RECENT_THRESHOLD_MS = 43_200_000;

/**
 * Derive a 3-state display status from raw ThingsBoard data.
 *
 * Status semantics:
 *   - **online**  = device is in an active game session (gameStatus is start/busy/active)
 *   - **standby** = device is powered on / recently active, but NOT in a game
 *   - **offline** = device hasn't been seen for >12 hours
 *
 * IMPORTANT: ThingsBoard's device `rawStatus` ("ACTIVE"/"INACTIVE") indicates
 * *connection* state, NOT game state. A connected device that is idle should be
 * "standby", not "online". Only `gameStatus` determines true "online" status.
 *
 * Logic mirrors `deriveStatusFromRaw` on the frontend and
 * `compute_status` in the shell diagnostic script.
 */
export function determineStatus(
  rawStatus: string | null,
  gameStatus: string | null,
  lastShotTime: number | null,
  isActiveFromTb: boolean | null,
  lastActivityTimeFromTb: number | null,
): "online" | "standby" | "offline" {
  const now = Date.now();
  const hasRecentActivity =
    lastActivityTimeFromTb != null && now - lastActivityTimeFromTb <= RECENT_THRESHOLD_MS;

  // STEP 1: gameStatus is the ONLY reliable indicator of an active game session.
  if (gameStatus && ["start", "busy", "active"].includes(String(gameStatus).toLowerCase())) {
    return "online";
  }

  // STEP 2: Device is explicitly disconnected (active === false).
  if (isActiveFromTb === false) {
    if (hasRecentActivity) return "standby";
    return "offline";
  }

  // STEP 3: Device is connected (active === true).
  // Connected but not in a game → standby (if recently active) or offline.
  if (isActiveFromTb === true) {
    // Connected device with recent activity is standby (powered on & idle).
    if (hasRecentActivity) return "standby";
    return "offline";
  }

  // STEP 4: active is null/unknown — fall back to lastActivityTime.
  if (hasRecentActivity) return "standby";
  return "offline";
}

/**
 * Parse the `active` server attribute from ThingsBoard into a boolean.
 * ThingsBoard may return it as a boolean, string "true"/"false", or null.
 */
export function parseActiveAttribute(value: unknown): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
}

/**
 * Parse the `lastActivityTime` server attribute from ThingsBoard into
 * a millisecond timestamp. ThingsBoard may return seconds or milliseconds.
 */
export function parseLastActivityTime(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  // ThingsBoard sometimes returns seconds instead of milliseconds
  return num < 1e11 ? num * 1000 : num;
}
