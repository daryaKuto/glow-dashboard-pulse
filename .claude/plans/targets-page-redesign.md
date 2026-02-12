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
- `text-center` — violates data-first hierarchy (should be left-aligned like Dashboard)
- Uses ad-hoc `text-green-600` / `text-yellow-600` — violates single-accent discipline
- No icons on any card
- Labels are same size or larger than numbers at mobile (`text-xs` label vs `text-sm` number)

#### New Implementation (AFTER)

Drop the `TargetsSummary` component entirely and replace with the Dashboard `StatCard` component. Import `StatCard` from the dashboard or extract it to a shared location.

**Data derivation (keep in `targets-page.tsx`, pass as props):**

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
    subtitle: `${onlineCount} online, ${standbyCount} standby`,
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

**Rendered grid with Framer Motion stagger:**

```tsx
import { motion } from 'framer-motion';

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

<motion.div
  className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-3 md:mb-6"
  variants={containerVariants}
  initial="hidden"
  animate="visible"
>
  {targetStatCards.map((card) => (
    <motion.div key={card.title} variants={itemVariants}>
      <StatCard
        title={card.title}
        value={card.value}
        subtitle={card.subtitle}
        icon={card.icon}
        isLoading={false}
      />
    </motion.div>
  ))}
</motion.div>
```

