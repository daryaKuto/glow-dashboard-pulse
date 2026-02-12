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

  if (gameStatus && ["start", "busy", "active"].includes(String(gameStatus).toLowerCase())) {
    return "online";
  }
  if (isActiveFromTb === false) {
    if (hasRecentActivity) return "standby";
    return "offline";
  }
  if (isActiveFromTb === true) {
    const normalized = (rawStatus ?? "").toLowerCase();
    if (["online", "active", "active_online", "busy"].includes(normalized)) {
      return "online";
    }
    // Connected but idle: only standby if we have recent server activity
    // (avoids all-standby when TB wrongly reports active).
    if (hasRecentActivity) return "standby";
    return "offline";
  }
  // When active is null: only standby if server lastActivityTime is recent (matches script).
  const normalized = (rawStatus ?? "").toLowerCase();
  if (["online", "active", "active_online", "busy"].includes(normalized)) {
    return "online";
  }
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
