import React from 'react';
import { motion } from 'framer-motion';
import {
  Target as TargetIcon,
  Sofa,
  Utensils,
  ChefHat,
  Bed,
  Briefcase,
  Home,
  Building,
  Car,
  TreePine,
  Gamepad2,
  Dumbbell,
  Music,
  BookOpen,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { TARGET_STATUS_DISPLAY } from '@/shared/constants/target-status';
import type { EdgeRoom } from '@/features/rooms';

interface RoomConfigurationGridProps {
  rooms: EdgeRoom[];
  targetStatusMap: Map<string, string>;
  isLoading: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

function getRoomIcon(iconName?: string | null) {
  const cls = 'h-5 w-5';
  switch (iconName) {
    case 'sofa': return <Sofa className={cls} />;
    case 'utensils': return <Utensils className={cls} />;
    case 'chef-hat': return <ChefHat className={cls} />;
    case 'bed': return <Bed className={cls} />;
    case 'briefcase': return <Briefcase className={cls} />;
    case 'home': return <Home className={cls} />;
    case 'building': return <Building className={cls} />;
    case 'car': return <Car className={cls} />;
    case 'tree-pine': return <TreePine className={cls} />;
    case 'gamepad2': return <Gamepad2 className={cls} />;
    case 'dumbbell': return <Dumbbell className={cls} />;
    case 'music': return <Music className={cls} />;
    case 'book-open': return <BookOpen className={cls} />;
    case 'basement': return <Building className={cls} />;
    default: return <Home className={cls} />;
  }
}

const RoomConfigurationGrid: React.FC<RoomConfigurationGridProps> = ({
  rooms,
  targetStatusMap,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TargetIcon className="h-4 w-4 text-brand-primary" />
          <h3 className="text-base font-heading text-brand-dark">
            Room Configuration
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="shadow-card animate-pulse">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-5 h-5 bg-gray-200 rounded" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
                    <div className="h-3 bg-gray-200 rounded w-16" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-gray-200 rounded-full" />
                    <div className="h-3 bg-gray-200 rounded w-14" />
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TargetIcon className="h-4 w-4 text-brand-primary" />
          <h3 className="text-base font-heading text-brand-dark">
            Room Configuration
          </h3>
        </div>
        <div className="text-center py-6">
          <p className="text-sm text-brand-dark/40 font-body">
            No rooms configured yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <TargetIcon className="h-4 w-4 text-brand-primary" />
        <h3 className="text-base font-heading text-brand-dark">
          Room Configuration
        </h3>
      </div>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {rooms.map((room) => {
          const targets = room.targets || [];
          const onlineCount = targets.filter((t) => {
            const status = targetStatusMap.get(t.id) || t.status;
            return status && status.toLowerCase() !== 'offline';
          }).length;
          const hasOnline = onlineCount > 0;

          const statusDotColor = hasOnline
            ? TARGET_STATUS_DISPLAY.online.dotColor
            : room.targetCount > 0
              ? TARGET_STATUS_DISPLAY.offline.dotColor
              : 'bg-brand-dark/20';

          const statusTextColor = hasOnline
            ? TARGET_STATUS_DISPLAY.online.textColor
            : 'text-brand-dark/40';

          const statusLabel = hasOnline
            ? `${onlineCount} ${TARGET_STATUS_DISPLAY.online.label}`
            : room.targetCount > 0
              ? `All ${TARGET_STATUS_DISPLAY.offline.label}`
              : 'No Targets';

          return (
            <motion.div
              key={room.id}
              variants={itemVariants}
              whileHover={{
                y: -2,
                boxShadow: 'var(--shadow-hover)',
              }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Card className="shadow-card bg-gradient-to-br from-white to-brand-secondary/[0.04]">
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-brand-primary">
                      {getRoomIcon(room.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-dark font-body truncate">
                        {room.name}
                      </p>
                      <p className="text-xs text-brand-dark/40 font-body">
                        {room.targetCount} target
                        {room.targetCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-2 h-2 rounded-full ${statusDotColor}`}
                      />
                      <span
                        className={`text-xs font-medium font-body ${statusTextColor}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <span className="text-label text-brand-dark/30 font-body uppercase tracking-wide">
                      {onlineCount}/{room.targetCount}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default RoomConfigurationGrid;
