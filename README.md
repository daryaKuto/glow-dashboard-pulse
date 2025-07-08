# Glow Dashboard Pulse

A modern React dashboard application for managing shooting range scenarios, targets, and rooms with real-time telemetry integration.

## 🚀 Features

### Core Functionality

#### ✅ **Authentication System**
- User registration and login
- Session management with automatic token refresh
- Protected routes and authentication state
- **Status**: Mock data is used for authentication

#### ✅ **Dashboard Overview**
- Real-time statistics display
- Active targets count
- Rooms created count
- Last session score
- Pending invites
- **Status**: Mock data is used for statistics

#### ✅ **Target Management**
- View all targets across rooms
- Target status monitoring (online/offline/error)
- Battery level tracking
- Hit count and accuracy statistics
- Target renaming and firmware updates
- **Status**: Mock data is used for target data

#### ✅ **Room Management**
- Create, rename, and delete rooms
- Drag-and-drop room reordering
- Room capacity tracking (target count)
- **Status**: Mock data is used for room data

#### ✅ **Room Designer**
- Visual room layout editor
- Drag-and-drop target placement
- Target grouping functionality
- Real-time room preview
- **Status**: Mock data is used for room layouts

#### ✅ **Scenario Templates**
- Pre-defined scenario templates (Quick Draw, Double Tap, Triple Threat)
- Scenario configuration (targets, shots, time limits)
- Room validation before starting scenarios
- **Status**: Frontend templates only - no backend integration yet

#### ✅ **Scenario Runtime**
- Start scenarios with room validation
- Real-time scenario status tracking
- Stop active scenarios
- **Status**: Mock data is used - API integration pending

#### ✅ **Leaderboard**
- User performance rankings
- Score tracking and comparison
- **Status**: Mock data is used for leaderboard

#### ✅ **User Profile**
- User statistics and achievements
- Recent session history
- Profile management
- **Status**: Mock data is used for user data

#### ✅ **Settings**
- Theme customization
- Notification preferences
- Account management
- **Status**: Mock data is used for settings

### Technical Features

#### ✅ **Real-time WebSocket Integration**
- Live target hit detection
- Real-time score updates
- Connection status monitoring
- **Status**: Mock WebSocket implementation

#### ✅ **ThingsBoard Integration**
- API client with automatic JWT refresh
- Device management
- Telemetry data collection
- WebSocket connections
- **Status**: API client ready, but using mock data

#### ✅ **Metrics & Analytics**
- Reaction time calculations
- Hit pattern analysis
- Performance statistics
- **Status**: Mock data is used for metrics

## 🛠 Tech Stack

- **Frontend**: React 18 + TypeScript
- **UI Framework**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Routing**: React Router v6
- **HTTP Client**: Axios with automatic retry
- **Real-time**: WebSocket API
- **Build Tool**: Vite
- **Testing**: Vitest + Testing Library
- **Backend Integration**: ThingsBoard IoT Platform

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── dashboard/      # Dashboard-specific components
│   └── scenarios/      # Scenario-related components
├── pages/              # Page components
│   ├── dashboard/      # Dashboard pages
│   └── auth/          # Authentication pages
├── store/              # Zustand stores
├── services/           # API services
│   └── thingsboard.ts  # ThingsBoard integration
├── lib/                # Utilities and configurations
│   ├── api.ts         # API client
│   └── tbClient.ts    # ThingsBoard HTTP client
├── hooks/              # Custom React hooks
├── providers/          # React context providers
└── data/               # Static data and templates
    └── scenarios.ts    # Scenario templates
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

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
   VITE_TB_HOST=your-thingsboard-host
   VITE_TB_PORT=8080
   VITE_TB_USE_HTTPS=false
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

The app is configured to integrate with ThingsBoard IoT platform:

- **API Endpoints**: Configured via environment variables
- **Authentication**: JWT-based with automatic refresh
- **WebSocket**: Real-time telemetry streaming
- **Device Management**: Target device CRUD operations

### Theme Customization

The app uses a custom color scheme defined in `tailwind.config.ts`:

- **Primary**: Brown (`#6B4A38`)
- **Background**: Light cream (`#F3E7DB`)
- **Text**: Dark blue (`#1A243C`)
- **Typography**: Oswald (headings) + Poppins (body)

## 📊 Current Data Sources

### Mock Data (Development)
- User authentication
- Target information
- Room layouts
- Scenario history
- Leaderboard rankings
- User profiles
- Statistics and metrics

### Real API Integration (Ready)
- ThingsBoard HTTP client
- WebSocket connections
- API authentication
- Device management endpoints

## 🔄 API Integration Status

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | Mock | Ready for ThingsBoard integration |
| Target Management | Mock | API endpoints ready |
| Room Management | Mock | CRUD operations ready |
| Scenario Runtime | Mock | Template system ready |
| WebSocket | Mock | Real-time ready |
| Metrics | Mock | Calculation logic ready |

## 🧪 Testing

The project includes comprehensive testing:

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:ui

# Run tests once
npm run test:run
```

### Test Coverage
- Component unit tests
- Store state management tests
- API integration tests
- Scenario template validation

## 🚧 Development Roadmap

### Phase 1: Core Infrastructure ✅
- [x] React + TypeScript setup
- [x] UI component library
- [x] State management
- [x] Routing system
- [x] Authentication flow

### Phase 2: Mock Data & UI ✅
- [x] Target management interface
- [x] Room designer
- [x] Scenario templates
- [x] Dashboard statistics
- [x] User profile system

### Phase 3: API Integration 🚧
- [ ] Connect to ThingsBoard API
- [ ] Real-time WebSocket integration
- [ ] Live target telemetry
- [ ] Scenario execution
- [ ] Performance metrics

### Phase 4: Advanced Features 📋
- [ ] Multi-user scenarios
- [ ] Advanced analytics
- [ ] Mobile optimization
- [ ] Offline support
- [ ] Export/import functionality

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the documentation in `/docs`
- Review the API documentation
- Open an issue on GitHub

---

**Note**: This application is currently using mock data for development purposes. Real ThingsBoard integration is ready but requires backend setup and configuration.
