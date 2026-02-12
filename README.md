# Ailith.co Dashboard

A production-grade React dashboard for managing IoT shooting range infrastructure. The application connects targets (IoT devices) through the ThingsBoard platform and manages authentication, rooms, game sessions, and analytics through Supabase.

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | React 18 + TypeScript |
| **Build** | Vite 5 (SWC) |
| **Styling** | Tailwind CSS 3.4 + Shadcn/UI + Radix UI primitives |
| **Server State** | React Query (@tanstack/react-query) |
| **Client State** | Zustand (real-time game flow only) |
| **Routing** | React Router v6 (lazy-loaded routes) |
| **Forms** | react-hook-form + Zod |
| **Charts** | Recharts 2.12 (lazy-loaded) |
| **Icons** | Lucide React |
| **Backend** | Supabase (auth, database, edge functions) + ThingsBoard IoT |
| **Testing** | Vitest + Testing Library + jsdom |

## Architecture

The codebase follows a **layered feature-based architecture** with a pure domain layer:

```
src/
├── app/                    # Application bootstrap
│   ├── auth-context.ts     # Auth context type definition
│   ├── auth-provider.tsx   # Auth provider component
│   ├── providers.tsx       # React Query provider
│   └── query-client.ts     # React Query configuration
│
├── domain/                 # Pure business logic (no React, no Supabase)
│   ├── dashboard/          # Aggregators, mappers, permissions, validators
│   ├── games/              # Rules, mappers, permissions, validators
│   ├── leaderboard/        # Ports (interfaces)
│   ├── profile/            # Rules, mappers, permissions, validators
│   ├── rooms/              # Rules, permissions, validators
│   ├── settings/           # Ports
│   ├── targets/            # Rules, permissions, validators
│   └── shared/             # Type guards, validation helpers
│
├── features/               # Feature modules (self-contained)
│   ├── auth/               # Authentication service
│   ├── dashboard/          # Analytics overview
│   ├── games/              # Game session management
│   ├── leaderboard/        # Performance rankings
│   ├── profile/            # User profile & settings
│   ├── rooms/              # Room management
│   ├── settings/           # App preferences
│   └── targets/            # IoT target device management
│
├── shared/                 # Cross-cutting concerns
│   ├── hooks/              # use-auth, use-mobile, use-toast
│   ├── lib/                # Logger, rate limiter, error boundary, ApiResponse<T>
│   ├── types/              # Shared type definitions
│   └── ui/                 # FeatureErrorBoundary
│
├── components/
│   ├── ui/                 # Shadcn/UI base components (48 components)
│   └── shared/             # Header, Sidebar, MobileDrawer, SubscriptionGate
│
├── pages/                  # Thin route wrappers (auth pages, legacy redirects)
│   └── auth/               # Login, Signup, ForgotPassword, ResetPassword, etc.
│
├── lib/                    # Edge function wrapper, Tailwind cn() utility
├── utils/                  # Dashboard helpers, throttled logging, logout, perf monitor
├── config/                 # Telemetry configuration
├── data/                   # Supabase client, database types
├── integrations/           # Supabase client setup & generated types
│
├── App.tsx                 # Route definitions
├── main.tsx                # Entry point (ErrorBoundary → BrowserRouter → Providers → AuthProvider → App)
└── index.css               # CSS variables, @font-face, base styles
```

### Feature Module Structure

Each feature follows a consistent layered pattern:

```
features/<feature>/
├── index.ts        # Public API — only exported hooks, types, and components
├── schema.ts       # Zod schemas + TypeScript types
├── repo.ts         # Data access layer (Supabase queries, edge function calls)
├── service.ts      # Business logic orchestration
├── hooks.ts        # React Query hooks (caching, invalidation, mutations)
├── hooks/          # Specialized hooks (complex features like games)
├── lib/            # Feature-specific utilities
├── state/          # Zustand stores (games only — real-time game flow)
└── ui/             # React components
    └── components/ # Presentational sub-components
```

**Data flows one way:** `repo → service → hooks → UI components`

All repo and service functions return a standardized `ApiResponse<T>` type (`{ ok: true, data: T } | { ok: false, error: { code, message } }`).

