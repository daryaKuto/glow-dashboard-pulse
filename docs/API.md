
# API Documentation

## Overview

This document outlines the API endpoints used by the DryFire Training System. The current implementation integrates with ThingsBoard Cloud API for device management, telemetry data, and user management.

## Base URL

- Development: `http://localhost:8080/api/tb` (via Vite proxy)
- Production: `https://thingsboard.cloud/api`
- Swagger UI: `https://thingsboard.cloud/swagger-ui/`

## Authentication

API requests require authentication via JWT token obtained through the login endpoint:

**Login Endpoint:** `POST /api/auth/login`
```json
{
  "username": "andrew.tam@gmail.com",
  "password": "dryfire2025"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzUxMiJ9...",
  "refreshToken": "eyJhbGciOiJIUzUxMiJ9...",
  "userId": { "id": "user-id" },
  "scopes": ["TENANT_ADMIN"]
}
```

**Authorization Header:** `X-Authorization: Bearer {token}`

## ThingsBoard API Endpoints

### Device Management

#### GET /api/tenant/devices
Returns a paginated list of devices owned by the tenant.

**Query Parameters:**
- `pageSize` (required): Maximum amount of entities to return (default: 100)
- `page` (required): Sequence number of page starting from 0
- `type` (optional): Device type filter
- `textSearch` (optional): Case-insensitive substring filter based on device name
- `sortProperty` (optional): Property to sort by
- `sortOrder` (optional): ASC or DESC

**Response:**
```json
{
  "data": [
    {
      "id": {
        "entityType": "DEVICE",
        "id": "device-uuid"
      },
      "name": "Dryfire-Target-001",
      "type": "default",
      "createdTime": 1747821447067,
      "tenantId": { "entityType": "TENANT", "id": "tenant-uuid" },
      "customerId": { "entityType": "CUSTOMER", "id": "customer-uuid" },
      "additionalInfo": {
        "roomId": 1,
        "roomName": "Living Room"
      }
    }
  ],
  "totalPages": 1,
  "totalElements": 1,
  "hasNext": false
}
```

#### GET /api/device/{deviceId}
Get device by ID.

#### POST /api/device
Create a new device.

**Request Body:**
```json
{
  "name": "New Target Device",
  "type": "default",
  "additionalInfo": {
    "roomId": 1,
    "roomName": "Living Room"
  }
}
```

#### POST /api/device/{deviceId}
Update device properties.

#### DELETE /api/device/{deviceId}
Delete a device.

### User Management

#### GET /api/customer/users
Returns a paginated list of users for the current tenant.

**Query Parameters:**
- `pageSize` (required): Maximum amount of entities in one page (default: 100)
- `page` (required): Sequence number of page starting from 0
- `textSearch` (optional): Case-insensitive substring filter based on user email
- `sortProperty` (optional): Property to sort by
- `sortOrder` (optional): ASC or DESC

**Response:**
```json
{
  "data": [
    {
      "id": {
        "entityType": "USER",
        "id": "user-uuid"
      },
      "email": "dryfire.user1@gmail.com",
      "firstName": "user1",
      "lastName": null,
      "authority": "CUSTOMER_USER",
      "createdTime": 1739341687805,
      "tenantId": { "entityType": "TENANT", "id": "tenant-uuid" },
      "customerId": { "entityType": "CUSTOMER", "id": "customer-uuid" }
    }
  ]
}
```

### Telemetry Data

#### GET /api/plugins/telemetry/{entityType}/{entityId}/keys/timeseries
Get all telemetry keys for a device.

**Path Parameters:**
- `entityType`: Entity type (e.g., "DEVICE")
- `entityId`: Entity ID

**Response:**
```json
[
  "temperature",
  "test",
  "msg",
  "deviceName",
  "event",
  "deviceId",
  "gameId"
]
```

#### GET /api/plugins/telemetry/{entityType}/{entityId}/values/timeseries
Get telemetry values for specific keys.

**Query Parameters:**
- `keys`: Comma-separated list of telemetry keys
- `startTs` (optional): Start timestamp
- `endTs` (optional): End timestamp
- `limit` (optional): Maximum number of values to return
- `agg` (optional): Aggregation function (NONE, AVG, SUM, etc.)

### Device Attributes

#### GET /api/plugins/telemetry/{entityType}/{entityId}/values/attributes/{scope}
Get device attributes.

**Path Parameters:**
- `scope`: Attribute scope (SHARED_SCOPE, SERVER_SCOPE, CLIENT_SCOPE)

#### POST /api/plugins/telemetry/{entityType}/{entityId}/attributes/{scope}
Set device attributes.

**Request Body:**
```json
{
  "roomId": 1,
  "location": "Living Room",
  "status": "active"
}
```

## WebSocket API

### Telemetry WebSocket

**URL**: `wss://thingsboard.cloud/api/ws/plugins/telemetry?token={jwt_token}`

**Events:**
- Real-time telemetry updates from devices
- Device status changes
- Hit events and scoring data

## Error Handling

ThingsBoard API returns standard HTTP status codes:

- `200 OK`: Successful request
- `201 Created`: Resource created
- `204 No Content`: Resource deleted
- `400 Bad Request`: Invalid request
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found

## Rate Limiting

ThingsBoard Cloud implements rate limiting:
- Varies by subscription plan
- Standard limits apply for API calls
- WebSocket connections have separate limits

## Implementation Details

The current implementation:
- Uses Vite proxy for CORS handling in development
- Integrates with ThingsBoard Cloud API
- Supports JWT token authentication
- Includes automatic token refresh
- Provides SwaggerUI integration for API testing
- WebSocket mocking is in `src/mocks/mockSocket.ts`
- Data is stored in memory during the session
