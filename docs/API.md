
# API Documentation

## Overview

This document outlines the API endpoints used by the FunGun Training System. The current implementation uses a mock API with MSW (Mock Service Worker) for development purposes.

## Base URL

- Development (Mock): `/` (relative to the application)
- Production: `https://api.fungun.dev/` (planned)

## Authentication

API requests require authentication via a token passed as either:
- Query parameter: `?token=your_token`
- Authorization header: `Authorization: Bearer your_token`

## REST Endpoints

### Statistics

#### GET /stats/targets
Returns statistics about targets.

**Response**:
```json
{
  "total": 4,
  "online": 3
}
```

#### GET /stats/rooms
Returns statistics about rooms.

**Response**:
```json
{
  "count": 2
}
```

#### GET /stats/scenarios
Returns statistics about available scenarios.

**Response**:
```json
{
  "count": 3
}
```

#### GET /stats/hits
Returns hit trend data for the last 7 days.

**Response**:
```json
[
  {
    "date": "2025-04-22",
    "hits": 45
  },
  {
    "date": "2025-04-23",
    "hits": 67
  }
]
```

### Targets

#### GET /targets
Returns a list of all targets.

**Response**:
```json
[
  {
    "id": 1,
    "name": "Target Alpha",
    "status": "online",
    "battery": 95,
    "roomId": 1
  }
]
```

#### PUT /targets/:id
Update a target's properties.

**Request Body**:
```json
{
  "name": "New Target Name",
  "roomId": 2
}
```

#### POST /targets/locate/:id
Signal a target to help locate it physically.

**Response**:
```json
{
  "success": true
}
```

### Rooms

#### GET /rooms
Returns a list of all rooms.

**Response**:
```json
[
  {
    "id": 1,
    "name": "Living Room",
    "order": 1,
    "targetCount": 2
  }
]
```

#### POST /rooms
Create a new room.

**Request Body**:
```json
{
  "name": "New Room"
}
```

#### PUT /rooms/:id
Update a room's properties.

**Request Body**:
```json
{
  "name": "Updated Room Name"
}
```

#### DELETE /rooms/:id
Delete a room.

#### PUT /rooms/order
Update the order of rooms.

**Request Body**:
```json
{
  "roomIds": [2, 1, 3] 
}
```

### Sessions

#### GET /sessions
Returns a list of all sessions.

**Response**:
```json
[
  {
    "id": 1,
    "name": "Morning Practice",
    "date": "2025-04-25T09:00:00Z",
    "duration": 15,
    "score": 87,
    "accuracy": 75
  }
]
```

#### POST /sessions
Create a new session.

**Request Body**:
```json
{
  "scenarioId": 1,
  "roomIds": [1, 2]
}
```

#### POST /sessions/:id/end
End an active session.

### Invites

#### GET /invites/pending
Returns a list of pending invites.

**Response**:
```json
[
  {
    "id": 1,
    "token": "abc123",
    "sessionId": 1,
    "createdAt": "2025-04-25T09:05:00Z"
  }
]
```

#### POST /invites
Create a new invite for a session.

**Request Body**:
```json
{
  "sessionId": 1
}
```

## WebSocket API

### Hit WebSocket

**URL**: `wss://api.fungun.dev/hits/:userId`

**Events**:
- `hit`: Sent when a target is hit
  ```json
  {
    "type": "hit",
    "targetId": "target123",
    "score": 75
  }
  ```

### Session WebSocket

**URL**: `wss://api.fungun.dev/session/:sessionId`

**Events**:
- `score_update`: Sent when a player's score changes
  ```json
  {
    "type": "score_update",
    "userId": "user123",
    "hits": 12,
    "accuracy": 85,
    "timestamp": "2025-04-25T09:10:00Z"
  }
  ```

## Error Handling

API endpoints return appropriate HTTP status codes:

- `200 OK`: Successful request
- `201 Created`: Resource created
- `204 No Content`: Resource deleted
- `400 Bad Request`: Invalid request
- `404 Not Found`: Resource not found
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions

Error responses include a message explaining the error.

## Rate Limiting

The API implements rate limiting:
- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated requests

## Implementation Details

The current implementation uses MSW to mock these endpoints during development:
- Mock handlers are defined in `src/mocks/handlers.ts`
- WebSocket mocking is in `src/mocks/mockSocket.ts`
- Data is stored in memory during the session
