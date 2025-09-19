# API Testing Scripts

This folder contains automated testing scripts for the ThingsBoard API integration.

## 📁 Files

- **`run-tests-fixed.js`** - Main test runner that executes Postman collection tests
- **`simple-auth-test.js`** - Basic authentication test script
- **`decode-token.js`** - JWT token decoder and analyzer
- **`test-runner.js`** - Alternative test runner implementation
- **`working-api-test.js`** - Verified working API test cases
- **`test_data.json`** - Sample test data for API calls
- **`package.json`** - Dependencies and npm scripts

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd tests/api
npm install
```

### 2. Run Tests

**Full Test Suite:**
```bash
npm test
```

**Individual Tests:**
```bash
npm run test:auth      # Authentication test only
npm run test:decode    # Token decoder utility
npm run test:runner    # Alternative test runner
npm run test:working   # Working API tests
```

## 📊 Test Scripts

### Main Test Runner (`run-tests-fixed.js`)
- Executes the complete Postman collection
- Uses collection files from `../../postman/`
- Provides detailed test results
- Handles authentication automatically

### Simple Auth Test (`simple-auth-test.js`)
- Tests basic ThingsBoard authentication
- Validates login credentials
- Displays token information
- Quick connectivity check

### Token Decoder (`decode-token.js`)
- Decodes JWT tokens from ThingsBoard
- Shows token payload and expiration
- Useful for debugging authentication issues

### Working API Test (`working-api-test.js`)
- Contains verified working API calls
- Good starting point for new tests
- Documented successful endpoints

## 🔗 Dependencies

The scripts reference Postman collection files located in:
- `../../postman/ThingsBoard_API_Collection_Fixed.json`
- `../../postman/ThingsBoard_Environment.json`

## 📝 Usage Notes

1. **Credentials**: Update credentials in the environment file if needed
2. **Base URL**: Default is `https://thingsboard.cloud`
3. **Results**: Test results are logged to console
4. **Debugging**: Use individual test scripts for focused testing

## 🔧 Configuration

Environment variables are loaded from the Postman environment file:
- `baseUrl` - ThingsBoard instance URL
- `username` - Login username
- `password` - Login password
- `accessToken` - JWT token (auto-filled)

## 📈 Success Criteria

- Authentication should return valid JWT token
- Device management endpoints should work
- Telemetry data should be retrievable
- All tests should have >80% success rate

## 🐛 Troubleshooting

1. **Connection Issues**: Check baseUrl and network connectivity
2. **Auth Failures**: Verify credentials in environment file
3. **Token Errors**: Use decode-token.js to analyze JWT tokens
4. **API Errors**: Check ThingsBoard instance status and API documentation
