
# Bug Fix Log

## Recent Fixes

### 2025-04-28

#### Fixed Lucide Icon Imports

**Issue**: Icon imports were using kebab-case (e.g., `circle-check`) which caused syntax errors in TypeScript files.

**Fix**: Updated all icon imports to use PascalCase component names (e.g., `CircleCheck`) which is the correct format for Lucide React components.

**Files Modified**:
- TargetCard.tsx
- Sessions.tsx
- RoomCard.tsx
- DragDropList.tsx
- Profile.tsx
- Targets.tsx

#### Resolved Missing Dependencies

**Issue**: The application was using `@dnd-kit/sortable` but the dependency was missing.

**Fix**: Added the required @dnd-kit packages to the dependencies.

**Packages Added**:
- @dnd-kit/core
- @dnd-kit/sortable
- @dnd-kit/utilities

#### Fixed WebSocket Import

**Issue**: The `useStats.ts` file was trying to import `createMockWebSocket` which didn't exist in the mockSocket.ts file.

**Fix**: Updated the import to use the correct function name `createSessionWebSocket`.

**Files Modified**:
- src/store/useStats.ts

#### Added TypeScript Types for MSW Handlers

**Issue**: The MSW handlers in `handlers.ts` were using untyped request bodies, causing TypeScript errors.

**Fix**: Added proper interfaces for all request body types to ensure type safety.

**Types Added**:
- TargetUpdateBody
- RoomCreateBody
- RoomUpdateBody
- RoomOrderBody
- SessionCreateBody
- InviteCreateBody

#### Fixed Missing Property in useTargets

**Issue**: The Targets page was trying to use `firmwareUpdateTarget` but was calling `updateFirmware` instead.

**Fix**: Updated the Targets component to use the correct method name.

**Files Modified**:
- src/pages/Targets.tsx

## Previous Known Issues

### WebSocket Connection Stability

**Status**: Monitoring

Some users reported occasional disconnections from the WebSocket server. The application now has reconnection logic and visible connection status indicators.

### Mobile Layout Improvements

**Status**: In Progress

The application is fully functional on mobile devices, but some UI elements could be better optimized for smaller screens.

