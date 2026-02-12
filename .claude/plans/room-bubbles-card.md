# Plan: Replace Hit Timeline with Room Bubbles Card

## Overview

Remove the Hit Timeline card (redundant with Target Activity bar chart) and replace it with a **Room Bubbles** card — a visual bubble layout showing the user's rooms, sized by session count, with the most-played room being the largest bubble.

## Current Layout (2-column grid, row 2)

```
┌──────────────────────┐ ┌──────────────────────┐
│ TimelineCard         │ │ HitDistributionCard  │
│ (REMOVING)           │ │ (KEEPING)            │
└──────────────────────┘ └──────────────────────┘
```

## New Layout

```
┌──────────────────────┐ ┌──────────────────────┐
│ RoomBubblesCard      │ │ HitDistributionCard  │
│ (NEW)                │ │ (KEEPING)            │
└──────────────────────┘ └──────────────────────┘
```

## RoomBubblesCard Design

**Card structure:**
- Card header: icon + "Your Rooms" title + subtitle "Session distribution"
- Bubble area: flex-wrap layout with circular bubbles, centered
- Each bubble is a circle with the room's Lucide icon centered inside
- Room name below each bubble
- Session count as a small badge or inside the bubble

**Bubble sizing (Strava-inspired):**
- Most-played room: largest bubble (`w-24 h-24` / 96px)
- Other rooms scale proportionally based on session count ratio
- Minimum bubble size: `w-14 h-14` (56px) so icons remain visible
- Rooms with 0 sessions: minimum size, muted styling

**Bubble styling:**
- Background: `bg-brand-primary/[0.08]` (warm tint) for the most-played room
- Background: `bg-brand-secondary/[0.06]` for other rooms
- The most-played room gets a subtle `ring-2 ring-brand-primary/20` highlight
- Icons: Lucide icons from the room's `icon` field, sized proportionally to bubble
- On hover: slight scale-up + shadow lift

**Data flow:**
1. `rooms` from `useRooms()` — already fetched in dashboard-page.tsx
2. `sessions` from `useDashboardSessions()` — already fetched
3. Group sessions by `roomName` → count per room
4. Match counts to rooms via `room.name === session.roomName`
5. Sort by session count descending

**Icon mapping:** Reuse the existing `getRoomIcon` pattern from `src/components/RoomCard.tsx` (lines 69-86) — the `iconMap` that maps string keys to Lucide components.

## Files to Change

### 1. Create `src/features/dashboard/ui/RoomBubblesCard.tsx` (NEW)
- Props: `rooms: EdgeRoom[]`, `sessions: DashboardSession[]`, `isLoading: boolean`
- Internal: group sessions by roomName, compute per-room counts
- Render: bubble layout with proportional sizing
- Skeleton: placeholder circles during loading
- Empty state: "No rooms configured" with link to rooms page

### 2. Modify `src/features/dashboard/ui/dashboard-page.tsx`
- Remove: `TimelineCard` lazy import, `hitTimelineTrackedDevices`, `hitTimelineData`, `hitTimelineLoading` variables, `aggregateSeriesLabel` useMemo
- Remove: `HitTimelineSkeleton` import
- Add: Import `RoomBubblesCard`
- Replace the `<TimelineCard>` usage with `<RoomBubblesCard rooms={rooms} sessions={sessions} isLoading={shouldShowSkeleton} />`
- Keep `HitDistributionCardWrapper` as-is in the same grid

### 3. No changes to `HitTimelineCard.tsx`
- Leave the file in place — it may still be used in the games/session detail view
- Just remove the dashboard import/usage

## NOT doing
- Not deleting HitTimelineCard.tsx or TimelineCard.tsx (may be used elsewhere)
- Not changing the HitDistributionCard
- Not adding new data fetching — all data already available
