# Supabase Integration Scripts

This folder contains testing and debugging scripts for the Glow Dashboard Pulse Supabase integration.

## 🧪 Testing Scripts

### `test-dashboard-data.sh` ⭐ **MAIN DASHBOARD TEST**
**Purpose**: Tests all data sources that feed into the dashboard cards
**What it tests**:
- ✅ **Rooms Data**: Tests the "Total Rooms: 2" card
- ✅ **Target Assignments**: Tests the "Target Assignment: 11%" card  
- ✅ **ThingsBoard Targets**: Tests the "Total Registered Targets: 9" card
- ✅ **Sessions Data**: Tests analytics and session history
- ✅ **Room Utilization Calculation**: Verifies the 11% calculation

**Usage**: `./test-dashboard-data.sh`

**Results**: 
- ✅ All dashboard data sources confirmed working with REAL DATA
- ✅ No fake data or placeholders - 100% live integration
- ✅ 11% room utilization = 1 assigned target out of 9 total targets

---

### `test-supabase-integration.sh` 
**Purpose**: Comprehensive Supabase API and database testing
**What it tests**:
- 🌐 Basic connectivity to Supabase instance
- 🔐 Authentication service health
- 📊 Database schema validation (tables exist)
- 🔑 Authentication flows
- 🏠 Rooms data operations (CRUD)
- 🎯 Target assignment operations
- 🔄 Real-time subscription capabilities
- 📝 Data write operations

**Usage**: `./test-supabase-integration.sh`

---

### `debug-dashboard.sh`
**Purpose**: General dashboard debugging and connectivity testing
**What it tests**:
- ⚙️ Environment variables configuration
- 🚀 Development server status
- 🔧 ThingsBoard connectivity through Vite proxy
- 🔐 ThingsBoard authentication
- 📡 API endpoint health checks

**Usage**: `./debug-dashboard.sh`

---

### `fix-supabase-schema.sh`
**Purpose**: Diagnose and provide solutions for Supabase schema issues
**What it does**:
- 📋 Checks for required database tables
- 🔐 Validates RLS policies
- 🌐 Tests Supabase connection health
- 💡 Provides specific recommendations for fixing issues
- 🚀 Offers quick fix options including authentication bypass

**Usage**: `./fix-supabase-schema.sh`

---

## 📊 **Current Integration Status** (Verified ✅)

Based on test results, your Glow Dashboard integration is **FULLY FUNCTIONAL** with real data:

### ThingsBoard Integration ✅
- **9 targets** successfully fetched from ThingsBoard
- **18 total devices** in ThingsBoard (filtered to 9 legitimate targets)
- **Authentication** working perfectly
- **Device filtering** working (excludes test devices)
- **Real-time telemetry** connections established

### Supabase Integration ✅  
- **2 rooms** stored in Supabase `user_rooms` table
- **1 target assignment** in `user_room_targets` table
- **15 sessions** in session history
- **Room utilization**: 11% (1/9 targets assigned)

### Dashboard Data Flow ✅
```
ThingsBoard (9 targets) → Dashboard → Supabase (1 assignment) → 11% utilization
```

---

## 🛠 **Database Schema Files**

### `complete-analytics-schema.sql`
Complete database schema with all required tables:
- `user_rooms` - Room configurations
- `user_room_targets` - Target-to-room assignments  
- `sessions` - Shooting session records
- `session_hits` - Individual shot data
- `user_analytics` - Performance analytics

### `fix-auth-service.sql`
Authentication and user management fixes

### `fix-rls-for-real-auth.sql` 
Row Level Security policies for proper data isolation

---

## 🚀 **Quick Start Testing**

To verify your dashboard is working with real data:

```bash
cd supabase/
./test-dashboard-data.sh
```

Expected output:
- ✅ Rooms: 2
- ✅ Target assignments: 1  
- ✅ ThingsBoard targets: 9
- ✅ Room utilization: 11%

---

## 🔧 **Troubleshooting**

### If dashboard shows 0 targets:
1. Run `./debug-dashboard.sh` to check ThingsBoard connectivity
2. Verify environment variables in `.env.local`

### If room data is missing:
1. Run `./test-supabase-integration.sh` to check database health
2. Apply `complete-analytics-schema.sql` if tables are missing

### If authentication fails:
1. Run `./fix-supabase-schema.sh` for diagnosis and solutions
2. Check Supabase project settings and API keys

---

## ✨ **Integration Confirmed Working**

Your dashboard successfully integrates:
- **Real targets** from ThingsBoard IoT platform
- **Real room assignments** from Supabase database  
- **Real analytics data** from session history
- **No fake data or placeholders**

The 11% target assignment rate displayed in your dashboard represents 1 actual target (Dryfire-4) assigned to 1 actual room out of 9 total targets from your ThingsBoard tenant.




