
# Technical Overview

## Architecture

The FunGun Training application is a React-based web application with a client-side architecture, featuring:

1. **Component-based UI**: Modular, reusable components built with React and TypeScript
2. **State Management**: Zustand stores for global state
3. **Mock Backend**: MSW (Mock Service Worker) for API simulation
4. **WebSocket Communication**: Real-time updates for game sessions and statistics

## Project Structure

```
src/
├── components/         # Reusable UI components
│   ├── marketing/      # Marketing site components
│   ├── dashboard/      # Dashboard components
│   └── ui/             # UI component library (shadcn/ui)
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and API mocks
├── mocks/              # API mocking configuration
├── pages/              # Main page components
│   ├── marketing/      # Marketing site pages
│   └── dashboard/      # Dashboard pages
├── providers/          # Context providers
└── store/              # Zustand state stores
```

## Core Technologies

- **React**: UI library
- **TypeScript**: Type safety throughout the codebase
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Component library based on Radix UI
- **Zustand**: State management
- **React Router**: Routing
- **MSW**: API mocking
- **Recharts**: Data visualization
- **@dnd-kit**: Drag and drop functionality
- **Lucide**: Icon library

## Key Implementation Details

### 1. Authentication Flow

- Login/Signup handled by `AuthProvider`
- Protected routes redirect unauthenticated users
- JWT storage in localStorage for persistence

### 2. State Management

The application uses Zustand for state management with these main stores:

- **useAuth**: Authentication state and operations
- **useStats**: Global statistics and WebSocket management
- **useTargets**: Target CRUD operations
- **useRooms**: Room management with drag-and-drop ordering
- **useSessions**: Session management and real-time scoring

### 3. WebSocket Implementation

Two WebSocket types handle real-time communication:

1. **Stats WebSocket**:
   - Initialized in Dashboard
   - Updates hit trends and statistics

2. **Session WebSocket**:
   - Handles player scores during active sessions

### 4. Responsive Layout Strategy

- Sidebar collapses to icons on desktop (expandable on hover)
- Mobile drawer navigation on small screens
- Flexible grid layouts with Tailwind breakpoints
- Component-specific mobile adaptations

### 5. API Integration

- API routes defined in `lib/api.ts`
- Mock implementations with MSW for development
- Structured for easy replacement with real backend

## Development Guidelines

When extending the application:

1. **Component Structure**:
   - Keep components small and focused
   - Separate business logic from presentation
   - Use TypeScript interfaces for props

2. **State Management**:
   - Use local state for component-specific state
   - Use Zustand stores for shared state
   - Minimize prop drilling with strategic store usage

3. **Styling**:
   - Use Tailwind utility classes
   - Leverage shadcn/ui components when possible
   - Follow the established color scheme and spacing patterns

4. **Error Handling**:
   - Use toast notifications for user feedback
   - Log errors to console during development
   - Gracefully handle API and WebSocket failures
