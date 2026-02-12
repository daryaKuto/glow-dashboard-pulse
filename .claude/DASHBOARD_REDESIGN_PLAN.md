# Dashboard Page Redesign Plan

> Complete implementation plan to transform the dashboard from its current generic layout
> into a Strava-inspired, data-first analytics hub per the CLAUDE.md Design Gospel.

---

## Table of Contents

1. [Pre-Requisites (Foundation Changes)](#step-1-pre-requisites--foundation-changes)
2. [Install Framer Motion](#step-2-install-framer-motion)
3. [Create Shared Chart Constants](#step-3-create-shared-chart-constants)
4. [Redesign StatCard Component](#step-4-redesign-statcard-component)
5. [Redesign ProgressRing Component](#step-5-redesign-progressring-component)
6. [Redesign ComingSoonCard Component](#step-6-redesign-comingsooncard-component)
7. [Redesign TargetActivityCard](#step-7-redesign-targetactivitycard)
8. [Redesign RecentSessionsCard](#step-8-redesign-recentsessionscard)
9. [Redesign HitTimelineCard (LineChart to AreaChart)](#step-9-redesign-hittimelinecard)
10. [Redesign HitDistributionCard (PieChart to Horizontal Bars)](#step-10-redesign-hitdistributioncard)
11. [Update Base Card Component](#step-11-update-base-card-component)
12. [Update Base Button Component](#step-12-update-base-button-component)
13. [Update Dashboard Page Layout & Shell](#step-13-update-dashboard-page-layout--shell)
14. [Update Header Component](#step-14-update-header-component)
15. [Update Sidebar Component](#step-15-update-sidebar-component)
16. [Create BottomTabBar (Mobile Navigation)](#step-16-create-bottomtabbar)
17. [Add Staggered Animations & Count-Up Hook](#step-17-add-animations--count-up-hook)
18. [Update CSS Design Tokens](#step-18-update-css-design-tokens)
19. [Update Tailwind Config Tokens](#step-19-update-tailwind-config-tokens)
20. [Validation Checklist](#step-20-validation-checklist)

---

## Step 1: Pre-Requisites / Foundation Changes

These must be done FIRST since every other step depends on the design tokens being correct.

### 1A: Update CSS Variables in `src/index.css`

**File:** `src/index.css` (lines 63-94, the `:root` block)

Replace the entire `:root` block inside `@layer base` with:

```css
:root {
  /* Brand Colors - Light Theme */
  --background: #F6F7EB;
  --surface: #FFFFFF;
  --surface-elevated: #FFFFFF;
  --text: #1C192B;
  --text-secondary: rgba(28, 25, 43, 0.55);
  --text-muted: rgba(28, 25, 43, 0.4);
  --accent-primary: #CE3E0A;
  --accent-primary-hover: #B8360A;
  --accent-primary-light: rgba(206, 62, 10, 0.08);
  --accent-primary-medium: rgba(206, 62, 10, 0.15);
  --accent-secondary: #816E94;
  --accent-secondary-light: rgba(129, 110, 148, 0.1);
  --border: rgba(28, 25, 43, 0.08);
  --border-strong: rgba(28, 25, 43, 0.15);

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(28, 25, 43, 0.04);
  --shadow-md: 0 2px 12px rgba(28, 25, 43, 0.06);
  --shadow-lg: 0 4px 24px rgba(28, 25, 43, 0.08);
  --shadow-hover: 0 8px 32px rgba(28, 25, 43, 0.1);

  /* Radii */
  --radius: 0.75rem;
  --radius-lg: 1rem;
  --radius-full: 9999px;

  /* Spacing */
  --space-card-padding: 1.5rem;
  --space-card-padding-lg: 2rem;

  /* Shadcn/UI HSL overrides */
  --foreground: 258 21% 14%;
  --card: 0 0% 100%;
  --card-foreground: 258 21% 14%;
  --primary: 16 92% 42%;
  --primary-foreground: 0 0% 100%;
  --secondary: 269 17% 50%;
  --secondary-foreground: 0 0% 100%;
  --muted: 72 30% 94%;
  --muted-foreground: 258 21% 45%;
  --accent: 16 92% 42%;           /* CHANGED: accent = burnt orange, NOT purple */
  --accent-foreground: 0 0% 100%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --input: 258 10% 88%;
  --ring: 16 92% 42%;
}
```

**KEY CHANGE:** `--accent` now maps to `#CE3E0A` (burnt orange) instead of `#816E94` (purple). This cascades through ALL shadcn components that use the `accent` variant.

### 1B: Update Dark Theme in `src/index.css`

Replace the `.dark` block (lines 96-117) with:

```css
.dark {
  --background: #1C192B;
  --surface: #252238;
  --surface-elevated: #2D2945;
  --text: #F6F7EB;
  --text-secondary: rgba(246, 247, 235, 0.6);
  --text-muted: rgba(246, 247, 235, 0.4);
  --accent-primary: #CE3E0A;
  --accent-primary-hover: #E04A12;
  --accent-primary-light: rgba(206, 62, 10, 0.12);
  --accent-primary-medium: rgba(206, 62, 10, 0.2);
  --accent-secondary: #9A87AD;
  --accent-secondary-light: rgba(154, 135, 173, 0.12);
  --border: rgba(246, 247, 235, 0.08);
  --border-strong: rgba(246, 247, 235, 0.15);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 2px 12px rgba(0, 0, 0, 0.25);
  --shadow-lg: 0 4px 24px rgba(0, 0, 0, 0.3);

  --foreground: 72 76% 86%;
  --card: 258 19% 17%;
  --card-foreground: 72 76% 86%;
  --primary: 16 92% 42%;
  --primary-foreground: 0 0% 100%;
  --secondary: 269 17% 52%;
  --secondary-foreground: 0 0% 100%;
  --muted: 258 18% 21%;
  --muted-foreground: 72 30% 70%;
  --accent: 16 92% 42%;
  --accent-foreground: 0 0% 100%;
  --input: 258 10% 30%;
  --ring: 72 76% 86%;
}
```

### 1C: Update `.btn-primary` CSS class

Replace the existing `.btn-primary` rules (lines 258-269) with:

```css
.btn-primary {
  background-color: var(--accent-primary);
  color: white;
  border-radius: var(--radius-full);
  transition: all 0.2s ease;
}
.btn-primary:hover {
  background-color: var(--accent-primary-hover);
  box-shadow: var(--shadow-md);
}
.btn-primary:active {
  transform: scale(0.97);
}
```

### 1D: Update `.btn-outline` CSS class

Replace existing `.btn-outline` (lines 271-283) with:

```css
.btn-secondary {
  background-color: transparent;
  border: 2px solid var(--text);
  color: var(--text);
  border-radius: var(--radius-full);
  transition: all 0.2s ease;
}
.btn-secondary:hover {
  background-color: var(--text);
  color: white;
}
```

### 1E: Update `.search-input` CSS class

Replace existing `.search-input` (lines 286-299) with:

```css
.search-input {
  background-color: var(--surface);
  color: var(--text);
  border: 1px solid rgba(28, 25, 43, 0.1);
  border-radius: var(--radius-full);
}
.search-input::placeholder {
  color: rgba(28, 25, 43, 0.4);
}
.search-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(206, 62, 10, 0.2);
  border-color: rgba(206, 62, 10, 0.3);
}
```

### 1F: Update `.card-standard` CSS class

Replace existing `.card-standard` (lines 301-307) with:

```css
.card-standard {
  background-color: var(--surface);
  border: none;
  box-shadow: var(--shadow-md);
  border-radius: var(--radius-lg);
}
```

---

## Step 2: Install Framer Motion

**Run:** `npm install framer-motion`

This is required for:
- Card entrance animations (fade-in + slide-up)
- Staggered grid animations
- Progress ring animated draw-in
- Horizontal bar width animations
- Card hover lift effects
- Segmented control transitions

---

## Step 3: Create Shared Chart Constants

**Create new file:** `src/shared/constants/chart-colors.ts`

```typescript
/** Brand-aligned chart color palette. Use in order for multi-series charts. */
export const CHART_COLORS = [
  '#CE3E0A', // Primary - burnt orange (always first)
  '#816E94', // Secondary - purple
  '#1C192B', // Dark
  '#6B4A38', // Brown
  '#A884FF', // Lavender
  '#FF7A00', // Orange
] as const;

/** Gradient definitions reusable across charts */
export const CHART_GRADIENTS = {
  primary: { start: 'rgba(206,62,10,0.2)', end: 'rgba(206,62,10,0)' },
  secondary: { start: 'rgba(129,110,148,0.12)', end: 'rgba(129,110,148,0)' },
} as const;

/** Shared axis/grid styling constants */
export const CHART_STYLE = {
  gridStroke: 'rgba(28,25,43,0.06)',
  gridDash: '4 4',
  axisStroke: 'rgba(28,25,43,0.3)',
  axisFontSize: 10,
  axisFontFamily: 'Raleway',
  tooltipCursor: 'rgba(28,25,43,0.1)',
  barCursorFill: 'rgba(206,62,10,0.04)',
  animationDuration: 800,
  animationEasing: 'ease-out' as const,
} as const;
```

After creating this file, update `src/features/games/ui/components/constants.ts` to re-export from the shared location or update all imports. The old `DEVICE_COLOR_PALETTE` (which uses non-brand colors like `#6C5CE7`, `#10B981`) must be replaced with `CHART_COLORS`.

---

## Step 4: Redesign StatCard Component

**File:** `src/features/dashboard/ui/dashboard-page.tsx` (lines 33-98)

The current `StatCard` violates multiple design gospel rules:
1. Icon wrapped in purple badge background (`bg-brand-secondary/10 rounded-sm md:rounded-lg`) - line 81
2. Value uses Merriweather (`font-heading`) instead of Raleway - line 75
3. Value size too small (`text-sm md:text-xl lg:text-2xl`) - line 75
4. Label not uppercase, not tracking-wide - line 49
5. Card has visible border (`border-gray-200`) - line 44
6. Rounded corners not consistent (`rounded-md md:rounded-lg`) - line 44
7. Padding too tight (`p-2 md:p-4`) - line 45
8. Layout has icon on right, value buried in text - lines 46-86

### Replace lines 33-98 with:

```tsx
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  isLoading?: boolean;
  infoTitle?: string;
  infoContent?: string;
}> = ({ title, value, subtitle, icon, trend, isLoading = false, infoTitle, infoContent }) => (
  <Card className="shadow-card hover:shadow-card-hover transition-all duration-200">
    <CardContent className="p-5 md:p-6">
      {/* Label row with bare icon */}
      <div className="flex items-center gap-2 mb-1">
        <div className="text-brand-primary w-4 h-4">{icon}</div>
        <span className="text-label text-brand-secondary font-body uppercase tracking-wide">
          {title}
        </span>
        {infoContent && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full hover:bg-brand-dark/10 p-0.5 -m-0.5 transition-colors"
                aria-label={`Info about ${title}`}
              >
                <Info className="h-3 w-3 text-brand-dark/40" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              className="w-64 bg-white shadow-lg p-3 border-0"
            >
              {infoTitle && (
                <p className="text-xs font-medium text-brand-dark mb-1">{infoTitle}</p>
              )}
              <p className="text-xs text-brand-dark/70">{infoContent}</p>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Hero number */}
      {isLoading ? (
        <div className="h-8 md:h-10 w-16 md:w-24 bg-gray-200 rounded animate-pulse" />
      ) : (
        <p className="text-stat-md md:text-stat-lg font-bold text-brand-dark font-body tabular-nums">
          {value}
        </p>
      )}

      {/* Optional subtitle */}
      {subtitle && (
        <p className="text-xs text-brand-dark/40 font-body mt-1">{subtitle}</p>
      )}

      {/* Optional trend */}
      {trend && !isLoading && (
        <div className="mt-2 flex items-center gap-1">
          <div
            className={`flex items-center gap-0.5 text-xs ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            <TrendingUp
              className={`w-3 h-3 ${!trend.isPositive && 'rotate-180'}`}
            />
            <span className="font-medium">{trend.value}%</span>
          </div>
          <span className="text-xs text-brand-dark/40 font-body">vs last week</span>
        </div>
      )}
    </CardContent>
  </Card>
);
```

### What changed and why:
| Before | After | Why |
|--------|-------|-----|
| `border-gray-200 shadow-sm` | `shadow-card` (no border) | Phase 4: Cards use shadow only, no visible border |
| `rounded-md md:rounded-lg` | Inherits from Card component (`rounded-[var(--radius-lg)]`) | Phase 4: Consistent 16px radius |
| `p-2 md:p-4` | `p-5 md:p-6` | Phase 4: Generous padding (20px/24px) |
| Icon in `bg-brand-secondary/10 rounded-sm p-1` | Bare `w-4 h-4 text-brand-primary` icon | Phase 5: No icon badge backgrounds |
| Label `text-xs font-medium text-brand-dark/70` | `text-label text-brand-secondary uppercase tracking-wide` | Phase 2: 11px uppercase muted labels |
| Value `text-sm md:text-xl font-heading` | `text-stat-md md:text-stat-lg font-body tabular-nums` | Phase 2: Raleway 700, not Merriweather |
| Icon right-aligned | Icon left of label, top of card | Phase 8: Strava layout pattern |

### Also update the icon sizes in the stat card usage (lines 576, 583, 607):

Change all `<TargetIcon className="w-6 h-6 -ml-1.5 md:ml-0" />` patterns to just:
```tsx
<TargetIcon className="w-4 h-4" />
```

(Remove the `w-6 h-6` and negative margins - icons are now 16px per Phase 5 rules)

---

## Step 5: Redesign ProgressRing Component

**File:** `src/features/dashboard/ui/dashboard-page.tsx` (lines 102-146)

Current violations:
1. Track stroke uses `#f3f4f6` (gray) instead of brand purple at 15%
2. Progress stroke uses arbitrary `color` prop instead of always `#CE3E0A`
3. Stroke width is 6 (too thick) instead of 4
4. No entrance animation
5. Center value uses `text-lg font-bold` instead of `text-stat-md`
6. Label uses `text-xs text-brand-dark/70` instead of `text-label`

### Replace lines 102-146 with:

```tsx
const ProgressRing: React.FC<{
  percentage: number;
  label: string;
  value: number | string;
  size?: number;
}> = ({ percentage, label, value, size = 80 }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(129,110,148,0.15)"
            strokeWidth="4"
            fill="transparent"
          />
          {/* Progress - animated with Framer Motion */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#CE3E0A"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={circumference}
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-stat-md font-bold text-brand-dark font-body tabular-nums">
            {value}
          </span>
        </div>
      </div>
      <span className="text-label text-brand-secondary font-body uppercase tracking-wide text-center">
        {label}
      </span>
    </div>
  );
};
```

**NOTE:** This requires `import { motion } from 'framer-motion'` at the top of the file.

**NOTE:** The `color` prop is removed. Progress stroke is ALWAYS `#CE3E0A`. Update any call sites that pass a `color` prop.

---

## Step 6: Redesign ComingSoonCard Component

**File:** `src/features/dashboard/ui/dashboard-page.tsx` (lines 148-223)

Current violations:
1. Card has visible border (`border-gray-200`) - line 176
2. Rounded corners inconsistent (`rounded-md md:rounded-lg`) - line 176
3. Icon in badge background (`bg-brand-secondary/10 rounded-sm md:rounded-lg`) - line 190
4. Button uses purple default (`bg-brand-secondary hover:bg-brand-primary`) - line 215
5. Button has non-pill corners (`rounded-sm md:rounded`) - line 215
6. "Coming Soon" ribbon uses non-brand dark overlay - line 177

### Replace lines 148-223 with:

```tsx
const ComingSoonCard: React.FC<{
  type: string;
  title: string;
  description: string;
  onDismiss: () => void;
}> = ({ type, title, description, onDismiss }) => {
  const getIcon = () => {
    switch (type) {
      case 'training': return <Gamepad2 className="h-5 w-5" />;
      case 'multiplayer': return <Users className="h-5 w-5" />;
      case 'analytics': return <BarChart className="h-5 w-5" />;
      case 'tournaments': return <Award className="h-5 w-5" />;
      default: return <Play className="h-5 w-5" />;
    }
  };

  return (
    <Card className="shadow-card relative overflow-hidden min-w-[300px] md:min-w-[350px]">
      <div className="absolute inset-0 bg-black/5 z-10">
        <div className="absolute top-4 md:top-6 left-0 right-0 bg-brand-primary text-white py-2 font-display font-semibold text-sm text-center shadow-lg">
          Coming Soon
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 z-20 p-1 rounded-full bg-white/80 hover:bg-white transition-colors"
      >
        <X className="h-4 w-4 text-gray-600" />
      </button>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          {/* Bare icon, no badge background */}
          <div className="text-brand-primary">{getIcon()}</div>
          <span className="text-label text-brand-secondary font-body uppercase tracking-wide">
            {type}
          </span>
        </div>
        <CardTitle className="text-lg font-heading text-brand-dark">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-brand-dark/70 font-body">{description}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-label text-brand-secondary font-body uppercase tracking-wide">
              Progress
            </span>
            <span className="text-sm font-bold text-brand-dark font-body tabular-nums">
              0%
            </span>
          </div>
          <Progress value={0} className="h-2" />
        </div>
        <Button
          className="w-full bg-brand-primary text-white rounded-full font-body"
          disabled
        >
          Coming Soon
        </Button>
      </CardContent>
    </Card>
  );
};
```

### Key changes:
- Removed `border-gray-200` from Card (shadow only)
- Removed icon badge background wrapper
- Changed `Badge` to a simple `span` with `text-label` styling
- Button now uses `bg-brand-primary rounded-full` (not `bg-brand-secondary rounded-sm`)
- Progress label uses `text-label` uppercase pattern

---

## Step 7: Redesign TargetActivityCard

**File:** `src/features/dashboard/ui/TargetActivityCard.tsx` (528 lines)

This is the most complex component. Multiple violations:

1. **Card styling** (line 465): `border-gray-200 shadow-sm rounded-md md:rounded-lg` -> `shadow-card`
2. **Card title** (line 467): Has both `text-xs md:text-base lg:text-lg` -> use `font-heading text-base`
3. **Padding** (lines 466, 469): `p-2 md:p-4` -> `p-5 md:p-6`
4. **Target Activity header** (lines 299-312): Icon in rounded badge background -> bare icon
5. **Metric cards** (lines 314-345): Use gradient backgrounds and `font-heading` for values -> use plain white cards with `font-body tabular-nums`
6. **Time range buttons** (lines 356-370): Use default Button variants (purple) -> use segmented control pattern
7. **Bar chart** (lines 375-400): Plain CSS bars with `bg-brand-secondary/30` -> should use brand-primary for all active bars
8. **Streak section** (lines 402-434): Icon in badge background -> bare icon

### 7A: Update `TargetActivityCard` wrapper (lines 456-525)

Replace the Card wrapping with:
```tsx
<Card className="shadow-card h-full">
  <CardHeader className="pb-1 md:pb-3 p-5 md:p-6">
    <CardTitle className="text-base font-heading text-brand-dark">Target Activity</CardTitle>
  </CardHeader>
  <CardContent className="p-5 md:p-6 pt-0">
    {/* ...content... */}
  </CardContent>
</Card>
```

### 7B: Update `ActivityChart` header (lines 299-312)

Replace the icon-in-badge header with:
```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <TargetIcon className="h-4 w-4 text-brand-primary" />
    <div>
      <h3 className="text-sm font-medium text-brand-dark font-body">Target Activity</h3>
      <p className="text-[11px] text-brand-dark/40 font-body">Session telemetry</p>
    </div>
  </div>
  <span className="text-label text-brand-secondary font-body uppercase tracking-wide">
    {summary?.sessionCount ?? 0} sessions
  </span>
</div>
```

**Changes:** Removed `rounded-full bg-brand-primary/10` badge wrapper. Badge replaced with plain text-label span.

### 7C: Update metric cards (lines 314-345)

Replace gradient metric cards with clean stat display:
```tsx
<div className="grid grid-cols-3 gap-3">
  {[
    { label: 'Average Score', value: averageScoreDisplay },
    { label: 'Best Score', value: bestScoreDisplay },
    { label: 'Shots Fired', value: totalShotsDisplay },
  ].map((metric) => (
    <div key={metric.label} className="rounded-[var(--radius)] bg-white px-3 py-2 shadow-subtle">
      <span className="text-label text-brand-secondary font-body uppercase tracking-wide block mb-0.5">
        {metric.label}
      </span>
      <p className="text-stat-sm font-bold text-brand-dark font-body tabular-nums">
        {metric.value}
      </p>
    </div>
  ))}
</div>
```

**Changes:**
- Removed gradient backgrounds (`from-brand-primary/10 via-white...`)
- Removed icons from metric cards (data-first, no icon clutter)
- Changed value from `font-heading text-sm` to `text-stat-sm font-bold font-body tabular-nums`
- Label uses `text-label` uppercase pattern
- Card uses `shadow-subtle` instead of borders

### 7D: Replace time range buttons with segmented control (lines 356-370)

Replace the `<Button>` row with a Strava-style segmented control:
```tsx
<div className="bg-brand-light rounded-full p-1 inline-flex">
  {availableRanges.map((range) => (
    <button
      key={range}
      onClick={() => onRangeChange(range)}
      className={cn(
        'relative px-4 py-1.5 text-xs font-body font-medium rounded-full transition-all duration-200',
        activeRange === range
          ? 'bg-brand-primary text-white'
          : 'text-brand-dark/60 hover:text-brand-dark'
      )}
    >
      {range === 'day' && 'Day'}
      {range === 'week' && 'Week'}
      {range === 'month' && 'Month'}
      {range === 'all' && 'All'}
    </button>
  ))}
</div>
```

**For advanced animation:** Wrap each button in a relative container and use Framer Motion `layoutId` for the sliding background:
```tsx
{activeRange === range && (
  <motion.div
    layoutId="activeSegment"
    className="absolute inset-0 bg-brand-primary rounded-full"
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
  />
)}
<span className={cn('relative z-10', activeRange === range ? 'text-white' : 'text-brand-dark/60')}>
  {/* label */}
</span>
```

### 7E: Update bar chart bars (lines 375-400)

Current bars use `bg-brand-secondary/30` for non-latest bars. Update:
```tsx
<div
  className={`w-full rounded-t-lg transition-all duration-300 ${
    isLatest ? 'bg-brand-primary' : 'bg-brand-primary/30 hover:bg-brand-primary/50'
  }`}
  style={{
    height: `${Math.max(6, barHeight)}%`,
    minHeight: '4px',
  }}
/>
```

**Change:** `bg-brand-secondary/30` -> `bg-brand-primary/30` (orange tint, not purple)

### 7F: Update streak section (lines 402-434)

Remove the icon badge wrapper (`rounded-full p-2.5 bg-brand-secondary/10`):
```tsx
{/* Before */}
<div className={`rounded-full p-2.5 ${achieved ? 'bg-green-100 text-green-700' : 'bg-brand-secondary/10 text-brand-secondary'}`}>
  <Icon className="h-5 w-5" />
</div>

{/* After */}
<Icon className={`h-5 w-5 ${achieved ? 'text-green-600' : 'text-brand-primary'}`} />
```

Also update the streak border from `border-brand-primary/20 bg-brand-primary/5` to just `bg-brand-primary/5 rounded-[var(--radius)]` (no border).

---

## Step 8: Redesign RecentSessionsCard

**File:** `src/features/dashboard/ui/RecentSessionsCard.tsx` (194 lines)

Current violations:
1. Card: `border-gray-200 shadow-sm rounded-md md:rounded-lg` (line 21)
2. Padding: `p-2 md:p-4` (lines 22, 58)
3. Header icon in badge background: `rounded-full bg-brand-primary/10` (line 37)
4. Card title size varies: `text-xs md:text-base lg:text-lg` (line 41)
5. Session cards use gradient backgrounds: `bg-gradient-to-r from-emerald-500/15...` (line 95, 102)
6. Session cards have non-pill corners: `rounded-sm md:rounded-lg` (line 102)
7. Icon in colored circle badge: `rounded-full bg-emerald-500/20` (line 107)
8. Session stat values use `font-heading` (Merriweather): lines 158, 164, 171
9. "View All" button uses `text-brand-secondary hover:text-brand-primary` (line 50)
10. "Start Training" button uses `bg-brand-secondary hover:bg-brand-primary` (line 183)

### Full replacement approach:

```tsx
const RecentSessionsCard: React.FC<RecentSessionsCardProps> = ({ sessions, isLoading, onViewAll }) => {
  const recentSessions = sessions.slice(0, 3);

  return (
    <Card className="shadow-card h-full">
      <CardHeader className="pb-1 md:pb-3 p-5 md:p-6">
        {/* Header with bare icon */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-brand-primary" />
            <div>
              <CardTitle className="text-base font-heading text-brand-dark">
                Recent Sessions
              </CardTitle>
              <p className="text-[11px] text-brand-dark/40 font-body">Latest games</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-brand-primary hover:bg-[rgba(206,62,10,0.08)] text-xs h-7 px-3 rounded-full font-body"
            onClick={onViewAll}
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-5 md:p-6 pt-0">
        {recentSessions.length > 0 ? (
          <div className="space-y-3">
            {recentSessions.map((session) => {
              const hasValidEndTime = session.endedAt && session.endedAt !== session.startedAt;
              const isCompleted = hasValidEndTime && Number.isFinite(session.score);

              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between py-3 border-b border-[rgba(28,25,43,0.06)] last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-brand-dark/40 font-body">
                      {dayjs(session.startedAt).format('MMM D, HH:mm')}
                    </p>
                    <h4 className="text-sm font-medium text-brand-dark font-body truncate">
                      {session.gameName || session.scenarioName || 'Custom Game'}
                    </h4>
                  </div>
                  <div className="text-right ml-4">
                    <span className="text-label text-brand-secondary font-body uppercase tracking-wide">
                      Score
                    </span>
                    <p className="text-stat-sm font-bold text-brand-dark font-body tabular-nums">
                      {Number.isFinite(session.score) ? formatScoreValue(session.score) : 'N/A'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-xs text-brand-dark/40 font-body mb-4">No sessions yet</p>
            <Button
              className="bg-brand-primary hover:bg-brand-primary/90 text-white rounded-full font-body"
              onClick={onViewAll}
            >
              Start Training
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

### Key changes:
| Before | After | Why |
|--------|-------|-----|
| Icon in `rounded-full bg-brand-primary/10` | Bare `h-4 w-4 text-brand-primary` | Phase 5: No icon badges |
| Gradient session cards | Simple rows with `border-b border-[rgba(28,25,43,0.06)]` | Phase 4: Clean, minimal |
| `font-heading` on values | `font-body tabular-nums` | Phase 2: Raleway for numbers |
| Score/Hits/Duration 3-column grid | Score right-aligned as hero number | Phase 8: Score is the hero |
| `bg-brand-secondary hover:bg-brand-primary` CTA | `bg-brand-primary hover:bg-brand-primary/90` | Phase 3: Orange always |
| `text-brand-secondary hover:text-brand-primary` link | `text-brand-primary` with ghost variant | Phase 3: Orange for interactive |

---

## Step 9: Redesign HitTimelineCard

**File:** `src/features/games/ui/components/HitTimelineCard.tsx` (145 lines)

This is a MAJOR change: `LineChart` -> `AreaChart` with gradient fills.

Current violations:
1. Uses `LineChart` with `<Line>` elements (lines 94, 112-123) - should be `AreaChart` with `<Area>`
2. Uses non-brand `DEVICE_COLOR_PALETTE` colors (line 117) - should use `CHART_COLORS`
3. Grid stroke uses `url(#timelineGrid)` gradient (line 101) - should be `rgba(28,25,43,0.06)`
4. XAxis/YAxis show axis lines and tick lines (lines 102-103)
5. Uses default Recharts `<Legend>` (lines 105-111) - should be inline colored dots
6. Animation disabled (`isAnimationActive={false}`) - should be `true` with 800ms
7. Card uses gradient background and border (`bg-gradient-to-br... border-brand-primary/20`) (line 71) - should be clean white shadow-card
8. Dots visible on lines (`dot={{ r: 2 }}`) - should be `dot={false}`
9. Tooltip uses default border style - should use brand StravaTip

### Replace the entire `HitTimelineCard` component:

```tsx
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { CHART_COLORS, CHART_STYLE } from '@/shared/constants/chart-colors';

const StravaTip: React.FC<{ active?: boolean; payload?: any[]; label?: string }> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg p-3 border-0 min-w-[120px]">
      <p className="text-xs text-brand-secondary font-body mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-brand-dark/60 font-body">{entry.name}</span>
          <span className="text-sm font-bold text-brand-dark font-body ml-auto tabular-nums">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export const HitTimelineCard: React.FC<HitTimelineCardProps> = ({ trackedDevices, data }) => {
  const totalHits = useMemo(() => {
    return data.reduce((sum, bucket) => {
      return (
        sum +
        trackedDevices.reduce((deviceSum, device) => {
          const value = bucket[device.deviceName];
          return typeof value === 'number' ? deviceSum + value : deviceSum;
        }, 0)
      );
    }, 0);
  }, [data, trackedDevices]);

  return (
    <Card className="shadow-card">
      <CardContent className="p-5 md:p-6">
        {/* Hero stat above chart */}
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <span className="text-label text-brand-secondary uppercase tracking-wide font-body">
              Hit Timeline
            </span>
            <p className="text-stat-lg font-bold text-brand-dark font-body tabular-nums">
              {totalHits.toLocaleString()}
            </p>
          </div>
          {/* Inline legend - colored dots + device names */}
          <div className="flex flex-wrap gap-3">
            {trackedDevices.map((d, i) => (
              <div key={d.deviceId} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="text-xs text-brand-dark/50 font-body">{d.deviceName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart - full bleed */}
        <div className="-mx-5 md:-mx-6">
          {data.length === 0 ? (
            <div className="flex h-60 items-center justify-center text-sm text-brand-dark/40 font-body px-6">
              Start streaming hits to populate the timeline.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
                <defs>
                  <linearGradient id="gradientPrimary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#CE3E0A" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#CE3E0A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradientSecondary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#816E94" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#816E94" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke={CHART_STYLE.gridStroke}
                  strokeDasharray={CHART_STYLE.gridDash}
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  stroke={CHART_STYLE.axisStroke}
                  fontSize={CHART_STYLE.axisFontSize}
                  fontFamily={CHART_STYLE.axisFontFamily}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={CHART_STYLE.axisStroke}
                  fontSize={CHART_STYLE.axisFontSize}
                  fontFamily={CHART_STYLE.axisFontFamily}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <RechartsTooltip
                  content={<StravaTip />}
                  cursor={{ stroke: CHART_STYLE.tooltipCursor }}
                />

                {trackedDevices.map((device, index) => (
                  <Area
                    key={device.deviceId}
                    type="monotone"
                    dataKey={device.deviceName}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={index === 0 ? 2 : 1.5}
                    fill={index === 0 ? 'url(#gradientPrimary)' : 'url(#gradientSecondary)'}
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: CHART_COLORS[index % CHART_COLORS.length],
                      stroke: '#fff',
                      strokeWidth: 2,
                    }}
                    isAnimationActive={true}
                    animationDuration={CHART_STYLE.animationDuration}
                    animationEasing={CHART_STYLE.animationEasing}
                    animationBegin={index * 200}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
```

### Key changes:
| Before | After | Rule |
|--------|-------|------|
| `LineChart` + `Line` | `AreaChart` + `Area` with gradient fills | Phase 7A |
| `DEVICE_COLOR_PALETTE` (non-brand) | `CHART_COLORS` (#CE3E0A first) | Phase 7 |
| Gradient card background | Clean white `shadow-card` | Phase 4 |
| `<Legend>` component | Inline colored dots above chart | Phase 7 anti-pattern |
| `dot={{ r: 2 }}` | `dot={false}` | Phase 7 anti-pattern |
| `isAnimationActive={false}` | `true`, 800ms ease-out | Phase 7 anti-pattern |
| Default tooltip | Custom `StravaTip` component | Phase 7 anti-pattern |
| Heavy grid with gradient | Nearly invisible dashed, no vertical | Phase 7 anti-pattern |
| Axis lines visible | `axisLine={false} tickLine={false}` | Phase 7 anti-pattern |

---

## Step 10: Redesign HitDistributionCard

**File:** `src/features/games/ui/components/HitDistributionCard.tsx` (106 lines)

Current: PieChart donut with Progress bars below.
New: CSS-based horizontal bars with Framer Motion animation (per Phase 7B).

Current violations:
1. PieChart uses non-brand colors (DEVICE_COLOR_PALETTE)
2. Card has border (`border-gray-200`)
3. Title uses `font-heading` for heading (ok) but no hero stat number
4. Progress bars use `bg-brand-secondary/10` track
5. Values use `font-heading text-sm` instead of `font-body tabular-nums`
6. No animations

### Replace the entire `HitDistributionCard` component:

```tsx
import { motion } from 'framer-motion';
import { CHART_COLORS } from '@/shared/constants/chart-colors';

export const HitDistributionCard: React.FC<HitDistributionCardProps> = ({
  totalHits,
  deviceHitSummary,
  pieChartData,
}) => {
  const hasHits = deviceHitSummary.length > 0;

  return (
    <Card className="shadow-card">
      <CardContent className="p-5 md:p-6 space-y-4">
        {/* Hero stat */}
        <div>
          <span className="text-label text-brand-secondary uppercase tracking-wide font-body">
            Hit Distribution
          </span>
          <p className="text-stat-lg font-bold text-brand-dark font-body tabular-nums">
            {totalHits.toLocaleString()}
          </p>
        </div>

        {/* Horizontal bars */}
        {!hasHits ? (
          <div className="flex h-40 items-center justify-center text-sm text-brand-dark/40 font-body">
            Start a game to see hit distribution.
          </div>
        ) : (
          <div className="space-y-3">
            {deviceHitSummary.slice(0, 6).map((entry, i) => {
              const pct = totalHits > 0 ? (entry.hits / totalHits) * 100 : 0;
              return (
                <div key={entry.deviceId}>
                  {/* Label row */}
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs text-brand-dark/70 font-body">
                      {entry.deviceName}
                    </span>
                    <span className="text-xs font-semibold text-brand-dark font-body tabular-nums">
                      {entry.hits.toLocaleString()} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  {/* Bar with track */}
                  <div className="h-2 w-full bg-[rgba(28,25,43,0.06)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{
                        duration: 0.8,
                        ease: 'easeOut',
                        delay: i * 0.1,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

### Key changes:
- PieChart removed entirely -> CSS horizontal bars with pill shape
- Framer Motion animates bar widths with staggered delays
- Track: `bg-[rgba(28,25,43,0.06)] rounded-full`
- Uses `CHART_COLORS` (brand palette)
- Hero stat number above bars
- No border on card, `shadow-card` only
- Labels above bars in `text-xs`, values with `tabular-nums`

**NOTE:** PieChart, Pie, Cell imports can be removed from this file. This reduces the Recharts bundle loaded for this component.

---

## Step 11: Update Base Card Component

**File:** `src/components/ui/card.tsx`

### Replace the Card component (lines 5-17):

```tsx
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[var(--radius-lg)] bg-white text-brand-dark shadow-card transition-shadow duration-200",
      className
    )}
    {...props}
  />
))
```

### Replace CardHeader (lines 20-29):

```tsx
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5 md:p-6", className)}
    {...props}
  />
))
```

### Replace CardContent (lines 59-65):

```tsx
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-5 pb-5 md:px-6 md:pb-6", className)} {...props} />
))
```

### Key changes:
| Before | After | Why |
|--------|-------|-----|
| `rounded-lg border bg-white shadow-sm` | `rounded-[var(--radius-lg)] bg-white shadow-card` | No border, shadow elevation |
| `p-6` (CardHeader) | `p-5 md:p-6` | Mobile-conscious generous padding |
| `p-6 pt-0` (CardContent) | `px-5 pb-5 md:px-6 md:pb-6` | Mobile-conscious |

**IMPORTANT:** After this change, verify ALL pages that use Card components still look correct. The removal of `border` from the base Card will cascade everywhere. Specific components that add their own `border-*` classes will need those removed too.

---

## Step 12: Update Base Button Component

**File:** `src/components/ui/button.tsx`

### Replace the `buttonVariants` CVA (lines 7-34):

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium font-body ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-brand-primary text-white hover:bg-brand-primary/90 shadow-sm hover:shadow-md",
        secondary:
          "border-2 border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-white",
        outline:
          "border border-brand-secondary text-brand-secondary hover:bg-brand-secondary hover:text-white",
        ghost: "text-brand-primary hover:bg-[rgba(206,62,10,0.08)]",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        link: "text-brand-primary underline-offset-4 hover:underline rounded-none",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-4 py-1.5 text-xs",
        lg: "h-12 px-8 py-3 text-base",
        xl: "h-14 px-10 py-4 text-base font-semibold",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

### Key changes:
| Before | After | Why |
|--------|-------|-----|
| `rounded-md` base | `rounded-full` base | Phase 3: Pill buttons |
| default: `bg-brand-secondary` (purple) | `bg-brand-primary` (orange) | Phase 3: Orange is primary |
| No `active:scale` | `active:scale-[0.97]` | Phase 3: Press feedback |
| No `font-body` | `font-body` in base | Phase 2: Raleway for buttons |
| `transition-colors` | `transition-all duration-200` | Phase 12: Smooth transitions |
| Size `sm`: `rounded-md` | Inherits `rounded-full` | Phase 3: All pills |
| No `xl` size | `h-14 px-10 py-4` | Phase 3: Large CTAs |

**CRITICAL:** This changes the default button color from purple to orange. Every `<Button>` in the app using `variant="default"` (or no variant) will change. This is intentional per the Design Gospel. Audit pages after this change.

---

## Step 13: Update Dashboard Page Layout & Shell

**File:** `src/features/dashboard/ui/dashboard-page.tsx`

### 13A: Add Framer Motion import at top

Add to imports:
```tsx
import { motion } from 'framer-motion';
```

### 13B: Update the stats grid (line 551)

Change from:
```tsx
<div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
```

To:
```tsx
<motion.div
  className="grid grid-cols-2 lg:grid-cols-4 gap-4"
  variants={{
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
  }}
  initial="hidden"
  animate="visible"
>
```

And wrap each `<StatCard>` in:
```tsx
<motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }}>
  <StatCard ... />
</motion.div>
```

Close with `</motion.div>` instead of `</div>`.

### 13C: Update main content spacing (line 533)

Change from:
```tsx
<div className="w-full px-4 py-2 md:p-4 lg:p-6 md:max-w-7xl md:mx-auto space-y-2 md:space-y-4 lg:space-y-6 responsive-transition h-full">
```

To:
```tsx
<div className="w-full px-4 py-4 md:p-6 lg:p-8 md:max-w-7xl md:mx-auto space-y-4 md:space-y-6 h-full">
```

**Change:** More generous spacing everywhere. Removed `py-2` (too tight), `space-y-2` (too tight).

### 13D: Update loading indicator (lines 537-547)

Replace the blue loading banner with a more subtle branded version:
```tsx
{!isReady && (
  <div className="bg-brand-primary/5 rounded-[var(--radius)] p-3">
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-brand-dark/60 font-body">Loading real-time data...</span>
    </div>
  </div>
)}
```

### 13E: Update "Upcoming Features" section header (line 659)

Change from:
```tsx
<h3 className="text-lg font-heading text-brand-dark">Upcoming Features</h3>
```

To:
```tsx
<h3 className="text-base font-heading text-brand-dark">Upcoming Features</h3>
```

### 13F: Update "Show All Again" button (line 682)

Change from:
```tsx
<Button
  variant="outline"
  onClick={() => setDismissedCards([])}
  className="border-brand-secondary text-brand-secondary hover:bg-brand-secondary hover:text-white rounded-sm md:rounded"
>
```

To:
```tsx
<Button
  variant="outline"
  onClick={() => setDismissedCards([])}
  className="rounded-full"
>
```

### 13G: Remove MobileDrawer, add BottomTabBar

At the top, change imports:
```tsx
// Remove:
import MobileDrawer from '@/components/shared/MobileDrawer';
// Add:
import BottomTabBar from '@/components/shared/BottomTabBar';
```

In the JSX (lines 524-529), remove:
```tsx
<MobileDrawer
  isOpen={isMobileMenuOpen}
  onClose={() => setIsMobileMenuOpen(false)}
/>
```

Add at the end of the component (before closing `</div>`):
```tsx
{isMobile && <BottomTabBar />}
```

Remove the `isMobileMenuOpen` state and `onMenuClick` prop from Header:
```tsx
// Remove line 229:
const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
// Change line 523:
<Header />  {/* Remove onMenuClick prop */}
```

Add bottom padding on mobile for the tab bar:
```tsx
<main className={cn("flex-1 overflow-y-auto", isMobile && "pb-20")}>
```

---

## Step 14: Update Header Component

**File:** `src/components/shared/Header.tsx`

### 14A: Remove hamburger menu button

Remove lines 62-69 (the mobile hamburger button):
```tsx
{/* DELETE THIS ENTIRE BLOCK */}
{isMobile && onMenuClick && (
  <button
    onClick={onMenuClick}
    className="p-1 bg-brand-brown rounded-lg text-white hover:bg-brand-secondary/90 transition-colors"
  >
    <Menu className="w-4 h-4" />
  </button>
)}
```

Remove `Menu` from lucide-react imports. Remove `onMenuClick` from `HeaderProps` interface.

### 14B: Update header height and border

Change line 59 from:
```tsx
<header className="w-full h-12 md:h-16 bg-white text-brand-dark border-b border-gray-200 shadow-sm flex items-center justify-between px-2 md:px-4 z-10">
```

To:
```tsx
<header className="w-full h-14 bg-white text-brand-dark border-b border-[rgba(28,25,43,0.06)] flex items-center justify-between px-4 z-10">
```

**Changes:** Standardized height to `h-14`, subtler border, consistent padding.

### 14C: Update logout button (lines 90-98)

The logout button already uses `bg-brand-primary` which is correct. Just ensure pill shape:
```tsx
<Button
  onClick={handleSignOut}
  size="sm"
  className="h-8 px-4 bg-brand-primary hover:bg-brand-primary/90 text-white font-body rounded-full"
>
  <LogOut className="size-4" />
  <span className="hidden sm:inline">Logout</span>
</Button>
```

---

## Step 15: Update Sidebar Component

**File:** `src/components/shared/Sidebar.tsx`

### 15A: Add active route detection

Add to imports:
```tsx
import { useLocation } from 'react-router-dom';
```

Inside the component, add:
```tsx
const location = useLocation();
```

### 15B: Update nav item active state (lines 54-66)

Replace the nav item rendering with:
```tsx
{navItems.map((item) => {
  const isActive = location.pathname === item.path ||
    (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

  return (
    <li key={item.title}>
      <Link
        to={item.path}
        className={cn(
          'flex items-center p-3 transition-all duration-200',
          isActive
            ? 'border-l-[3px] border-brand-primary text-white pl-[calc(0.75rem-3px)]'
            : 'text-white/50 hover:text-white/80'
        )}
        onClick={isMobile ? onClose : undefined}
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
        <span className="ml-3 font-medium font-body">{item.title}</span>
      </Link>
    </li>
  );
})}
```

**Changes:**
- Active state: 3px left orange bar + white text (not bg highlight)
- Inactive: `text-white/50` (dimmer than current `text-white/80`)
- Hover: `text-white/80` (subtle, no background)
- Icons standardized to `w-5 h-5`
- No `rounded-lg hover:bg-white/10` background on hover

### 15C: Remove version footer (lines 71-75)

Replace with just the ailith.co wordmark:
```tsx
<div className="p-4 border-t border-white/10">
  <span className="text-xs text-white/40 font-display">ailith.co</span>
</div>
```

---

## Step 16: Create BottomTabBar

**Create new file:** `src/components/shared/BottomTabBar.tsx`

```tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Target, Users, Gamepad2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Dashboard', icon: Home, path: '/dashboard' },
  { label: 'Targets', icon: Target, path: '/dashboard/targets' },
  { label: 'Rooms', icon: Users, path: '/dashboard/rooms' },
  { label: 'Games', icon: Gamepad2, path: '/dashboard/games' },
  { label: 'Profile', icon: User, path: '/dashboard/profile' },
];

const BottomTabBar: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[rgba(28,25,43,0.08)] shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-safe">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive =
            tab.path === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(tab.path);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-200 relative',
                isActive ? 'text-brand-primary' : 'text-brand-secondary'
              )}
            >
              {/* Active indicator - small bar above icon */}
              {isActive && (
                <div className="absolute top-0 w-6 h-0.5 bg-brand-primary rounded-full" />
              )}
              <Icon className="w-5 h-5" />
              <span
                className={cn(
                  'text-[10px] font-body',
                  isActive ? 'font-semibold' : 'font-normal'
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomTabBar;
```

**Specs per Phase 6A:**
- Fixed bottom, `h-16` (64px) + safe area for notched phones
- 5 tabs: Dashboard, Targets, Rooms, Games, Profile
- Active: `text-brand-primary` (#CE3E0A) + 2px bar indicator above icon
- Inactive: `text-brand-secondary` (#816E94)
- `z-50` above content

**NOTE:** Add `pb-safe` utility to Tailwind config or CSS:
```css
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

---

## Step 17: Add Animations & Count-Up Hook

**Create new file:** `src/shared/hooks/use-count-up.ts`

```typescript
import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number>();
  const prevTarget = useRef(target);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }

    // Only animate on initial mount or when target changes
    if (prevTarget.current === target && value !== 0) return;
    prevTarget.current = target;

    startTime.current = null;

    const step = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafId.current = requestAnimationFrame(step);
      }
    };

    rafId.current = requestAnimationFrame(step);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [target, duration]);

  return value;
}
```

### Usage in StatCard:

For numeric-only values, use `useCountUp`:
```tsx
// In StatCard or at the dashboard level when computing stat values:
const animatedTargets = useCountUp(totalTargets);
// Then display: {animatedTargets.toLocaleString()}
```

**NOTE:** `useCountUp` can only be used when the value is purely numeric. For formatted values like "12.3s" (score), format after the count-up animation or skip animation.

---

## Step 18: Update CSS Design Tokens

These were partially covered in Step 1 but here are the remaining CSS additions needed in `src/index.css`:

### Add `pb-safe` utility class after the existing utility classes:

```css
@layer utilities {
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}
```

### Add `text-label` utility if not using Tailwind's custom fontSize

If the Tailwind `text-label` token isn't working, add this as a CSS class:
```css
.text-label {
  font-size: 0.6875rem;
  line-height: 1rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
```

---

## Step 19: Update Tailwind Config Tokens

**File:** `tailwind.config.ts`

### 19A: Add stat font sizes (inside `theme.extend.fontSize`):

```typescript
fontSize: {
  // Existing tokens stay...
  'stat-hero': ['3rem', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.02em' }],
  'stat-lg': ['2.25rem', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.02em' }],
  'stat-md': ['1.75rem', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.01em' }],
  'stat-sm': ['1.25rem', { lineHeight: '1.2', fontWeight: '600' }],
  'label': ['0.6875rem', { lineHeight: '1rem', fontWeight: '500', letterSpacing: '0.06em' }],
},
```

### 19B: Add/update shadow tokens (inside `theme.extend.boxShadow`):

```typescript
boxShadow: {
  'card': 'var(--shadow-md)',
  'card-hover': 'var(--shadow-hover)',
  'subtle': 'var(--shadow-sm)',
  'elevated': 'var(--shadow-lg)',
},
```

### 19C: Update borderRadius:

```typescript
borderRadius: {
  DEFAULT: 'var(--radius)',
  lg: 'var(--radius)',
  'radius-lg': 'var(--radius-lg)',
  full: 'var(--radius-full)',
  md: 'calc(var(--radius) - 2px)',
  sm: 'calc(var(--radius) - 4px)',
},
```

---

## Step 20: Validation Checklist

After all changes, verify each of these on the dashboard page:

- [ ] **No purple buttons:** No `bg-brand-secondary` or `#816E94` used as a primary/default button color
- [ ] **Stat numbers > labels:** All stat numbers (targets, rooms, score, sessions) are visually larger than their labels
- [ ] **Pill buttons:** All buttons use `rounded-full`, no `rounded-md` or `rounded-sm` on any button
- [ ] **No icon badges:** No `bg-brand-secondary/10 rounded-lg p-2` wrapper around any icons
- [ ] **Cards: shadow, no border:** All cards use `shadow-card` with no visible `border-*` class
- [ ] **Search inputs white:** No purple-background search inputs
- [ ] **#CE3E0A is the only accent for interactive states:** All buttons, links, active indicators use burnt orange
- [ ] **Labels are uppercase/small/muted:** All stat labels use `text-label` pattern (11px, uppercase, tracking-wide, `#816E94`)
- [ ] **Merriweather for titles, Raleway for everything else:** Section titles use `font-heading`, stat numbers use `font-body`
- [ ] **Charts use brand colors:** #CE3E0A is the first color in all chart color arrays
- [ ] **Mobile bottom tab bar:** No hamburger menu, bottom tab bar visible on mobile
- [ ] **Sidebar active indicator:** 3px left orange bar on active nav item
- [ ] **Transitions 200ms:** All hover/active transitions use `duration-200`
- [ ] **tabular-nums on numbers:** All numeric displays have `tabular-nums` class
- [ ] **Font weights correct:** 700 for stat numbers, 600 for headings, 400-500 for body text
- [ ] **Generous padding:** Cards use `p-5 md:p-6` minimum, not `p-2`
- [ ] **Area charts:** HitTimelineCard uses AreaChart with gradient fills, not LineChart
- [ ] **Horizontal bars:** HitDistributionCard uses CSS bars, not PieChart
- [ ] **Animations working:** Stat cards stagger in, progress rings animate draw, bars animate width
- [ ] **Build passes:** `npm run build` completes without errors
- [ ] **No console errors:** No runtime errors in browser console

---

## Execution Order Summary

Execute these steps in this exact order to avoid breaking changes cascading incorrectly:

1. **Step 18-19**: Design tokens (CSS vars + Tailwind) - Foundation
2. **Step 2**: Install framer-motion - Dependency
3. **Step 3**: Create chart constants - Dependency
4. **Step 11**: Base Card component - Foundation
5. **Step 12**: Base Button component - Foundation
6. **Step 4**: StatCard redesign
7. **Step 5**: ProgressRing redesign
8. **Step 6**: ComingSoonCard redesign
9. **Step 7**: TargetActivityCard redesign
10. **Step 8**: RecentSessionsCard redesign
11. **Step 9**: HitTimelineCard redesign
12. **Step 10**: HitDistributionCard redesign
13. **Step 14**: Header update
14. **Step 15**: Sidebar update
15. **Step 16**: Create BottomTabBar
16. **Step 13**: Dashboard page layout & shell
17. **Step 17**: Count-up animations
18. **Step 20**: Validation

---

## Files Modified (Complete List)

| # | File | Action | Step |
|---|------|--------|------|
| 1 | `src/index.css` | MODIFY - CSS variables, btn classes, utility classes | 1, 18 |
| 2 | `tailwind.config.ts` | MODIFY - Add stat sizes, shadows, radii | 19 |
| 3 | `src/components/ui/card.tsx` | MODIFY - Remove border, update padding/radius | 11 |
| 4 | `src/components/ui/button.tsx` | MODIFY - Pill shape, orange default, press feedback | 12 |
| 5 | `src/features/dashboard/ui/dashboard-page.tsx` | MODIFY - StatCard, ProgressRing, ComingSoonCard, layout | 4, 5, 6, 13 |
| 6 | `src/features/dashboard/ui/TargetActivityCard.tsx` | MODIFY - Segmented control, clean metrics, bars | 7 |
| 7 | `src/features/dashboard/ui/RecentSessionsCard.tsx` | MODIFY - Row layout, score hero, orange CTA | 8 |
| 8 | `src/features/games/ui/components/HitTimelineCard.tsx` | MODIFY - LineChart->AreaChart, gradients, StravaTip | 9 |
| 9 | `src/features/games/ui/components/HitDistributionCard.tsx` | MODIFY - PieChart->CSS bars, Framer Motion | 10 |
| 10 | `src/features/games/ui/components/constants.ts` | MODIFY - Update to use CHART_COLORS | 3 |
| 11 | `src/components/shared/Header.tsx` | MODIFY - Remove hamburger, update height/border | 14 |
| 12 | `src/components/shared/Sidebar.tsx` | MODIFY - Active left bar, dim inactive | 15 |
| 13 | `src/shared/constants/chart-colors.ts` | CREATE - Brand chart color palette | 3 |
| 14 | `src/components/shared/BottomTabBar.tsx` | CREATE - Mobile bottom tab navigation | 16 |
| 15 | `src/shared/hooks/use-count-up.ts` | CREATE - Number count-up animation hook | 17 |

**Total:** 12 files modified, 3 files created
