
# Project Documentation

## Overview

This project is a web application for managing target practice sessions, built with React, TypeScript, and Tailwind CSS. The application allows users to manage targets, rooms, and training sessions.

## Core Functionality

- **Dashboard**: View statistics about targets, rooms, and sessions
- **Targets Management**: Add, rename, locate, and delete targets
- **Room Management**: Create, rename, reorder, and delete rooms
- **Sessions**: Create and manage training sessions with real-time scoring

## Technical Stack

- **Frontend**: React with TypeScript
- **State Management**: Zustand
- **Styling**: Tailwind CSS with shadcn/ui components
- **WebSocket Communication**: For real-time session updates
- **Drag and Drop**: @dnd-kit library for room reordering

## Key Components

### Store

- **useStats**: Manages global statistics and WebSocket connections
- **useTargets**: CRUD operations for targets
- **useRooms**: CRUD operations for rooms
- **useSessions**: CRUD operations for sessions and player scoring

### Pages

- **Dashboard**: Main dashboard showing statistics
- **Targets**: List and manage targets
- **Rooms**: List and manage rooms
- **Sessions**: Create and participate in training sessions

### Components

- **TargetCard**: Displays target info with actions
- **RoomCard**: Displays room info with actions
- **DragDropList**: Reusable drag and drop list with sorting
- **SessionScoreboard**: Real-time session scores display
- **StatCard**: Reusable stats display
- **TrendChart**: Chart visualization for hit trends

## API Mock Integration

The application uses MSW (Mock Service Worker) to simulate API calls:

- Mock REST endpoints for targets, rooms, sessions
- Mock WebSocket connections for real-time updates

## Recent Bug Fixes

1. Fixed Lucide icon imports by using PascalCase component names
2. Resolved missing dependencies by installing @dnd-kit packages
3. Fixed incorrect WebSocket import in useStats
4. Added proper TypeScript typings for MSW handlers

## Code Organization

- **src/components/**: Reusable UI components
- **src/pages/**: Main page components
- **src/store/**: Zustand stores
- **src/hooks/**: Custom React hooks
- **src/mocks/**: Mock API implementation
- **src/lib/**: Utility functions

## WebSocket Implementation

The application uses WebSockets for real-time updates:

1. Stats WebSocket: Tracks target hits in real-time
2. Session WebSocket: Updates player scores during active sessions

