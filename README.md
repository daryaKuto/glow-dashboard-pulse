# Glow Dashboard Pulse

A modern React dashboard application for managing shooting range scenarios, targets, and rooms with real-time telemetry integration via ThingsBoard IoT platform.

## 🔄 Telemetry Strategy

- **Dashboards & rooms** refresh from Supabase edge caches on a ≤10 s SLA using adaptive polling with exponential backoff.
- **Live game sessions** target a ≤1 s SLA: the client upgrades to a dedicated Supabase `device-telemetry` edge WebSocket bridge during active play and falls back to polling otherwise.
- Heartbeat and slow-cycle logging provide early warnings if either SLA is breached.

## 🚀 Features

### Core Functionality

#### ✅ **Authentication System**
- User registration and login via Supabase
- Session management with automatic token refresh
- Protected routes and authentication state
- **Status**: ✅ Fully integrated with Supabase

#### ✅ **Dashboard Overview**
- Real-time statistics display from ThingsBoard
- Active targets count with live status
- Rooms created count
- Last session score
- Pending invites
- **Status**: ✅ Real data from ThingsBoard API

#### ✅ **Target Management**
- View all targets across rooms from ThingsBoard devices
- Target status monitoring (online/offline/error)
- Battery level tracking
- Hit count and accuracy statistics
- Target renaming and firmware updates
- **Status**: ✅ Real data from ThingsBoard devices

#### ✅ **Room Management**
- Create, rename, and delete rooms
- Drag-and-drop room reordering
- Room capacity tracking (target count)
- Room-target assignment management
- **Status**: ✅ Real data via ThingsBoard device attributes

#### ✅ **Room Designer**
- Visual room layout editor
- Drag-and-drop target placement
- Target grouping functionality
- Real-time room preview
- **Status**: ✅ Real data integration

#### ✅ **Scenario Templates**
- Pre-defined scenario templates (currently: Double Tap)
- Scenario configuration (targets, shots, time limits)
- Room validation before starting scenarios
- **Status**: ✅ Template system fully implemented

#### ✅ **Scenario Runtime**
- Full-screen countdown with 3-2-1 beep synchronization
- Start scenarios with room validation and target selection
- Real-time scenario status tracking with live progress
- Stop active scenarios with proper cleanup
- Demo mode with mock data for testing
- **Status**: ✅ Fully implemented with ThingsBoard-ready structure

#### ✅ **Leaderboard**
- User performance rankings
- Score tracking and comparison
- **Status**: 🚧 Ready for implementation

#### ✅ **User Profile**
- User statistics and achievements
- Recent session history
- Profile management
- **Status**: 🚧 Ready for implementation

#### ✅ **Settings**
- Theme customization
- Notification preferences
- Account management
- **Status**: ✅ UI ready, backend integration pending

### Technical Features

#### ✅ **Real-time WebSocket Integration**
- Live target hit detection via ThingsBoard telemetry
- Real-time score updates
- Connection status monitoring
- **Status**: ✅ WebSocket client ready for ThingsBoard

#### ✅ **ThingsBoard Integration**
- API client with automatic JWT refresh
- Device management and filtering
- Telemetry data collection
- WebSocket connections
- **Status**: ✅ Fully integrated and working

#### ✅ **Metrics & Analytics**
- Reaction time calculations
- Hit pattern analysis
- Performance statistics
- **Status**: ✅ Real data processing from ThingsBoard

#### ✅ **Mobile-First Design**
- Responsive layouts optimized for mobile devices
- Touch-friendly interactions and button sizing
- Scalable typography and component sizing
- Mobile-optimized navigation and status banners
- **Status**: ✅ Fully implemented across all pages

#### ✅ **Countdown System**
- Full-screen countdown popup with brand styling
- 3-2-1 countdown with synchronized audio beeps
- ThingsBoard-ready signal structure for hardware integration
- Demo mode with mock countdown simulation
- **Status**: ✅ Complete implementation ready for hardware

## 🛠 Tech Stack

- **Frontend**: React 18 + TypeScript
- **UI Framework**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Routing**: React Router DOM v6
- **HTTP Client**: Axios with automatic retry
- **Real-time**: WebSocket API
- **Build Tool**: Vite
- **Testing**: Vitest + Testing Library + jsdom
- **Backend Integration**: ThingsBoard IoT Platform + Supabase
- **Authentication**: Supabase Auth

## 📁 Project Structure

