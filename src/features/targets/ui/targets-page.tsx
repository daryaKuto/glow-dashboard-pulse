import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getStatusDisplay, TARGET_STATUS_DISPLAY } from '@/shared/constants/target-status';
import { motion } from 'framer-motion';
import { useRooms, type Room } from '@/features/rooms';
import {
  useTargets,
  useTargetDetails,
  mergeTargetDetails,
  targetsKeys,
  useTargetCustomNames,
  // Target groups hooks (replaces Zustand useTargetGroups store)
  useTargetGroups,
  useCreateTargetGroup,
  useUpdateTargetGroup,
  useDeleteTargetGroup,
  useAssignTargetsToGroup,
  useUnassignTargetsFromGroup,
  type TargetGroup,
} from '@/features/targets';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import type { Target } from '@/features/targets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Target as TargetIcon,
  Plus,
  Search,
  Wifi,
  WifiOff,
  MapPin,
  Settings,
  Trash2,
  Sparkles,
  Users,
  X,
  Pencil,
  Check,
  MoreVertical,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGameHistory } from '@/features/games/hooks/use-game-history';
import { TargetCustomizationDialog } from '@/features/targets/ui/TargetCustomizationDialog';
import CreateGroupModal from '@/features/targets/ui/CreateGroupModal';
import AddTargetsToGroupModal from '@/features/targets/ui/AddTargetsToGroupModal';
import RenameTargetDialog from '@/features/targets/ui/RenameTargetDialog';
import { useSubscription } from '@/features/auth/hooks';
import { PremiumLockIcon } from '@/components/shared/SubscriptionGate';
import { useAuth } from '@/shared/hooks/use-auth';
import { logger } from '@/shared/lib/logger';

// Framer Motion variants for staggered target card grids
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

// StatCard — copied from Dashboard's Strava-style data-first hierarchy pattern
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: React.ReactNode;
  icon: React.ReactNode;
  isLoading?: boolean;
}> = ({ title, value, subtitle, icon, isLoading = false }) => (
  <Card className="shadow-card hover:shadow-card-hover transition-all duration-200 bg-gradient-to-br from-white via-white to-brand-primary/[0.04]">
    <CardContent className="p-3 md:p-5 lg:p-6">
      <div className="flex items-center justify-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
        <div className="text-brand-primary w-3.5 h-3.5 md:w-4 md:h-4">{icon}</div>
        <span className="text-[10px] md:text-label text-brand-secondary font-body uppercase tracking-wide">
          {title}
        </span>
      </div>
      {isLoading ? (
        <div className="h-7 md:h-10 w-12 md:w-24 bg-gray-200 rounded animate-pulse mx-auto" />
      ) : (
        <p className="text-stat-sm md:text-stat-lg font-bold text-brand-dark font-body tabular-nums text-center">
          {value}
        </p>
      )}
      {subtitle && (
        <div className="text-[10px] md:text-xs text-brand-dark/40 font-body mt-0.5 md:mt-1 flex justify-center">{subtitle}</div>
      )}
    </CardContent>
  </Card>
);

