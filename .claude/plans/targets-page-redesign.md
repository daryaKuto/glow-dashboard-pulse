# Targets Page Redesign Plan

> Align `src/features/targets/ui/targets-page.tsx` and sub-components with the Design Gospel established by the Dashboard redesign.

---

## Current State (Problems)

The Targets page is the **oldest page in the app** and predates the Design Gospel. Every UI element violates at least one principle:

| Problem | Where | Gospel Violation |
|---------|-------|-----------------|
| Cards have `border-gray-200` visible borders | TargetCard, TargetsSummary | Phase 4: "NO visible borders by default" |
| `rounded-sm md:rounded-lg` on cards | TargetCard | Phase 4: cards use `rounded-[var(--radius-lg)]` |
| Stat numbers use `font-heading` (Merriweather) | TargetCard, TargetsSummary | Phase 2: "Stat numbers always use Raleway 700" / Anti-pattern #6 |
| "Create Group" button is `bg-brand-secondary` | Page header | Anti-pattern #1: "NEVER use purple as primary button" |
| Labels are same size or bigger than data | TargetsSummary stat cards | P1: "Numbers are ALWAYS the largest" |
| Icon badge backgrounds (`bg-brand-secondary/10 rounded-lg p-2`) | CreateGroupModal, AddTargetsToGroupModal | Phase 5 / Anti-pattern #2 |
| Status badges use non-brand colors (blue, amber, generic green) | TargetCard | Phase 2: use brand palette |
| Search input has `border-gray-200`, not pill shape | Search bar | Phase 11: pill search, subtle border |
| No card tint gradients | All cards | Phase 4: card tint system |
| No shadow-card / shadow-card-hover | TargetCard | Phase 4: shadow-based elevation |
| `text-sm md:text-2xl font-heading` for stat numbers | TargetsSummary | Phase 2: use `text-stat-*` tokens |
| No skeleton loading states matching card structure | Skeletons are generic gray blocks | Dashboard pattern: skeletons mirror final layout |
| No Framer Motion entrance animations | Entire page | Phase 12: staggered card entrance |
| Room section headers don't match Design Gospel typography | Room group headings | Phase 2: Merriweather for headings, Raleway for body |
| Buttons not pill-shaped (`rounded-sm md:rounded`) | Various badges and buttons | Phase 3: all buttons `rounded-full` |

---

## Steps

### Step 0: Page Layout Shell

The targets page must use the standard page layout pattern from Phase 6D, including all utility classes.

**Outer wrapper:**
```tsx
<div className="min-h-screen flex flex-col bg-brand-light responsive-container pt-[116px] lg:pt-16">
  <Header />
  {isMobile && <MobileDrawer />}
  {!isMobile && <Sidebar />}
  <div className="flex flex-1 no-overflow lg:pl-64">
    <main className="flex-1 overflow-y-auto responsive-container">
      {/* Content wrapper with standard padding + spacing */}
      <div className="w-full px-4 py-2 md:p-4 lg:p-6 md:max-w-7xl md:mx-auto space-y-2 md:space-y-4 lg:space-y-6 responsive-transition h-full">
        {/* Stat cards, target cards grid, etc. — each as a direct child for space-y spacing */}
      </div>
    </main>
  </div>
</div>
```

**Key points:**
- `responsive-container`, `no-overflow`, `responsive-transition` are custom utility classes defined in `src/index.css`
- Section vertical spacing is handled by `space-y-2 md:space-y-4 lg:space-y-6` on the content wrapper — individual sections do NOT add their own margin-bottom
- Content width: `md:max-w-7xl md:mx-auto` for centered max-width layout

### Step 1: TargetsSummary → StatCards Row

Replace the current `TargetsSummary` component (5 generic cards in a grid) with the Dashboard's `StatCard` pattern.

#### Current Implementation (BEFORE — lines 262-296)