```
glow-dashboard-pulse/
├── src/                    # Source code
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # shadcn/ui components (51 components)
│   │   │   ├── accordion.tsx, alert-dialog.tsx, alert.tsx
│   │   │   ├── aspect-ratio.tsx, avatar.tsx, badge.tsx
│   │   │   ├── breadcrumb.tsx, button.tsx, calendar.tsx
│   │   │   ├── card.tsx, carousel.tsx, chart.tsx
│   │   │   ├── checkbox.tsx, collapsible.tsx, command.tsx
│   │   │   ├── context-menu.tsx, dialog.tsx, drawer.tsx
│   │   │   ├── dropdown-menu.tsx, form.tsx, hover-card.tsx
│   │   │   ├── input.tsx, label.tsx, menubar.tsx
│   │   │   ├── navigation-menu.tsx, pagination.tsx, popover.tsx
│   │   │   ├── progress.tsx, radio-group.tsx, scroll-area.tsx
│   │   │   ├── select.tsx, separator.tsx, sheet.tsx
│   │   │   ├── sidebar.tsx, skeleton.tsx, slider.tsx
│   │   │   ├── switch.tsx, table.tsx, tabs.tsx
│   │   │   ├── textarea.tsx, toast.tsx, toggle.tsx
│   │   │   └── tooltip.tsx, use-toast.ts
│   │   ├── dashboard/      # Dashboard-specific components
│   │   │   └── index.ts
│   │   ├── scenarios/      # Scenario-related components
│   │   │   ├── CreateScenarioDialog.tsx
│   │   │   └── ScenarioCard.tsx
│   │   ├── settings/       # Settings page components
│   │   │   ├── DangerZone.tsx
│   │   │   ├── NotificationSettings.tsx
│   │   │   └── ThemeSettings.tsx
│   │   ├── DragDropList.tsx
│   │   ├── FindFriendsTab.tsx
│   │   ├── GroupBox.tsx
│   │   ├── Header.tsx
│   │   ├── InspectorPanel.tsx
│   │   ├── InviteModal.tsx
│   │   ├── MobileDrawer.tsx
│   │   ├── PalettePanel.tsx
│   │   ├── PhoneVerifyModal.tsx
│   │   ├── RoomCanvas.tsx
│   │   ├── RoomCard.tsx
│   │   ├── ScenarioCountdown.tsx      # Full-screen countdown popup
│   │   ├── SearchInput.tsx
│   │   ├── ShootingStatusBanner.tsx   # Mobile-optimized status banner
│   │   ├── Sidebar.tsx
│   │   ├── StatCard.tsx
│   │   ├── TargetCard.tsx
│   │   ├── TargetIcon.tsx
│   │   ├── TargetPreferencesSkeleton.tsx
│   │   ├── TrendChart.tsx
│   │   └── UserSearchResult.tsx
│   ├── pages/              # Page components
│   │   ├── auth/          # Authentication pages
│   │   │   └── callback.tsx
│   │   ├── dashboard/      # Dashboard pages
│   │   │   └── Dashboard.tsx
│   │   ├── Leaderboard.tsx
│   │   ├── Login.tsx
│   │   ├── NotFound.tsx
│   │   ├── Profile.tsx
│   │   ├── RoomDesigner.tsx
│   │   ├── Rooms.tsx
│   │   ├── Scenarios.tsx
│   │   ├── Settings.tsx
│   │   ├── Signup.tsx
│   │   └── Targets.tsx
│   ├── store/              # Zustand stores (10 stores)
│   │   ├── useAuth.ts
│   │   ├── useDashboardStats.ts
│   │   ├── useFriends.ts
│   │   ├── useRoomDesigner.ts
│   │   ├── useRooms.ts
│   │   ├── useScenarioRun.ts
│   │   ├── useScenarios.ts
│   │   ├── useStats.ts
│   │   ├── useTargets.ts
│   │   └── useUserPrefs.ts
│   ├── services/           # API services
│   │   ├── countdown.ts    # Countdown service for scenario starts
│   │   ├── metrics.ts      # Metrics calculation service
│   │   ├── scenario-api.ts # Scenario execution API
│   │   ├── scenario-mock.ts # Mock scenario service
│   │   └── thingsboard.ts  # ThingsBoard integration
│   ├── lib/                # Utilities and configurations
│   │   ├── api.ts         # Main API client
│   │   ├── cache.ts       # Caching utilities
│   │   ├── tbClient.ts    # ThingsBoard HTTP client
│   │   ├── types.ts       # Type definitions
│   │   ├── utils.ts       # Utility functions
│   │   ├── websocket.ts   # WebSocket client
│   │   └── utils/         # Additional utilities
│   │       └── EventEmitter.ts
│   ├── hooks/              # Custom React hooks
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   ├── useScenarioLiveData.ts    # Real-time scenario data
│   │   ├── useScenarioLiveDataMock.ts # Mock scenario data
│   │   ├── useShootingActivityPolling.ts # Smart polling system
│   │   └── useSmartPolling.ts
│   ├── providers/          # React context providers
│   │   └── AuthProvider.tsx
│   ├── integrations/       # External service integrations
│   │   └── supabase/       # Supabase client and types
│   │       ├── client.ts
│   │       └── types.ts
│   ├── types/              # TypeScript type definitions
│   │   ├── game.ts
│   │   └── scenario-data.ts
│   ├── data/               # Static data and templates
│   │   └── scenarios.ts    # Scenario templates
│   ├── mocks/              # Mock data directory
│   ├── App.css
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   ├── test-setup.ts
│   └── vite-env.d.ts
├── tests/                  # Test files (organized)
│   ├── api/               # ThingsBoard API integration tests
│   │   ├── decode-token.js
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── run-tests-fixed.js
│   │   ├── simple-auth-test.js
│   │   ├── test_data.json
│   │   ├── test-runner.js
│   │   └── working-api-test.js
│   ├── data/              # Data tests
│   │   └── scenarios.test.ts
│   ├── lib/               # Library tests
│   │   ├── api.test.ts
│   │   └── tbClient.test.ts
│   ├── pages/             # Page component tests
│   │   └── Targets.test.tsx
│   ├── services/          # Service tests
│   │   └── thingsboard.test.ts
│   └── store/             # Store tests
│       ├── useScenarioRun.test.ts
│       ├── useStats.test.ts
│       └── useTargets.test.ts
├── postman/               # API testing collections
│   ├── README.md
│   ├── SwaggerUI.md
│   ├── TEST_RESULTS.md
│   ├── ThingsBoard_API_Collection_Fixed.json
│   └── ThingsBoard_Environment.json
├── supabase/              # Database schemas and migrations
│   ├── analytics-schema.sql
│   ├── clean-analytics-schema.sql
│   ├── complete-analytics-schema.sql
│   ├── complete-schema.sql
│   ├── config.toml
│   ├── create-tables-only.sql
│   ├── migrations/
│   │   └── 001_create_user_settings.sql
│   └── rls-policies.sql
├── public/                # Static assets and brand fonts
│   ├── ailith_dark.png
│   ├── Comfortaa,Merriweather,Raleway/  # Brand font families
│   │   ├── Comfortaa/     # 3 files (1 variable font + license + readme)
│   │   ├── Merriweather/  # 4 files (2 variable fonts + license + readme)
│   │   └── Raleway/       # 4 files (2 variable fonts + license + readme)
│   ├── favicon.ico
│   ├── placeholder.svg
│   ├── robots.txt
│   ├── target-logo-fav.png
│   └── thumb-3.png        # Updated favicon
├── docs/                  # Comprehensive documentation
│   ├── API.md
│   ├── BugFixLog.md
│   ├── Dashboard.md
│   ├── Design-System.md
│   ├── Installation.md
│   ├── ProjectDocumentation.md
│   ├── SupabaseSetup.md
│   ├── TechnicalOverview.md
│   ├── TechnicalREADME.md
│   ├── ThingsBoard-Scenario-Integration.md
│   └── UserManual.md
├── components.json        # shadcn/ui configuration
├── eslint.config.js       # ESLint configuration
├── index.html             # Main HTML file
├── package.json           # Dependencies and scripts
├── package-lock.json      # Lock file
├── postcss.config.js      # PostCSS configuration
├── README.md              # This file
├── tailwind.config.ts     # Tailwind CSS configuration
├── tsconfig.app.json      # TypeScript app config
├── tsconfig.json          # TypeScript root config
├── tsconfig.node.json     # TypeScript node config
├── vite.config.ts         # Vite build configuration
└── vitest.config.ts       # Vitest test configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- ThingsBoard instance (for IoT data)
- Supabase project (for authentication)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd glow-dashboard-pulse
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file:
   ```env
   # ThingsBoard Configuration
   VITE_TB_BASE_URL=https://your-thingsboard-instance.com
   VITE_TB_WS_URL=wss://your-thingsboard-instance.com
   VITE_TB_CONTROLLER_ID=your-controller-id
   
   # Supabase Configuration
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
   
   **Note**: The app uses Vite proxy configuration to avoid CORS issues with ThingsBoard Cloud.

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Run tests**
   ```bash
   npm run test
   ```

