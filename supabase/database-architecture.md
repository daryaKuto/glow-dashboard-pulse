# Glow Dashboard Pulse - Supabase Database Architecture

## 🏗️ Complete Database Schema Overview

The Glow Dashboard Pulse application uses a **user-centric database architecture** built on Supabase, designed to store shooting practice data, room management, and performance analytics. The system integrates with ThingsBoard for real-time scenario execution while maintaining all user data in Supabase.

```
┌─────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION LAYER                    │
├─────────────────────────────────────────────────────────────────┤
│  auth.users (Supabase built-in)                                │
│  ├─ id (UUID) - Primary Key                                    │
│  ├─ email                                                       │
│  ├─ encrypted_password                                          │
│  ├─ email_confirmed_at                                          │
│  └─ raw_user_meta_data (JSON)                                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ 1:Many (Direct Reference)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        USER DATA LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  user_rooms                    │  sessions                      │
│  ├─ id (UUID)                  │  ├─ id (UUID)                  │
│  ├─ user_id → auth.users.id    │  ├─ user_id → auth.users.id    │
│  ├─ name, room_type, icon      │  ├─ room_id → user_rooms.id    │
│  ├─ order_index                │  ├─ scenario_name, score       │
│  └─ created_at, updated_at     │  ├─ duration_ms, hit_count     │
│                                │  ├─ accuracy_percentage        │
│                                │  ├─ reaction_time_metrics      │
│                                │  ├─ thingsboard_data (JSONB)   │
│                                │  └─ raw_sensor_data (JSONB)    │
│                                │                                │
│  user_room_targets             │  session_hits                  │
│  ├─ id (UUID)                  │  ├─ id (UUID)                  │
│  ├─ user_id → auth.users.id    │  ├─ session_id → sessions.id   │
│  ├─ room_id → user_rooms.id    │  ├─ user_id → auth.users.id    │
│  ├─ target_id, target_name     │  ├─ target_id, hit_type        │
│  └─ assigned_at                │  ├─ reaction_time_ms, score    │
│                                │  ├─ hit_position (JSONB)       │
│                                │  └─ sensor_data (JSONB)        │
│                                │                                │
│  user_analytics                │  user_settings                 │
│  ├─ id (UUID)                  │  ├─ id (UUID)                  │
│  ├─ user_id → auth.users.id    │  ├─ user_id → auth.users.id    │
│  ├─ date, period_type          │  ├─ target_preferences (JSON)  │
│  ├─ total_sessions, avg_score  │  └─ created_at, updated_at     │
│  ├─ accuracy_percentage        │                                │
│  ├─ reaction_time_metrics      │                                │
│  └─ improvement_tracking       │                                │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Table Details

### 1. **user_rooms** - Room Management
**Purpose**: Stores user-created rooms where shooting practice takes place.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | UUID | Primary key | `gen_random_uuid()` |
| `user_id` | UUID | References `auth.users.id` | NOT NULL, CASCADE DELETE |
| `name` | VARCHAR(255) | Room name | NOT NULL |
| `room_type` | VARCHAR(50) | Type of room | DEFAULT 'living-room' |
| `icon` | VARCHAR(50) | UI icon identifier | DEFAULT 'home' |
| `order_index` | INTEGER | Display order | DEFAULT 0 |
| `created_at` | TIMESTAMP | Creation timestamp | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Last update timestamp | DEFAULT NOW() |

**Unique Constraints**: `(user_id, name)` - Users can't have duplicate room names

**Usage in App**: 
- Room creation/editing in `src/pages/Rooms.tsx`
- Room management in `src/store/useRooms.ts`
- Service layer in `src/services/supabase-rooms.ts`

### 2. **user_room_targets** - Target Assignments
**Purpose**: Links ThingsBoard targets to specific user rooms.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | UUID | Primary key | `gen_random_uuid()` |
| `user_id` | UUID | References `auth.users.id` | NOT NULL, CASCADE DELETE |
| `room_id` | UUID | References `user_rooms.id` | NOT NULL, CASCADE DELETE |
| `target_id` | VARCHAR(255) | ThingsBoard target ID | NOT NULL |
| `target_name` | VARCHAR(255) | Human-readable target name | NOT NULL |
| `assigned_at` | TIMESTAMP | Assignment timestamp | DEFAULT NOW() |
| `created_at` | TIMESTAMP | Creation timestamp | DEFAULT NOW() |

**Unique Constraints**: `(user_id, target_id)` - Each target can only be assigned to one room per user

**Usage in App**: 
- Target assignment in room management
- Integration with ThingsBoard target system

### 3. **sessions** - Shooting Session Data
**Purpose**: Stores complete shooting session records with performance metrics.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | UUID | Primary key | `gen_random_uuid()` |
| `user_id` | UUID | References `auth.users.id` | NOT NULL, CASCADE DELETE |
| `room_id` | UUID | References `user_rooms.id` | NULLABLE, SET NULL on DELETE |
| `room_name` | VARCHAR(255) | Room name (historical) | NULLABLE |
| `scenario_name` | VARCHAR(255) | Scenario identifier | NULLABLE |
| `scenario_type` | VARCHAR(100) | Type of scenario | NULLABLE |
| `score` | INTEGER | Total session score | DEFAULT 0 |
| `duration_ms` | INTEGER | Session duration | DEFAULT 0 |
| `hit_count` | INTEGER | Number of hits | DEFAULT 0 |
| `miss_count` | INTEGER | Number of misses | DEFAULT 0 |
| `total_shots` | INTEGER | Total shots taken | DEFAULT 0 |
| `accuracy_percentage` | DECIMAL(5,2) | Hit accuracy percentage | DEFAULT 0 |
| `avg_reaction_time_ms` | INTEGER | Average reaction time | NULLABLE |
| `best_reaction_time_ms` | INTEGER | Best reaction time | NULLABLE |
| `worst_reaction_time_ms` | INTEGER | Worst reaction time | NULLABLE |
| `started_at` | TIMESTAMP | Session start time | DEFAULT NOW() |
| `ended_at` | TIMESTAMP | Session end time | NULLABLE |
| `created_at` | TIMESTAMP | Record creation time | DEFAULT NOW() |
| `thingsboard_data` | JSONB | ThingsBoard integration data | DEFAULT '{}' |
| `raw_sensor_data` | JSONB | Raw sensor readings | DEFAULT '{}' |

**Usage in App**:
- Session storage in `src/services/supabase-rooms.ts::storeSessionData()`
- ThingsBoard integration in `src/services/thingsboard-supabase-sync.ts`
- Dashboard analytics in `src/store/useDashboardStats.ts`

### 4. **session_hits** - Individual Shot Data
**Purpose**: Stores detailed shot-by-shot data for analysis.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | UUID | Primary key | `gen_random_uuid()` |
| `session_id` | UUID | References `sessions.id` | NOT NULL, CASCADE DELETE |
| `user_id` | UUID | References `auth.users.id` | NOT NULL, CASCADE DELETE |
| `target_id` | VARCHAR(255) | Target identifier | NULLABLE |
| `target_name` | VARCHAR(255) | Target name | NULLABLE |
| `room_name` | VARCHAR(255) | Room name | NULLABLE |
| `hit_type` | VARCHAR(50) | Type of hit | DEFAULT 'hit' |
| `reaction_time_ms` | INTEGER | Reaction time | NULLABLE |
| `score` | INTEGER | Shot score | DEFAULT 0 |
| `hit_timestamp` | TIMESTAMP | Shot timestamp | DEFAULT NOW() |
| `hit_position` | JSONB | Position data | DEFAULT '{}' |
| `sensor_data` | JSONB | Raw sensor data | DEFAULT '{}' |

**Hit Types**: `'hit'`, `'miss'`, `'timeout'`

**Usage in App**:
- Shot tracking in `src/services/supabase-rooms.ts::storeHitData()`
- Performance analysis in dashboard

### 5. **user_analytics** - Performance Analytics
**Purpose**: Aggregated performance data for analytics and reporting.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | UUID | Primary key | `gen_random_uuid()` |
| `user_id` | UUID | References `auth.users.id` | NOT NULL, CASCADE DELETE |
| `date` | DATE | Analytics date | DEFAULT CURRENT_DATE |
| `period_type` | VARCHAR(20) | Time period | DEFAULT 'daily' |
| `total_sessions` | INTEGER | Sessions count | DEFAULT 0 |
| `total_duration_ms` | BIGINT | Total practice time | DEFAULT 0 |
| `avg_session_duration_ms` | INTEGER | Average session length | DEFAULT 0 |
| `total_score` | INTEGER | Total score | DEFAULT 0 |
| `avg_score` | DECIMAL(10,2) | Average score | DEFAULT 0 |
| `best_score` | INTEGER | Best score | DEFAULT 0 |
| `total_shots` | INTEGER | Total shots | DEFAULT 0 |
| `total_hits` | INTEGER | Total hits | DEFAULT 0 |
| `total_misses` | INTEGER | Total misses | DEFAULT 0 |
| `accuracy_percentage` | DECIMAL(5,2) | Overall accuracy | DEFAULT 0 |
| `avg_reaction_time_ms` | INTEGER | Average reaction time | NULLABLE |
| `best_reaction_time_ms` | INTEGER | Best reaction time | NULLABLE |
| `worst_reaction_time_ms` | INTEGER | Worst reaction time | NULLABLE |
| `score_improvement` | DECIMAL(10,2) | Score improvement | DEFAULT 0 |
| `accuracy_improvement` | DECIMAL(5,2) | Accuracy improvement | DEFAULT 0 |
| `created_at` | TIMESTAMP | Record creation | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Last update | DEFAULT NOW() |

**Period Types**: `'daily'`, `'weekly'`, `'monthly'`

**Unique Constraints**: `(user_id, date, period_type)`

**Usage in App**:
- Analytics retrieval in `src/services/supabase-rooms.ts::getUserAnalytics()`
- Dashboard statistics in `src/store/useDashboardStats.ts`

### 6. **user_settings** - User Preferences
**Purpose**: Stores user-specific preferences and settings.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | UUID | Primary key | `gen_random_uuid()` |
| `user_id` | UUID | References `auth.users.id` | NOT NULL, CASCADE DELETE |
| `target_preferences` | JSON | Target preferences | DEFAULT '{}' |
| `created_at` | TIMESTAMP | Creation time | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | Last update | DEFAULT NOW() |

**Usage in App**:
- User preferences management
- Target configuration settings

## 🔗 Data Relationships

### Primary Relationships
1. **auth.users** → **user_rooms** (1:Many)
2. **auth.users** → **sessions** (1:Many)
3. **auth.users** → **user_room_targets** (1:Many)
4. **auth.users** → **session_hits** (1:Many)
5. **auth.users** → **user_analytics** (1:Many)
6. **auth.users** → **user_settings** (1:1)

### Secondary Relationships
1. **user_rooms** → **user_room_targets** (1:Many)
2. **user_rooms** → **sessions** (1:Many)
3. **sessions** → **session_hits** (1:Many)

## 🔐 Security & Access Control

### Row Level Security (RLS)
All tables have RLS enabled with policies that ensure users can only access their own data:

```sql
-- Example RLS Policy
CREATE POLICY "Users can manage their own sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id);
```

### Authentication Bypass
Due to Supabase Auth service issues, a bypass function is implemented:

```sql
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try real authentication first
  IF auth.uid() IS NOT NULL THEN
    RETURN auth.uid();
  END IF;
  
  -- Fallback to Andrew's user ID for development
  RETURN '1dca810e-7f11-4ec9-8605-8633cf2b74f0'::UUID;