```tsx
const TargetsSummary: React.FC<{ targets: Target[]; rooms: Room[] }> = ({ targets, rooms }) => {
  const onlineTargets = targets.filter(t => t.status === 'online').length;
  const standbyTargets = targets.filter(t => t.status === 'standby').length;
  const offlineTargets = targets.filter(t => t.status === 'offline').length;
  const unassignedTargets = targets.filter(t => !t.roomId).length;

  const stats = [
    { label: 'Total Targets', value: targets.length, color: 'text-brand-dark' },
    { label: 'Online', value: onlineTargets, color: 'text-green-600' },
    { label: 'Standby', value: standbyTargets, color: 'text-yellow-600' },
    { label: 'Offline', value: offlineTargets, color: 'text-gray-600' },
    { label: 'Unassigned', value: unassignedTargets, color: 'text-yellow-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4 mb-3 md:mb-6">
      {stats.map((stat, index) => (
        <Card key={...} className="bg-white border-gray-200 shadow-sm rounded-sm md:rounded-lg">
          <CardContent className="p-2 md:p-4 text-center">
            <div className={`text-sm md:text-2xl font-bold ${stat.color} font-heading`}>{stat.value}</div>
            <div className="text-xs md:text-sm text-brand-dark/70 font-body">{stat.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
```

**Problems:**
- 5 cards in grid → awkward `lg:grid-cols-5` (uneven at smaller widths)
- `border-gray-200 shadow-sm rounded-sm` — violates Phase 4 (no borders, use shadow-card, use --radius-lg)
- `text-sm md:text-2xl font-bold font-heading` — violates Phase 2 (stat numbers use Raleway/font-body, not Merriweather/font-heading)
- `text-center` layout without proper hierarchy — numbers should be hero-sized and centered per Dashboard StatCard pattern
- Uses ad-hoc `text-green-600` / `text-yellow-600` — violates single-accent discipline
- No icons on any card
- Labels are same size or larger than numbers at mobile (`text-xs` label vs `text-sm` number)

#### New Implementation (AFTER)

Drop the `TargetsSummary` component entirely and replace with the Dashboard `StatCard` component. Import `StatCard` from the dashboard or extract it to a shared location.

**Data derivation (keep in `targets-page.tsx`, pass as props):**

All counts derive from the `storeTargets` array (merged `useTargets()` + `useTargetDetails()` via `mergeTargetDetails()`). Status is already derived by `deriveStatusFromRaw()` in `edge.ts`. Room assignment normalization: `roomId` can be `null`, `""`, `"null"` (string), or `"unassigned"` — all mean unassigned.

```tsx
const onlineCount = targets.filter(t => t.status === 'online').length;
const standbyCount = targets.filter(t => t.status === 'standby').length;
const offlineCount = targets.filter(t => t.status === 'offline').length;
const unassignedCount = targets.filter(t => !t.roomId).length;
```

**4 StatCards — props and layout:**

```tsx
import { Target, Wifi, WifiOff, MapPin } from 'lucide-react';

const targetStatCards = [
  {
    title: 'Total Targets',
    value: targets.length,
    subtitle: (
      <span className="flex items-center gap-2">
        {onlineCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            {onlineCount} online
          </span>
        )}
        {standbyCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            {standbyCount} standby
          </span>
        )}
        {offlineCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
            {offlineCount} offline
          </span>
        )}
      </span>
    ),
    icon: <Target className="w-4 h-4" />,
  },
  {
    title: 'Online',
    value: onlineCount,
    subtitle: 'Connected devices',
    icon: <Wifi className="w-4 h-4" />,
  },
  {
    title: 'Offline',
    value: offlineCount,
    subtitle: offlineCount > 0 ? `${offlineCount} need attention` : 'All devices connected',
    icon: <WifiOff className="w-4 h-4" />,
  },
  {
    title: 'Unassigned',
    value: unassignedCount,
    subtitle: 'No room assigned',
    icon: <MapPin className="w-4 h-4" />,
  },
];
```

**Rendered grid (plain `<div>`, no stagger — matches Dashboard StatCards which do NOT use Framer Motion stagger):**

