import React, { useState, useEffect } from 'react';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { SCENARIOS, type ScenarioTemplate } from '@/data/scenarios';
import { useScenarioRun } from '@/store/useScenarioRun';
import { useRooms } from '@/store/useRooms';
import { useGameFlow } from '@/store/useGameFlow';
import { toast } from '@/components/ui/sonner';
import API from '@/lib/api';
import { useScenarioLiveData } from '@/hooks/useScenarioLiveData';
import GameFlowDashboard from '@/components/game-flow/GameFlowDashboard';
import GameHistory from '@/components/game-flow/GameHistory';
// Removed mock data import - using real data only
import type { Target } from '@/store/useTargets';
import { DeviceStatus } from '@/services/device-game-flow';

const Scenarios: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { rooms: storeRooms, fetchRooms, getRoomTargets } = useRooms();
  const { active, current, error, start, stop, progress, timeRemaining, currentSession } = useScenarioRun();
  const { devices: gameFlowDevices, initializeDevices } = useGameFlow();
  
  // Demo mode toggle (Scenarios page only)
  const [isDemoMode, setIsDemoMode] = useState(true); // Default to demo mode
  const [activeTab, setActiveTab] = useState<'scenarios' | 'game-flow' | 'history'>('scenarios');
  const [gameDuration, setGameDuration] = useState(30); // Default 30 minutes

  // Mock data for demo mode
  const mockRooms = [
    { id: '1', name: 'Training Room A', order: 1, targetCount: 4, icon: 'home', room_type: 'training' },
    { id: '2', name: 'Training Room B', order: 2, targetCount: 3, icon: 'briefcase', room_type: 'training' },
    { id: '3', name: 'Practice Range', order: 3, targetCount: 6, icon: 'building', room_type: 'range' }
  ];

  const mockTargets: Target[] = [
    { id: 'demo-target-1', name: 'Target Alpha', status: 'online', roomId: 1 },
    { id: 'demo-target-2', name: 'Target Beta', status: 'online', roomId: 1 },
    { id: 'demo-target-3', name: 'Target Gamma', status: 'online', roomId: 1 },
    { id: 'demo-target-4', name: 'Target Delta', status: 'offline', roomId: 1 },
    { id: 'demo-target-5', name: 'Target Echo', status: 'online', roomId: 2 },
    { id: 'demo-target-6', name: 'Target Foxtrot', status: 'online', roomId: 2 },
    { id: 'demo-target-7', name: 'Target Golf', status: 'online', roomId: 2 },
    { id: 'demo-target-8', name: 'Target Hotel', status: 'online', roomId: 3 },
    { id: 'demo-target-9', name: 'Target India', status: 'online', roomId: 3 },
    { id: 'demo-target-10', name: 'Target Juliet', status: 'offline', roomId: 3 },
    { id: 'demo-target-11', name: 'Target Kilo', status: 'online', roomId: 3 },
    { id: 'demo-target-12', name: 'Target Lima', status: 'online', roomId: 3 },
    { id: 'demo-target-13', name: 'Target Mike', status: 'online', roomId: 3 }
  ];

  // Use demo or real data based on mode
  const rooms = isDemoMode ? mockRooms : storeRooms;
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [availableTargets, setAvailableTargets] = useState<Target[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [pendingScenario, setPendingScenario] = useState<ScenarioTemplate | null>(null);
  const [countdownState, setCountdownState] = useState<{
    phase: 'ready' | 'countdown' | 'go' | 'complete';
    count: number;
    message: string;
  }>({
    phase: 'ready',
    count: 3,
    message: 'Get Ready'
  });

  // Convert targets to device statuses for game flow
  const convertTargetsToDevices = (targets: Target[]): DeviceStatus[] => {
    return targets.map(target => ({
      deviceId: typeof target.id === 'string' ? target.id : (target.id as { id: string })?.id || String(target.id),
      name: target.name,
      gameStatus: 'idle' as const,
      wifiStrength: target.status === 'online' ? 85 : 0,
      ambientLight: 'good' as const,
      hitCount: 0,
      lastSeen: target.status === 'online' ? Date.now() : 0,
      isOnline: target.status === 'online'
    }));
  };

  const availableDevices = convertTargetsToDevices(availableTargets);

  // Get token from localStorage
  const token = localStorage.getItem('tb_access');

  // Debug logging
  console.log('🔍 Scenarios page state:', {
    roomsCount: rooms.length,
    selectedRoomId,
    availableTargetsCount: availableTargets.length,
    selectedTargetsCount: selectedTargets.length,
    loadingTargets,
    isDemoMode,
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

  // Load targets based on demo/live mode
  useEffect(() => {
    const loadTargets = async () => {
      setLoadingTargets(true);
      try {
        if (isDemoMode) {
          // Demo mode - use mock data
          setAvailableTargets(mockTargets);
          console.log(`🎭 Demo mode: Loaded ${mockTargets.length} mock targets`);
        } else {
          // Live mode - use real ThingsBoard data
          console.log('🔄 Live mode: Loading all targets from ThingsBoard...');
          const targets = await API.getTargets() as Target[];
          setAvailableTargets(targets);
          console.log(`✅ Live mode: Loaded ${targets.length} real targets from ThingsBoard`);
        }
      } catch (error) {
        console.error('❌ Failed to load targets:', error);
        setAvailableTargets([]);
      } finally {
        setLoadingTargets(false);
      }
    };

    loadTargets();
  }, [isDemoMode]);

  // Don't auto-select room - let user choose or see all targets
  // React.useEffect(() => {
  //   if (rooms.length > 0 && selectedRoomId === null) {
  //     setSelectedRoomId(Number(rooms[0].id));
  //   }
  // }, [rooms, selectedRoomId]);

  // Load targets when room is selected
  useEffect(() => {
    const loadRoomTargets = async () => {
      if (selectedRoomId === null) {
        // No room selected - show all targets
        if (isDemoMode) {
          setAvailableTargets(mockTargets);
        } else {
          try {
            const targets = await API.getTargets() as Target[];
            setAvailableTargets(targets);
          } catch (error) {
            console.error('Failed to load all targets:', error);
            setAvailableTargets([]);
          }
        }
        return;
      }
      
      setLoadingTargets(true);
      try {
        if (isDemoMode) {
          // Demo mode - filter mock targets by room
          const roomTargets = mockTargets.filter(t => t.roomId === selectedRoomId);
          setAvailableTargets(roomTargets);
          console.log(`🎭 Demo mode: Filtered ${roomTargets.length} targets for room ${selectedRoomId}`);
        } else {
          // Live mode - get targets from Supabase
          console.log(`🔄 Live mode: Loading targets for room ${selectedRoomId} from Supabase...`);
          const roomTargets = await getRoomTargets(selectedRoomId.toString());
          setAvailableTargets(roomTargets);
          console.log(`✅ Live mode: Loaded ${roomTargets.length} targets for room ${selectedRoomId}`);
        }
        
        setSelectedTargets([]); // Clear selection when targets change
      } catch (error) {
        console.error('❌ Failed to load room targets:', error);
        if (!isDemoMode) {
          toast.error('Failed to load room targets');
        }
        setAvailableTargets([]);
      } finally {
        setLoadingTargets(false);
      }
    };

    loadRoomTargets();
  }, [selectedRoomId, isDemoMode, getRoomTargets]);

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
        return newSelection;
      });
    } else {
      setSelectedTargets(prev => {
        const newSelection = prev.filter(id => id !== targetId);
        console.log('Target deselected:', targetId, 'Total selected:', newSelection.length, 'IDs:', newSelection);
        return newSelection;
      });
    }
  };

  const handleStartScenario = async (scenarioTemplate: ScenarioTemplate) => {
    if (selectedRoomId === null) {
      toast.error('Please select a room first');
      return;
    }

    const roomIdToUse = selectedRoomId;

    if (selectedTargets.length < scenarioTemplate.targetCount) {
      toast.error(`Please select ${scenarioTemplate.targetCount} targets for this scenario`);
      return;
    }

    const onlineSelectedTargets = availableTargets.filter(
      t => selectedTargets.includes(t.id) && t.status === 'online'
    );

    if (onlineSelectedTargets.length < scenarioTemplate.targetCount) {
      toast.error(`${scenarioTemplate.targetCount} online targets required. Only ${onlineSelectedTargets.length} selected targets are online.`);
      return;
    }

    if (isDemoMode) {
      // Demo mode - use existing countdown flow
      setPendingScenario(scenarioTemplate);
      setShowCountdown(true);
      startInlineCountdown(scenarioTemplate);
    } else {
      // Live mode - use ThingsBoard game flow according to DeviceManagement.md
      console.log('🔴 LIVE MODE: Starting ThingsBoard game flow');
      
      // Generate unique game ID
      const gameId = `GM-${Date.now()}`;
      
      // Start the game flow according to documentation
      await startLiveModeGame(scenarioTemplate, gameId, selectedTargets, gameDuration);
    }
  };

  // Live mode game flow according to DeviceManagement.md
  const startLiveModeGame = async (
    scenarioTemplate: ScenarioTemplate, 
    gameId: string, 
    targetIds: string[], 
    duration: number = 30
  ) => {
    try {
      toast.info('🎮 Starting live game flow...');
      
      // Step 1: Create game session
      console.log('📋 Step 1: Creating game session');
      const { createGame, configureDevices, startGame } = useGameFlow.getState();
      
      const gameCreated = await createGame(scenarioTemplate.name, duration);
      if (!gameCreated) {
        toast.error('Failed to create game session');
        return;
      }
      
      // Step 2: Configure devices (sends 'configure' RPC commands)
      console.log('⚙️ Step 2: Configuring devices');
      toast.info('Configuring devices...');
      
      const configSuccess = await configureDevices();
      if (!configSuccess) {
        toast.error('Failed to configure devices');
        return;
      }
      
      // Step 3: Wait for device responses and start countdown
      console.log('⏳ Step 3: Starting countdown');
      setPendingScenario(scenarioTemplate);
      setShowCountdown(true);
      
      // Custom countdown for live mode
      startLiveModeCountdown(scenarioTemplate, startGame);
      
    } catch (error) {
      console.error('❌ Live mode game flow failed:', error);
      toast.error('Failed to start live game');
    }
  };

  // Live mode countdown that integrates with ThingsBoard
  const startLiveModeCountdown = async (
    scenarioTemplate: ScenarioTemplate, 
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
                setPendingScenario(null);
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
    
    if (!pendingScenario) return;

    const roomIdToUse = selectedRoomId;

    try {
      // Now actually start the scenario after countdown
      await start(pendingScenario, roomIdToUse!.toString(), selectedTargets);
      toast.success(`${pendingScenario.name} scenario started!`);
    } catch (err) {
      toast.error('Failed to start scenario');
    } finally {
      setPendingScenario(null);
    }
  }, [pendingScenario, selectedRoomId, selectedTargets, start]);

  // Start inline countdown within the scenario card
  const startInlineCountdown = React.useCallback(async (scenarioTemplate: ScenarioTemplate) => {
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
                
                {/* Mode Toggle - Compact */}
                <div className="flex items-center gap-2">
                  <div className={`px-2 py-1 rounded-lg text-xs font-body font-medium ${
                    isDemoMode 
                      ? 'bg-yellow-100 text-yellow-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {isDemoMode ? '🎭 Demo' : '🔗 Live'}
                  </div>
                  <Button
                    onClick={() => setIsDemoMode(!isDemoMode)}
                    disabled={active}
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs font-body border border-brand-secondary/30 text-brand-secondary hover:bg-brand-primary hover:text-white hover:border-brand-primary"
                  >
                    Toggle
                  </Button>

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
                      {availableTargets.filter(t => t.status === 'online').length}
                    </div>
                    <div className="text-xs sm:text-sm text-brand-text/60 font-body">Online Targets</div>
                  </div>
                  <div className="w-px h-8 sm:h-10 lg:h-12 bg-gray-200"></div>
                  <div className="text-center">
                    <div className="text-lg sm:text-xl lg:text-2xl font-heading font-bold text-brand-primary mb-1">
                      {SCENARIOS.length}
                    </div>
                    <div className="text-xs sm:text-sm text-brand-text/60 font-body">Training Scenarios</div>
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
                <div className={`bg-brand-surface rounded-xl p-4 shadow-subtle border border-gray-100 ${
                  !isDemoMode ? 'opacity-50 pointer-events-none' : ''
                }`}>
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
                          value={selectedRoomId || ''}
                          onChange={(e) => setSelectedRoomId(e.target.value ? parseInt(e.target.value) : null)}
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
                <div className={`bg-brand-surface rounded-xl p-4 shadow-subtle border border-gray-100 ${
                  !isDemoMode ? 'opacity-50 pointer-events-none' : ''
                }`}>
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
                            const isOnline = target.status === 'online';
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
                          <span>{availableTargets.filter(t => t.status === 'online').length} online</span>
                          <span>{selectedTargets.length} selected</span>
                        </div>
                      </>
                    )}
                  </div>
              </div>

              {/* Right Column - Double Tap Scenario */}
              <div className="lg:col-span-9">
                {SCENARIOS.map((template, index) => (
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
                      onClick={() => handleStartScenario(template)}
                      disabled={
                        active || 
                        showCountdown || 
                        (!isDemoMode && selectedRoomId === null) || 
                        selectedTargets.length < template.targetCount
                      }
                      className="w-full h-12 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-gray-300 disabled:text-gray-500 text-white font-body text-base font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <TargetIcon className="h-5 w-5 mr-2" />
                      {active && current?.id === template.id ? 'Scenario Running...' : 
                       showCountdown && pendingScenario?.id === template.id ? 'Starting...' : 'Start Session'}
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
      {showCountdown && pendingScenario && (
        <div className="fixed inset-0 z-50 bg-purple-600 bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-4xl md:text-6xl font-heading font-bold mb-8">
              {pendingScenario.name}
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
                  <div className="text-2xl font-heading font-bold">{pendingScenario.targetCount}</div>
                  <div className="text-sm opacity-75">Targets</div>
                </div>
                <div>
                  <div className="text-2xl font-heading font-bold">{pendingScenario.shotsPerTarget}</div>
                  <div className="text-sm opacity-75">Shots Each</div>
                </div>
                <div>
                  <div className="text-2xl font-heading font-bold">{Math.round(pendingScenario.timeLimitMs / 1000)}s</div>
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