# ThingsBoard API Testing with Postman

This folder contains all the necessary files to test the ThingsBoard API integration using Postman.

## 📁 Files Included

- `ThingsBoard_API_Collection_Fixed.json` - Complete Postman collection with all API endpoints
- `ThingsBoard_Environment.json` - Environment variables for ThingsBoard configuration  
- `README.md` - This instruction file
- `SwaggerUI.md` - ThingsBoard API documentation reference
- `TEST_RESULTS.md` - Documented test results and findings

**Note:** Automated testing scripts have been moved to `../tests/api/` folder.

## 🚀 Quick Start

### 1. Import Collection
1. Open Postman
2. Click "Import" button
3. Select `ThingsBoard_API_Collection.json`
4. The collection will be imported with all endpoints

### 2. Import Environment
1. In Postman, click the gear icon (⚙️) in the top right
2. Click "Import"
3. Select `ThingsBoard_Environment.json`
4. Select the "ThingsBoard Environment" from the dropdown

### 3. Test Public Endpoints
Start with the "🔍 Public Endpoints (No Auth)" folder:
1. Test Base URL
2. Test Swagger UI
3. Test API Documentation
4. Test Health Check
5. Test API Info

### 4. Test Authentication
Try the "🔐 Authentication" folder:
1. Login - Standard (most likely to work)
2. Login - API Path (alternative)
3. Login - V1 API (alternative)

**Note:** The login requests will automatically save your access token to environment variables.

### 5. Test Protected Endpoints
Once you have a valid token, test the protected endpoints:
1. Device Management
2. User Management
3. Telemetry
4. Attributes
5. System Info

## 🔧 Environment Variables

The environment includes these variables:

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `baseUrl` | ThingsBoard base URL | `https://thingsboard.cloud` |
| `username` | Your ThingsBoard username | `andrew.tam@gmail.com` |
| `password` | Your ThingsBoard password | `dryfire2025` |
| `accessToken` | JWT access token (auto-filled) | (empty) |
| `refreshToken` | JWT refresh token (auto-filled) | (empty) |
| `deviceId` | Device ID for testing (auto-filled) | (empty) |
| `userId` | User ID for testing (auto-filled) | (empty) |
| `customerId` | Customer ID for testing | (empty) |

## 🧪 Testing Order

### Phase 1: Public Endpoints
- ✅ Test Base URL
- ✅ Test Swagger UI
- ✅ Test API Documentation
- ✅ Test Health Check
- ✅ Test API Info

### Phase 2: Authentication
- 🔐 Login - Standard
- 🔐 Login - API Path (if Standard fails)
- 🔐 Login - V1 API (if others fail)

### Phase 3: Device Management
- 📱 Get All Devices
- 📱 Get Device by ID
- 📱 Create Device
- 📱 Update Device
- 📱 Delete Device

### Phase 4: User Management
- 👥 Get All Users
- 👥 Get User by ID
- 👥 Create User

### Phase 5: Telemetry
- 📊 Get Latest Telemetry
- 📊 Get Telemetry History
- 📊 Save Telemetry Data

### Phase 6: Attributes
- 🏷️ Get Device Attributes
- 🏷️ Update Device Attributes

### Phase 7: System Info
- 🏢 Get Tenant Info
- 🏢 Get Dashboards
- 🏢 Get Rule Chains
- 🏢 Get Customer Info

## 📊 Expected Results

### Public Endpoints
- **Status:** 200 OK
- **Response:** HTML or JSON
- **Notes:** These should work without authentication

### Authentication
- **Status:** 200 OK
- **Response:** JSON with token and refreshToken
- **Notes:** One of the login endpoints should work

### Protected Endpoints
- **Without Token:** 401 Unauthorized
- **With Valid Token:** 200 OK + JSON data
- **With Invalid Token:** 401 Unauthorized

## 🔍 Troubleshooting

### Common Issues

1. **HTML Response Instead of JSON**
   - The API endpoint might be wrong
   - Try different login endpoints
   - Check if API access is enabled

2. **401 Unauthorized**
   - Check credentials
   - Verify token is valid
   - Try refreshing the token

3. **404 Not Found**
   - Endpoint might not exist
   - Check ThingsBoard version
   - Verify API documentation

### Getting Help

1. Check the Swagger UI at `https://thingsboard.cloud/swagger-ui/`
2. Review the ThingsBoard API documentation
3. Verify your ThingsBoard instance configuration

## 📝 Notes

- The collection automatically saves tokens and IDs to environment variables
- Test data is included in `test_data.json` for reference
- All requests include proper error handling
- The collection is organized by functionality for easy testing

## 🔄 Updates

This collection is designed for ThingsBoard Cloud. If you're using a different ThingsBoard instance, update the `baseUrl` environment variable accordingly.

## 🚀 Programmatic Testing

You can also run tests programmatically using the automated testing scripts:

```bash
cd tests/api
npm install
npm test
```

This will run the entire collection and generate a test report. See `../tests/api/README.md` for more details.

## 📋 Manual Testing Steps

1. **Import the collection and environment into Postman**
2. **Select the "ThingsBoard Environment" from the dropdown**
3. **Start with public endpoints to verify connectivity**
4. **Try authentication endpoints to get a token**
5. **Test protected endpoints with the obtained token**
6. **Use the collection runner to test all endpoints at once**

## 🎯 Success Criteria

- ✅ All public endpoints return 200 OK
- ✅ At least one authentication endpoint works
- ✅ Protected endpoints work with valid token
- ✅ Device and user management endpoints function
- ✅ Telemetry data can be read and written
- ✅ Attributes can be retrieved and updated

## 📞 Support

If you encounter issues:
1. Check the console output in Postman
2. Verify your ThingsBoard instance is running
3. Confirm your credentials are correct
4. Review the ThingsBoard API documentation 