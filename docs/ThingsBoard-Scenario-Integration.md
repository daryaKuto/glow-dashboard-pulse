# ThingsBoard Scenario Integration Documentation

## Overview

This document outlines the integration requirements for implementing shooting scenario functionality in ThingsBoard. The system enables structured training drills with real-time data collection, precise timing control, and comprehensive performance analysis.

## Architecture Overview

```
Frontend Dashboard → ThingsBoard API → Target Devices
                  ↓
            Real-time WebSocket Updates
                  ↓
            Performance Analytics
```

## Core Concepts

### Scenario Session
A **Scenario Session** represents a complete training drill execution with:
- Unique session identifier
- Multiple target devices
- Timed sequence of commands
- Real-time hit detection
- Performance scoring

### Double Tap Scenario
The primary scenario implementation:
- **2 targets** participate
- **2 shots per target** (4 total shots required)
- **10-second time limit**
- **Alternating sequence**: Target1 → Target2 → Target1 → Target2
- **2-second intervals** between commands

## Data Flow

### 1. Session Initialization

**Frontend → ThingsBoard**
```json
POST /api/scenarios/start
{
  "sessionId": "session_1758159000000_xyz123",
  "scenarioId": "double-tap",
  "targetDeviceIds": ["device1", "device2"],
  "roomId": "room_123",
  "userId": "user_456",
  "startTime": 1758159000000,
  "configuration": {
    "targetCount": 2,
    "shotsPerTarget": 2,
    "timeLimitMs": 10000,
    "sequence": "alternating"
  }
}
```

**Expected Response**
```json
{
  "success": true,
  "sessionId": "session_1758159000000_xyz123",
  "status": "active",
  "expectedShots": 4,
  "startTime": 1758159000000
}
```

### 2. Command Sequence Execution

**ThingsBoard → Target Devices (RPC Commands)**

Commands sent at precise intervals (every 2.5 seconds):

```json
// T+1s: First command to Target 1
{
  "method": "beep",
  "params": {
    "sessionId": "session_1758159000000_xyz123",
    "type": "go",
    "sequence": 1,
    "targetNumber": 1,
    "shotNumber": 1,
    "timestamp": 1758159001000,
    "responseWindow": 1500
  }
}

// T+3s: First command to Target 2  
{
  "method": "beep",
  "params": {
    "sessionId": "session_1758159000000_xyz123",
    "type": "go",
    "sequence": 2,
    "targetNumber": 2,
    "shotNumber": 1,
    "timestamp": 1758159003000,
    "responseWindow": 1500
  }
}

// T+5s: Second command to Target 1
{
  "method": "beep", 
  "params": {
    "sessionId": "session_1758159000000_xyz123",
    "type": "go",
    "sequence": 3,
    "targetNumber": 1,
    "shotNumber": 2,
    "timestamp": 1758159005000,
    "responseWindow": 1500
  }
}

// T+7s: Second command to Target 2
{
  "method": "beep",
  "params": {
    "sessionId": "session_1758159000000_xyz123", 
    "type": "go",
    "sequence": 4,
    "targetNumber": 2,
    "shotNumber": 2,
    "timestamp": 1758159007000,
    "responseWindow": 1500
  }
}
```

### 3. Hit Detection and Telemetry

**Target Devices → ThingsBoard (Telemetry)**

When a target detects a hit, it sends telemetry data:

```json
{
  "scenario_session_id": "session_1758159000000_xyz123",
  "hit_timestamp": 1758159001250,
  "hit_sequence": 1,
  "shot_number": 1,
  "beep_reference": 1,
  "reaction_time_ms": 250,
  "target_number": 1,
  "accuracy": "hit",
  "sensor_data": {
    "zone": "center",
    "impact": 85,
    "confidence": 95
  }
}
```

### 4. Real-Time Updates

**ThingsBoard → Frontend (WebSocket)**

Continuous updates during scenario execution:

```json
{
  "sessionId": "session_1758159000000_xyz123",
  "progress": 50,
  "hitsReceived": 2,
  "expectedHits": 4,
  "timeRemaining": 5000,
  "currentTarget": 1,
  "lastHitTime": 1758159005100,
  "averageReactionTime": 275
}
```

### 5. Session Completion

**ThingsBoard → Frontend**

Final results calculation:

```json
{
  "sessionId": "session_1758159000000_xyz123",
  "status": "completed",
  "results": {
    "totalHits": 4,
    "expectedHits": 4,
    "accuracy": 100,
    "averageReactionTime": 285,
    "fastestReactionTime": 220,
    "slowestReactionTime": 350,
    "totalDuration": 8500,
    "score": 92,
    "passed": true,
    "targetResults": [
      {
        "targetDeviceId": "device1",
        "targetNumber": 1,
        "hitsReceived": 2,
        "expectedHits": 2,
        "accuracy": 100,
        "averageReactionTime": 275,
        "reactionTimes": [250, 300]
      },
      {
        "targetDeviceId": "device2", 
        "targetNumber": 2,
        "hitsReceived": 2,
        "expectedHits": 2,
        "accuracy": 100,
        "averageReactionTime": 295,
        "reactionTimes": [220, 370]
      }
    ]
  }
}
```