6. **Run API tests (ThingsBoard integration)**
   ```bash
   cd tests/api && npm test
   ```

## 🔧 Configuration

### ThingsBoard Integration

The app is fully integrated with ThingsBoard IoT platform:

- **API Endpoints**: Configured via environment variables
- **Authentication**: JWT-based with automatic refresh
- **WebSocket**: Real-time telemetry streaming
- **Device Management**: Target device CRUD operations
- **Device Filtering**: Smart filtering for target devices
- **Room Management**: Via device attributes

### Supabase Integration

Authentication and user management via Supabase:

- **User Registration/Login**: Email/password authentication
- **Session Management**: Automatic token refresh
- **Protected Routes**: Authentication state management

### Theme Customization

The app uses a custom brand color scheme defined in `tailwind.config.ts`:

- **Brand Primary**: Burnt Orange (`#CE3E0A`) - Icons, buttons when hovered/activated
- **Brand Secondary**: Purple (`#816E94`) - Search bars, default button states
- **Brand Text**: Dark Purple (`#1C192B`) - Primary text and fonts
- **Brand Background**: Ivory (`#F6F7EB`) - Page backgrounds
- **Brand Surface**: White (`#FFFFFF`) - Card backgrounds
- **Typography**: Comfortaa (display), Merriweather (headings), Raleway (body)