### Domain Layer

The `src/domain/` layer contains **pure business logic** with strict rules:
- No React imports
- No Supabase or external service imports
- All functions must be pure (no side effects)
- All functions must have explicit return types

Each domain module provides: `ports.ts` (interfaces), `validators.ts`, `rules.ts`, `permissions.ts`, and `mappers.ts`.

## Features

### Dashboard
Real-time analytics overview with stat cards, target activity charts, hit timeline (area chart), hit distribution, and recent sessions list. Charts are lazy-loaded to keep the initial bundle under control (~200KB savings).

### Targets
View and manage IoT target devices from ThingsBoard. Status monitoring (online/offline), battery tracking, hit counts, custom naming (premium), and device RPC commands. Permission-aware hooks enforce access control.

### Rooms
Create, rename, reorder (drag-and-drop via @dnd-kit), and delete rooms. Assign targets to rooms. Data stored in Supabase, fetched via rate-limited edge functions.

### Games
The most complex feature — manages the full game session lifecycle:

1. **Setup** — Select room, pick targets, configure duration (3-step wizard)
2. **Launch** — Send RPC commands + shared attributes to ThingsBoard devices
3. **Running** — WebSocket telemetry streaming, real-time hit tracking
4. **Finalize** — Stop commands, persist session to Supabase, update history

15+ specialized hooks decompose concerns (session lifecycle, telemetry sync, device RPC, preset management, etc.). Zustand is used exclusively here for transient real-time state during active play.

### Game Presets
Save and reuse target/room/duration configurations. Stored in Supabase via edge functions, managed through React Query hooks.

### Profile & Settings
User profile management, WiFi credential sync, theme preferences, notification settings.

### Authentication
Dual auth: Supabase (primary) + ThingsBoard (background). JWT management, session persistence, automatic token refresh. Auth context provided via `src/app/auth-provider.tsx`.

## Backend Integration

### Supabase

**Edge Functions** (in `supabase/functions/`):
| Function | Purpose |
|----------|---------|
| `dashboard-metrics` | Aggregated dashboard stats |
| `device-admin` | Device administration |
| `device-command` | Send RPC commands to devices |
| `device-telemetry` | Telemetry data retrieval |
| `game-control` | Game session control |
| `game-presets` | CRUD for saved game configurations |
| `rooms` | Room CRUD operations |
| `targets-with-telemetry` | Target list with live telemetry |
| `target-details` | Individual target detail |
| `telemetry-history` | Historical telemetry data |
| `thingsboard-auth` | ThingsBoard token exchange |
| `thingsboard-session` | ThingsBoard session management |
| `shooting-activity` | Activity data for charts |
| `refresh-device-snapshots` | Cache refresh for device state |
| `scenario-control` | Scenario execution |

**Database tables:** `user_profiles`, `sessions`, `user_rooms`, `user_room_targets`, `game_presets`, `target_groups`, `target_custom_names`

All edge function calls go through a rate-limited wrapper (`src/lib/edge.ts`) using a token-bucket algorithm.

### ThingsBoard

HTTP client (`src/features/games/lib/thingsboard-client.ts`) with:
- Per-endpoint rate limiting (REST, telemetry, RPC presets)
- Axios interceptor for automatic token injection
- WebSocket support for real-time telemetry during live sessions
- Vite dev proxy (`/api/tb → thingsboard.cloud`) to avoid CORS

## State Management Strategy

| Concern | Tool | Why |
|---------|------|-----|
| Server data (targets, rooms, sessions, presets, metrics) | React Query | Caching, background refetch, optimistic updates, query invalidation |
| Auth session | React Context | Global, infrequently changing, needed everywhere |
| Real-time game flow (live hit tracking, device status during play) | Zustand | Transient UI state, high-frequency updates, reset on logout |

React Query is configured with 30s stale time, 5min GC, exponential retry with rate-limit awareness, and window-focus refetch in production only.

## Error Handling & Resilience

