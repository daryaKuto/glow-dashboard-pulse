# ThingsBoard Tests

This directory contains tests specifically for ThingsBoard data fetching and integration.

## Test Structure

- `api.test.ts` - Tests for ThingsBoard API service methods (login, devices, telemetry)
- `client.test.ts` - Tests for the HTTP client configuration and interceptors
- `data-mapping.test.ts` - Tests for data mapping between ThingsBoard and application models
- `integration.test.ts` - Integration tests for the complete data flow

## Running Tests

```bash
npm run test:thingsboard
```

## Test Coverage

### API Service Tests
- Authentication (login/logout)
- Device listing and management
- Telemetry data fetching
- WebSocket connections

### Client Tests
- Request/response interceptors
- Token refresh flow
- Error handling
- Configuration validation

### Data Mapping Tests
- Target data transformation
- Room data integration
- Scenario history processing
- Error handling and validation

### Integration Tests
- Environment configuration
- Token management
- Data structure validation
- Performance considerations
- Error scenarios

## Mock Strategy

Tests use comprehensive mocking to:
- Avoid actual API calls during testing
- Test error scenarios safely
- Ensure consistent test results
- Focus on business logic validation

## Test Data

Tests validate:
- Proper data structure transformation
- Error handling and recovery
- Performance with large datasets
- Edge cases and invalid data
