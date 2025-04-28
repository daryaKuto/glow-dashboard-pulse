
# Technical Documentation

## Architecture Overview

This application uses a client-side architecture with React and TypeScript, featuring:

1. **Component-based UI**: Modular, reusable components 
2. **State Management**: Zustand stores for global state
3. **Mock Backend**: MSW (Mock Service Worker) for API simulation
4. **WebSocket Communication**: Real-time updates for game sessions

## Project Structure

```
src/
├── components/      # Reusable UI components
├── hooks/           # Custom React hooks
├── lib/             # Utility functions
├── mocks/           # API mocking
├── pages/           # Main pages
└── store/           # Zustand state stores
```

## State Management

The application uses Zustand for state management with these main stores:

### useStats
- Manages global statistics (active targets, rooms created, etc.)
- Handles WebSocket connection for real-time hit updates

### useTargets
- CRUD operations for targets
- Target-specific actions (locate, firmware update, etc.)

### useRooms
- CRUD operations for rooms
- Room reordering functionality

### useSessions
- Session management
- Real-time player score tracking

## WebSocket Communication

Two types of WebSocket connections are implemented:

1. **Stats WebSocket**: 
   - Initialized in the Dashboard
   - Tracks target hits in real-time
   - Updates hit trends and statistics

2. **Session WebSocket**:
   - Initialized when joining a session
   - Updates player scores in real-time
   - Provides session status

## API Mocking

Mock Service Worker (MSW) is used to simulate API endpoints:

- REST endpoints for CRUD operations
- Mock WebSocket implementation

## Components

### Key UI Components

- **Cards**: TargetCard, RoomCard for displaying items
- **DragDropList**: Drag-and-drop reordering with @dnd-kit
- **Charts**: TrendChart for visualizing hit data
- **Layout**: Header, Sidebar, MobileDrawer for responsive layout

## TypeScript Implementation

The codebase uses TypeScript throughout with:

- Interface definitions for all data structures
- Type safety for API requests and responses
- Strongly typed state management
- Generic components with type parameters

## Bug Fixes and Optimizations

Recent fixes:

1. **Icon imports**: Fixed Lucide icon imports to use PascalCase
2. **WebSocket connections**: Corrected WebSocket initialization
3. **TypeScript improvements**: Added proper typing for request bodies
4. **API handler typing**: Strengthened type safety in MSW handlers

## Drag and Drop Implementation

Room reordering uses @dnd-kit with:

- Custom sortable components
- Keyboard accessibility
- Touch support for mobile
- Optimistic UI updates

## Development Guidelines

When extending the application:

1. Keep components small and focused
2. Add new features in their own files
3. Maintain TypeScript types
4. Update documentation when adding major features

## Testing

Current test coverage focuses on:
- Store functionality
- Component rendering
- API mocking validation

## Future Improvements

Potential enhancements:

1. Offline support with service workers
2. Enhanced error handling and retries
3. Performance optimizations for large datasets
4. Additional interactive visualizations