## Required API Endpoints

### 1. Start Scenario Session
```
POST /api/scenarios/start
Content-Type: application/json
Authorization: Bearer {token}
```

### 2. Stop Scenario Session  
```
POST /api/scenarios/{sessionId}/stop
Content-Type: application/json
Authorization: Bearer {token}
```

### 3. Get Scenario Status
```
GET /api/scenarios/{sessionId}/status
Authorization: Bearer {token}
```

### 4. Get Scenario Results
```
GET /api/scenarios/{sessionId}/results  
Authorization: Bearer {token}
```

## Required Telemetry Keys

### Session Management
- `scenario_session_id` - Unique session identifier
- `scenario_status` - Session status (active/completed/failed/timeout)
- `scenario_start_time` - Session start timestamp
- `scenario_end_time` - Session end timestamp

### Command Tracking
- `beep_sent_timestamp` - When beep command was sent
- `beep_type` - Type of beep (start/ready/go)
- `beep_sequence` - Order of beep in sequence
- `beep_ts` - Legacy compatibility

### Hit Detection
- `hit_timestamp` - When hit was registered
- `hit_sequence` - Order of hit in scenario
- `reaction_time_ms` - Time from beep to hit
- `shot_number` - Which shot for this target (1 or 2)
- `target_number` - Which target in sequence (1 or 2)

### Performance Metrics
- `scenario_score` - Final performance score (0-100)
- `scenario_accuracy` - Hit accuracy percentage
- `total_hits` - Total successful hits
- `avg_reaction_time` - Average reaction time

### Legacy Compatibility
- `hits` - Total hit count
- `hit_ts` - Hit timestamp
- `event` - Event type
- `game_name` - Scenario name
- `gameId` - Session ID

## WebSocket Subscription

### Connection
```javascript
ws://thingsboard.cloud/api/ws/plugins/telemetry?token={token}
```

### Subscription Message
```json
{
  "cmdId": 1758159000001,
  "entityType": "DEVICE", 
  "entityId": "device1",
  "scope": "LATEST_TELEMETRY",
  "keys": "hit_timestamp,reaction_time_ms,scenario_session_id,hit_sequence"
}
```

## Error Handling

### Common Error Responses
```json
{
  "success": false,
  "error": "INSUFFICIENT_TARGETS",
  "message": "Need 2 online targets, found 1",
  "code": 400
}

{
  "success": false,
  "error": "SESSION_TIMEOUT", 
  "message": "Scenario timed out after 10 seconds",
  "code": 408
}

{
  "success": false,
  "error": "DEVICE_OFFLINE",
  "message": "Target device device1 went offline during scenario",
  "code": 503
}
```

## Performance Requirements

### Timing Precision
- **Command timing**: ±50ms accuracy for beep commands
- **Hit detection**: <100ms latency for hit registration  
- **WebSocket updates**: <200ms for real-time updates

### Scalability
- Support **concurrent sessions** across multiple rooms
- Handle **up to 10 targets** per scenario (future expansion)
- Process **100+ hits per second** system-wide

### Data Retention
- **Session data**: 30 days minimum
- **Performance metrics**: 1 year for analytics
- **Raw telemetry**: 7 days for debugging

## Security Considerations

### Authentication
- All API calls require valid JWT token
- Session isolation by tenant/customer
- Device-level access control

### Data Privacy
- Session data encrypted at rest
- Personal performance data anonymized for analytics
- GDPR compliance for user data

## Implementation Phases

### Phase 1: Basic Scenario Support
- [x] Session management API
- [x] RPC command sending
- [x] Basic telemetry collection
- [x] WebSocket real-time updates

### Phase 2: Advanced Features
- [ ] Multiple scenario types
- [ ] Custom timing sequences  
- [ ] Advanced scoring algorithms
- [ ] Historical analytics

### Phase 3: Enterprise Features
- [ ] Multi-tenant isolation
- [ ] Performance dashboards
- [ ] Automated reporting
- [ ] Integration APIs

## Testing Scenarios

### Unit Tests
- Session lifecycle management
- Command timing accuracy
- Hit detection processing
- Score calculation algorithms

### Integration Tests  
- End-to-end scenario execution
- WebSocket real-time updates
- Error handling and recovery
- Multi-device coordination

### Load Tests
- Concurrent session handling
- High-frequency hit processing
- WebSocket connection scaling
- Database performance under load

## Support and Maintenance

### Monitoring
- Session success rates
- Command timing accuracy
- WebSocket connection health
- Database performance metrics

### Logging
- All RPC commands sent
- Hit detection events
- Error conditions
- Performance bottlenecks

### Alerts
- Session failures > 5%
- Command timing drift > 100ms
- WebSocket disconnections
- Database query timeouts

---

**Document Version**: 1.0  
**Last Updated**: January 18, 2025  
**Contact**: Development Team - ailith.co