## 📊 Current Data Sources

### Real Data Integration ✅
- **ThingsBoard Devices**: Target information and status
- **ThingsBoard Telemetry**: Real-time hit data and metrics
- **ThingsBoard Attributes**: Room assignments and configurations
- **Supabase Auth**: User authentication and sessions

### Recently Implemented ✅
- Full-screen countdown system with 3-2-1 beep synchronization
- Mobile-optimized responsive design across all pages
- Enhanced scenario flow with demo/live mode toggle
- Shooting status banner with mobile optimization
- Brand color system integration (CE3E0A, 816E94, 1C192B, F6F7EB)
- Typography system (Comfortaa, Merriweather, Raleway)

### Ready for Implementation 🚧
- User profiles and preferences
- Leaderboard rankings
- Advanced analytics
- Scenario execution history

## 🔄 API Integration Status

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ Real | Supabase integration complete |
| Target Management | ✅ Real | ThingsBoard device integration |
| Room Management | ✅ Real | Via ThingsBoard device attributes |
| Telemetry Data | ✅ Real | ThingsBoard WebSocket integration |
| Scenario Templates | ✅ Complete | Template system with countdown integration |
| Scenario Runtime | ✅ Complete | Full countdown system with ThingsBoard structure |
| Countdown System | ✅ Complete | 3-2-1 beep sync ready for ThingsBoard |
| WebSocket | ✅ Real | ThingsBoard telemetry streaming |
| Metrics | ✅ Real | Live data from ThingsBoard |

## 🧪 Testing

The project includes comprehensive testing with real data:

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:ui

# Run tests once
npm run test:run

# Run API integration tests
cd tests/api && npm test
```

### Test Coverage
- ✅ Component unit tests (with real providers)
- ✅ Store state management tests
- ✅ API integration tests
- ✅ ThingsBoard service tests
- ✅ Scenario template validation
- ✅ Authentication flow tests

### Test Organization
- All tests are organized under `/tests` directory
- Unit tests use real providers and data
- API integration tests in `/tests/api` with separate package.json
- Proper test isolation and cleanup

## 🚧 Development Roadmap

### Phase 1: Core Infrastructure ✅
- [x] React + TypeScript setup
- [x] UI component library
- [x] State management
- [x] Routing system
- [x] Authentication flow

### Phase 2: Real Data Integration ✅
- [x] ThingsBoard API integration
- [x] Device management and filtering
- [x] Real-time telemetry
- [x] Room management via device attributes
- [x] Target status monitoring

### Phase 3: Advanced Features ✅/🚧
- [x] Scenario execution engine with countdown system
- [x] Real-time scenario tracking with live progress
- [x] Mobile-first responsive design optimization
- [ ] Advanced analytics dashboard
- [ ] User profiles and preferences
- [ ] Leaderboard system

### Phase 4: Production Features 🚧
- [x] Mobile optimization (completed)
- [x] Full-screen countdown with beep synchronization
- [ ] Multi-user scenarios
- [ ] Offline support
- [ ] Export/import functionality
- [ ] Performance monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the documentation in `/docs`
- Review the API documentation
- Open an issue on GitHub

---

**Note**: This application is fully integrated with ThingsBoard IoT platform and Supabase for real data management. All core features are working with live data from your IoT infrastructure.