// TargetCard — Design Gospel Phase 10 compliant
const TargetCard: React.FC<{
  target: Target & { displayName?: string };
  room?: Room;
  onEdit: () => void;
  onDelete: () => void;
  onCustomize?: () => void;
  onRename?: () => void;
  totalHitCount?: number;
  isHitTotalsLoading?: boolean;
}> = ({ target, room, onEdit, onDelete, onCustomize, onRename, totalHitCount, isHitTotalsLoading }) => {
  const { isPremium } = useSubscription();

  const displayName = target.displayName || target.name;

  const hasGameHistory = typeof totalHitCount === 'number';
  const hasTelemetryShots = typeof target.totalShots === 'number';
  const hasAnyShots = hasGameHistory || hasTelemetryShots;
  const totalShots = hasAnyShots
    ? Math.max(totalHitCount ?? 0, target.totalShots ?? 0)
    : null;
  const lastShotTime = target.lastShotTime ?? target.lastActivityTime ?? null;

  const status = target.status;
  const statusConfig = getStatusDisplay(status);
  const isConnected = status === 'online' || status === 'standby';
  const ConnectionIcon = isConnected ? Wifi : WifiOff;

  return (
    <Card className="shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-br from-white via-white to-brand-primary/[0.04]">
      <CardContent className="p-3 md:p-5">
        {/* Row 1 — Status dot + Name + Action menu */}
        <div className="flex items-center justify-between gap-1.5 md:gap-2 mb-2 md:mb-3">
          <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusConfig.dotColor}`} />
            <h3 className="text-sm md:text-base font-heading font-semibold text-brand-dark truncate" title={displayName}>
              {displayName}
            </h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="flex-shrink-0 h-7 w-7 md:h-8 md:w-8">
                <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white shadow-lg border-0">
              <DropdownMenuItem onClick={onRename || onEdit}>
                <Settings className="h-4 w-4 mr-2" />
                <span className="text-sm">{onRename ? 'Rename' : 'Edit'}</span>
              </DropdownMenuItem>
              {isPremium && onCustomize && (
                <DropdownMenuItem
                  onClick={onCustomize}
                  className="relative overflow-hidden premium-customize-item"
                >
                  <Sparkles className="h-4 w-4 mr-2 text-white relative z-10 premium-sparkle-icon" />
                  <span className="text-sm relative z-10 font-medium text-white">
                    Customize
                  </span>
                </DropdownMenuItem>
              )}
              {!isPremium && onCustomize && (
                <DropdownMenuItem
                  onClick={() => toast.info('Upgrade to Premium to customize targets')}
                  className="opacity-60"
                >
                  <PremiumLockIcon className="h-4 w-4 mr-2" />
                  <span className="text-sm">Customize (Premium)</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                <span className="text-sm">Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Row 2 — Hit Count (hero stat, data-first) */}
        <div className="text-center mb-2 md:mb-3">
          <span className="text-[10px] md:text-label text-brand-secondary font-body uppercase tracking-wide">Hit Count</span>
          <p className="text-stat-sm md:text-stat-md font-bold text-brand-dark font-body tabular-nums">
            {isHitTotalsLoading && !hasGameHistory
              ? '…'
              : totalShots !== null ? totalShots.toLocaleString() : '—'}
          </p>
        </div>

        {/* Row 3 — Secondary info strip */}
        <div className="flex items-center justify-center gap-2 md:gap-4 mb-1.5 md:mb-2">
          <div className="flex items-center gap-1">
            <ConnectionIcon className="h-3 w-3 md:h-3.5 md:w-3.5 text-brand-dark/50" />
            <span className="text-[10px] md:text-xs text-brand-dark/50 font-body">{statusConfig.label}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 text-brand-dark/50" />
            <span className="text-[10px] md:text-xs text-brand-dark/50 font-body truncate max-w-[80px] md:max-w-none">
              {room ? room.name : 'Unassigned'}
            </span>
          </div>
        </div>

        {/* Row 4 — Last activity */}
        <div className="text-center">
          <span className="text-[10px] md:text-[11px] text-brand-dark/40 font-body">
            {lastShotTime
              ? `Last: ${new Date(lastShotTime).toLocaleDateString()}`
              : 'No activity'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

// Status sort: ready (standby) first, then active (online), then offline
const GROUP_TARGET_SORT: Record<string, number> = { standby: 0, online: 1, offline: 2 };

// GroupCard — Design Gospel compliant group display card with inline edit mode
const GroupCard: React.FC<{
  group: TargetGroup & { targets?: (Target & { displayName?: string })[] };
  room?: Room | null;
  allTargets: Array<Target & { displayName?: string }>;
  onAddTargets: (groupId: string, targetIds: string[]) => void;
  onRemoveTarget: (groupId: string, targetId: string) => void;
  onDelete: (groupId: string) => void;
}> = ({ group, room, allTargets, onAddTargets, onRemoveTarget, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const targets = group.targets ?? [];
  const groupTargetIds = new Set(targets.map(t => t.id));
  const sortedTargets = [...targets].sort(
    (a, b) => (GROUP_TARGET_SORT[a.status ?? 'offline'] ?? 2) - (GROUP_TARGET_SORT[b.status ?? 'offline'] ?? 2)
  );
  // All targets sorted: ready first, with group members on top within each status tier
  const sortedAllTargets = [...allTargets].sort((a, b) => {
    const statusA = GROUP_TARGET_SORT[a.status ?? 'offline'] ?? 2;
    const statusB = GROUP_TARGET_SORT[b.status ?? 'offline'] ?? 2;
    if (statusA !== statusB) return statusA - statusB;
    const inGroupA = groupTargetIds.has(a.id) ? 0 : 1;
    const inGroupB = groupTargetIds.has(b.id) ? 0 : 1;
    return inGroupA - inGroupB;
  });
  const onlineCount = targets.filter(t => t.status === 'online').length;
  const standbyCount = targets.filter(t => t.status === 'standby').length;
  const offlineCount = targets.filter(t => t.status === 'offline').length;

  const handleToggleTarget = (targetId: string) => {
    if (groupTargetIds.has(targetId)) {
      onRemoveTarget(group.id, targetId);
    } else {
      onAddTargets(group.id, [targetId]);
    }
  };

  return (
    <Card className="shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-br from-white to-brand-secondary/[0.04]">
      <CardContent className="p-3 md:p-5">
        {/* Row 1 — Group icon + Name + Edit/Delete buttons */}
        <div className="flex items-center justify-between gap-1.5 md:gap-2 mb-2 md:mb-3">
          <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1">
            <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-brand-primary flex-shrink-0" />
            <h3 className="text-sm md:text-base font-heading font-semibold text-brand-dark truncate" title={group.name}>
              {group.name}
            </h3>
          </div>
          <div className="flex items-center gap-0 md:gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsEditing(!isEditing)}
              className={`h-7 w-7 md:h-8 md:w-8 ${isEditing ? 'text-brand-primary bg-brand-primary/[0.08]' : 'text-brand-dark/50 hover:text-brand-dark hover:bg-brand-dark/[0.06]'}`}
              title={isEditing ? 'Done editing' : 'Edit Group'}
            >
              {isEditing ? <Check className="w-3 h-3 md:w-3.5 md:h-3.5" /> : <Pencil className="w-3 h-3 md:w-3.5 md:h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(group.id)}
              className="text-brand-dark/50 hover:text-red-600 hover:bg-red-600/[0.08] h-7 w-7 md:h-8 md:w-8"
              title="Delete Group"
            >
              <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
            </Button>
          </div>
        </div>

        {/* Row 2 — Status summary (clickable to expand/collapse in normal mode) */}
        <button
          type="button"
          onClick={() => { if (!isEditing) setIsExpanded(!isExpanded); }}
          className={`flex items-center gap-2 md:gap-3 w-full text-left ${isEditing ? 'cursor-default mb-2 md:mb-3' : 'cursor-pointer mb-2 md:mb-3'}`}
        >
          <div className="flex items-center gap-2 md:gap-3 flex-1 flex-wrap">
            {onlineCount > 0 && (
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${TARGET_STATUS_DISPLAY.online.dotColor}`} />
                <span className="text-[10px] md:text-xs text-brand-dark/50 font-body">
                  {onlineCount} {TARGET_STATUS_DISPLAY.online.label.toLowerCase()}
                </span>
              </div>
            )}
            {standbyCount > 0 && (
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${TARGET_STATUS_DISPLAY.standby.dotColor}`} />
                <span className="text-[10px] md:text-xs text-brand-dark/50 font-body">
                  {standbyCount} {TARGET_STATUS_DISPLAY.standby.label.toLowerCase()}
                </span>
              </div>
            )}
            {offlineCount > 0 && (
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${TARGET_STATUS_DISPLAY.offline.dotColor}`} />
                <span className="text-[10px] md:text-xs text-brand-dark/50 font-body">
                  {offlineCount} {TARGET_STATUS_DISPLAY.offline.label.toLowerCase()}
                </span>
              </div>
            )}
            {targets.length === 0 && !isEditing && (
              <span className="text-[10px] md:text-xs text-brand-dark/40 font-body">No targets assigned</span>
            )}
          </div>
          {!isEditing && targets.length > 0 && (
            <ChevronDown className={`w-3.5 h-3.5 text-brand-dark/30 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          )}
        </button>

        {/* Edit mode — all targets checklist */}
        {isEditing ? (
          <div className="space-y-1 mb-2 md:mb-3 max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-brand-secondary/20">
            {sortedAllTargets.length === 0 ? (
              <p className="text-xs text-brand-dark/40 font-body text-center py-3">No targets available</p>
            ) : (
              sortedAllTargets.map((target) => {
                const isInGroup = groupTargetIds.has(target.id);
                const statusCfg = getStatusDisplay(target.status);
                const displayName = target.displayName || target.name;
                return (
                  <button
                    key={target.id}
                    onClick={() => handleToggleTarget(target.id)}
                    className={`flex items-center gap-2 w-full text-left rounded-[var(--radius)] px-2 py-1.5 transition-colors duration-150 ${
                      isInGroup ? 'bg-brand-primary/[0.05]' : 'bg-white/60 hover:bg-white'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isInGroup ? 'border-brand-primary bg-brand-primary' : 'border-brand-dark/20 bg-transparent'
                    }`}>
                      {isInGroup && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dotColor}`} />
                    <span className="text-xs text-brand-dark font-body truncate flex-1" title={displayName}>
                      {displayName}
                    </span>
                    <span className={`text-[9px] font-body ${statusCfg.textColor} flex-shrink-0`}>
                      {statusCfg.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          /* Normal mode — expandable target member list */
          isExpanded && sortedTargets.length > 0 && (
            <div className="space-y-1 mb-2 md:mb-3 max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-brand-secondary/20">
              {sortedTargets.map((target) => {
                const statusCfg = getStatusDisplay(target.status);
                const displayName = (target as Target & { displayName?: string }).displayName || target.name;
                return (
                  <div
                    key={target.id}
                    className="flex items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 bg-white/60 hover:bg-white transition-colors duration-150"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dotColor}`} />
                    <TargetIcon className="w-3 h-3 text-brand-dark/30 flex-shrink-0" />
                    <span className="text-xs text-brand-dark font-body truncate flex-1" title={displayName}>
                      {displayName}
                    </span>
                    <span className={`text-[9px] font-body ${statusCfg.textColor} flex-shrink-0`}>
                      {statusCfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Row 4 — Room badge */}
        {room && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-brand-dark/40" />
            <span className="text-[10px] md:text-[11px] text-brand-dark/40 font-body truncate max-w-[100px]">{room.name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Targets: React.FC = () => {
  const isMobile = useIsMobile();

  const queryClient = useQueryClient();
  // Use new React Query hooks
  const { data: roomsData, isLoading: roomsLoading, refetch: refetchRooms } = useRooms();
  const liveRooms = roomsData?.rooms || [];

  // Target groups - now using React Query hooks (replaces Zustand useTargetGroups store)
  const { groups, isLoading: groupsLoading, refetch: refetchGroups } = useTargetGroups();
  const createGroupMutation = useCreateTargetGroup();
  const updateGroupMutation = useUpdateTargetGroup();
  const deleteGroupMutation = useDeleteTargetGroup();
  const assignTargetsMutation = useAssignTargetsToGroup();
  const unassignTargetsMutation = useUnassignTargetsFromGroup();
  // Use new React Query hooks
  // Changed force to false - React Query will use cached data if available, reducing duplicate calls
  const { data: targetsData, isLoading: targetsStoreLoading, refetch: refetchTargets } = useTargets(false);
  const { data: targetDetailsData, isLoading: detailsLoading } = useTargetDetails(
    targetsData?.targets.map(t => t.id) || [],
    { includeHistory: false, telemetryKeys: ['hit_ts', 'hits', 'event'], recentWindowMs: 5 * 60 * 1000 },
    targetsData !== undefined
  );
  
  // Merge targets with details
  const storeTargets = useMemo(() => {
    return targetsData?.targets ? mergeTargetDetails(targetsData.targets, targetDetailsData || []) : [];
  }, [targetsData?.targets, targetDetailsData]);
  
  // Legacy compatibility functions
  const fetchTargetsFromEdge = async (force?: boolean) => {
    const result = await refetchTargets();
    // Return the fresh data from the refetch result, not the stale memoized value
    if (result.data?.targets) {
      return mergeTargetDetails(result.data.targets, targetDetailsData || []);
    }
    return storeTargets;
  };
  
  const fetchTargetDetails = useCallback(async (deviceIds: string[], options?: any) => {
    if (!deviceIds || deviceIds.length === 0) {
      return [];
    }

    const queryKey = targetsKeys.details(deviceIds, options);
    await queryClient.invalidateQueries({ queryKey });
    const results = await queryClient.refetchQueries({ queryKey, exact: true });

    return results;
  }, [queryClient]);
  
  // Local state
  const [targets, setTargets] = useState<Target[]>(storeTargets);
  const isLoading = roomsLoading || groupsLoading || targetsStoreLoading;

  // Fetch game history for hit totals (deferred, non-blocking, max 3 pages = 150 records)
  const { data: gameHistoryData, isLoading: hitTotalsLoading } = useGameHistory({
    pageSize: 50,
    maxPages: 3,
  });

  // Aggregate hit totals per device from game history
  const targetHitTotals = useMemo(() => {
    if (!gameHistoryData?.length) return {};
    const totals: Record<string, number> = {};
    for (const entry of gameHistoryData) {
      const seen = new Set<string>();
      if (Array.isArray(entry.targetStats)) {
        for (const stat of entry.targetStats) {
          const deviceId = stat?.deviceId;
          const hits = Number(stat?.hitCount ?? 0);
          if (!deviceId || !Number.isFinite(hits)) continue;
          totals[deviceId] = (totals[deviceId] ?? 0) + hits;
          seen.add(deviceId);
        }
      }
      if (Array.isArray(entry.deviceResults)) {
        for (const result of entry.deviceResults) {
          const deviceId = result?.deviceId;
          if (!deviceId || seen.has(deviceId)) continue;
          const hits = Number(result?.hitCount ?? 0);
          if (!Number.isFinite(hits)) continue;
          totals[deviceId] = (totals[deviceId] ?? 0) + hits;
        }
      }
    }
    return totals;
  }, [gameHistoryData]);
  
  // Use live rooms
  const rooms = liveRooms;
  const [searchTerm, setSearchTerm] = useState('');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [groupIdToAddTargets, setGroupIdToAddTargets] = useState<string | null>(null);
  const [renamingTargetId, setRenamingTargetId] = useState<string | null>(null);
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetRoomId, setNewTargetRoomId] = useState<string>('');
  const [customizingTargetId, setCustomizingTargetId] = useState<string | null>(null);
  const { data: customNames = new Map() } = useTargetCustomNames();

  // Check subscription status and log for debugging
  const { isPremium, tier, isLoading: subscriptionLoading } = useSubscription();
  const { user } = useAuth();
  const userEmail = user?.email ?? null;
  
  useEffect(() => {
    if (!subscriptionLoading) {
      logger.debug('[Targets] Subscription Status:', {
        tier,
        isPremium,
        canCustomize: isPremium,
      });
    }
  }, [isPremium, tier, subscriptionLoading, userEmail]);
  
  // Find the target being customized
  const customizingTarget = useMemo(() => {
    return customizingTargetId ? targets.find(t => t.id === customizingTargetId) : null;
  }, [customizingTargetId, targets]);

  const FETCH_DEBUG_DEFAULT = import.meta.env.DEV;

  const isFetchDebugEnabled = useCallback(() => {
    if (typeof window === 'undefined') {
      return FETCH_DEBUG_DEFAULT;
    }

    const flag = window.localStorage?.getItem('DEBUG_TARGET_FETCH');
    if (flag === 'true') {
      return true;
    }
    if (flag === 'false') {
      return false;
    }

    return FETCH_DEBUG_DEFAULT;
  }, [FETCH_DEBUG_DEFAULT]);

  // Sync targets from the shared store and ensure edge data is loaded
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setTargets(storeTargets);
  }, [storeTargets]);

  // Live target details: log fetched targets to console for debugging
  useEffect(() => {
    if (storeTargets.length === 0) return;
    const timestamp = new Date().toISOString();
    logger.debug('[Targets] Live target details fetched', {
      timestamp,
      count: storeTargets.length,
      targets: storeTargets.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        activityStatus: t.activityStatus,
        rawStatus: t.rawStatus,
        active: t.active,
        tbLastActivityTime: t.tbLastActivityTime,
        lastShotTime: t.lastShotTime,
        lastActivityTime: t.lastActivityTime,
        gameStatus: t.gameStatus,
        roomId: t.roomId,
      })),
    });
  }, [storeTargets]);


  const ensureTargets = useCallback(async (force = false) => {
    const debug = isFetchDebugEnabled();
    if (debug) {
      logger.info('[Targets] ensureTargets invoked', { force });
    }
    try {
      const fetchedTargets = await fetchTargetsFromEdge(force);
      if (debug) {
        logger.info('[Targets] ensureTargets fetched targets', {
          count: fetchedTargets?.length ?? 0,
          fromForce: force,
        });
      }
      setTargets(fetchedTargets);
      return fetchedTargets;
    } catch (error) {
      logger.error('❌ [Targets] Failed to fetch targets from edge:', error);
      if (debug) {
        logger.info('[Targets] ensureTargets encountered error', error);
      }
      if (force) {
        toast.error('Failed to refresh targets');
      }
      return undefined;
    }
  }, [fetchTargetsFromEdge, isFetchDebugEnabled]);

  const detailsFetchKeyRef = useRef<string>('');

  const targetIdsKey = useMemo(() => {
    if (!storeTargets.length) {
      return '';
    }
    return storeTargets
      .map((target) => target.id)
      .sort()
      .join(',');
  }, [storeTargets]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!targetIdsKey) {
      detailsFetchKeyRef.current = '';
      return;
    }

    const ids = targetIdsKey.split(',').filter(Boolean);
    if (ids.length === 0) {
      detailsFetchKeyRef.current = '';
      return;
    }

    const shouldForce = detailsFetchKeyRef.current !== targetIdsKey;
    const debug = isFetchDebugEnabled();

    const hydrateDetails = async () => {
      if (debug) {
        logger.info('[Targets] priming target details', { idsCount: ids.length, force: shouldForce });
      }
      try {
        const success = await fetchTargetDetails(ids, {
          includeHistory: true,
          historyRangeMs: 24 * 60 * 60 * 1000,
          recentWindowMs: 5 * 60 * 1000,
          force: shouldForce,
        });
        if (success) {
          detailsFetchKeyRef.current = targetIdsKey;
        } else if (shouldForce) {
          detailsFetchKeyRef.current = '';
        }
      } catch (error) {
        logger.error('❌ [Targets] Failed to hydrate target details', error);
      }
    };

    void hydrateDetails();
  }, [targetIdsKey, fetchTargetDetails, isFetchDebugEnabled]);

  // Removed duplicate initial fetch - React Query useTargets(true) already handles initial fetch
  // This eliminates duplicate targets-with-telemetry calls

  useEffect(() => {
    if (!liveRooms.length) {
      refetchRooms().catch(error => {
        logger.error('Failed to fetch rooms:', error);
      });
    }
  }, [liveRooms.length, refetchRooms]);

  // Note: React Query useTargetGroups() handles initial fetch automatically
  // Manual refetch is available via refetchGroups() if needed

  // Consolidated verification summary for easy comparison with check script.
  useEffect(() => {
    if (!targets.length) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const debugEnabled = localStorage.getItem('DEBUG_TARGET_VERIFICATION') === 'true';
    if (!debugEnabled) {
      return;
    }

    const activeTargetsLocal = targets.filter(target => target.activityStatus === 'active');
    const recentTargetsLocal = targets.filter(target => target.activityStatus === 'recent');
    const standbyTargetsLocal = targets.filter(target => (target.activityStatus ?? 'standby') === 'standby');
    const recentShotsAggregate = targets.reduce((acc, target) => acc + (target.recentShotsCount ?? 0), 0);

    const timestamp = new Date().toISOString();
    logger.debug('='.repeat(80));
    logger.debug(`🔍 [VERIFICATION] Shot Records Summary - ${timestamp}`);
    logger.debug('='.repeat(80));

    logger.debug('📊 [VERIFICATION] System Status:', {
      mode: 'LIVE',
      totalTargets: targets.length,
      onlineTargets: targets.filter(t => t.status === 'online' || t.status === 'standby').length,
      standbyTargets: standbyTargetsLocal.length,
      offlineTargets: targets.filter(t => t.status === 'offline').length,
      activeShooters: activeTargetsLocal.length,
      recentlyActiveTargets: recentTargetsLocal.length,
      recentActivity: recentShotsAggregate,
    });

    logger.debug('📊 [VERIFICATION] Target Details:');
    targets.forEach((target, index) => {
      const mergedShots = target.totalShots ?? 0;
      const mergedShotTime = target.lastShotTime ?? null;

      logger.debug(`  ${index + 1}. ${target.name} (${target.id}):`, {
        status: target.status,
        activityStatus: target.activityStatus,
        roomId: target.roomId || 'unassigned',
        deviceName: target.deviceName,
        deviceType: target.deviceType,
        battery: target.battery,
        wifiStrength: target.wifiStrength,
        totalShots: mergedShots,
        lastShotTime: mergedShotTime ?? 0,
        lastShotTimeReadable: mergedShotTime ? new Date(mergedShotTime).toISOString() : 'Never'
      });
    });

    logger.debug('📊 [VERIFICATION] Data Flow Summary:');
    logger.debug('  1. Supabase Edge → target-details → Telemetry & history');
    logger.debug('  2. Targets store → Merge edge data into shared state');
    logger.debug('  3. Targets Page → Render shared state across views');

    logger.debug('📊 [VERIFICATION] Key Verification Points:');
    logger.debug('  • Check that totalShots matches ThingsBoard hits value');
    logger.debug('  • Check that lastShotTime matches ThingsBoard hit_ts value');
    logger.debug('  • Check that activity status reflects actual data');
    logger.debug('  • Compare with check script output for device names and IDs');

    logger.debug('='.repeat(80));
  }, [targets]);

  // Handle cache updates

  // Handle refresh
  const handleRefresh = async () => {
    logger.debug('🔄 Refreshing targets from edge cache...');

    try {
      const refreshedTargets = await ensureTargets(true);
      const selectedTargets = Array.isArray(refreshedTargets) && refreshedTargets.length > 0
        ? refreshedTargets
        : storeTargets;

      const ids = selectedTargets.map((target) => target.id);
      const idsKey = ids.slice().sort().join(',');

      const tasks: Array<Promise<unknown>> = [refetchRooms()];

      if (ids.length > 0) {
        tasks.push(fetchTargetDetails(ids, {
          includeHistory: true,
          historyRangeMs: 24 * 60 * 60 * 1000,
          recentWindowMs: 5 * 60 * 1000,
          force: true,
        }).then(() => {
          detailsFetchKeyRef.current = idsKey;
        }));
      }

      await Promise.all(tasks);
      toast.success('🔗 Targets refreshed');
    } catch (error) {
      logger.error('❌ [Targets] Refresh failed', error);
      toast.error('Failed to refresh targets');
    }
  };

  // Merge custom names with targets
  const targetsWithCustomNames = useMemo(() => {
    return targets.map(target => ({
      ...target,
      customName: customNames.get(target.id) || null,
      displayName: customNames.get(target.id) || target.name
    }));
  }, [targets, customNames]);

  // Merge custom names with group targets
  const groupsWithCustomNames = useMemo(() => {
    return groups.map(group => ({
      ...group,
      targets: group.targets?.map(target => {
        const customName = customNames.get(target.id);
        return {
          ...target,
          customName: customName || null,
          displayName: customName || target.name
        };
      })
    }));
  }, [groups, customNames]);

  // Get targets that belong to groups
  const targetsInGroups = useMemo(() => {
    const groupTargetIds = new Set<string>();
    groupsWithCustomNames.forEach(group => {
      group.targets?.forEach(target => {
        groupTargetIds.add(target.id);
      });
    });
    return groupTargetIds;
  }, [groupsWithCustomNames]);

  // Get available targets for adding to a specific group (excludes targets already in that group)
  const getAvailableTargetsForGroup = useCallback((groupId: string) => {
    const group = groupsWithCustomNames.find(g => g.id === groupId);
    const groupTargetIds = new Set(group?.targets?.map(t => t.id) || []);
    
    return targetsWithCustomNames
      .filter(target => !groupTargetIds.has(target.id))
      .map(target => ({
        id: target.id,
        name: target.displayName || target.name,
        status: target.status,
        activityStatus: target.activityStatus,
      }));
  }, [targetsWithCustomNames, groupsWithCustomNames]);

  // Get the current group being edited
  const currentGroupForAdding = useMemo(() => {
    return groupIdToAddTargets 
      ? groupsWithCustomNames.find(g => g.id === groupIdToAddTargets)
      : null;
  }, [groupIdToAddTargets, groupsWithCustomNames]);

  // Pre-build a Set of target IDs for the selected group filter (O(1) lookups instead of nested .some())
  const groupFilterTargetIds = useMemo(() => {
    if (groupFilter === 'all' || groupFilter === 'ungrouped' || groupFilter === 'grouped') return null;
    const group = groupsWithCustomNames.find(g => g.id === groupFilter);
    return new Set(group?.targets?.map(t => t.id) ?? []);
  }, [groupFilter, groupsWithCustomNames]);

  // Memoized filter → deduplicate → group → sort pipeline
  const sortedGroupedTargets = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();

    // 1. Filter
    const filtered = targetsWithCustomNames.filter(target => {
      const matchesSearch = !searchTerm ||
        target.displayName.toLowerCase().includes(searchLower) ||
        target.name.toLowerCase().includes(searchLower);
      const matchesRoom = roomFilter === 'all' ||
        (roomFilter === 'unassigned' && !target.roomId) ||
        (target.roomId && target.roomId.toString() === roomFilter);
      const matchesGroup = groupFilter === 'all' ||
        (groupFilter === 'ungrouped' && !targetsInGroups.has(target.id)) ||
        (groupFilter === 'grouped' && targetsInGroups.has(target.id)) ||
        (groupFilterTargetIds !== null && groupFilterTargetIds.has(target.id));
      return matchesSearch && matchesRoom && matchesGroup;
    });

    // 2. Deduplicate by ID (use Map for O(n) instead of O(n²) findIndex)
    const seenMap = new Map<string, Target>();
    for (const target of filtered) {
      const existing = seenMap.get(target.id);
      if (!existing) {
        seenMap.set(target.id, target);
      } else if (target.roomId && !existing.roomId) {
        seenMap.set(target.id, target);
      }
    }
    const unique = Array.from(seenMap.values());

    // 3. Group by room
    const grouped: Record<string, Target[]> = {};
    for (const target of unique) {
      const rawRoomId = target.roomId;
      const roomIdStr = String(rawRoomId);
      const roomId = (!rawRoomId || roomIdStr === 'unassigned' || roomIdStr === '' || roomIdStr === 'null' || roomIdStr === 'undefined')
        ? 'unassigned'
        : roomIdStr;
      if (!grouped[roomId]) grouped[roomId] = [];
      grouped[roomId].push(target);
    }

    // 4. Sort room keys: assigned rooms alphabetically, unassigned last
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'unassigned') return 1;
      if (b === 'unassigned') return -1;
      const nameA = rooms.find(r => r.id === a)?.name || a;
      const nameB = rooms.find(r => r.id === b)?.name || b;
      return nameA.localeCompare(nameB);
    });

    // 5. Sort targets within each room group
    const result: Record<string, Target[]> = {};
    for (const key of sortedKeys) {
      result[key] = [...grouped[key]].sort((a, b) => {
        const aOnline = a.status === 'online' || a.status === 'standby';
        const bOnline = b.status === 'online' || b.status === 'standby';
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
        return a.name.localeCompare(b.name);
      });
    }

    return result;
  }, [targetsWithCustomNames, searchTerm, roomFilter, groupFilter, groupFilterTargetIds, targetsInGroups, rooms]);

  // Get room object for display
  const getRoom = (roomId?: string | number) => {
    if (!roomId) return null;
    return rooms.find(room => String(room.id) === String(roomId));
  };

  // Handle group creation
  const handleCreateGroup = async (groupData: {
    name: string;
    roomId?: string | null;
    targetIds: string[];
  }) => {
    await createGroupMutation.mutateAsync({
      name: groupData.name,
      roomId: groupData.roomId,
      targetIds: groupData.targetIds
    });
  };

  // Handle group deletion
  const handleDeleteGroup = async (groupId: string) => {
    if (confirm('Are you sure you want to delete this group? Targets will remain but will be ungrouped.')) {
      await deleteGroupMutation.mutateAsync(groupId);
    }
  };

  // Handle removing a target from a group
  const handleRemoveTargetFromGroup = async (groupId: string, targetId: string) => {
    try {
      await unassignTargetsMutation.mutateAsync({ groupId, targetIds: [targetId] });
    } catch (error) {
      logger.error('Failed to remove target from group:', error);
    }
  };

  // Handle adding targets to a group
  const handleAddTargetsToGroup = async (groupId: string, targetIds: string[]) => {
    try {
      await assignTargetsMutation.mutateAsync({ groupId, targetIds });
      setGroupIdToAddTargets(null);
    } catch (error) {
      logger.error('Failed to add targets to group:', error);
    }
  };

  // Handle opening add targets modal
  const handleOpenAddTargetsModal = (groupId: string) => {
    setGroupIdToAddTargets(groupId);
  };

  // Handle group update
  const handleUpdateGroup = async (groupId: string, updates: { name?: string; roomId?: string | null }) => {
    await updateGroupMutation.mutateAsync({ groupId, updates });
  };

  // Handle target rename
  const handleRenameTarget = async (targetId: string, customName: string) => {
    queryClient.invalidateQueries({ queryKey: targetsKeys.customNames() });
    
    // Update targets store
    setTargets(prevTargets => 
      prevTargets.map(t => 
        t.id === targetId 
          ? { ...t, customName: customName !== t.name ? customName : null }
          : t
      )
    );
  };

  // Handle target actions
  const handleCreateTarget = async () => {
    if (!newTargetName.trim()) {
      toast.error('Target name is required');
      return;
    }
    
    toast.error('Create target not implemented with ThingsBoard yet');
    
    setNewTargetName('');
    setNewTargetRoomId('');
    setIsAddDialogOpen(false);
  };

  // Remove simple loading spinner - use inline conditional rendering instead

  // Compute stat card counts
  // "Active" = online (in game), "Ready" = standby (powered on, idle), "Offline" = disconnected
  const activeCount = targets.filter(t => t.status === 'online').length;
  const readyCount = targets.filter(t => t.status === 'standby').length;
  const offlineCount = targets.filter(t => t.status === 'offline').length;
  const unassignedCount = targets.filter(t => !t.roomId).length;

  const targetStatCards = [
    {
      title: 'Total Targets',
      value: targets.length,
      subtitle: 'Registered devices',
      icon: <TargetIcon className="w-4 h-4" />,
    },
    {
      title: 'Ready',
      value: readyCount + activeCount,
      subtitle: activeCount > 0 ? `${activeCount} in game` : 'Powered on & idle',
      icon: <Wifi className="w-4 h-4" />,
    },
    {
      title: 'Offline',
      value: offlineCount,
      subtitle: offlineCount > 0 ? 'Not reachable' : 'All devices connected',
      icon: <WifiOff className="w-4 h-4" />,
    },
    {
      title: 'Unassigned',
      value: unassignedCount,
      subtitle: 'No room assigned',
      icon: <MapPin className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-brand-light responsive-container pt-[116px] lg:pt-16">
      <Header />
      {isMobile && <MobileDrawer />}
      {!isMobile && <Sidebar />}
      <div className="flex flex-1 no-overflow lg:pl-64">
        <main className="flex-1 overflow-y-auto responsive-container">
          <div className="w-full px-4 py-2 md:p-4 lg:p-6 md:max-w-7xl md:mx-auto space-y-2 md:space-y-4 lg:space-y-6 responsive-transition h-full">

            {/* Page Header */}
            <div>
              <div className="flex items-center justify-between gap-2 md:gap-4">
                <h1 className="text-xl md:text-3xl font-heading font-semibold text-brand-dark text-left">Targets</h1>
                <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsCreateGroupModalOpen(true)}
                    className="md:h-10 md:px-5 md:text-sm"
                  >
                    <Users className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Create Group</span>
                  </Button>
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-brand-primary hover:bg-brand-primary/90 text-white md:h-10 md:px-5 md:text-sm">
                        <Plus className="h-4 w-4 md:mr-2" />
                        <span className="hidden md:inline">Add Target</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle className="font-heading">Add New Target</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="target-name" className="text-label text-brand-secondary font-body uppercase tracking-wide">Target Name</Label>
                          <Input
                            id="target-name"
                            value={newTargetName}
                            onChange={(e) => setNewTargetName(e.target.value)}
                            placeholder="Enter target name"
                            className="bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark placeholder:text-brand-dark/40 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/30 font-body h-10"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="target-room" className="text-label text-brand-secondary font-body uppercase tracking-wide">Room (Optional)</Label>
                          <Select value={newTargetRoomId} onValueChange={setNewTargetRoomId}>
                            <SelectTrigger className="bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark">
                              <SelectValue placeholder="Select a room" />
                            </SelectTrigger>
                            <SelectContent className="bg-white shadow-lg border-0">
                              <SelectItem value="none">No Room</SelectItem>
                              {rooms.map(room => (
                                <SelectItem key={room.id} value={room.id.toString()}>
                                  {room.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={handleCreateTarget}
                          className="bg-brand-primary hover:bg-brand-primary/90 text-white"
                        >
                          Create Target
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <p className="text-sm text-brand-dark/55 font-body mt-0.5 text-left">Manage your shooting targets and monitor their status</p>
              {/* Status Legend */}
              <div className="flex items-center gap-3 md:gap-4 pt-0.5">
                {(['online', 'standby', 'offline'] as const).map((s) => {
                  const cfg = TARGET_STATUS_DISPLAY[s];
                  return (
                    <div key={s} className="flex items-center gap-1 md:gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                      <span className="text-[10px] md:text-xs text-brand-dark/50 font-body">{cfg.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stat Cards Row */}
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="shadow-card bg-gradient-to-br from-white via-white to-brand-primary/[0.04]">
                    <CardContent className="p-3 md:p-5 lg:p-6 animate-pulse">
                      <div className="flex items-center justify-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
                        <div className="w-3.5 h-3.5 md:w-4 md:h-4 bg-gray-200 rounded" />
                        <div className="h-3 w-16 md:w-20 bg-gray-200 rounded" />
                      </div>
                      <div className="h-6 md:h-10 w-10 md:w-24 bg-gray-200 rounded mt-1 mx-auto" />
                      <div className="h-2.5 md:h-3 w-20 md:w-28 bg-gray-200 rounded mt-1.5 md:mt-2 mx-auto" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
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
            )}

            {/* Search and Filters */}
            {isLoading ? (
              <div className="space-y-2 md:space-y-0 md:flex md:flex-row md:gap-4">
                <div className="flex-1 h-10 bg-gray-200 rounded-full animate-pulse" />
                <div className="grid grid-cols-2 gap-2 md:flex md:gap-4">
                  <div className="h-10 bg-gray-200 rounded animate-pulse md:w-48" />
                  <div className="h-10 bg-gray-200 rounded animate-pulse md:w-48" />
                </div>
              </div>
            ) : (
              <div className="space-y-2 md:space-y-0 md:flex md:flex-row md:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-dark/30" />
                  <Input
                    placeholder="Search targets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-11 bg-white border border-[rgba(28,25,43,0.1)] rounded-full text-brand-dark placeholder:text-brand-dark/40 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/30 font-body h-10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 md:flex md:gap-4">
                  <Select value={roomFilter} onValueChange={setRoomFilter}>
                    <SelectTrigger className="w-full md:w-48 bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark text-xs md:text-sm h-9 md:h-10">
                      <SelectValue placeholder="Room" />
                    </SelectTrigger>
                    <SelectContent className="bg-white shadow-lg border-0">
                      <SelectItem value="all">All Rooms</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {rooms.map(room => (
                        <SelectItem key={room.id} value={room.id.toString()}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={groupFilter} onValueChange={setGroupFilter}>
                    <SelectTrigger className="w-full md:w-48 bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark text-xs md:text-sm h-9 md:h-10">
                      <SelectValue placeholder="Group" />
                    </SelectTrigger>
                    <SelectContent className="bg-white shadow-lg border-0">
                      <SelectItem value="all">All Groups</SelectItem>
                      <SelectItem value="ungrouped">Ungrouped</SelectItem>
                      <SelectItem value="grouped">Grouped</SelectItem>
                      {groupsWithCustomNames.map(group => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Groups Section — only visible when groups exist */}
            {!isLoading && groupsWithCustomNames.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand-primary" />
                    <h2 className="text-base font-heading font-semibold text-brand-dark">Groups</h2>
                    <span className="text-[10px] text-brand-dark/40 font-body">
                      {groupsWithCustomNames.length} group{groupsWithCustomNames.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <motion.div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {groupsWithCustomNames.map((group) => (
                    <motion.div key={group.id} variants={itemVariants}>
                      <GroupCard
                        group={group}
                        room={group.roomId ? getRoom(group.roomId) : null}
                        allTargets={targetsWithCustomNames}
                        onAddTargets={handleAddTargetsToGroup}
                        onRemoveTarget={handleRemoveTargetFromGroup}
                        onDelete={handleDeleteGroup}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            )}

            {/* Targets Grid */}
            {isLoading ? (
              <div className="space-y-4 md:space-y-8">
                {[...Array(2)].map((_, sectionIndex) => (
                  <div key={sectionIndex}>
                    <div className="flex items-center justify-between mb-2 md:mb-4">
                      <div className="flex items-center gap-1.5 md:gap-3">
                        <div className="h-4 md:h-5 w-24 md:w-40 bg-gray-200 rounded animate-pulse" />
                        <div className="h-3 md:h-4 w-8 md:w-16 bg-gray-200 rounded animate-pulse" />
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <div className="h-2.5 md:h-3 w-14 md:w-20 bg-gray-200 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 lg:gap-5">
                      {[...Array(3)].map((_, cardIndex) => (
                        <Card key={cardIndex} className="shadow-card bg-gradient-to-br from-white via-white to-brand-primary/[0.04]">
                          <CardContent className="p-3 md:p-5 animate-pulse">
                            <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                              <div className="w-2 h-2 rounded-full bg-gray-200" />
                              <div className="h-3.5 md:h-4 w-20 md:w-28 bg-gray-200 rounded" />
                              <div className="ml-auto h-5 w-5 md:h-6 md:w-6 bg-gray-200 rounded" />
                            </div>
                            <div className="text-center mb-2 md:mb-3">
                              <div className="h-2.5 md:h-3 w-14 md:w-16 bg-gray-200 rounded mx-auto mb-1" />
                              <div className="h-5 md:h-7 w-14 md:w-20 bg-gray-200 rounded mx-auto" />
                            </div>
                            <div className="flex items-center justify-center gap-2 md:gap-4 mb-1.5 md:mb-2">
                              <div className="h-2.5 md:h-3 w-12 md:w-16 bg-gray-200 rounded" />
                              <div className="h-2.5 md:h-3 w-14 md:w-20 bg-gray-200 rounded" />
                            </div>
                            <div className="h-2.5 md:h-3 w-24 md:w-32 bg-gray-200 rounded mx-auto" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : Object.keys(sortedGroupedTargets).length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="p-8 md:p-12 text-center">
                  <TargetIcon className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 md:mb-4 text-brand-dark/40" />
                  <h3 className="text-base md:text-lg font-heading text-brand-dark mb-1.5 md:mb-2">No targets found</h3>
                  <p className="text-xs md:text-sm text-brand-dark/40 font-body mb-4 md:mb-6">
                    {searchTerm || roomFilter !== 'all'
                      ? 'Try adjusting your search or filter criteria.'
                      : 'Get started by adding your first target device.'
                    }
                  </p>
                  {!searchTerm && roomFilter === 'all' && (
                    <Button
                      size="sm"
                      onClick={() => setIsAddDialogOpen(true)}
                      className="bg-brand-primary hover:bg-brand-primary/90 text-white md:h-10 md:px-5 md:text-sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Target
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4 md:space-y-8">
                {Object.entries(sortedGroupedTargets).map(([roomId, roomTargets]: [string, Target[]]) => {
                  const room = roomId !== 'unassigned' ? getRoom(roomId) : null;

                  return (
                    <div key={roomId}>
                      {/* Room Section Header */}
                      <div className="flex items-center justify-between mb-2 md:mb-4">
                        <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
                          <h2 className="text-sm md:text-base font-heading font-semibold text-brand-dark truncate">
                            {room ? room.name : 'Unassigned'}
                          </h2>
                          <span className="text-[10px] md:text-label text-brand-secondary font-body uppercase tracking-wide shrink-0">
                            {roomTargets.length}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] text-brand-dark font-body shrink-0">
                          {roomTargets.some(t => t.status === 'online') && (
                            <div className="flex items-center gap-1">
                              <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${TARGET_STATUS_DISPLAY.online.dotColor}`} />
                              <span>{roomTargets.filter(t => t.status === 'online').length} {TARGET_STATUS_DISPLAY.online.label.toLowerCase()}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${TARGET_STATUS_DISPLAY.standby.dotColor}`} />
                            <span>{roomTargets.filter(t => t.status === 'standby').length} {TARGET_STATUS_DISPLAY.standby.label.toLowerCase()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${TARGET_STATUS_DISPLAY.offline.dotColor}`} />
                            <span>{roomTargets.filter(t => t.status === 'offline').length} {TARGET_STATUS_DISPLAY.offline.label.toLowerCase()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Staggered target card grid */}
                      <motion.div
                        className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 lg:gap-5"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        {roomTargets.map((target, index) => {
                          const targetKey = target.id || `target-${index}`;
                          const aggregatedHits = targetHitTotals[target.id];

                          return (
                            <motion.div key={targetKey} variants={itemVariants}>
                              <TargetCard
                                target={target}
                                room={room}
                                onEdit={() => {
                                  toast.info('Edit functionality coming soon');
                                }}
                                onRename={() => {
                                  setRenamingTargetId(target.id);
                                }}
                                onDelete={() => {
                                  toast.info('Delete functionality coming soon');
                                }}
                                onCustomize={() => {
                                  setCustomizingTargetId(target.id);
                                }}
                                totalHitCount={aggregatedHits}
                                isHitTotalsLoading={hitTotalsLoading}
                              />
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </main>
      </div>
      
      {/* Rename Target Dialog */}
      {renamingTargetId && (() => {
        const target = targets.find(t => t.id === renamingTargetId);
        if (!target) return null;
        return (
          <RenameTargetDialog
            isOpen={!!renamingTargetId}
            onClose={() => setRenamingTargetId(null)}
            targetId={target.id}
            originalName={target.name}
            currentCustomName={customNames.get(target.id) || null}
            onRename={handleRenameTarget}
          />
        );
      })()}

      {/* Target Customization Dialog */}
      {customizingTarget && (
        <TargetCustomizationDialog
          targetId={customizingTarget.id}
          targetName={customizingTarget.name}
          isOpen={!!customizingTargetId}
          onClose={() => setCustomizingTargetId(null)}
        />
      )}

      {/* Create Group Modal — only mounted when open */}
      {isCreateGroupModalOpen && (
        <CreateGroupModal
          isOpen={isCreateGroupModalOpen}
          onClose={() => setIsCreateGroupModalOpen(false)}
          onCreateGroup={handleCreateGroup}
          availableTargets={targetsWithCustomNames
            .filter(target => !targetsInGroups.has(target.id))
            .map(target => ({
              id: target.id,
              name: target.displayName || target.name,
              status: target.status,
              activityStatus: target.activityStatus,
            }))}
          rooms={rooms}
        />
      )}

      {/* Add Targets to Group Modal */}
      {currentGroupForAdding && (
        <AddTargetsToGroupModal
          isOpen={!!groupIdToAddTargets}
          onClose={() => setGroupIdToAddTargets(null)}
          onAddTargets={(targetIds) => handleAddTargetsToGroup(currentGroupForAdding.id, targetIds)}
          availableTargets={getAvailableTargetsForGroup(currentGroupForAdding.id)}
          groupName={currentGroupForAdding.name}
        />
      )}
    </div>
  );
};

export default Targets;
