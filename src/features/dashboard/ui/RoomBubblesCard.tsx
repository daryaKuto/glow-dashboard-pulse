import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  Sofa,
  Utensils,
  ChefHat,
  Bed,
  Briefcase,
  Building,
  Car,
  TreePine,
  Gamepad2,
  Dumbbell,
  Music,
  BookOpen,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { EdgeRoom } from '@/features/rooms/repo';
import type { DashboardSession } from '@/features/dashboard';

// ─── Icon mapping (mirrors RoomCard.tsx) ────────────────────────────────────

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  home: Home,
  sofa: Sofa,
  utensils: Utensils,
  'chef-hat': ChefHat,
  bed: Bed,
  briefcase: Briefcase,
  building: Building,
  car: Car,
  'tree-pine': TreePine,
  gamepad2: Gamepad2,
  dumbbell: Dumbbell,
  music: Music,
  'book-open': BookOpen,
};

function getRoomIcon(icon?: string | null) {
  return ICON_MAP[icon ?? 'home'] ?? Home;
}

// ─── Types ──────────────────────────────────────────────────────────────────

type RoomData = {
  id: string;
  name: string;
  icon: string | null;
  sessionCount: number;
  targetCount: number;
  isTopRoom: boolean;
};

type RoomBubblesCardProps = {
  rooms: EdgeRoom[];
  sessions: DashboardSession[];
  isLoading: boolean;
};

// ─── Animations ─────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

// ─── Bar gradients (brand palette) ──────────────────────────────────────────

const BAR_GRADIENTS = [
  'linear-gradient(90deg, #CE3E0A, #E8601F)',           // orange → warm orange
  'linear-gradient(90deg, #816E94, #A884FF)',           // purple → lavender
  'linear-gradient(90deg, #1C192B, #3D3654)',           // dark → muted dark
  'linear-gradient(90deg, #CE3E0A, #FF7A00)',           // orange → bright orange
  'linear-gradient(90deg, #816E94, #B8A0CC)',           // purple → light purple
  'linear-gradient(90deg, #6B4A38, #9E7A60)',           // brown → warm brown
];

const DOT_COLORS = [
  'bg-brand-primary',
  'bg-brand-secondary',
  'bg-brand-dark/40',
  'bg-brand-primary/50',
  'bg-brand-secondary/60',
  'bg-brand-dark/30',
];

// ─── Room row sub-component ─────────────────────────────────────────────────

const RoomRow: React.FC<{
  room: RoomData;
  percentage: number;
  index: number;
  maxCount: number;
}> = ({ room, percentage, index, maxCount }) => {
  const Icon = getRoomIcon(room.icon);
  const barGradient = BAR_GRADIENTS[index % BAR_GRADIENTS.length];
  const dotColor = DOT_COLORS[index % DOT_COLORS.length];
  // Bar width: at least 4% even for 0-session rooms so something is visible
  const barWidth = maxCount > 0 ? Math.max((room.sessionCount / maxCount) * 100, 4) : 4;

  return (
    <motion.div
      variants={rowVariants}
      className="flex items-center gap-3 rounded-lg px-1 -mx-1 cursor-default"
      whileHover={{ scale: 1.02, y: -1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {/* Colored dot */}
      <motion.span
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`}
      />

      {/* Icon + name */}
      <div className="flex items-center gap-2 min-w-0 w-24 shrink-0">
        <Icon
          className={room.isTopRoom ? 'text-brand-primary shrink-0' : 'text-brand-secondary shrink-0'}
          style={{ width: 16, height: 16 }}
        />
        <span
          className={`text-xs font-body truncate ${
            room.isTopRoom ? 'font-semibold text-brand-dark' : 'text-brand-dark/70'
          }`}
        >
          {room.name}
        </span>
      </div>

      {/* Proportion bar */}
      <div className="flex-1 h-8 rounded-lg bg-brand-dark/[0.04] overflow-hidden relative group">
        <motion.div
          className="h-full rounded-lg transition-[filter] duration-200 group-hover:brightness-110 group-hover:shadow-md"
          style={{ background: barGradient }}
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 + index * 0.08 }}
        />
      </div>

      {/* Session count */}
      <span
        className={`text-sm font-bold font-body tabular-nums w-6 text-right shrink-0 ${
          room.isTopRoom ? 'text-brand-primary' : 'text-brand-dark/60'
        }`}
      >
        {room.sessionCount}
      </span>
    </motion.div>
  );
};

// ─── Main component ─────────────────────────────────────────────────────────

const RoomBubblesCard: React.FC<RoomBubblesCardProps> = ({ rooms, sessions, isLoading }) => {
  const roomData = useMemo<RoomData[]>(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      const name = s.roomName || '—';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    const data = rooms.map((room) => ({
      id: room.id,
      name: room.name,
      icon: room.icon ?? null,
      sessionCount: counts.get(room.name) ?? 0,
      targetCount: room.targetCount,
      isTopRoom: false,
    }));

    data.sort((a, b) => b.sessionCount - a.sessionCount);

    if (data.length > 0 && data[0].sessionCount > 0) {
      data[0].isTopRoom = true;
    }

    return data;
  }, [rooms, sessions]);

  const totalSessions = useMemo(
    () => roomData.reduce((sum, r) => sum + r.sessionCount, 0),
    [roomData],
  );

  const maxCount = roomData.length > 0 ? roomData[0].sessionCount : 0;

  if (isLoading) {
    return (
      <Card className="shadow-card bg-gradient-to-br from-white to-brand-secondary/[0.04]">
        <CardHeader className="pb-2 md:pb-3 p-5 md:p-6">
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded bg-gray-200" />
            <div>
              <Skeleton className="h-4 w-24 bg-gray-200 mb-1" />
              <Skeleton className="h-3 w-16 bg-gray-200" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 md:px-6 md:pb-6 pt-0">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                <Skeleton className="w-20 h-3 bg-gray-200 rounded" />
                <Skeleton className="flex-1 h-8 rounded-lg bg-gray-100" />
                <Skeleton className="w-5 h-4 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (roomData.length === 0) {
    return (
      <Card className="shadow-card bg-gradient-to-br from-white to-brand-secondary/[0.04]">
        <CardHeader className="pb-2 md:pb-3 p-5 md:p-6">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-primary" />
            <h3 className="text-sm font-medium text-brand-dark font-body">Your Rooms</h3>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 md:px-6 md:pb-6 pt-0">
          <div className="flex h-40 items-center justify-center text-sm text-brand-dark/40 font-body">
            No rooms configured yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card bg-gradient-to-br from-white to-brand-secondary/[0.04] h-full flex flex-col">
      <CardHeader className="pb-3 md:pb-4 p-5 md:p-6 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-primary" />
            <div>
              <h3 className="text-sm font-medium text-brand-dark font-body">Your Rooms</h3>
              <p className="text-[11px] text-brand-dark/40 font-body">Session distribution</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-stat-sm font-bold text-brand-dark font-body tabular-nums">
              {totalSessions}
            </p>
            <p className="text-[10px] text-brand-dark/40 font-body uppercase tracking-wide">
              sessions
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 md:px-6 md:pb-6 pt-0 flex-1 flex flex-col">
        <motion.div
          className="flex flex-col justify-evenly flex-1"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {roomData.map((room, i) => (
            <RoomRow
              key={room.id}
              room={room}
              percentage={totalSessions > 0 ? (room.sessionCount / totalSessions) * 100 : 0}
              index={i}
              maxCount={maxCount}
            />
          ))}
        </motion.div>
      </CardContent>
    </Card>
  );
};

export default RoomBubblesCard;
