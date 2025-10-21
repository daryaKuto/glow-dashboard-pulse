import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Gamepad2,
  Play,
  Square,
  Plus,
  Wifi,
  WifiOff,
  AlertCircle,
  Activity,
  Target as TargetIcon,
  ArrowLeft,
  Trophy
} from 'lucide-react';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/components/ui/sonner';
import { subscribeToGameTelemetry, type TelemetryEnvelope } from '@/services/gameTelemetry';
import type { DeviceStatus, GameHistory } from '@/services/device-game-flow';
import {
  fetchGameControlDevices,
  fetchTargetDetails,
  invokeGameControl,
  type GameControlDevice,
} from '@/lib/edge';
import type { Target } from '@/store/useTargets';

type GameStage = 'main-dashboard' | 'game-control';

type HitRecord = {
  deviceId: string;
  deviceName: string;
  timestamp: number;
  gameId: string;
};

const Games: React.FC = () => {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentStage, setCurrentStage] = useState<GameStage>('main-dashboard');

  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [availableDevices, setAvailableDevices] = useState<DeviceStatus[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [totalShotsFromThingsBoard, setTotalShotsFromThingsBoard] = useState<number>(0);
  const [loadingTotalShots, setLoadingTotalShots] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isStoppingGame, setIsStoppingGame] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [gameStopTime, setGameStopTime] = useState<number | null>(null);
  const [hitCounts, setHitCounts] = useState<Record<string, number>>({});
  const [hitHistory, setHitHistory] = useState<HitRecord[]>([]);

  const telemetryUnsubscribeRef = useRef<(() => void) | null>(null);
  const currentGameDevicesRef = useRef<string[]>([]);
  const availableDevicesRef = useRef<DeviceStatus[]>([]);

  const mapEdgeDeviceToStatus = useCallback((device: GameControlDevice): DeviceStatus => {
    const isOnline = Boolean(device.isOnline);
    const rawGameStatus = (device.gameStatus ?? device.status ?? '').toString().toLowerCase();

    let gameStatus: DeviceStatus['gameStatus'] = 'idle';
    if (!isOnline) {
      gameStatus = 'offline';
    } else if (rawGameStatus === 'start' || rawGameStatus === 'busy') {
      gameStatus = 'start';
    } else if (rawGameStatus === 'stop') {
      gameStatus = 'stop';
    } else {
      gameStatus = 'idle';
    }

    const ambientValue = (device.ambientLight ?? '').toString().toLowerCase();
    let ambientLight: DeviceStatus['ambientLight'];
    if (ambientValue === 'average') {
      ambientLight = 'average';
    } else if (ambientValue === 'poor') {
      ambientLight = 'poor';
    } else {
      ambientLight = 'good';
    }

    const wifi = Number(device.wifiStrength ?? 0);
    const hitCount = Number(device.hitCount ?? 0);
    const lastSeen = typeof device.lastSeen === 'number' && Number.isFinite(device.lastSeen)
      ? device.lastSeen
      : 0;

    return {
      deviceId: device.deviceId,
      name: device.name,
      gameStatus,
      wifiStrength: Number.isFinite(wifi) ? Math.max(0, Math.round(wifi)) : 0,
      ambientLight,
      hitCount: Number.isFinite(hitCount) ? hitCount : 0,
      lastSeen,
      isOnline,
      hitTimes: [],
    };
  }, []);

  const loadLiveDevices = useCallback(
    async ({ silent = false, showToast = false }: { silent?: boolean; showToast?: boolean } = {}) => {
      if (!silent) {
        setLoadingDevices(true);
      }

      try {
        const { devices } = await fetchGameControlDevices();
        const mapped = devices.map(mapEdgeDeviceToStatus);

        setAvailableDevices(mapped);
        availableDevicesRef.current = mapped;
        setErrorMessage(null);

        if (!isGameRunning) {
          const baseline: Record<string, number> = {};
          mapped.forEach((device) => {
            baseline[device.deviceId] = device.hitCount ?? 0;
          });
          setHitCounts(baseline);
        } else {
          setHitCounts((prev) => {
            const next = { ...prev };
            mapped.forEach((device) => {
              if (!(device.deviceId in next)) {
                next[device.deviceId] = device.hitCount ?? 0;
              }
            });
            return next;
          });
        }

        if (showToast) {
          const onlineCount = mapped.filter((device) => device.isOnline).length;
          const total = mapped.length;
          const offlineCount = total - onlineCount;

          if (total === 0) {
            toast.warning('🔗 No devices found in ThingsBoard');
          } else if (onlineCount === 0) {
            toast.warning('🔗 All devices are currently offline', {
              description: 'At least one online device is required to start a game.',
            });
          } else if (offlineCount > 0) {
            toast.info(`🔗 ${onlineCount} online, ${offlineCount} offline devices found`);
          } else {
            toast.success(`🔗 ${onlineCount} devices online and ready for games`);
          }
        }
      } catch (error) {
        console.error('❌ Failed to load live device data:', error);
        if (showToast) {
          toast.error('Failed to refresh device list');
        }
        if (!silent) {
          setErrorMessage('Failed to load live device data. Please try again.');
        }
        setAvailableDevices([]);
        availableDevicesRef.current = [];
      } finally {
        if (!silent) {
          setLoadingDevices(false);
        }
      }
    },
    [isGameRunning, mapEdgeDeviceToStatus],
  );

  useEffect(() => {
    availableDevicesRef.current = availableDevices;
  }, [availableDevices]);

  useEffect(() => {
    void loadLiveDevices();
  }, [loadLiveDevices]);

  useEffect(() => {
    if (currentStage === 'game-control') {
      void loadLiveDevices();
    }
  }, [currentStage, loadLiveDevices]);

  useEffect(() => {
    const intervalMs = isGameRunning ? 3_000 : 10_000;
    const interval = setInterval(() => {
      void loadLiveDevices({ silent: true });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isGameRunning, loadLiveDevices]);

  const fetchTotalShots = useCallback(async () => {
    setLoadingTotalShots(true);
    try {
      const { useTargets } = await import('@/store/useTargets');
      const targets = useTargets.getState().targets as Target[];
      let totalShots = 0;

      const deviceIds = targets.map((target) =>
        typeof target.id === 'string'
          ? target.id
          : (target.id as { id: string })?.id || String(target.id),
      );

      if (deviceIds.length > 0) {
        const { details } = await fetchTargetDetails(deviceIds, {
          includeHistory: false,
          telemetryKeys: ['hits'],
        });

        totalShots = details.reduce((sum, detail) => {
          const hitsArray = Array.isArray(detail.telemetry?.hits) ? detail.telemetry.hits : [];
          if (hitsArray.length === 0) {
            return sum;
          }

          const latest = hitsArray[0]?.value ?? hitsArray[0];
          const numeric = Number(latest);
          return Number.isFinite(numeric) ? sum + numeric : sum;
        }, 0);
      }

      setTotalShotsFromThingsBoard(totalShots);
    } catch (error) {
      console.error('Failed to fetch total shots:', error);
    } finally {
      setLoadingTotalShots(false);
    }
  }, []);

  useEffect(() => {
    void fetchTotalShots();
  }, [fetchTotalShots]);

  useEffect(() => {
    return () => {
      telemetryUnsubscribeRef.current?.();
    };
  }, []);

  const getOnlineDevices = useCallback(() => {
    return availableDevicesRef.current.filter(device => device.isOnline);
  }, []);

  const handleTelemetryMessage = useCallback(
    (message: TelemetryEnvelope) => {
      if (!message.data || !isGameRunning || !currentGameId) {
        return;
      }

      const telemetryData = message.data as Record<string, unknown>;
      const eventPayload = telemetryData.event;
      const eventValue = Array.isArray(eventPayload) ? eventPayload[0]?.[1] : eventPayload;

      if (eventValue !== 'hit') {
        return;
      }

      const gameIdPayload = telemetryData.gameId;
      const gameIdValue = Array.isArray(gameIdPayload) ? gameIdPayload[0]?.[1] : gameIdPayload;

      if (gameIdValue !== currentGameId) {
        return;
      }

      const deviceId = message.entityId;
      if (!deviceId || !currentGameDevicesRef.current.includes(deviceId)) {
        return;
      }

      const deviceInfo = availableDevicesRef.current.find(device => device.deviceId === deviceId);
      const deviceName = deviceInfo?.name ?? deviceId;
      const timestamp = Date.now();

      setHitCounts(prev => ({
        ...prev,
        [deviceId]: (prev[deviceId] ?? 0) + 1
      }));

      setHitHistory(prev => [
        ...prev,
        {
          deviceId,
          deviceName,
          timestamp,
          gameId: currentGameId
        }
      ]);

      setAvailableDevices(prev =>
        prev.map(device => {
          if (device.deviceId !== deviceId) {
            return device;
          }

          return {
            ...device,
            gameStatus: 'start',
            hitCount: (device.hitCount ?? 0) + 1,
            hitTimes: [...(device.hitTimes ?? []), timestamp],
            lastSeen: timestamp
          };
        })
      );
    },
    [currentGameId, isGameRunning]
  );

  const handleStartGame = useCallback(async () => {
    if (isStartingGame || isGameRunning) {
      return;
    }

    await loadLiveDevices({ silent: true });
    const onlineDevices = getOnlineDevices();
    if (onlineDevices.length === 0) {
      setErrorMessage('No online devices available to start a game.');
      toast.error('No online devices available to start a game.');
      return;
    }

    setIsStartingGame(true);
    setErrorMessage(null);

    const tentativeGameId = `GM-${Date.now()}`;

    try {
      const response = await invokeGameControl('start', {
        deviceIds: onlineDevices.map((device) => device.deviceId),
        gameId: tentativeGameId,
      });

      const results = response.results ?? [];
      const successfulIds = results.filter((result) => result.success).map((result) => result.deviceId);
      const warnedIds = results.filter((result) => result.success && result.warning).map((result) => result.deviceId);
      const failedIds = results.filter((result) => !result.success).map((result) => result.deviceId);

      if (successfulIds.length === 0) {
        setErrorMessage('Failed to start game on the selected devices.');
        toast.error('Failed to start game on the selected devices.');
        return;
      }

      telemetryUnsubscribeRef.current?.();
      currentGameDevicesRef.current = successfulIds;

      const startedAt = response.startedAt ?? Date.now();
      const gameId = response.gameId ?? tentativeGameId;

      setCurrentGameId(gameId);
      setIsGameRunning(true);
      setGameStartTime(startedAt);
      setGameStopTime(null);
      setHitCounts(Object.fromEntries(successfulIds.map((id) => [id, 0])));
      setHitHistory([]);

      telemetryUnsubscribeRef.current = subscribeToGameTelemetry(
        successfulIds,
        handleTelemetryMessage,
        { realtime: true },
      );

      await loadLiveDevices({ silent: true });

      toast.success(`Game started (${successfulIds.length}/${onlineDevices.length} devices).`);
      if (warnedIds.length > 0) {
        toast.warning(`${warnedIds.length} device(s) reported a timeout but should still receive the command.`);
      }
      if (failedIds.length > 0) {
        toast.error(`${failedIds.length} device(s) failed to start.`);
      }
    } catch (error) {
      console.error('Failed to start game:', error);
      setErrorMessage('Failed to start game. Please try again.');
      toast.error('Failed to start game.');
    } finally {
      setIsStartingGame(false);
    }
  }, [
    getOnlineDevices,
    handleTelemetryMessage,
    isGameRunning,
    isStartingGame,
    loadLiveDevices,
  ]);

  const handleStopGame = useCallback(async () => {
    if (!isGameRunning || !currentGameId || isStoppingGame) {
      return;
    }

    const activeDeviceIds = [...currentGameDevicesRef.current];
    if (activeDeviceIds.length === 0) {
      setIsGameRunning(false);
      setCurrentGameId(null);
      return;
    }

    setIsStoppingGame(true);
    try {
      const response = await invokeGameControl('stop', {
        deviceIds: activeDeviceIds,
        gameId: currentGameId,
      });

      const results = response.results ?? [];
      const failedIds = results.filter((result) => !result.success).map((result) => result.deviceId);
      const warnedIds = results.filter((result) => result.success && result.warning).map((result) => result.deviceId);

      telemetryUnsubscribeRef.current?.();
      telemetryUnsubscribeRef.current = null;

      const stopTimestamp = response.stoppedAt ?? Date.now();

      setIsGameRunning(false);
      setCurrentGameId(null);
      setGameStopTime(stopTimestamp);

      setAvailableDevices(prev =>
        prev.map(device => {
          if (activeDeviceIds.includes(device.deviceId)) {
            return {
              ...device,
              gameStatus: 'stop',
              lastSeen: stopTimestamp
            };
          }
          return device;
        })
      );

      if (failedIds.length > 0) {
        toast.warning(`${failedIds.length} device(s) may not have received the stop command.`);
      } else {
        toast.success('Game stopped successfully.');
      }

      if (warnedIds.length > 0) {
        toast.warning(`${warnedIds.length} device(s) reported a timeout when stopping.`);
      }

      const deviceStats = activeDeviceIds.map(deviceId => {
        const hitsForDevice = hitHistory.filter(hit => hit.deviceId === deviceId);
        const hitTimes = hitsForDevice.map(hit => hit.timestamp);
        const intervals = hitTimes.slice(1).map((ts, idx) => (ts - hitTimes[idx]) / 1000);
        const deviceInfo = availableDevicesRef.current.find(device => device.deviceId === deviceId);

        return {
          deviceId,
          deviceName: deviceInfo?.name ?? deviceId,
          hitCount: hitsForDevice.length,
          hitTimes,
          averageInterval: intervals.length
            ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
            : 0,
          firstHitTime: hitTimes[0] ?? 0,
          lastHitTime: hitTimes[hitTimes.length - 1] ?? 0
        };
      });

      const totalHits = deviceStats.reduce((sum, stat) => sum + stat.hitCount, 0);
      const actualDurationSeconds = gameStartTime
        ? Math.max(0, Math.round((stopTimestamp - gameStartTime) / 1000))
        : 0;

      const sortedHitTimes = hitHistory.map(hit => hit.timestamp).sort((a, b) => a - b);
      const overallIntervals = sortedHitTimes
        .slice(1)
        .map((ts, idx) => (ts - sortedHitTimes[idx]) / 1000);

      const averageHitInterval = overallIntervals.length
        ? overallIntervals.reduce((sum, value) => sum + value, 0) / overallIntervals.length
        : 0;

      const switchTimes: number[] = [];
      for (let i = 1; i < hitHistory.length; i++) {
        if (hitHistory[i].deviceId !== hitHistory[i - 1].deviceId) {
          switchTimes.push((hitHistory[i].timestamp - hitHistory[i - 1].timestamp) / 1000);
        }
      }

      const historyEntry: GameHistory = {
        gameId: currentGameId,
        gameName: `Game ${new Date(gameStartTime ?? stopTimestamp).toLocaleTimeString()}`,
        duration: Math.max(1, Math.ceil(actualDurationSeconds / 60)),
        startTime: gameStartTime ?? stopTimestamp,
        endTime: stopTimestamp,
        deviceResults: deviceStats.map(({ deviceId, deviceName, hitCount }) => ({
          deviceId,
          deviceName,
          hitCount
        })),
        totalHits,
        actualDuration: actualDurationSeconds,
        averageHitInterval,
        targetStats: deviceStats,
        crossTargetStats: {
          totalSwitches: switchTimes.length,
          averageSwitchTime: switchTimes.length
            ? switchTimes.reduce((sum, value) => sum + value, 0) / switchTimes.length
            : 0,
          switchTimes
        }
      };

      setGameHistory(prev => [historyEntry, ...prev]);
      currentGameDevicesRef.current = [];
      void fetchTotalShots();
      await loadLiveDevices({ silent: true });
    } catch (error) {
      console.error('Failed to stop game:', error);
      setErrorMessage('Failed to stop the game. Please try again.');
      toast.error('Failed to stop the game.');
    } finally {
      setIsStoppingGame(false);
    }
  }, [
    currentGameId,
    fetchTotalShots,
    gameStartTime,
    hitHistory,
    isGameRunning,
    isStoppingGame,
    loadLiveDevices
  ]);

  const handleBackToMain = useCallback(async () => {
    if (isGameRunning) {
      await handleStopGame();
    }
    setCurrentStage('main-dashboard');
  }, [handleStopGame, isGameRunning]);

  const getDeviceStatusBadge = (device: DeviceStatus) => {
    if (!device.isOnline) {
      return <Badge variant="destructive" className="text-xs">Offline</Badge>;
    }

    switch (device.gameStatus) {
      case 'start':
        return <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Active</Badge>;
      case 'stop':
        return <Badge variant="secondary" className="text-xs">Stopped</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Idle</Badge>;
    }
  };

  const getWifiIndicator = (strength: number) => {
    if (strength >= 80) return <Wifi className="h-4 w-4 text-green-500" />;
    if (strength >= 50) return <Wifi className="h-4 w-4 text-yellow-500" />;
    return <WifiOff className="h-4 w-4 text-red-500" />;
  };

  const getAmbientLightColor = (light: string) => {
    switch (light) {
      case 'good':
        return 'text-green-500';
      case 'average':
        return 'text-yellow-500';
      case 'poor':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return 'No activity';
    const diffMs = Date.now() - timestamp;
    if (diffMs < 5_000) return 'Just now';
    if (diffMs < 60_000) return `${Math.round(diffMs / 1000)}s ago`;
    if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`;
    return new Date(timestamp).toLocaleTimeString();
  };

  const totalDevices = availableDevices.length;
  const onlineDevices = availableDevices.filter(device => device.isOnline).length;
  const offlineDevices = Math.max(totalDevices - onlineDevices, 0);
  const activeSessionDevices = currentGameDevicesRef.current.length;
  const activeSessionHits = currentGameDevicesRef.current.reduce(
    (sum, id) => sum + (hitCounts[id] ?? 0),
    0
  );

  return (
    <div className="min-h-screen bg-brand-background">
      <Header onMenuClick={() => setIsMobileMenuOpen(true)} />

      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        <MobileDrawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        <main className="flex-1 overflow-y-auto">
          <div className="p-2 md:p-4 lg:p-6 xl:p-8 max-w-[1600px] mx-auto">
            {errorMessage && (
              <Card className="border-red-200 bg-red-50 mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-red-800 font-medium">{errorMessage}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setErrorMessage(null)}
                      className="ml-auto text-red-600 hover:text-red-800"
                    >
                      ×
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStage === 'main-dashboard' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="text-left">
                    <h1 className="font-heading text-2xl md:text-3xl font-semibold text-brand-text mb-2">
                      DryFire Games
                    </h1>
                    <p className="font-body text-brand-text/70 text-sm md:text-base">
                      Manage game sessions with real-time device monitoring
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={async () => {
                        setErrorMessage(null);
                        setCurrentStage('game-control');
                        await loadLiveDevices({ showToast: true });
                      }}
                      className="bg-brand-primary hover:bg-brand-primary/90 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Game
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg">
                    <CardContent className="p-2 md:p-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
                          <p className="text-xs font-medium text-brand-dark/70 font-body">Total Devices</p>
                          <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">
                            {totalDevices}
                          </p>
                          <p className="text-xs text-brand-dark/50 font-body">
                            {onlineDevices} online • {offlineDevices} offline
                          </p>
                        </div>
                        <div className="flex-shrink-0 p-1 md:p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
                          <TargetIcon className="text-brand-primary w-6 h-6 md:w-10 md:h-10" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg">
                    <CardContent className="p-2 md:p-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
                          <p className="text-xs font-medium text-brand-dark/70 font-body">Games Played</p>
                          <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">
                            {gameHistory.length}
                          </p>
                          <p className="text-xs text-brand-dark/50 font-body">Total sessions</p>
                        </div>
                        <div className="flex-shrink-0 p-1 md:p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
                          <Gamepad2 className="text-brand-primary w-6 h-6 md:w-10 md:h-10" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg">
                    <CardContent className="p-2 md:p-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
                          <p className="text-xs font-medium text-brand-dark/70 font-body">Total Hits</p>
                          <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">
                            {loadingTotalShots ? (
                              <span className="animate-pulse">...</span>
                            ) : (
                              totalShotsFromThingsBoard.toLocaleString()
                            )}
                          </p>
                          <p className="text-xs text-brand-dark/50 font-body">All time shots</p>
                        </div>
                        <div className="flex-shrink-0 p-1 md:p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
                          <Activity className="text-brand-primary w-6 h-6 md:w-10 md:h-10" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg">
                    <CardContent className="p-2 md:p-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
                          <p className="text-xs font-medium text-brand-dark/70 font-body">Best Score</p>
                          <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">
                            {gameHistory.length > 0
                              ? Math.max(
                                  ...gameHistory.map(game =>
                                    game.deviceResults.reduce((sum, result) => sum + result.hitCount, 0)
                                  )
                                )
                              : 0}
                          </p>
                          <p className="text-xs text-brand-dark/50 font-body">Single game</p>
                        </div>
                        <div className="flex-shrink-0 p-1 md:p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
                          <Trophy className="text-brand-primary w-6 h-6 md:w-10 md:h-10" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {(isGameRunning || currentGameId || hitHistory.length > 0) && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="h-5 w-5" />
                      <h2 className="font-heading text-xl font-semibold text-brand-text">Current Session</h2>
                      <Badge
                        variant={isGameRunning ? 'default' : 'outline'}
                        className={isGameRunning ? 'bg-green-100 text-green-700 border-green-200 text-xs' : 'text-xs'}
                      >
                        {isGameRunning ? 'ACTIVE' : currentGameId ? 'STOPPED' : 'IDLE'}
                      </Badge>
                    </div>

                    <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                      <CardContent className="p-3 md:p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center md:text-left">
                          <div>
                            <p className="text-xs text-brand-dark/60 font-body">Game ID</p>
                            <p className="text-sm md:text-lg font-heading text-brand-dark">{currentGameId ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-brand-dark/60 font-body">Status</p>
                            <p className="text-sm md:text-lg font-heading text-brand-dark">
                              {isGameRunning ? 'Active' : currentGameId ? 'Stopped' : 'Idle'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-brand-dark/60 font-body">Devices</p>
                            <p className="text-sm md:text-lg font-heading text-brand-dark">{activeSessionDevices}</p>
                          </div>
                          <div>
                            <p className="text-xs text-brand-dark/60 font-body">Hits Recorded</p>
                            <p className="text-sm md:text-lg font-heading text-brand-dark">{activeSessionHits}</p>
                          </div>
                        </div>

                        <div className="border-t border-gray-200 pt-3">
                          <p className="text-xs uppercase tracking-wide text-brand-dark/50 mb-2">Live Device Status</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                            {availableDevices.map(device => (
                              <div
                                key={device.deviceId}
                                className="border border-gray-200 rounded-md md:rounded-lg p-2 md:p-3 bg-white shadow-sm"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${device.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                    <span className="font-heading text-xs md:text-sm text-brand-dark">{device.name}</span>
                                  </div>
                                  {getDeviceStatusBadge(device)}
                                </div>
                                <div className="text-xs md:text-sm text-brand-dark/70 flex items-center justify-between">
                                  <span>Hits</span>
                                  <span className="font-semibold text-brand-dark">{hitCounts[device.deviceId] ?? device.hitCount ?? 0}</span>
                                </div>
                                <div className="text-xs md:text-sm text-brand-dark/70 flex items-center justify-between">
                                  <span>Last Hit</span>
                                  <span className="font-semibold text-brand-dark">{device.hitTimes?.length ? formatLastSeen(device.hitTimes[device.hitTimes.length - 1]) : '—'}</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-[11px] md:text-xs text-brand-dark/60">
                                  <div className="flex items-center gap-1">
                                    {getWifiIndicator(device.wifiStrength)}
                                    <span>{device.wifiStrength}%</span>
                                  </div>
                                  <div className={`flex items-center gap-1 ${getAmbientLightColor(device.ambientLight)}`}>
                                    <div className="w-2 h-2 rounded-full bg-current"></div>
                                    <span className="capitalize">{device.ambientLight}</span>
                                  </div>
                                  <span>{formatLastSeen(device.lastSeen)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    <h2 className="font-heading text-xl font-semibold text-brand-text">Game History</h2>
                  </div>

                  {gameHistory.length === 0 ? (
                    <Card className="bg-white border-gray-200 shadow-sm rounded-sm md:rounded-lg">
                      <CardContent className="p-8 text-center">
                        <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Games Yet</h3>
                        <p className="text-gray-600">Start your first game to see results here</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
                      {gameHistory.slice(0, 6).map(game => {
                        const totalHits = game.deviceResults.reduce((sum, r) => sum + r.hitCount, 0);
                        const bestDevice = game.deviceResults.reduce(
                          (best, r) => (r.hitCount > best.hitCount ? r : best),
                          game.deviceResults[0]
                        );
                        const avgHits = Math.round(totalHits / (game.deviceResults.length || 1));

                        return (
                          <Card
                            key={game.gameId}
                            className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg"
                          >
                            <CardContent className="p-2 md:p-4">
                              <div className="flex items-start gap-2">
                                <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
                                  <p className="text-xs font-medium text-brand-dark/70 font-body">{game.gameName}</p>
                                  <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">
                                    {totalHits}
                                  </p>
                                  <p className="text-xs text-brand-dark/50 font-body">
                                    {new Date(game.startTime).toLocaleDateString()} • {game.duration}m
                                  </p>
                                </div>
                                <div className="flex-shrink-0 p-1 md:p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
                                  <Trophy className="text-brand-primary w-6 h-6 md:w-10 md:h-10" />
                                </div>
                              </div>

                              <div className="mt-1 md:mt-3 space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-brand-dark/70">Devices</span>
                                  <span className="font-medium text-brand-dark">{game.deviceResults.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-brand-dark/70">Best Score</span>
                                  <span className="font-medium text-brand-dark">{bestDevice?.hitCount ?? 0}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-brand-dark/70">Avg per Device</span>
                                  <span className="font-medium text-brand-dark">{avgHits}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStage === 'game-control' && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" onClick={handleBackToMain} className="p-2">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-left">
                    <h1 className="font-heading text-2xl md:text-3xl font-semibold text-brand-text mb-2">
                      Live Game Control
                    </h1>
                    <p className="font-body text-brand-text/70 text-sm md:text-base">
                      Start and stop your ThingsBoard-backed dryfire session and monitor hits in real time.
                    </p>
                  </div>
                </div>

                <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                  <CardContent className="p-4 md:p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-brand-dark/50 mb-1">Game ID</p>
                        <p className="text-lg font-heading text-brand-dark">
                          {currentGameId ?? 'Not started'}
                        </p>
                        {gameStartTime && (
                          <p className="text-xs text-brand-dark/60">
                            Started {new Date(gameStartTime).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleStartGame}
                          disabled={isGameRunning || isStartingGame || loadingDevices}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isStartingGame ? (
                            <>
                              <Play className="h-4 w-4 mr-2 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Start Game
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleStopGame}
                          disabled={!isGameRunning || isStoppingGame}
                          variant="destructive"
                        >
                          {isStoppingGame ? (
                            <>
                              <Square className="h-4 w-4 mr-2 animate-spin" />
                              Stopping...
                            </>
                          ) : (
                            <>
                              <Square className="h-4 w-4 mr-2" />
                              Stop Game
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-brand-dark/60 uppercase tracking-wide">Status</p>
                        <p className="text-lg font-heading text-brand-dark">
                          {isGameRunning ? 'Active' : currentGameId ? 'Stopped' : 'Idle'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-brand-dark/60 uppercase tracking-wide">Devices</p>
                        <p className="text-lg font-heading text-brand-dark">
                          {currentGameDevicesRef.current.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-brand-dark/60 uppercase tracking-wide">Total Hits</p>
                        <p className="text-lg font-heading text-brand-dark">
                          {currentGameDevicesRef.current.reduce((sum, id) => sum + (hitCounts[id] ?? 0), 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-brand-dark/60 uppercase tracking-wide">Elapsed</p>
                        <p className="text-lg font-heading text-brand-dark">
                          {gameStartTime
                            ? `${Math.max(
                                0,
                                Math.floor(
                                  ((isGameRunning ? Date.now() : gameStopTime ?? Date.now()) - gameStartTime) /
                                    1000
                                )
                              )}s`
                            : '0s'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                  <CardContent className="p-4 md:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-heading text-lg font-semibold text-brand-dark">Devices</h2>
                      <Badge variant="outline" className="text-xs">
                        {availableDevices.filter(device => device.isOnline).length} online / {availableDevices.length} total
                      </Badge>
                    </div>

                    {loadingDevices ? (
                      <div className="flex items-center justify-center py-10 text-sm text-brand-dark/60">
                        Refreshing device list...
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {availableDevices.map(device => (
                          <div
                            key={device.deviceId}
                            className="border border-gray-200 rounded-md md:rounded-lg p-3 bg-white shadow-sm space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${device.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                                <span className="font-heading text-sm text-brand-dark">{device.name}</span>
                              </div>
                              {getDeviceStatusBadge(device)}
                            </div>
                            <div className="flex items-center justify-between text-xs text-brand-dark/70">
                              <span>Hits</span>
                              <span className="font-semibold text-brand-dark">{hitCounts[device.deviceId] ?? device.hitCount ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-brand-dark/70">
                              <span>WiFi</span>
                              <div className="flex items-center gap-1">
                                {getWifiIndicator(device.wifiStrength)}
                                <span>{device.wifiStrength}%</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-brand-dark/70">
                              <span>Last Activity</span>
                              <span>{formatLastSeen(device.lastSeen)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
                  <CardContent className="p-4 md:p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-heading text-lg font-semibold text-brand-dark">Hit Feed</h2>
                      <Badge variant="outline" className="text-xs">
                        {hitHistory.length} hits
                      </Badge>
                    </div>
                    {hitHistory.length === 0 ? (
                      <p className="text-sm text-brand-dark/60 text-center py-6">
                        {isGameRunning ? 'Waiting for hits...' : 'No hits recorded yet.'}
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {[...hitHistory].reverse().slice(0, 50).map(hit => (
                          <div
                            key={`${hit.deviceId}-${hit.timestamp}`}
                            className="flex items-center justify-between text-xs border border-gray-100 rounded-md px-3 py-2 bg-gray-50"
                          >
                            <span className="font-medium text-brand-dark">{hit.deviceName}</span>
                            <span className="text-brand-dark/60">{new Date(hit.timestamp).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Games;
