# Glow Dashboard Pulse

A modern React dashboard application for managing shooting range scenarios, targets, and rooms with real-time telemetry integration via ThingsBoard IoT platform.

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
- Pre-defined scenario templates (Quick Draw, Double Tap, Triple Threat)
- Scenario configuration (targets, shots, time limits)
- Room validation before starting scenarios
- **Status**: ✅ Template system ready for execution

#### ✅ **Scenario Runtime**
- Start scenarios with room validation
- Real-time scenario status tracking
- Stop active scenarios
- **Status**: 🚧 Ready for ThingsBoard integration

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

## 🛠 Tech Stack

- **Frontend**: React 18 + TypeScript
- **UI Framework**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Routing**: React Router v6
- **HTTP Client**: Axios with automatic retry
- **Real-time**: WebSocket API
- **Build Tool**: Vite
- **Testing**: Vitest + Testing Library
- **Backend Integration**: ThingsBoard IoT Platform + Supabase
- **Authentication**: Supabase Auth

## 📁 Project Structure

```
glow-dashboard-pulse/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── dashboard/      # Dashboard-specific components
│   │   └── scenarios/      # Scenario-related components
│   ├── pages/              # Page components
│   │   ├── dashboard/      # Dashboard pages
│   │   └── auth/          # Authentication pages
│   ├── store/              # Zustand stores
│   ├── services/           # API services
│   │   └── thingsboard.ts  # ThingsBoard integration
│   ├── lib/                # Utilities and configurations
│   │   ├── api.ts         # API client
│   │   ├── tbClient.ts    # ThingsBoard HTTP client
│   │   └── cache.ts       # Caching utilities
│   ├── hooks/              # Custom React hooks
│   ├── providers/          # React context providers
│   ├── integrations/       # External service integrations
│   │   └── supabase/       # Supabase client and types
│   └── data/               # Static data and templates
│       └── scenarios.ts    # Scenario templates
├── tests/                  # All test files (organized)
│   ├── lib/               # Library tests
│   ├── data/              # Data tests
│   ├── pages/             # Page component tests
│   ├── services/          # Service tests
│   └── store/             # Store tests
├── scripts/               # Utility scripts
├── postman/               # API testing collections
├── supabase/              # Database schemas and migrations
└── docs/                  # Documentation
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

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Run tests**
   ```bash
   npm run test
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

The app uses a custom color scheme defined in `tailwind.config.ts`:

- **Primary**: Brown (`#6B4A38`)
- **Background**: Light cream (`#F3E7DB`)
- **Text**: Dark blue (`#1A243C`)
- **Typography**: Oswald (headings) + Poppins (body)

## 📊 Current Data Sources

### Real Data Integration ✅
- **ThingsBoard Devices**: Target information and status
- **ThingsBoard Telemetry**: Real-time hit data and metrics
- **ThingsBoard Attributes**: Room assignments and configurations
- **Supabase Auth**: User authentication and sessions

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
| Scenario Templates | ✅ Ready | Template system complete |
| Scenario Runtime | 🚧 Ready | API integration pending |
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
- Tests use real data and providers (no mocks)
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

### Phase 3: Advanced Features 🚧
- [ ] Scenario execution engine
- [ ] Real-time scenario tracking
- [ ] Advanced analytics dashboard
- [ ] User profiles and preferences
- [ ] Leaderboard system

### Phase 4: Production Features 📋
- [ ] Multi-user scenarios
- [ ] Mobile optimization
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