- **Error boundaries:** Root-level (`shared/lib/error-boundary.tsx`) + per-feature (`shared/ui/FeatureErrorBoundary.tsx`) — feature failures don't crash the app
- **Rate limiting:** Token-bucket algorithm with configurable presets for Supabase edge, ThingsBoard REST/telemetry/RPC
- **Rate limit monitoring:** Tracks hits, logs warnings when approaching limits
- **Structured logging:** Dev-only debug/info, always-on warn/error (`shared/lib/logger.ts`)
- **Throttled logging:** Prevents log flooding during high-frequency events (`utils/log-throttle.ts`)
- **Performance monitoring:** Mark/measure utilities for dev profiling (`utils/performance-monitor.ts`)

## Telemetry Strategy

- **Dashboards & rooms:** Supabase edge caches, ≤10s SLA, adaptive polling with exponential backoff
- **Live game sessions:** ≤1s SLA, WebSocket telemetry during active play, polling fallback
- All ThingsBoard API calls go through rate-limited Axios interceptors

## Routing

All dashboard routes are lazy-loaded with `React.lazy()` + `Suspense`:

| Route | Page |
|-------|------|
| `/dashboard` | Dashboard (analytics overview) |
| `/dashboard/targets` | Targets management |
| `/dashboard/rooms` | Rooms management |
| `/dashboard/games` | Games (session setup, live play, history) |
| `/dashboard/leaderboard` | Leaderboard |
| `/dashboard/profile` | User profile |
| `/dashboard/settings` | App settings |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Auth pages |

Auth pages are statically imported. Old paths (`/targets`, `/rooms`, etc.) redirect to `/dashboard/*`.

## Design System

### Brand Identity

| Token | Value | Role |
|-------|-------|------|
| Black | `#1C192B` | Primary text, dark backgrounds |
| Burnt Orange | `#CE3E0A` | Primary accent — CTAs, active states, links |
| Purple | `#816E94` | Secondary/muted — inactive states, labels |
| Ivory | `#F6F7EB` | Page backgrounds |

### Typography

| Font | Role |
|------|------|
| **Comfortaa** | Logo & display text only |
| **Merriweather** | Headlines & section titles |
| **Raleway** | Body text, labels, stats, numbers, buttons |

Fonts are self-hosted from `public/Comfortaa,Merriweather,Raleway/`.

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase project (auth + database + edge functions)
- ThingsBoard instance (IoT platform)

### Installation

```bash
git clone <repository-url>
cd glow-dashboard-pulse
npm install
```

### Environment

Create a `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_TB_HOST=thingsboard.cloud
VITE_TB_BASE_URL=https://thingsboard.cloud
```

The Vite dev server proxies `/api/tb` requests to ThingsBoard to avoid CORS issues.

### Development

```bash
npm run dev          # Start dev server (port 8080)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint
```

### Testing

```bash
npm test             # Run all tests (Vitest)
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

Tests are organized under `tests/`:

```
tests/
├── domain/          # Pure business logic tests (20 test files)
│   ├── dashboard-aggregators.test.ts
│   ├── games-rules.test.ts
│   ├── rooms-validators.test.ts
│   ├── targets-permissions.test.ts
│   └── ...
├── features/        # Service and adapter tests (13 test files)
│   ├── auth-service.test.ts
│   ├── games-service.test.ts
│   ├── targets-adapter.test.ts
│   └── ...
├── thingsboard/     # ThingsBoard integration tests
│   ├── api-patterns.test.ts
│   └── data-validation.test.ts
├── safety/          # Architectural constraint tests
│   └── no-direct-thingsboard.test.ts
├── lib/             # Library utility tests
├── pages/           # Page component tests
└── setup.ts         # Test setup (jsdom environment)
```

## Project Configuration

| File | Purpose |
|------|---------|
| `tailwind.config.ts` | Theme tokens, brand colors, typography scale, custom shadows |
| `src/index.css` | CSS custom properties, @font-face, base styles |
| `vite.config.ts` | Build config, path aliases (`@/ → ./src/`), ThingsBoard proxy |
| `vitest.config.ts` | Test runner config (jsdom, 30s timeout) |
| `components.json` | Shadcn/UI configuration |
| `tsconfig.app.json` | TypeScript config (strict mode) |

## License

This project is licensed under the MIT License.
