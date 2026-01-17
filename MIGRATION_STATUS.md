# Architecture Migration Status

This document tracks the migration from Zustand stores to React Query with feature-first architecture.

## ✅ Completed Migrations

### Phase 1: Foundation
- [x] ApiResponse type system (`src/shared/lib/api-response.ts`)
- [x] ErrorBoundary component (`src/shared/lib/error-boundary.tsx`)
- [x] React Query setup (`src/app/query-client.ts`, `src/app/providers.tsx`)
- [x] Data layer structure (`src/data/supabase-client.ts`)

### Phase 2: Rooms Feature (Pilot)
- [x] Feature structure created (`src/features/rooms/`)
- [x] Schema, repo, service, hooks implemented
- [x] UI migrated (`src/features/rooms/ui/rooms-page.tsx`)
- [x] Routing updated to use new RoomsPage
- [x] Old store marked as deprecated (`src/state/useRooms.ts`)

### Phase 3: All Features Migrated
- [x] **Targets** (`src/features/targets/`) - Complete
- [x] **Games** (`src/features/games/`) - Basic structure complete
- [x] **Dashboard** (`src/features/dashboard/`) - Complete
- [x] **Profile** (`src/features/profile/`) - Complete
- [x] **Auth** (`src/features/auth/`) - Types and utilities added

### Phase 4: Page Updates
- [x] Dashboard page updated to use new hooks
- [x] Profile page updated to use new hooks
- [x] Targets page updated to use new hooks
- [x] Rooms page already using new hooks (migrated in Phase 2)

## 🔄 Partially Migrated

### Pages Still Using Legacy Stores
These pages have been updated but may still reference old stores for compatibility:

- `src/pages/Games.tsx` - Uses `useGameFlow` (complex, needs incremental migration)
- `src/pages/Scenarios.tsx` - Uses multiple legacy stores
- Various components still import from old stores

### Legacy Stores Status
All server state stores are marked as deprecated:

- `src/state/useRooms.ts` - ✅ Deprecated, use `@/features/rooms`
- `src/state/useTargets.ts` - ✅ Deprecated, use `@/features/targets`
- `src/state/useProfile.ts` - ✅ Deprecated, use `@/features/profile`
- `src/state/useDashboardStats.ts` - ✅ Deprecated, use `@/features/dashboard`
- `src/state/useGameFlow.ts` - ⚠️ Still in use, needs migration
- `src/state/useScenarios.ts` - ⚠️ Still in use
- `src/state/useSessions.ts` - ⚠️ Still in use
- `src/state/useStats.ts` - ⚠️ Still in use

## 📋 Remaining Work

### Phase 4: Complete Cleanup
- [ ] Remove old Zustand stores after testing
- [ ] Update remaining components to use new hooks
- [ ] Migrate Games feature fully (complex game flow logic)
- [ ] Migrate Scenarios feature
- [ ] Migrate Sessions feature
- [ ] Migrate Stats feature

### Phase 5: TypeScript & Validation
- [ ] Enable `strictNullChecks` incrementally
- [ ] Enable `noImplicitAny` incrementally
- [ ] Add Zod validation to all forms
- [ ] Add Zod validation to API boundaries

## 🎯 Migration Pattern

All new features follow this structure:

```
src/features/{feature}/
  schema.ts      # Zod schemas and types
  repo.ts         # Data access (Supabase/API calls)
  service.ts      # Business logic
  hooks.ts        # React Query hooks
  ui/             # Feature-specific components
    {feature}-page.tsx
  index.ts        # Public API
```

## 📚 Usage Examples

### Rooms
```typescript
import { useRooms, useCreateRoom } from '@/features/rooms';

const { data, isLoading } = useRooms();
const createRoom = useCreateRoom();
```

### Targets
```typescript
import { useTargets, useTargetDetails } from '@/features/targets';

const { data } = useTargets();
const { data: details } = useTargetDetails(deviceIds);
```

### Dashboard
```typescript
import { useDashboardMetrics } from '@/features/dashboard';

const { data } = useDashboardMetrics();
```

### Profile
```typescript
import { useProfile, useRecentSessions } from '@/features/profile';

const { data } = useProfile(userId);
const { data: sessions } = useRecentSessions(userId, 10);
```

## ⚠️ Breaking Changes

None yet - old stores are still available but deprecated. They will be removed in a future version after thorough testing.

## 🧪 Testing Checklist

- [ ] Rooms feature works identically
- [ ] Targets feature works identically
- [ ] Dashboard loads correctly
- [ ] Profile page loads correctly
- [ ] All mutations (create, update, delete) work
- [ ] Error handling works correctly
- [ ] Loading states display correctly
- [ ] Cache invalidation works