**Each rendered StatCard produces this DOM (from Dashboard's StatCard):**

```tsx
<Card className="shadow-card hover:shadow-card-hover transition-all duration-200 bg-gradient-to-br from-white via-white to-brand-primary/[0.04]">
  <CardContent className="p-5 md:p-6">
    {/* Label row: bare icon + uppercase label */}
    <div className="flex items-center gap-2 mb-1">
      <div className="text-brand-primary w-4 h-4">{icon}</div>
      <span className="text-label text-brand-secondary font-body uppercase tracking-wide">
        {title}
      </span>
    </div>
    {/* Hero number — largest element on the card */}
    <p className="text-stat-md md:text-stat-lg font-bold text-brand-dark font-body tabular-nums">
      {value}
    </p>
    {/* Subtitle — small, muted */}
    <p className="text-xs text-brand-dark/40 font-body mt-1">{subtitle}</p>
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

**New skeleton — mirrors the StatCard structure (left-aligned, 3 placeholder rows):**
```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-3 md:mb-6">
  {[...Array(4)].map((_, i) => (
    <Card key={i} className="shadow-card bg-gradient-to-br from-white via-white to-brand-primary/[0.04]">
      <CardContent className="p-5 md:p-6 animate-pulse">
        {/* Icon + label row placeholder */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-200 rounded" />
        </div>
        {/* Hero number placeholder */}
        <div className="h-8 md:h-10 w-16 md:w-24 bg-gray-200 rounded mt-1" />
        {/* Subtitle placeholder */}
        <div className="h-3 w-28 bg-gray-200 rounded mt-2" />
      </CardContent>
    </Card>
  ))}
</div>
```

**Key skeleton changes:**
- Card uses `shadow-card` + gradient tint (matches loaded card appearance)
- No `border-gray-200` or `rounded-sm`
- Left-aligned placeholders (no `mx-auto` or `text-center`)
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
- [ ] Replace `<TargetsSummary targets={targets} rooms={rooms} />` (line 1049) with `motion.div` grid
- [ ] Replace skeleton block (lines 1037-1047) with new skeleton matching StatCard structure
- [ ] Import `motion` from `framer-motion`, define `containerVariants` / `itemVariants`
- [ ] Import `Target`, `Wifi`, `WifiOff`, `MapPin` from `lucide-react`
- [ ] Verify: no `border-gray-200`, no `font-heading` on numbers, no `text-center`, no 5th card
- [ ] Verify: numbers use `text-stat-md md:text-stat-lg font-body tabular-nums`
- [ ] Verify: labels use `text-label text-brand-secondary uppercase tracking-wide`
- [ ] Verify: cards use `shadow-card` + gradient tint, `rounded-[var(--radius-lg)]` via Card base

### Step 2: TargetCard Redesign

Completely restyle the `TargetCard` to match the Design Gospel card system.

**Card wrapper:**
- `shadow-card hover:shadow-card-hover transition-all duration-200`
- `rounded-[var(--radius-lg)] bg-white` (no border)
- Card tint: `bg-gradient-to-br from-white via-white to-brand-primary/[0.04]` for online targets, plain white for offline
- Wrap in `motion.div` with `whileHover={{ y: -2 }}` for hover lift

**Layout (top to bottom):**
1. **Row 1 — Name + status dot + action menu:**
   - Status dot: `w-2.5 h-2.5 rounded-full` (green-500 / yellow-500 / gray-400) — left-aligned
   - Name: `text-sm font-medium text-brand-dark font-body truncate` (NOT font-heading, NOT centered)
   - DropdownMenu trigger: `ghost` button, right-aligned
   - Left-aligned, single row — NOT centered as it currently is

2. **Row 2 — Hero stat (Total Shots):**
   - `text-stat-md font-bold text-brand-dark font-body tabular-nums`
   - Label below: `text-label text-brand-secondary uppercase tracking-wide` — "Total Shots"
   - This is the dominant visual element on the card

3. **Row 3 — Secondary info strip:**
   - Horizontal row with icon + value pairs, tiny text
   - Room: `MapPin` icon + room name (or "Unassigned")
   - Battery: `Battery` icon + percentage (if online)
   - Status: connection label text
   - All `text-xs text-brand-dark/50 font-body`

4. **Row 4 — Last activity:**
   - `text-[11px] text-brand-dark/30 font-body`
   - "Last active: {date}" or "No activity recorded"

**Remove:**
- Centered text layout (everything should be left-aligned)
- Status badges (Badge component with colored backgrounds) — status is already shown by the dot
- The separate "Status Indicators" section (redundant with dot)
- The `border-t border-gray-100` divider (use spacing instead)

### Step 3: Search Bar + Filters Redesign

**Search input:**
- Pill shape: `rounded-full`
- `bg-white border border-[rgba(28,25,43,0.1)]`
- Search icon: `text-brand-dark/30` (was `/50`)
- Focus: `ring-2 ring-brand-primary/20 border-brand-primary/30`
- Match Phase 11 spec exactly

**Filter selects:**
- Keep Select components but update trigger styling:
  - `bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark`
  - Remove `border-gray-200`
- SelectContent: `bg-white shadow-lg border-0` (no visible border, shadow only)

### Step 4: Page Header Cleanup

**Title:** Keep `h1` with Merriweather — that's correct per the Gospel.

**Subtitle:** `text-sm text-brand-dark/50 font-body` (was `/70`)

**Buttons:**
- "Create Group": Change from `bg-brand-secondary` to `variant="secondary"` (dark outline pill) per Phase 3. This uses `border-2 border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-white`.
- "Add Target": Already correct (`bg-brand-primary`). Ensure `rounded-full` is inherited from base Button.

### Step 5: Room Section Headers

**Current:** `text-sm md:text-xl font-heading font-semibold` with a red badge.

**New:**
- Room name: `text-base md:text-lg font-heading font-semibold text-brand-dark` (consistent heading size)
- Target count: `text-label text-brand-secondary font-body uppercase tracking-wide` inline (NOT a red badge)
- Status summary dots: keep, but use `text-[11px] text-brand-dark/40 font-body` text (was text-xs text-brand-dark/70)
- Remove the `Badge` component with `bg-red-50 border-red-500` — replace with plain text

### Step 6: Targets Grid Layout

**Current:** `grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6`

**New:** `grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 lg:gap-5` (tighter gaps matching dashboard)

### Step 7: Empty State

**Current:** Card with border, Zap icon, centered text.

**New:**
- `shadow-card rounded-[var(--radius-lg)]` (no border)
- Icon: `Target` instead of `Zap`, `text-brand-dark/30` (was brand-dark/50)
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

Add staggered entrance animations matching the Dashboard pattern:

```tsx
// Stat cards grid
<motion.div
  className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4"
  variants={containerVariants}
  initial="hidden"
  animate="visible"
>
  {statCards.map((card) => (
    <motion.div key={card.id} variants={itemVariants}>
      <StatCard {...card} />
    </motion.div>
  ))}
</motion.div>

// Target cards per room section
<motion.div className="grid ..." variants={containerVariants} initial="hidden" animate="visible">
  {roomTargets.map((target) => (
    <motion.div key={target.id} variants={itemVariants}>
      <TargetCard {...target} />
    </motion.div>
  ))}
</motion.div>
```

Use the same `containerVariants` / `itemVariants` from the Dashboard (staggerChildren: 0.08, y: 12 → 0).

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

- [ ] No `border-gray-200` on any card
- [ ] All stat numbers use `text-stat-*` + `font-body` (not `font-heading`)
- [ ] All buttons are `rounded-full` (pill shape)
- [ ] No `bg-brand-secondary` as primary button color
- [ ] No icon badge backgrounds (`bg-*/10 rounded-lg p-2`)
- [ ] Cards use `shadow-card` not `shadow-sm`
- [ ] Cards use `rounded-[var(--radius-lg)]` not `rounded-sm` or `rounded-lg`
- [ ] Search input is pill-shaped with subtle border
- [ ] Labels are uppercase, small, muted (`text-label`)
- [ ] Numbers are larger than their labels
- [ ] Framer Motion entrance animations on card grids
- [ ] Skeletons match final card structure
- [ ] Data-first hierarchy: hero number is dominant on every TargetCard
- [ ] No centered text on TargetCard (left-aligned)
- [ ] Room section headers use plain text count (no red Badge)