END;
$$;
```

## 📈 Data Flow & Integration

### 1. **User Registration Flow**
1. User signs up → `auth.users` (Supabase Auth)
2. [undetermined] → User profile creation
3. User creates rooms → `user_rooms`
4. User assigns targets → `user_room_targets`

### 2. **Session Execution Flow**
1. User starts scenario → ThingsBoard integration
2. Real-time data flows → ThingsBoard
3. Session completion → `sessions` table
4. Individual shots → `session_hits` table
5. Analytics calculation → `user_analytics` table

### 3. **ThingsBoard Integration**
- **Real-time scenarios**: Handled by ThingsBoard
- **Data storage**: All user data stored in Supabase
- **Sync process**: `src/services/thingsboard-supabase-sync.ts`
- **Data mapping**: ThingsBoard telemetry → Supabase schema

## 🎯 Key Features

### ✅ **User Isolation**
- Each user only sees their own data
- RLS policies enforce data separation
- No cross-user data access

### ✅ **Scalable Architecture**
- UUID primary keys for distributed systems
- JSONB columns for flexible data storage
- Proper indexing for performance

### ✅ **Data Integrity**
- Foreign key constraints
- Unique constraints prevent duplicates
- Cascade deletes maintain consistency

### ✅ **Analytics Ready**
- Pre-aggregated analytics tables
- Multiple time period support
- Performance tracking and improvement metrics

### ✅ **Real-time Integration**
- ThingsBoard for live scenarios
- Supabase for data persistence
- WebSocket support for live updates

## 🔧 Database Functions

### 1. **get_current_user_id()**
Authentication bypass function for development mode.

### 2. **update_updated_at_column()**
Trigger function to automatically update `updated_at` timestamps.

## 📊 Performance Considerations

### Indexes
- User-based queries: `idx_sessions_user_id`, `idx_user_rooms_user_id`
- Time-based queries: `idx_sessions_started_at`, `idx_user_analytics_date`
- Foreign key indexes for joins

### Data Types
- UUID for primary keys (distributed-friendly)
- JSONB for flexible data storage
- Proper decimal precision for percentages
- Timestamp with timezone for global compatibility

## 🚀 Future Enhancements

### Planned Features
- [undetermined] - Multi-user scenarios
- [undetermined] - Social features
- [undetermined] - Advanced analytics
- [undetermined] - Export functionality

### Schema Evolution
- [undetermined] - Additional user profile fields
- [undetermined] - Enhanced analytics tables
- [undetermined] - Integration with external services
