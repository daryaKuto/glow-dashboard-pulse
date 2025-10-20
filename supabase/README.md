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
