# Legacy Code Archive

This folder contains deprecated code preserved for reference during the architecture migration.

## Contents

### hooks/
Old hooks that were replaced during the React Query migration:

| Legacy File | Replaced By |
|-------------|-------------|
| `useHistoricalActivity_old_code.ts` | Functionality integrated into `src/features/dashboard/hooks.ts` via React Query |
| `useScenarioLiveData_old_code.ts` | Deprecated - scenarios now use React Query patterns |
| `useScenarioLiveDataMock_old_code.ts` | Deprecated - mock data no longer needed |
| `useShootingActivityPolling_old_code.ts` | Replaced by React Query's built-in polling |
| `useSmartPolling_old_code.ts` | Replaced by React Query's stale-while-revalidate |
| `useUnifiedData_old_code.ts` | Split into feature-specific hooks |

### types/
Old type definitions that were consolidated:

| Legacy File | Replaced By |
|-------------|-------------|
| `game_old_code.ts` | Types moved to feature-specific schemas or deleted |
| `scenario-data_old_code.ts` | Deprecated with legacy scenario system |

### lib/
Old utility types:

| Legacy File | Replaced By |
|-------------|-------------|
| `types_old_code.ts` | `src/shared/types/legacy.ts` (used types only) |

### services/
Deprecated service implementations:

| Legacy File | Replaced By |
|-------------|-------------|
| `api-wrapper_old_code.ts` | `src/features/targets/repo.ts`, `src/features/rooms/repo.ts`, `src/features/profile/repo.ts`, `src/lib/api.ts` |
| `countdown_old_code.ts` | `src/features/games/ui/games-page.tsx` (session timing flow) |
| `demo-game-flow_old_code.ts` | `src/features/games/hooks/use-game-telemetry.ts`, `src/features/games/lib/device-game-flow.ts` |
| `mock-supabase_old_code.ts` | `src/data/supabase-client.ts` (live Supabase data) |
| `mock-thingsboard_old_code.ts` | `src/features/games/lib/thingsboard-client.ts`, `src/lib/edge.ts` |
| `profile_old_code.ts` | `src/features/profile/repo.ts`, `src/features/profile/service.ts` |
| `supabase-auth_old_code.ts` | `src/features/auth/repo.ts`, `src/features/auth/service.ts` |
| `supabase-target-custom-names_old_code.ts` | `src/features/targets/repo.ts` |
| `scenario-api_old_code.ts` | `src/pages/Scenarios.tsx` (legacy scenario flow) |
| `scenario-mock_old_code.ts` | `src/pages/Scenarios.tsx` (legacy scenario flow) |

### domain/
Unused domain layer code that was scaffolded but never wired into the application:

| Legacy File | Original Location | Why Unused |
|-------------|-------------------|------------|
| `rooms_mappers_old_code.ts` | `src/domain/rooms/mappers.ts` | Never imported - repo handles transformation inline |
| `rooms_permissions_old_code.ts` | `src/domain/rooms/permissions.ts` | Never imported - Supabase RLS handles authorization |
| `rooms_rules_old_code.ts` | `src/domain/rooms/rules.ts` | Never imported - validators.ts handles validation |
| `targets_mappers_old_code.ts` | `src/domain/targets/mappers.ts` | Never imported - edge functions handle transformation |
| `targets_permissions_old_code.ts` | `src/domain/targets/permissions.ts` | Never imported - Supabase RLS handles authorization |
| `targets_rules_old_code.ts` | `src/domain/targets/rules.ts` | Never imported - validators.ts handles validation |

**Note on domain files**: These were part of a planned domain-driven design architecture that was partially implemented. The validators are actively used, but mappers/permissions/rules were scaffolded speculatively. They could be wired in if stricter separation of concerns is needed in the future.

### pages/
Deprecated pages:

| Legacy File | Replaced By |
|-------------|-------------|
| `Scenarios_old_code.tsx` | Scenarios route removed (no active replacement) |

### state/
Deprecated state stores:

| Legacy File | Replaced By |
|-------------|-------------|
| `useScenarioRun_old_code.ts` | Scenarios route removed (no active replacement) |

## When to Delete

This folder can be safely deleted once:
1. All features are verified working with new architecture
2. No references to old patterns are needed
3. Team is comfortable with new React Query patterns

## Migration Date
January 2026
