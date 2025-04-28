
# API Documentation

## Overview

This document outlines the API endpoints used by the Target Practice Management System. Note that the current implementation uses a mock API with MSW (Mock Service Worker) for development purposes.

## Base URL

For mock implementation: `/` (relative to the application)
For production: `https://api.fungun.dev/`

## Authentication

All API requests require a token passed either as:
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
  },
  // ...more dates
]
```

#### GET /sessions/latest
Returns information about the latest session.

**Response**:
```json
{
  "id": 1,
  "name": "Morning Practice",
  "date": "2023-04-25T09:00:00Z",
  "score": 87
}
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
  },
  // ...more targets
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

**Response**: The updated target object

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
  },
  // ...more rooms
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

**Response**: The created room object with a new ID

#### PUT /rooms/:id
Update a room's properties.

**Request Body**:
```json
{
  "name": "Updated Room Name"
}
```

**Response**: The updated room object

#### DELETE /rooms/:id
Delete a room.

**Response**: Empty response with 204 status code

#### PUT /rooms/order
Update the order of rooms.

**Request Body**:
```json
{
  "roomIds": [2, 1, 3] 
}
```

**Response**: The list of rooms with updated order

### Sessions

#### GET /sessions
Returns a list of all sessions.

**Response**:
```json
[
  {
    "id": 1,
    "name": "Morning Practice",
    "date": "2023-04-25T09:00:00Z",
    "duration": 15,
    "score": 87,
    "accuracy": 75
  },
  // ...more sessions
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

**Response**: The created session object

#### POST /sessions/:id/end
End an active session.

**Response**: The session object with final score and accuracy

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
    "createdAt": "2023-04-25T09:05:00Z"
  },
  // ...more invites
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

**Response**:
```json
{
  "token": "xyz789"
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
    "timestamp": "2023-04-25T09:10:00Z"
  }
  ```

## Error Handling

All API endpoints return appropriate HTTP status codes:

- `200 OK`: Successful request
- `201 Created`: Resource successfully created
- `204 No Content`: Resource successfully deleted
- `400 Bad Request`: Invalid request
- `404 Not Found`: Resource not found

Error responses include a message explaining the error.

## Rate Limiting

The API implements rate limiting to prevent abuse:
- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated requests

