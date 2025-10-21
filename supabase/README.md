# Supabase Edge Functions

This project uses Supabase Edge Functions to proxy ThingsBoard and Supabase workloads. All code lives under `supabase/functions` with shared utilities in `supabase/functions/_shared`.

## Required Secrets

Set the following secrets before deploying any function:

```bash
supabase secrets set \
  EDGE_SUPABASE_URL=https://<your-project-id>.supabase.co \
  EDGE_SUPABASE_ANON_KEY=ey... \
  EDGE_SUPABASE_SERVICE_ROLE_KEY=ey... \
  THINGSBOARD_URL=https://thingsboard.cloud \
  THINGSBOARD_USERNAME=<tb-email> \
  THINGSBOARD_PASSWORD=<tb-password>
```

- `EDGE_SUPABASE_URL`, `EDGE_SUPABASE_ANON_KEY` are required for token validation inside the function.
- `EDGE_SUPABASE_SERVICE_ROLE_KEY` enables server-side queries that bypass row-level security while still respecting per-user filtering in code.
- `THINGSBOARD_*` credentials are used to authenticate the ThingsBoard REST API. Update them to match your tenant or self-hosted instance.

## Local Development

1. Populate a `.env.functions` file with the same keys above. The CLI will read it when serving functions:

   ```bash
   THINGSBOARD_URL=https://thingsboard.cloud
   THINGSBOARD_USERNAME=example@domain.com
   THINGSBOARD_PASSWORD=super-secret
   EDGE_SUPABASE_URL=https://<project>.supabase.co
   EDGE_SUPABASE_ANON_KEY=ey...
   EDGE_SUPABASE_SERVICE_ROLE_KEY=ey...
   ```

2. Start the Supabase stack if needed: `supabase start`.
3. Serve the functions locally: `supabase functions serve targets-with-telemetry --env-file supabase/.env.functions`.
4. Invoke: `curl "http://127.0.0.1:54321/functions/v1/targets-with-telemetry" -H "Authorization: Bearer <anon-jwt>"`.

## Data Snapshots & Metrics Cache

Two support tables power the new edge APIs:

- `public.device_snapshots` keeps the latest ThingsBoard device state per user (room assignment, telemetry highlights, fetched timestamp).
- `public.dashboard_metrics_cache` stores precomputed dashboard metrics (hero counts, trend overview) with an expiration window.

They are populated by the `refresh-device-snapshots` function (see below) and read by the `dashboard-metrics` endpoint. Snapshots can be forced to refresh when necessary (admin tooling or scheduled cron).

## refresh-device-snapshots Endpoint

- **Method:** `POST` (no public JWT required; protect with a shared secret)
- **Headers:**
  - `x-refresh-secret: <value>` — must match `REFRESH_DEVICE_SNAPSHOT_SECRET` (if the env var is set).
- **Query Parameters:**
  - `user_id=<uuid>` (optional) limits the refresh to a single user; otherwise all active users are processed.
- **Response:**

```json
{
  "refreshedAt": "2024-06-20T18:30:00.000Z",
  "deviceCount": 12,
  "userCount": 3,
  "results": [
    { "userId": "…", "refreshed": true, "targetCount": 12 },
    { "userId": "…", "refreshed": false, "error": "ThingsBoard login failed" }
  ]
}
```

The function fetches all tenant devices/telemetry from ThingsBoard, merges Supabase room assignments for each active user, upserts `device_snapshots`, and recomputes `dashboard_metrics_cache`. Schedule it via Supabase cron (e.g., every 2 minutes) by deploying the function and configuring the secret.

### Additional Secrets

- `METRICS_CACHE_TTL_MS` (optional): override the default 5-minute metrics cache TTL.
- `SNAPSHOT_FRESHNESS_MS` (optional): controls how long a snapshot is considered "fresh" before the `dashboard-metrics` endpoint forces a ThingsBoard refresh (default 120 s).

## dashboard-metrics Endpoint

- **Method:** `GET` (or `POST`)
- **Query Parameters:**
  - `force=true` triggers a live refresh, ignoring cached metrics and stale snapshots.
- **Response:**

```json
{
  "metrics": {
    "summary": {
      "totalTargets": 12,
      "onlineTargets": 8,
      "offlineTargets": 4,
      "assignedTargets": 10,
      "unassignedTargets": 2,
      "totalRooms": 4,
      "lastUpdated": 1718800123456
    },
    "totals": {
      "totalSessions": 28,
      "bestScore": 950,
      "avgScore": 820.5
    },
    "recentSessions": [
      {
        "id": "…",
        "started_at": "2024-06-19T21:15:00Z",
        "score": 895,
        "hit_count": 42,
        "duration_ms": 180000,
        "accuracy_percentage": 92.3
      }
    ],
    "generatedAt": 1718800130000
  },
  "cached": false,
  "source": "thingsboard"
}
```

Without `force`, the endpoint attempts to (1) return the cached metrics if still valid, then (2) recompute from stored snapshots if they are fresh, otherwise (3) fetch live data via ThingsBoard and refresh the cache. It requires a valid Supabase JWT (`requireUser`).

## device-telemetry Endpoint

- **Method:** `GET` (WebSocket upgrade)
- **Query Parameters:**
  - `deviceIds` (comma-separated ThingsBoard device IDs) – required.
  - `access_token` – Supabase JWT used for user verification (add `apikey` if calling from the browser).
- **Messages:**