```tsx
<div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
  {targetStatCards.map((card) => (
    <StatCard
      key={card.title}
      title={card.title}
      value={card.value}
      subtitle={card.subtitle}
      icon={card.icon}
      isLoading={false}
    />
  ))}
</div>
```

**Note:** Dashboard StatCards use a plain `<div>` grid, not `motion.div`. Stagger is reserved for animated list/chart components (RoomBubblesCard rows use `staggerChildren: 0.07`, HitDistributionCard legend uses `staggerChildren: 0.08`).

**Each rendered StatCard produces this DOM (from Dashboard's StatCard):**

```tsx
<Card className="shadow-card hover:shadow-card-hover transition-all duration-200 bg-gradient-to-br from-white via-white to-brand-primary/[0.04]">
  <CardContent className="p-5 md:p-6">
    {/* Label row: bare icon + uppercase label — centered */}
    <div className="flex items-center justify-center gap-2 mb-1">
      <div className="text-brand-primary w-4 h-4">{icon}</div>
      <span className="text-label text-brand-secondary font-body uppercase tracking-wide">
        {title}
      </span>
    </div>
    {/* Hero number — largest element on the card, centered */}
    <p className="text-stat-md md:text-stat-lg font-bold text-brand-dark font-body tabular-nums text-center">
      {value}
    </p>
    {/* Subtitle — small, muted, centered, accepts ReactNode */}
    <div className="text-xs text-brand-dark/40 font-body mt-1 flex justify-center">{subtitle}</div>
  </CardContent>
</Card>
```

#### Skeleton Loading State (BEFORE → AFTER)

**Current skeleton (lines 1036-1047):**
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-3 md:mb-6">
  {[...Array(4)].map((_, i) => (
    <Card key={i} className="bg-white border-gray-200 shadow-sm rounded-sm md:rounded-lg animate-pulse">
      <CardContent className="p-2 md:p-4 text-center">
        <div className="h-6 md:h-8 w-12 md:w-16 bg-gray-200 rounded mx-auto mb-2" />
        <div className="h-3 md:h-4 w-16 md:w-20 bg-gray-200 rounded mx-auto" />
      </CardContent>
    </Card>
  ))}
</div>
```

**New skeleton — mirrors the StatCard structure (centered, 3 placeholder rows):**
```tsx
<div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
  {[...Array(4)].map((_, i) => (
    <Card key={i} className="shadow-card bg-gradient-to-br from-white via-white to-brand-primary/[0.04]">
      <CardContent className="p-5 md:p-6 animate-pulse">
        {/* Icon + label row placeholder — centered */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-4 h-4 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-200 rounded" />
        </div>
        {/* Hero number placeholder — centered */}
        <div className="h-8 md:h-10 w-16 md:w-24 bg-gray-200 rounded mt-1 mx-auto" />
        {/* Subtitle placeholder — centered */}
        <div className="h-3 w-28 bg-gray-200 rounded mt-2 mx-auto" />
      </CardContent>
    </Card>
  ))}
</div>
```

**Key skeleton changes:**
- Card uses `shadow-card` + gradient tint (matches loaded card appearance)
- No `border-gray-200` or `rounded-sm`
- No per-section `mb-*` — vertical spacing handled by parent `space-y-*` wrapper (Step 0)
- Grid uses `md:grid-cols-2` matching loaded state
- Centered placeholders (`justify-center`, `mx-auto`) — mirrors StatCard's centered layout
- 3 rows: icon+label (top), hero number (middle, tallest), subtitle (bottom) — mirrors StatCard DOM
- Padding matches loaded card: `p-5 md:p-6`

#### StatCard Extraction Decision

The Dashboard's `StatCard` is currently defined inline in `dashboard-page.tsx` (lines 33-109). Two options:

**Option A (preferred — minimal change):** Copy the `StatCard` component into `targets-page.tsx` as a local component. This avoids touching the Dashboard file and avoids creating a shared component prematurely (YAGNI). If a third page needs it, extract then.

**Option B (if already extracted):** If `StatCard` has been extracted to a shared location (e.g., `src/components/shared/StatCard.tsx`) by the time this step is implemented, import from there.

#### Checklist for Step 1

- [ ] Remove the `TargetsSummary` component (lines 262-296)
- [ ] Add `StatCard` component (copy from Dashboard or import from shared)
- [ ] Compute `onlineCount`, `standbyCount`, `offlineCount`, `unassignedCount` from `targets` array
- [ ] Build `targetStatCards` array with 4 entries (Total, Online, Offline, Unassigned)
- [ ] Replace `<TargetsSummary targets={targets} rooms={rooms} />` (line 1049) with plain `<div>` grid (no stagger — matches Dashboard)
- [ ] Replace skeleton block (lines 1037-1047) with new skeleton matching StatCard structure
- [ ] Import `Target`, `Wifi`, `WifiOff`, `MapPin` from `lucide-react`
- [ ] Import `motion` from `framer-motion` for target card grids (Step 9), NOT for stat cards
- [ ] Verify: no `border-gray-200`, no `font-heading` on numbers, no `text-center`, no 5th card
- [ ] Verify: numbers use `text-stat-md md:text-stat-lg font-body tabular-nums`
- [ ] Verify: labels use `text-label text-brand-secondary uppercase tracking-wide`
- [ ] Verify: cards use `shadow-card` + gradient tint, `rounded-[var(--radius-lg)]` via Card base

### Step 2: TargetCard Redesign

Completely restyle the `TargetCard` to match the Design Gospel Phase 10 spec.

**Card wrapper:**

- `shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200`
- `rounded-[var(--radius-lg)] bg-white` (no border)
- Card tint: `bg-gradient-to-br from-white via-white to-brand-primary/[0.04]` for all TargetCards (consistent with Phase 4 rule: tint is per card type, not per data state)

**Layout (per Phase 10 spec):**

1. **Row 1 — Status dot + Name + action menu:**
   - Status dot: `w-2 h-2 rounded-full` (8px per Phase 10 spec)
     - Online: `bg-green-500`, Standby: `bg-amber-500`, Offline: `bg-red-500` (per Phase 10)
   - Name: `text-base font-heading font-semibold text-brand-dark truncate` (Merriweather 600 per Phase 10: "Target name: `Merriweather 600, text-base`")
   - DropdownMenu trigger: `...` ghost icon button, right-aligned (per Phase 10: "Action menu: `...` ghost icon button → dropdown")

2. **Row 2 — Hit Count (prominent, right-aligned per Phase 10):**
   - Label above: `text-label text-brand-secondary uppercase tracking-wide` — "Hit Count" (per Phase 10: "Hit count label: `text-label text-brand-secondary` above the number")
   - Number: `text-stat-md font-bold text-brand-dark font-body tabular-nums` (per Phase 10: "`text-stat-md font-bold text-brand-dark`")
   - **Data source**: `Math.max(totalHitCount ?? 0, target.totalShots ?? 0)` — takes the higher of game history aggregation (`totalHitCount` from `fetchAllGameHistory`, capped at 50 entries / 500 total) vs live telemetry (`target.totalShots`). Falls back to `"—"` if both are 0/null. Adding `font-body tabular-nums` per Phase 2 rules (not explicit in Phase 10 but required by typography spec).
   - This is the dominant visual element on the card — data-first hierarchy (P1)

3. **Row 3 — Secondary info strip:**
   - Connection: `Wifi` / `WifiOff` icon + status label text — all `text-brand-dark/50` (per Phase 10: "Battery/WiFi: small inline icons, `text-xs text-brand-dark/50`"). Status is already communicated by the dot in Row 1; WiFi icons do NOT need color-coding.
   - Room: `MapPin` icon + room name (or "Unassigned"). Room is resolved by joining `target.roomId` with rooms array. Note: `roomId` can be `null`, `""`, `"null"` (string), or `"unassigned"` — all normalize to unassigned.
   - All `text-xs text-brand-dark/50 font-body`

4. **Row 4 — Last activity:**
   - `text-[11px] text-brand-dark/40 font-body`
   - "Last active: {date}" or "No activity recorded"
   - **Data source**: `target.lastShotTime` (preferred) or `target.lastActivityTime` (fallback), both in epoch ms

**Remove:**

- Status badges (Badge component with colored backgrounds) — status is already shown by the dot
- The separate "Status Indicators" section (redundant with dot)
- The `border-t border-gray-100` divider (use spacing instead)
- Icon badge backgrounds — bare icons only (Phase 5)

### Step 3: Search Bar + Filters Redesign

**Search input (full Phase 11 SearchInput spec):**
```tsx
<div className="relative">
  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-dark/30" />
  <Input
    className="pl-11 bg-white border border-[rgba(28,25,43,0.1)] rounded-full
               text-brand-dark placeholder:text-brand-dark/40
               focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/30
               font-body h-10"
    placeholder={placeholder}
  />
</div>
```
- Pill shape: `rounded-full`
- Icon padding: `pl-11` to accommodate search icon
- Text color: `text-brand-dark`, placeholder: `placeholder:text-brand-dark/40`
- Height: `h-10` (40px standard)
- Font: `font-body` (Raleway)

**Filter selects:**
- Keep Select components but update trigger styling:
  - `bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark`
  - Remove `border-gray-200`
- SelectContent: `bg-white shadow-lg border-0` (no visible border, shadow only)

### Step 4: Page Header Cleanup

**Title:** Keep `h1` with Merriweather — that's correct per the Gospel.

**Subtitle:** `text-sm text-brand-dark/55 font-body` (was `/70` — now matches `--text-secondary: rgba(28,25,43,0.55)` token from Phase 1)

**Buttons:**
- "Create Group": Change from `bg-brand-secondary` to `variant="secondary"` (dark outline pill) per Phase 3. This uses `border-2 border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-white`.
- "Add Target": Already correct (`bg-brand-primary`). Ensure `rounded-full` is inherited from base Button.

### Step 5: Room Section Headers

**Current:** `text-sm md:text-xl font-heading font-semibold` with a red badge.

**New:**
- Room name: `text-base font-heading font-semibold text-brand-dark` (matches Phase 2 Card Title: Merriweather 600, 1rem/16px)
- Target count: `text-label text-brand-secondary font-body uppercase tracking-wide` inline (NOT a red badge)
- Status summary dots: keep, but use `text-[11px] text-brand-dark font-body` text (was text-xs text-brand-dark/70) — matches TargetActivityCard/RecentSessionsCard inner subtitle pattern (no opacity modifier)
- Remove the `Badge` component with `bg-red-50 border-red-500` — replace with plain text

### Step 6: Targets Grid Layout

**Current:** `grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6`

**New:** `grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 lg:gap-5` (tighter gaps matching dashboard)

### Step 7: Empty State

**Current:** Card with border, Zap icon, centered text.

**New:**
- `shadow-card rounded-[var(--radius-lg)]` (no border)
- Icon: `Target` instead of `Zap`, `text-brand-dark/40` (matches dashboard empty state patterns and Phase 5 icon rules)
- Text: `text-sm text-brand-dark/40 font-body` (was text-brand-dark/70)
- CTA: already correct (bg-brand-primary pill)

### Step 8: Skeleton Loading States

Replace the current generic skeleton blocks with skeletons that mirror the final card structure.

**Stat cards skeleton:** Match Dashboard pattern — gradient bg + shimmer placeholders for icon row, number, subtitle.

**Target cards skeleton:** Each skeleton card should have:
- Status dot placeholder + name placeholder (top row)
- Large number placeholder (hero stat area)
- Small info strip placeholder
- All with `animate-pulse` and matching `rounded-[var(--radius-lg)] shadow-card`

### Step 9: Framer Motion Entrance Animations

Add staggered entrance animations for target card grids per room section. **Note:** StatCards use a plain `<div>` grid (no stagger), matching the Dashboard. Stagger is for target card lists only.

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// Stat cards grid — plain <div>, NO stagger (matches Dashboard)
<div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
  {statCards.map((card) => (
    <StatCard key={card.title} {...card} />
  ))}
</div>

// Target cards per room section — staggered entrance
<motion.div className="grid ..." variants={containerVariants} initial="hidden" animate="visible">
  {roomTargets.map((target) => (
    <motion.div key={target.id} variants={itemVariants}>
      <TargetCard {...target} />
    </motion.div>
  ))}
</motion.div>
```

Stagger parameters: `staggerChildren: 0.08` from Phase 7.0B generic template, `y: 12 → 0` slide-up. Used by target card grids and room sections only.

### Step 10: Modal Dialogs Cleanup

Update the 4 modal dialogs to match Design Gospel:

**All modals:**
- Remove icon badge backgrounds (`bg-brand-secondary/10 rounded-lg p-2` → bare icon)
- Labels: `text-label` style where appropriate
- Inputs: `border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)]` (not `border-gray-200`)
- Focus rings: `ring-brand-primary/20`
- Cancel buttons: use Button `variant="secondary"` (dark outline pill)
- Primary buttons: already correct (bg-brand-primary)

**CreateGroupModal + AddTargetsToGroupModal specific:**
- Remove `<div className="p-2 bg-brand-primary/10 rounded-lg">` wrapping the Plus icon in DialogTitle — use bare icon
- Remove `<div className="p-1.5 bg-brand-secondary/10 rounded-lg">` wrapping Target icons in target list rows — use bare icon
- Target selection rows: remove `border` (use shadow or bg tint for selected state instead)

### Step 11: Add Target Dialog Cleanup

The inline "Add Target" dialog (inside the page):
- Input/Select styling: match Phase 11 spec
- Remove `border-gray-200` from all inputs
- Labels: `text-label` style

---

## Data Flow Reference

### Hooks Called by targets-page.tsx

| Hook | Query Key | Returns | Notes |
|------|-----------|---------|-------|
| `useTargets(force?)` | `['targets', 'list', force]` | `{ targets: Target[], summary, cached }` | Base target data from ThingsBoard via `targets-with-telemetry` edge function |
| `useTargetDetails(deviceIds[])` | `['targets', 'details', deviceIds]` | `TargetDetail[]` | Enriched telemetry per device; merged with base via `mergeTargetDetails()` |
| `useRooms(force?)` | `['rooms', 'list', force]` | `{ rooms: Room[] }` | Room list for target→room lookup |
| `useTargetGroups(force?)` | `['target-groups', 'list']` | `TargetGroup[]` | Custom target groupings |
| `useTargetCustomNames()` | `['targets', 'custom-names']` | `Map<targetId, customName>` | Display name overrides from `user_target_custom_names` |
| `fetchAllGameHistory()` | (imperative, not a hook) | `GameHistory[]` | Called in `useEffect` to aggregate total shots per device |

### Data Assembly for TargetCard

```
useTargets() ──────────┐
                        ├── mergeTargetDetails() ──→ storeTargets[] (Target with merged telemetry)
useTargetDetails() ────┘                                │
                                                        ├── TargetCard receives:
fetchAllGameHistory() ──→ targetHitTotals{} ───────────┘     target, room, totalHitCount
                          (deviceId → aggregated hits)
useRooms() ──→ rooms lookup by roomId ─────────────────┘
useTargetCustomNames() ──→ displayName override ───────┘
```

### Key Target Fields Used by TargetCard

| Field | Source | Availability | Display Purpose |
|-------|--------|-------------|-----------------|
| `name` / `customName` | Edge: `targets-with-telemetry` + Supabase: `user_target_custom_names` | Always | Card title |
| `status` | Derived by `deriveStatusFromRaw()` in `edge.ts` | Always | Status dot color |
| `totalShots` | Edge: live telemetry | Optional | Hero stat (fallback) |
| `totalHitCount` (prop) | Aggregated from `fetchAllGameHistory()` — checks `targetStats[]` then `deviceResults[]`, capped at 50 entries | Optional | Hero stat (primary) |
| `status` (for wifi icon) | Derived by `deriveStatusFromRaw()` in `edge.ts` | Always | Wifi icon color: green=online, yellow=standby, gray=offline |
| `roomId` | Edge: room assignment | Optional | Room name lookup |
| `lastShotTime` | Edge: telemetry | Optional | Last activity display |
| `lastActivityTime` | Edge: TB server attribute (already converted to ms) | Optional | Last activity fallback |

### Data Caveats

- **Total shots aggregation is capped**: `fetchAllGameHistory()` fetches max 50 entries × 10 pages = 500 game history records. Targets with extensive history may show underestimated totals.
- **`roomId` normalization**: Can be `null`, `""`, `"null"` (string), or `"unassigned"` — all must normalize to the unassigned bucket.
- **Hero stat resolution**: `Math.max(totalHitCount ?? 0, target.totalShots ?? 0)` — takes whichever is higher between game history aggregate and live telemetry. Shows `"—"` if both are 0/null.
- **Status is pre-derived**: `target.status` is already `'online' | 'standby' | 'offline'` — do NOT re-derive from raw fields.

---

## File Checklist

| File | Changes |
|------|---------|
| `src/features/targets/ui/targets-page.tsx` | Steps 1-9: TargetCard, TargetsSummary, page layout, search, filters, headers, empty state, skeletons, animations |
| `src/features/targets/ui/CreateGroupModal.tsx` | Step 10: remove icon badges, update input/button styling |
| `src/features/targets/ui/AddTargetsToGroupModal.tsx` | Step 10: remove icon badges, update input/button styling |
| `src/features/targets/ui/RenameTargetDialog.tsx` | Step 10: update input/button styling |

**No new files needed** — all changes are modifications to existing files.

---

## Validation Checklist (post-implementation)

- [ ] Page uses Phase 6D layout shell with `responsive-container`, `no-overflow`, `responsive-transition` utility classes
- [ ] Content wrapper uses `space-y-2 md:space-y-4 lg:space-y-6` for section spacing (no per-section `mb-*`)
- [ ] No `border-gray-200` on any card
- [ ] All stat numbers use `text-stat-*` + `font-body` (not `font-heading`) — Raleway 700 for numbers
- [ ] Target names use `font-heading font-semibold text-base` (Merriweather 600 per Phase 10)
- [ ] All buttons are `rounded-full` (pill shape)
- [ ] No `bg-brand-secondary` as primary button color
- [ ] No icon badge backgrounds (`bg-*/10 rounded-lg p-2`)
- [ ] Cards use `shadow-card` not `shadow-sm`
- [ ] Cards use `rounded-[var(--radius-lg)]` not `rounded-sm` or `rounded-lg`
- [ ] Search input is pill-shaped with subtle border
- [ ] Labels are uppercase, small, muted (`text-label`)
- [ ] Numbers are larger than their labels
- [ ] Framer Motion staggered entrance on target card grids (NOT on StatCards — StatCards use plain `<div>`)
- [ ] TargetCard WiFi/connection icons use `text-brand-dark/50` (not color-coded per status)
- [ ] Skeletons match final card structure (centered placeholders for StatCards)
- [ ] StatCard icons all inherit `text-brand-primary` from wrapper (no `text-green-500`, `text-gray-400`, etc.)
- [ ] Data-first hierarchy: hit count is dominant on every TargetCard
- [ ] Status dots use correct Phase 10 colors: green-500 (online), amber-500 (standby), red-500 (offline)
- [ ] TargetCard status dots are 8px (`w-2 h-2`). StatCard subtitle dots are 6px (`w-1.5 h-1.5`) for compact inline display.
- [ ] Hit count label text says "Hit Count" (per Phase 10), positioned above the number
- [ ] TargetCard hover: `shadow-card-hover -translate-y-0.5` (per Phase 10)
- [ ] Room section headers use plain text count (no red Badge)
