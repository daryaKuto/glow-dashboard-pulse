import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target as TargetIcon, AlertCircle, Wifi, WifiOff, CheckCircle, Gamepad2, History } from 'lucide-react';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import type { GameTemplate } from '@/features/games/schema';
import { useScenarioRun } from '@/store/useScenarioRun';
import { useScenarios } from '@/store/useScenarios';
import { useRooms } from '@/store/useRooms';
import { useGameFlow } from '@/store/useGameFlow';
import { toast } from '@/components/ui/sonner';
import { useScenarioLiveData } from '@/hooks/useScenarioLiveData_old_code';
import GameFlowDashboard from '@/components/game-flow/GameFlowDashboard';
import GameHistory from '@/components/game-flow/GameHistory';
// Removed mock data import - using real data only
import type { Target } from '@/store/useTargets';
import { useTargets } from '@/store/useTargets';
import { useGameDevices } from '@/features/games/hooks/use-game-devices';

const Scenarios: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { rooms: storeRooms, fetchRooms } = useRooms();
  const { active, current, error, start, stop, progress, timeRemaining, currentSession } = useScenarioRun();
  const { devices: gameFlowDevices, initializeDevices, selectDevices: setGameFlowSelectedDevices } = useGameFlow();
  const scenarios = useScenarios((state) => state.scenarios);
  const fetchScenarios = useScenarios((state) => state.fetchScenarios);
  const scenariosLoading = useScenarios((state) => state.isLoading);
  const scenariosError = useScenarios((state) => state.error);
  
  // Demo mode removed - using live data only
  const [activeTab, setActiveTab] = useState<'scenarios' | 'game-flow' | 'history'>('scenarios');
  const [gameDuration, setGameDuration] = useState(30); // Default 30 minutes

  // Use live data only
  const rooms = storeRooms;
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [showCountdown, setShowCountdown] = useState(false);
  const [pendingGame, setPendingGame] = useState<GameTemplate | null>(null);
  const [countdownState, setCountdownState] = useState<{
    phase: 'ready' | 'countdown' | 'go' | 'complete';
    count: number;
    message: string;
  }>({
    phase: 'ready',
    count: 3,
    message: 'Get Ready'
  });

  const { devices: liveDevices, isLoading: isLoadingGameDevices } = useGameDevices();
  const targetsStore = useTargets((state) => state.targets);
  const targetsLoading = useTargets((state) => state.isLoading);
  const refreshTargets = useTargets((state) => state.refresh);
  const activeScenarios = useMemo(() => {
    return [...scenarios]
      .filter((scenario) => scenario.isActive && scenario.isPublic)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [scenarios]);

  useEffect(() => {
    if (targetsStore.length === 0) {
      void refreshTargets().catch((err) => {
        console.warn('Failed to refresh ThingsBoard targets via store', err);
      });
    }
  }, [targetsStore, refreshTargets]);

  useEffect(() => {
    if (liveDevices.length === 0) {
      return;
    }
    void initializeDevices(liveDevices);
  }, [initializeDevices, liveDevices]);

  useEffect(() => {
    void fetchScenarios();
  }, [fetchScenarios]);

  const targetMetaById = useMemo(() => {
    const map = new Map<string, Target>();
    targetsStore.forEach((target) => {
      const key = typeof target.id === 'string'
        ? target.id
        : String((target.id as { id?: string })?.id ?? target.id);
      map.set(key, target);
    });
    return map;
  }, [targetsStore]);

  const normalizedTargets = useMemo(() => {
    if (liveDevices.length === 0) {
      return targetsStore;
    }

    return liveDevices.map((device) => {
      const meta = targetMetaById.get(device.deviceId);
      const status: Target['status'] = device.isOnline
        ? (device.gameStatus === 'start' ? 'online' : 'standby')
        : 'offline';

      return {
        id: device.deviceId,
        name: meta?.name ?? device.name ?? `Target ${device.deviceId}`,
        status,
        wifiStrength: device.wifiStrength,
        roomId: meta?.roomId ?? null,
        telemetry: meta?.telemetry ?? {},
        telemetryHistory: meta?.telemetryHistory ?? {},
        lastEvent: meta?.lastEvent ?? device.raw.lastEvent ?? null,
        lastGameId: meta?.lastGameId ?? device.gameId ?? null,
        lastGameName: meta?.lastGameName ?? null,
        lastHits: meta?.lastHits ?? null,
        lastActivity: meta?.lastActivity ?? null,
        lastActivityTime: meta?.lastActivityTime ?? null,
        deviceName: meta?.deviceName ?? device.name ?? `Target ${device.deviceId}`,
        deviceType: meta?.deviceType ?? device.raw?.deviceType ?? undefined,
        gameStatus: device.gameStatus,
        additionalInfo: meta?.additionalInfo ?? {},
      } as Target;
    });
  }, [liveDevices, targetMetaById, targetsStore]);

  const availableTargets = useMemo(() => {
    if (selectedRoomId === null) {
      return normalizedTargets;
    }
    return normalizedTargets.filter((target) => {
      if (target.roomId === null || target.roomId === undefined) {
        return false;
      }
      return String(target.roomId) === String(selectedRoomId);
    });
  }, [normalizedTargets, selectedRoomId]);

  const availableDevices = liveDevices;
  const loadingTargets = targetsLoading || isLoadingGameDevices;

  useEffect(() => {
    const availableIds = new Set(availableTargets.map((target) => target.id));
    setSelectedTargets((prev) => {
      const filtered = prev.filter((id) => availableIds.has(id));
      if (filtered.length !== prev.length) {
        setGameFlowSelectedDevices(filtered);
      }
      return filtered;
    });
  }, [availableTargets, setGameFlowSelectedDevices]);

  // Debug logging
  console.log('🔍 Scenarios page state:', {
    roomsCount: rooms.length,
    selectedRoomId,
    availableTargetsCount: availableTargets.length,
    selectedTargetsCount: selectedTargets.length,
    loadingTargets,
    active,
    showCountdown,
    rooms: rooms.map(r => ({ id: r.id, name: r.name, idType: typeof r.id })),
    selectedTargets: selectedTargets
  });

  // Beep sound function
  const playBeep = React.useCallback((frequency: number = 800, duration: number = 200) => {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
      } catch (error) {
        console.log('Audio not available:', error);
      }
    }
  }, []);

  // Create stable callback functions to prevent infinite re-renders
  const handleHitDetected = React.useCallback((hitData: {
    deviceId: string;
    timestamp: number;
    sessionId: string;
    hitSequence: number;
    reactionTime?: number;
  }) => {
    console.log('Hit detected:', hitData);
    toast.success(`Hit registered on target!`);
  }, []);

  const handleScenarioComplete = React.useCallback(() => {
    console.log('Scenario completed by time limit');
    stop();
    toast.success('Scenario completed');
  }, [stop]);

  const handleLiveDataError = React.useCallback((error: string) => {
    console.error('Live data error:', error);
    toast.error('Live data connection error');
  }, []);

  // Setup live data monitoring for active scenarios
  const liveDataConfig = React.useMemo(() => {
    if (!currentSession) return null;
    
    return {
      sessionId: currentSession.sessionId,
      targetDeviceIds: currentSession.targetDeviceIds,
      scenarioStartTime: currentSession.startTime,
      scenarioTimeLimit: currentSession.timeLimitMs,
      expectedHits: currentSession.expectedShots,
      onHitDetected: handleHitDetected,
      onScenarioComplete: handleScenarioComplete,
      onError: handleLiveDataError
    };
  }, [currentSession, handleHitDetected, handleScenarioComplete, handleLiveDataError]);

  // Default config for when no session is active (prevents hooks from running)
  const defaultConfig = React.useMemo(() => ({
    sessionId: '',
    targetDeviceIds: [],
    scenarioStartTime: 0,
    scenarioTimeLimit: 0,
    expectedHits: 0,
    onHitDetected: () => {},
    onScenarioComplete: () => {},
    onError: () => {}
  }), []);

  // Use real live data only
  const { liveData, isPolling } = useScenarioLiveData(liveDataConfig || defaultConfig);

  // Fetch rooms when component mounts
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleTargetSelection = (targetId: string, checked: boolean) => {
    if (checked) {
      setSelectedTargets(prev => {
        // Prevent duplicate selections
        if (prev.includes(targetId)) {
          console.log('Target already selected, ignoring:', targetId);
          return prev;
        }
        const newSelection = [...prev, targetId];
        console.log('Target selected:', targetId, 'Total selected:', newSelection.length, 'IDs:', newSelection);
        setGameFlowSelectedDevices(newSelection);
        return newSelection;
      });
    } else {
      setSelectedTargets(prev => {
        const newSelection = prev.filter(id => id !== targetId);
        console.log('Target deselected:', targetId, 'Total selected:', newSelection.length, 'IDs:', newSelection);
        setGameFlowSelectedDevices(newSelection);
        return newSelection;
      });
    }
  };

  const handleStartGame = async (gameTemplate: GameTemplate) => {
    if (selectedRoomId === null) {
      toast.error('Please select a room first');
      return;
    }

    const roomIdToUse = selectedRoomId;

    if (selectedTargets.length < gameTemplate.targetCount) {
      toast.error(`Please select ${gameTemplate.targetCount} targets for this game`);
      return;
    }

    const onlineSelectedTargets = availableTargets.filter(
      t => selectedTargets.includes(t.id) && (t.status === 'online' || t.status === 'standby')
    );

    if (onlineSelectedTargets.length < gameTemplate.targetCount) {
      toast.error(`${gameTemplate.targetCount} online targets required. Only ${onlineSelectedTargets.length} selected targets are connected.`);
      return;
    }

    // Use countdown flow for all games
    setPendingGame(gameTemplate);
    setShowCountdown(true);
    startInlineCountdown(gameTemplate);
    
    // Live mode - use ThingsBoard game flow according to DeviceManagement.md
    console.log('🔴 LIVE MODE: Starting ThingsBoard game flow');
    
    // Generate unique game ID
    const gameId = `GM-${Date.now()}`;
    
    // Start the game flow according to documentation
    await startLiveModeGame(gameTemplate, gameId, selectedTargets, gameDuration);
  };

  // Live mode game flow according to DeviceManagement.md
  const startLiveModeGame = async (
    gameTemplate: GameTemplate, 
    gameId: string, 
    targetIds: string[], 
    duration: number = 30
  ) => {
    try {
      toast.info('🎮 Starting live game flow...');
      
      // Step 1: Create game session
      console.log('📋 Step 1: Creating game session');
      const { createGame, configureDevices, startGame } = useGameFlow.getState();
      
      const gameCreated = await createGame(gameTemplate.name, duration);
      if (!gameCreated) {
        toast.error('Failed to create game session');
        return;
      }
      
      // Step 2: Configure devices (sends 'configure' RPC commands)
      console.log('⚙️ Step 2: Configuring devices');
      toast.info('Configuring devices...');
      
      const configResult = await configureDevices();

      if (configResult.warnings.length > 0) {
        configResult.warnings.forEach(({ deviceId, warning }) => {
          const target = availableTargets.find((t) => t.id === deviceId);
          toast.warning(`Configure warning for ${target?.name ?? deviceId}`, {
            description: warning,
          });
        });
      }

      if (!configResult.ok) {
        if (configResult.failed.length > 0) {
          configResult.failed.forEach((deviceId) => {
            const target = availableTargets.find((t) => t.id === deviceId);
            toast.error(`Failed to configure ${target?.name ?? deviceId}`);
          });
        } else {
          toast.error('Failed to configure devices');
        }
        return;
      }
      toast.success(`Configured ${configResult.success.length} device${configResult.success.length === 1 ? '' : 's'}`);
      
      // Step 3: Wait for device responses and start countdown
      console.log('⏳ Step 3: Starting countdown');
      setPendingGame(gameTemplate);
      setShowCountdown(true);
      
      // Custom countdown for live mode
      startLiveModeCountdown(gameTemplate, startGame);
      
    } catch (error) {
      console.error('❌ Live mode game flow failed:', error);
      toast.error('Failed to start live game');
    }
  };

  // Live mode countdown that integrates with ThingsBoard
  const startLiveModeCountdown = async (
    gameTemplate: GameTemplate, 
    startGameFn: () => Promise<boolean>
  ) => {
    // Initial ready state
    setCountdownState({ phase: 'ready', count: 3, message: 'Configuring Devices' });
    
    // Wait 2 seconds for device configuration responses
    setTimeout(async () => {
      // Start normal countdown
      setCountdownState({ phase: 'countdown', count: 3, message: 'Get Ready' });
      playBeep(600, 300);
      
      setTimeout(async () => {
        setCountdownState({ phase: 'countdown', count: 2, message: 'Get Set' });
        playBeep(700, 300);
        
        setTimeout(async () => {
          setCountdownState({ phase: 'countdown', count: 1, message: 'Almost...' });
          playBeep(800, 300);
          
          setTimeout(async () => {
            setCountdownState({ phase: 'go', count: 0, message: 'GO!' });
            playBeep(1000, 500);
            
            // Send start commands to devices
            const gameStarted = await startGameFn();
            if (gameStarted) {
              console.log('🚀 Live game started successfully!');
              toast.success('Game started! Devices are now active.');
            } else {
              toast.error('Failed to start game on devices');
            }
            
            setTimeout(() => {
              setCountdownState({ phase: 'complete', count: 0, message: 'Game Active!' });
              setTimeout(() => {
                setShowCountdown(false);
                setPendingGame(null);
              }, 500);
            }, 1000);
          }, 1000);
        }, 1000);
      }, 1000);
    }, 2000); // Extra time for device configuration
  };

  // Handle countdown completion - actually start the scenario
  const handleCountdownComplete = React.useCallback(async () => {
    setShowCountdown(false);
    
    if (!pendingGame) return;

    const roomIdToUse = selectedRoomId;

    try {
      // Now actually start the game after countdown
      await start(pendingGame, roomIdToUse!, selectedTargets);
      toast.success(`${pendingGame.name} game started!`);
    } catch (err) {
      toast.error('Failed to start scenario');
    } finally {
      setPendingGame(null);
    }
  }, [pendingGame, selectedRoomId, selectedTargets, start]);

  // Start inline countdown within the scenario card
  const startInlineCountdown = React.useCallback(async (gameTemplate: GameTemplate) => {
    // Initial ready state
    setCountdownState({ phase: 'ready', count: 3, message: 'Get Ready' });
    
    // Wait 1 second, then start countdown
    setTimeout(async () => {
      // 3
      setCountdownState({ phase: 'countdown', count: 3, message: 'Get Ready' });
      playBeep(600, 300);
      
      setTimeout(async () => {
        // 2
        setCountdownState({ phase: 'countdown', count: 2, message: 'Get Set' });
        playBeep(700, 300);
        
        setTimeout(async () => {
          // 1
          setCountdownState({ phase: 'countdown', count: 1, message: 'Almost...' });
          playBeep(800, 300);
          
          setTimeout(async () => {
            // GO!
            setCountdownState({ phase: 'go', count: 0, message: 'GO!' });
            playBeep(1000, 500); // Higher pitch, longer beep for GO
            
            setTimeout(() => {
              setCountdownState({ phase: 'complete', count: 0, message: 'Scenario Started' });
              setTimeout(() => {
                handleCountdownComplete();
              }, 500);
            }, 1000);
          }, 1000);
        }, 1000);
      }, 1000);
    }, 1000);
  }, [playBeep, handleCountdownComplete]);


  const handleStopScenario = () => {
    stop();
    toast.success('Scenario stopped');
  };

  return (
    <div className="min-h-screen bg-brand-background">
      <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
      
      <div className="flex flex-1">
        {!isMobile && <Sidebar />}
        <MobileDrawer 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
        
        <main className="flex-1 overflow-y-auto">
          <div className="p-2 md:p-4 lg:p-6 xl:p-8 max-w-[1600px] mx-auto">
            
            {/* Header Section */}
            <div className="mb-6 md:mb-8">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                {/* Title & Subtitle - Left Aligned */}
                <div className="text-left">
                  <h1 className="font-heading text-2xl md:text-3xl font-semibold text-brand-text mb-2">
                    Training Scenarios
                  </h1>
                  <p className="font-body text-brand-text/70 text-sm md:text-base">
                    Practice with structured shooting drills and track your progress
                  </p>
                </div>
                
                {/* Mode Indicator - Live Only */}
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 rounded-lg text-xs font-body font-medium bg-green-100 text-green-800">
                    🔗 Live
                  </div>

                  {active && (
                    <Button 
                      onClick={handleStopScenario}
                      size="sm"
                      className="h-7 px-2 text-xs font-body bg-red-500 hover:bg-red-600 text-white"
                    >
                      Stop
                    </Button>
                  )}
                </div>
              </div>

              {/* Stats Overview Bar - Responsive */}
              <div className="flex items-center justify-center p-3 sm:p-4 lg:p-6 bg-brand-surface rounded-2xl shadow-subtle border border-gray-100 mt-4">
                <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
                  <div className="text-center">
                    <div className="text-lg sm:text-xl lg:text-2xl font-heading font-bold text-brand-primary mb-1">
                      {rooms.length}
                    </div>
                    <div className="text-xs sm:text-sm text-brand-text/60 font-body">Available Rooms</div>
                  </div>
                  <div className="w-px h-8 sm:h-10 lg:h-12 bg-gray-200"></div>
                  <div className="text-center">
                    <div className="text-lg sm:text-xl lg:text-2xl font-heading font-bold text-brand-primary mb-1">
                      {availableTargets.filter(t => t.status === 'online' || t.status === 'standby').length}
                    </div>
                    <div className="text-xs sm:text-sm text-brand-text/60 font-body">Online Targets</div>
                  </div>
                  <div className="w-px h-8 sm:h-10 lg:h-12 bg-gray-200"></div>
                  <div className="text-center">
                    <div className="text-lg sm:text-xl lg:text-2xl font-heading font-bold text-brand-primary mb-1">
                      {activeScenarios.length}
                    </div>
                    <div className="text-xs sm:text-sm text-brand-text/60 font-body">Available Games</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'scenarios' | 'game-flow' | 'history')} className="w-full mt-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="scenarios" className="flex items-center gap-2">
                  <TargetIcon className="h-4 w-4" />
                  Scenarios
                </TabsTrigger>
                <TabsTrigger value="game-flow" className="flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4" />
                  Game Flow
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  History
                </TabsTrigger>
              </TabsList>

              {/* Tab Content */}
              <TabsContent value="scenarios" className="mt-6">
                {/* Main Content Layout - Simplified 3-column design */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
              
              {/* Left Column - Room & Target Selection (Stacked) */}
              <div className="lg:col-span-3 space-y-4">
                
                {/* Room Selection - Compact */}
                <div className="bg-brand-surface rounded-xl p-4 shadow-subtle border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-heading text-sm font-semibold text-brand-text">Training Room</h3>
                    {/* Demo badge - disabled */}
                  </div>
                  
                  {rooms.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="w-8 h-8 bg-brand-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <TargetIcon className="w-4 h-4 text-brand-secondary" />
                      </div>
                      <p className="text-xs text-brand-text/60 font-body">
                        No rooms
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <select
                          value={selectedRoomId ?? ''}
                          onChange={(e) => setSelectedRoomId(e.target.value || null)}
                          disabled={false}
                          className="w-full px-3 py-2 pr-8 rounded-lg font-body text-sm appearance-none transition-all duration-200 bg-brand-background border border-brand-secondary/20 text-brand-text cursor-pointer hover:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                        >
                          <option value="">Select room...</option>
                          {rooms.map(room => (
                            <option key={room.id} value={room.id}>
                              {room.name}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                          <svg className="w-4 h-4 text-brand-text/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* Demo mode message - disabled */}
                    </div>
                  )}
                </div>

                {/* Active Scenario Status - Compact */}
                {active && current && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-3 border border-green-200">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="font-heading font-semibold text-green-800 text-xs">
                        {current.name} Active
                      </span>
                    </div>
                  </div>
                )}

                {/* Error Display - Compact */}
                {error && (
                  <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-3 border border-red-200">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 text-red-600" />
                      <span className="font-heading font-semibold text-red-800 text-xs">Error</span>
                    </div>
                    <p className="text-xs text-red-700 font-body mt-1">{error}</p>
                  </div>
                )}
                
                {/* Target Selection - Compact */}
                <div className="bg-brand-surface rounded-xl p-4 shadow-subtle border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-heading text-sm font-semibold text-brand-text">Select Targets</h3>
                      <div className="px-2 py-1 bg-brand-primary/10 text-brand-primary text-xs font-body rounded-full">
                        {availableTargets.length}
                      </div>
                    </div>
                    
                    {loadingTargets ? (
                      <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-12"></div>
                        ))}
                      </div>
                    ) : availableTargets.length === 0 ? (
                      <div className="text-center py-4">
                        <div className="w-8 h-8 bg-brand-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                          <TargetIcon className="w-4 h-4 text-brand-secondary" />
                        </div>
                        <p className="text-xs text-brand-text/60 font-body">No targets found</p>
                        <p className="text-xs text-gray-500 mt-1">Debug: availableTargets.length = {availableTargets.length}, loadingTargets = {loadingTargets.toString()}</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {availableTargets.map(target => {
                            const isOnline = target.status === 'online' || target.status === 'standby';
                            const isSelected = selectedTargets.includes(target.id);
                            
                            return (
                              <div 
                                key={`target-${(target.id as any)?.id || target.id}`} 
                                className={`p-3 rounded-lg border transition-all duration-200 ${
                                  isSelected 
                                    ? 'border-brand-primary bg-brand-primary/5' 
                                    : 'border-gray-200 bg-brand-background hover:border-brand-secondary/50'
                                } ${!isOnline ? 'opacity-50' : ''}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`checkbox-${(target.id as any)?.id || target.id}`}
                                      checked={isSelected}
                                      onCheckedChange={(checked) => handleTargetSelection(target.id, checked as boolean)}
                                      disabled={!isOnline}
                                      className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 data-[state=checked]:text-white"
                                    />
                                    <div>
                                      <label 
                                        htmlFor={target.id}
                                        className={`text-xs font-medium font-body cursor-pointer ${
                                          isOnline ? 'text-brand-text' : 'text-gray-400'
                                        }`}
                                      >
                                        {target.name}
                                      </label>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-1">
                                    <div className={`w-2 h-2 rounded-full ${
                                      isOnline ? 'bg-green-500' : 'bg-gray-400'
                                    }`}></div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-xs text-brand-text/60 font-body">
                          <span>{availableTargets.filter(t => t.status === 'online' || t.status === 'standby').length} online</span>
                          <span>{selectedTargets.length} selected</span>
                        </div>
                      </>
                    )}
                  </div>
              </div>

              {/* Right Column - Available Games */}
              <div className="lg:col-span-9">
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Select a game to start a new session.</strong> Each game has specific rules, target requirements, and time limits. 
                    Choose your room and targets, then click "Start Game" to begin.
                  </p>
                </div>
                {scenariosError && (
                  <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Unable to load games</p>
                      <p className="text-xs text-red-700/80 font-body">{scenariosError}</p>
                    </div>
                  </div>
                )}
                {scenariosLoading ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-brand-text/70 font-body">
                    Loading live games…
                  </div>
                ) : activeScenarios.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-brand-text/70 font-body">
                    No game templates available yet. Check back after new games are published in Supabase.
                  </div>
                ) : (
                activeScenarios.map((template, index) => (
                  <div key={template.id} className={`bg-brand-surface rounded-xl p-4 lg:p-6 shadow-subtle border border-gray-100 hover:shadow-lg transition-all duration-300 ${index > 0 ? 'mt-4' : ''}`}>
                    
                    {/* Header - Compact */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                        <TargetIcon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-heading text-lg lg:text-xl font-semibold text-brand-text mb-1">
                          {template.name}
                        </h2>
                        <p className="text-brand-text/70 font-body text-sm leading-relaxed">
                          {template.description}
                        </p>
                      </div>
                    </div>

                    {/* Stats - Horizontal Layout */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-brand-background rounded-lg p-3 text-center">
                        <div className="text-lg lg:text-xl font-heading font-bold text-brand-primary">
                          {template.targetCount}
                        </div>
                        <div className="text-xs text-brand-text/70 font-body">Targets</div>
                      </div>
                      
                      <div className="bg-brand-background rounded-lg p-3 text-center">
                        <div className="text-lg lg:text-xl font-heading font-bold text-brand-primary">
                          {template.shotsPerTarget}
                        </div>
                        <div className="text-xs text-brand-text/70 font-body">Shots</div>
                      </div>
                      
                      <div className="bg-brand-background rounded-lg p-3 text-center">
                        <div className="text-lg lg:text-xl font-heading font-bold text-brand-primary">
                          {template.timeLimitMs / 1000}s
                        </div>
                        <div className="text-xs text-brand-text/70 font-body">Time</div>
                      </div>
                    </div>

                    {/* Live Progress Section - When Active */}
                    {active && current?.id === template.id && currentSession && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              isPolling && liveData.isConnected 
                                ? 'bg-green-500 animate-pulse' 
                                : 'bg-blue-500'
                            }`}></div>
                            <h3 className="font-heading font-semibold text-blue-800 text-sm">
                              Scenario Active
                            </h3>
                          </div>
                          <div className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-body rounded-full">
                            {Math.round(liveData.progress)}%
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-blue-200 rounded-full h-2 mb-3">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${liveData.progress}%` }}
                          ></div>
                        </div>
                        
                        {/* Live Stats */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="text-center">
                            <div className="font-heading font-bold text-blue-800">
                              {Math.max(0, Math.ceil(liveData.timeRemaining / 1000))}s
                            </div>
                            <div className="text-blue-600 font-body">Remaining</div>
                          </div>
                          <div className="text-center">
                            <div className="font-heading font-bold text-blue-800">
                              {liveData.hitCount}/{liveData.expectedHits}
                            </div>
                            <div className="text-blue-600 font-body">Hits</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status Message - Highlighted when ready */}
                    {selectedTargets.length >= template.targetCount && !active && !showCountdown && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <p className="text-sm text-green-700 font-body font-medium">
                            Ready to start ({selectedTargets.length}/{template.targetCount} targets selected)
                          </p>
                        </div>
                      </div>
                    )}


                    {/* Start Session Button - Bottom */}
                    <Button 
                      onClick={() => handleStartGame(template)}
                      disabled={
                        active || 
                        showCountdown || 
                        selectedTargets.length < template.targetCount
                      }
                      className="w-full h-12 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-gray-300 disabled:text-gray-500 text-white font-body text-base font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <TargetIcon className="h-5 w-5 mr-2" />
                      {active && current?.id === template.id ? 'Scenario Running...' : 
                       showCountdown && pendingGame?.id === template.id ? 'Starting...' : 'Start Game'}
                    </Button>
                  </div>
                ))}
                </div>
                </div>
              </TabsContent>

              {/* Game Flow Tab */}
              <TabsContent value="game-flow" className="mt-6">
                <GameFlowDashboard 
                  availableDevices={availableDevices}
                  onGameComplete={(results) => {
                    console.log('Game completed:', results);
                    toast.success('Game completed successfully!');
                  }}
                />
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="mt-6">
                <GameHistory 
                  onGameSelect={(game) => {
                    console.log('Game selected:', game);
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Full-Screen Countdown Modal */}
      {showCountdown && pendingGame && (
        <div className="fixed inset-0 z-50 bg-purple-600 bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-4xl md:text-6xl font-heading font-bold mb-8">
              {pendingGame.name}
            </h1>
            
            <div className="mb-8">
              {countdownState.phase === 'ready' && (
                <div className="text-3xl md:text-5xl font-heading font-bold animate-pulse">
                  Get Ready
                </div>
              )}
              {countdownState.phase === 'countdown' && (
                <div className="text-8xl md:text-9xl font-heading font-bold animate-pulse">
                  {countdownState.count}
                </div>
              )}
              {countdownState.phase === 'go' && (
                <div className="text-6xl md:text-8xl font-heading font-bold animate-bounce text-green-300">
                  GO!
                </div>
              )}
              {countdownState.phase === 'complete' && (
                <div className="text-4xl md:text-6xl font-heading font-bold text-green-300">
                  Session Started!
                </div>
              )}
            </div>
            
            <p className="text-xl md:text-2xl font-body mb-8 opacity-90">
              {countdownState.message}
            </p>
            
            {/* Progress Dots */}
            <div className="flex items-center justify-center gap-4">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`w-4 h-4 md:w-6 md:h-6 rounded-full transition-all duration-500 ${
                    countdownState.phase === 'ready' ? 'bg-white/30' :
                    countdownState.phase === 'countdown' && countdownState.count >= (4 - step) ? 'bg-white scale-125' :
                    countdownState.phase === 'go' || countdownState.phase === 'complete' ? 'bg-green-300 scale-125' :
                    'bg-white/30'
                  }`}
                />
              ))}
            </div>
            
            {/* Scenario Details */}
            <div className="mt-12 p-6 bg-white/10 rounded-lg backdrop-blur-sm">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-heading font-bold">{pendingGame.targetCount}</div>
                  <div className="text-sm opacity-75">Targets</div>
                </div>
                <div>
                  <div className="text-2xl font-heading font-bold">{pendingGame.shotsPerTarget}</div>
                  <div className="text-sm opacity-75">Shots Each</div>
                </div>
                <div>
                  <div className="text-2xl font-heading font-bold">{Math.round(pendingGame.timeLimitMs / 1000)}s</div>
                  <div className="text-sm opacity-75">Time Limit</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Scenarios; 