```json
// initial acknowledgement
{ "type": "connected", "timestamp": 1718800200000, "payload": { "deviceIds": ["device-a"] } }

// periodic heartbeat (every 15s)
{ "type": "heartbeat", "timestamp": 1718800215000 }

// telemetry payload sampled roughly every second
{
  "type": "telemetry",
  "timestamp": 1718800215123,
  "payload": [
    {
      "deviceId": "device-a",
      "telemetry": {
        "hits": [{ "ts": 1718800214000, "value": 17 }],
        "event": [{ "ts": 1718800214100, "value": "hit" }],
        "gameStatus": [{ "ts": 1718800214100, "value": "start" }]
      }
    }
  ]
}

// degraded mode (ThingsBoard fetch failed; backoff applied)
{ "type": "error", "timestamp": 1718800216000, "message": "telemetry_fetch_failed", "backoffMs": 3200 }
```

If ThingsBoard sampling fails, the server emits an `error` envelope with the suggested backoff and retries automatically using an exponential strategy. The client should keep the socket open and optionally fall back to REST polling if the socket closes.

## targets-with-telemetry Endpoint

- **Method:** `GET` (or `POST` with `{ "force": true }` payload)
- **Query Parameters:**
  - `force=true` (optional) bypasses the 30-second in-memory cache.
- **Response:**

```json
{
  "data": [
    {
      "id": "<device-id>",
      "name": "My Target",
      "roomId": "<room-uuid or null>",
      "roomName": "Room Name",
      "battery": 92,
      "wifiStrength": 68,
      "lastEvent": "hit",
      "lastActivityTime": 1718800000000,
      "telemetry": {
        "hits": [{ "value": 10, "ts": 1718800000000 }]
      }
    }
  ],
  "cached": false
}
```

The function validates the Supabase JWT, fetches ThingsBoard devices + telemetry, merges Supabase room assignments, and caches the result for 30 seconds per user.


## rooms Endpoint

- **Method:** `GET` (or `POST` with `{ "force": true }` payload)
- **Query Parameters:**
  - `force=true` (optional) bypasses the 30-second cache.
- **Response:**

```json
{
  "rooms": [
    {
      "id": "room-uuid",
      "name": "Basement",
      "room_type": "garage",
      "icon": "car",
      "order_index": 1,
      "targets": [
        {
          "id": "device-id",
          "name": "Target 1",
          "status": "online",
          "battery": 88,
          "wifiStrength": 70,
          "lastActivityTime": 1718800000000,
          "telemetry": { "hits": [{ "value": 12, "ts": 1718800000000 }] }
        }
      ],
      "targetCount": 1
    }
  ],
  "unassignedTargets": [
    {
      "id": "device-id-2",
      "name": "Spare Target",
      "roomId": null,
      "status": "offline",
      "telemetry": {}
    }
  ],
  "cached": false
}
```

This function aggregates rooms, Supabase assignments, and ThingsBoard telemetry so the client can render room dashboards without multiple network calls or exposing service-role credentials.
Existing clients can continue to use it while new dashboards transition to the snapshot-backed endpoints above.

## telemetry-history Endpoint

- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceIds": ["device-id-1", "device-id-2"],
    "startTs": 1718697600000,
    "endTs": 1719302400000,
    "limit": 1000,
    "keys": ["hits", "hit_ts", "beep_ts"]
  }
  ```
- **Response:**
  ```json
  {
    "devices": [
      {
        "deviceId": "device-id-1",
        "telemetry": {
          "hits": [{ "ts": 1718800000000, "value": 12 }],
          "hit_ts": [{ "ts": 1718800010000, "value": 1 }]
        }
      }
    ],
    "cached": false
  }
  ```

Returns raw ThingsBoard historical telemetry for a set of devices within a time window. The client can aggregate hits into chart buckets without making per-device calls.

## shooting-activity Endpoint

- **Method:** `POST`
- **Body:**
  ```json
  {
    "deviceIds": ["device-id-1", "device-id-2"],
    "keys": ["hits", "hit_ts", "event"]
  }
  ```
- **Response:**
  ```json
  {
    "activity": [
      {
        "deviceId": "device-id-1",
        "telemetry": {
          "hits": [{ "ts": 1718800000000, "value": 12 }],
          "hit_ts": [{ "ts": 1718800010000, "value": 1718800010000 }]
        }
      }
    ],
    "cached": false
  }
  ```

Provides the latest telemetry snapshot for active devices, reducing the dashboard's polling overhead during shooting sessions.

## game-control Endpoint

The `game-control` function proxies ThingsBoard game commands so the client no longer needs direct credentials.

- `GET` returns the latest device telemetry snapshot (status, hits, wifi, etc.).
- `POST` accepts `{ "action": "start" | "stop", "deviceIds": ["..."] }` plus an optional `gameId` to coordinate ThingsBoard RPCs.

Example start payload:

```json
{
  "action": "start",
  "deviceIds": ["f49dd5a0-a014-11f0-b4af-b334f2239a02"],
  "gameId": "GM-1718900000000"
}
```

Successful response:

```json
{
  "action": "start",
  "gameId": "GM-1718900000000",
  "startedAt": 1718900000123,
  "successCount": 1,
  "failureCount": 0,
  "results": [
    {
      "deviceId": "f49dd5a0-a014-11f0-b4af-b334f2239a02",
      "success": true
    }
  ]
}
```

## Deployment

Deploy the function with the Supabase CLI (ensure you have authenticated and set the correct project reference):

```bash
supabase functions deploy game-control --project-ref <your-project-ref>
```

If your `project-ref` is already stored in `supabase/config.toml`, you can omit the flag:

```bash
supabase functions deploy game-control
```
