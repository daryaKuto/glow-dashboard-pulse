
# Dashboard Documentation

## Overview

The dashboard is the authenticated portion of the FunGun Training application. It provides users with tools to manage targets, rooms, and training sessions, as well as view performance statistics.

## Access Control

- All dashboard routes require authentication
- Unauthenticated users are redirected to the login page
- Authentication state is managed via the `AuthProvider`

## Key Sections

### Main Dashboard (`/dashboard`)
- **Purpose**: Provides an overview of system status and statistics
- **Components**:
  - Stats Cards: Display active targets, rooms created, last session score, pending invites
  - Hit Trend Chart: Visualizes target hits over time
  - WebSocket Connection: Real-time updates for hit data

### Targets Management (`/dashboard/targets`)
- **Purpose**: Manage practice targets
- **Features**:
  - List targets with status (online/offline)
  - Search and filter targets
  - Target actions: rename, locate, update firmware, delete
  - Battery level monitoring

### Rooms Management (`/dashboard/rooms`)
- **Purpose**: Organize physical spaces
- **Features**:
  - Room creation and deletion
  - Target assignment to rooms
  - Room reordering with drag and drop
  - Target count per room

### Sessions (`/dashboard/sessions`)
- **Purpose**: Create and manage training sessions
- **Features**:
  - Session creation with scenario selection
  - Real-time scoring via WebSockets
  - Invite players to sessions
  - Session history and statistics

### User Profile (`/dashboard/profile`)
- **Purpose**: User profile management
- **Features**:
  - Profile information display/edit
  - Performance statistics

### Settings (`/dashboard/settings`)
- **Purpose**: System configuration
- **Features**:
  - Notification preferences
  - Theme settings
  - Account danger zone (deletion)

## Navigation

The dashboard uses two navigation components:

1. **Header** (`src/components/Header.tsx`):
   - User profile dropdown
   - WebSocket connection status
   - Quick navigation to marketing site

2. **Sidebar** (`src/components/Sidebar.tsx`):
   - Main navigation between dashboard sections
   - Collapsible on desktop, drawer on mobile
   - Icon-based navigation with hover labels

## WebSocket Communication

Two WebSocket connections handle real-time updates:

1. **Stats WebSocket**:
   - Connected in Dashboard component
   - Updates target hit statistics in real-time

2. **Session WebSocket**:
   - Connected in active sessions
   - Updates player scores during training

## State Management

The application uses Zustand for state management with several stores:

- `useStats`: Dashboard statistics and WebSocket state
- `useTargets`: Target management operations
- `useRooms`: Room management operations
- `useSessions`: Session management and scoring
- `useAuth`: Authentication state

## Technical Implementation

- **Component Structure**: Small, focused components for maintainability
- **Responsive Design**: Functions on both mobile and desktop devices
- **Error Handling**: Toast notifications for user feedback
- **TypeScript**: Strong typing throughout the codebase
- **API Mocking**: MSW used for development without backend
