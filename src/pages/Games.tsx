import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Gamepad2, 
  Play, 
  Square, 
  Plus,
  Wifi, 
  WifiOff, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Activity,
  Target as TargetIcon,
  ArrowLeft,
  Trophy,
  BarChart3
} from 'lucide-react';
import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import MobileDrawer from '@/components/shared/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGameFlow } from '@/store/useGameFlow';
import { GameHistory } from '@/services/device-game-flow';

// Define GameSummary interface locally since it's from the popup component
interface GameSummary {
  totalHits: number;
  gameDuration: number;
  averageHitInterval: number;
  targetStats: Array<{
    deviceId: string;
    deviceName: string;
    hitCount: number;
    hitTimes: number[];
    averageInterval: number;
    firstHitTime: number;
    lastHitTime: number;
  }>;
  crossTargetStats: {
    totalSwitches: number;
    averageSwitchTime: number;
    switchTimes: number[];
  };
}
import { deviceGameFlowService, DeviceStatus } from '@/services/device-game-flow';
import { demoGameFlowService } from '@/services/demo-game-flow';
import { toast } from '@/components/ui/sonner';
import API from '@/lib/api';
import type { Target } from '@/store/useTargets';
import GameCountdownPopup from '@/components/game-flow/GameCountdownPopup';

type GameStage = 'main-dashboard' | 'configuration' | 'game-window';

const Games: React.FC = () => {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentStage, setCurrentStage] = useState<GameStage>('main-dashboard');
  
  // Game Flow State
  const {
    currentSession,
    devices,
    selectedDevices,
    gameHistory,
    isConfiguring,
    isGameActive,
    error,
    initializeDevices,
    selectDevices,
    createGame,
    configureDevices,
    startGame,
    stopGame,
    endGame,
    setError,
    clearError,
    loadGameHistory,
    addGameToHistory
  } = useGameFlow();

  // Configuration state
  const [gameName, setGameName] = useState('');
  const [gameDuration, setGameDuration] = useState(30);
  const [availableDevices, setAvailableDevices] = useState<DeviceStatus[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  
  // Demo mode state
  const [isDemoMode, setIsDemoMode] = useState(true); // Default to demo mode
  
  // Countdown popup state
  const [showCountdownPopup, setShowCountdownPopup] = useState(false);
  const [countdownGameData, setCountdownGameData] = useState<{
    gameName: string;
    duration: number;
    devices: DeviceStatus[];
  } | null>(null);

  // Load available devices (demo or real)
  useEffect(() => {
    const loadDevices = async () => {
      setLoadingDevices(true);
      try {
        if (isDemoMode) {
          // Demo mode - use mock devices
          console.log('🎭 DEMO MODE: Loading mock devices...');
          const mockDevices = demoGameFlowService.getMockDevices();
          setAvailableDevices(mockDevices);
          await initializeDevices(mockDevices.map(d => d.deviceId));
          
          const onlineCount = mockDevices.filter(d => d.isOnline).length;
          toast.success(`🎭 Demo mode: ${onlineCount} mock devices loaded`);
          console.log(`✅ DEMO: Loaded ${mockDevices.length} mock devices`);
          
        } else {
          // Live mode - use real ThingsBoard data
          console.log('🔄 LIVE MODE: Loading devices from ThingsBoard...');
          const targets = await API.getTargets() as Target[];
          
          console.log('📊 Raw targets data:', targets);
          console.log('📊 Target statuses:', targets.map(t => ({ name: t.name, status: t.status, id: t.id })));
          
          // Convert targets to device statuses
          const deviceStatuses: DeviceStatus[] = targets.map(target => {
            // Check various possible status values
            const isOnline = target.status === 'online';
            
            console.log(`🎯 Device ${target.name}: status="${target.status}", isOnline=${isOnline}`);
            
            return {
              deviceId: typeof target.id === 'string' ? target.id : (target.id as { id: string })?.id || String(target.id),
              name: target.name,
              gameStatus: 'idle',
              wifiStrength: isOnline ? 85 : 0,
              ambientLight: 'good',
              hitCount: 0,
              lastSeen: isOnline ? Date.now() : 0,
              isOnline: isOnline,
              hitTimes: []
            };
          });

          console.log('🎮 Converted device statuses:', deviceStatuses);
          console.log(`📈 Online devices: ${deviceStatuses.filter(d => d.isOnline).length}/${deviceStatuses.length}`);

          setAvailableDevices(deviceStatuses);
          await initializeDevices(deviceStatuses.map(d => d.deviceId));
          
          console.log(`✅ Loaded ${deviceStatuses.length} devices from ThingsBoard`);
          
          // Show user feedback about device status
          const onlineCount = deviceStatuses.filter(d => d.isOnline).length;
          const offlineCount = deviceStatuses.length - onlineCount;
          
          if (deviceStatuses.length === 0) {
            toast.warning('No devices found in ThingsBoard');
          } else if (onlineCount === 0) {
            toast.warning('All devices are currently offline', {
              description: 'At least 1 online device is required to create a game'
            });
          } else if (offlineCount > 0) {
            toast.info(`${onlineCount} online, ${offlineCount} offline devices found`);
          } else {
            toast.success(`${onlineCount} devices online and ready for games`);
          }
        }
        
      } catch (error) {
        console.error('❌ Failed to load devices:', error);
        toast.error('Failed to load devices');
        setAvailableDevices([]);
      } finally {
        setLoadingDevices(false);
      }
    };

    loadDevices();
  }, [initializeDevices, isDemoMode]);

  // Load game history when component mounts
  useEffect(() => {
    loadGameHistory();
  }, [loadGameHistory]);

  // Handle device selection
  const handleDeviceSelection = (deviceId: string, checked: boolean) => {
    const currentSelection = selectedDevices;
    if (checked) {
      selectDevices([...currentSelection, deviceId]);
    } else {
      selectDevices(currentSelection.filter(id => id !== deviceId));
    }
  };

  // Handle new game creation (Configuration Stage)
  // According to DeviceManagement.md: "Press Create Game Button" action
  const handleCreateGame = async () => {
    // Input validation
    if (!gameName.trim()) {
      setError('Please enter a game name');
      return;
    }
    
    if (selectedDevices.length === 0) {
      setError('Please select at least one device');
      return;
    }

    // Check if selected devices are online
    const onlineSelectedDevices = availableDevices.filter(
      d => selectedDevices.includes(d.deviceId) && d.isOnline
    );

    if (onlineSelectedDevices.length === 0) {
      setError('You need to have at least 1 device online to create a game');
      toast.error('Cannot create game', {
        description: 'At least 1 online device is required to start a game session'
      });
      return;
    }

    if (onlineSelectedDevices.length < selectedDevices.length) {
      const offlineCount = selectedDevices.length - onlineSelectedDevices.length;
      toast.error(`${offlineCount} selected device(s) are offline and will be skipped`);
    }

    console.log('🎮 Starting game creation flow according to DeviceManagement.md');
    console.log(`📋 Game: "${gameName}", Duration: ${gameDuration}m, Devices: ${onlineSelectedDevices.length}`);
    
    try {
      clearError();
      
      // Set configuring state to show loading UI
      const { isConfiguring } = useGameFlow.getState();
      if (isConfiguring) return; // Prevent double-clicks
      
      // Generate unique game ID (as per documentation format: GM-001)
      const gameId = `GM-${Date.now().toString().slice(-6)}`;
      
      // Step 1: Create game session with selected devices
      console.log('📋 Step 1: Creating game session...');
      toast.info('Creating game session...', {
        description: `Setting up game "${gameName}" for ${onlineSelectedDevices.length} devices`
      });
      
      // Create the game session with only online devices
      const gameSession = deviceGameFlowService.createGameSession(
        gameId,
        gameName,
        gameDuration,
        onlineSelectedDevices.map(d => d.deviceId)
      );

      // Step 2: Send 'configure' RPC commands to each selected device
      console.log('⚙️ Step 2: Sending configure commands to devices...');
      toast.info('Configuring devices...', { 
        description: `Sending configure commands to ${onlineSelectedDevices.length} devices` 
      });
      
      // Send configure commands according to DeviceManagement.md
      const configResults = isDemoMode 
        ? await demoGameFlowService.configureDevices(
            onlineSelectedDevices.map(d => d.deviceId),
            gameId,
            gameDuration
          )
        : await deviceGameFlowService.configureDevices(
            onlineSelectedDevices.map(d => d.deviceId),
            gameId,
            gameDuration
          );

      if (configResults.failed.length > 0) {
        toast.error(`Failed to configure ${configResults.failed.length} devices`);
        if (configResults.success.length === 0) {
          setError('All device configuration failed');
          return;
        }
      }

      console.log(`✅ Configure commands sent to ${configResults.success.length} devices`);
      
      // Step 3: Subscribe to device events to receive responses
      console.log('📡 Step 3: Subscribing to device telemetry...');
      configResults.success.forEach(deviceId => {
        const service = isDemoMode ? demoGameFlowService : deviceGameFlowService;
        service.subscribeToDeviceEvents(deviceId, (event) => {
          console.log(`📨 Device response received from ${deviceId}:`, event);
          
          // Update the UI state when devices respond
          const updatedDevices = service.getAllDeviceStatuses();
          setAvailableDevices(updatedDevices);
          
          // In live mode, also update countdown popup if it's open
          if (!isDemoMode && showCountdownPopup && countdownGameData) {
            setCountdownGameData(prev => ({
              ...prev!,
              devices: updatedDevices
            }));
          }
        });
      });
      
      // Step 4: Wait for device responses (info events with gameStatus: idle)
      console.log('⏳ Step 4: Waiting for device responses...');
      toast.info('Waiting for device responses...', {
        description: 'Devices should respond with status: idle, wifiStrength, ambientLight'
      });

      // Wait 3 seconds for device responses as per documentation
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 5: Update game session with current device states
      const service = isDemoMode ? demoGameFlowService : deviceGameFlowService;
      const updatedSession = service.getGameSession(gameId);
      if (updatedSession) {
        // Update our local state to match the game session
        setAvailableDevices(updatedSession.devices);
      }

      // Step 6: Show countdown popup instead of transitioning to game window
      console.log('🎯 Step 6: Showing countdown popup');
      
      // Set up countdown popup data
      setCountdownGameData({
        gameName,
        duration: gameDuration,
        devices: onlineSelectedDevices
      });
      
      // Show countdown popup
      setShowCountdownPopup(true);
      
      toast.success('Game configured successfully!', {
        description: 'Get ready for the countdown!'
      });
      
    } catch (error) {
      console.error('❌ Failed to create game:', error);
      setError('Failed to create game: ' + (error as Error).message);
      toast.error('Game creation failed');
    }
  };

  // Handle game start from countdown popup
  const handleStartGame = async () => {
    if (!currentSession) return;
    
    console.log(`🚀 ${isDemoMode ? 'DEMO' : 'LIVE'}: Starting game from countdown popup`);
    
    try {
      const deviceIds = currentSession.devices.map(d => d.deviceId);
      const service = isDemoMode ? demoGameFlowService : deviceGameFlowService;
      
      // Send start commands
      const startResults = await service.startGame(deviceIds, currentSession.gameId);
      
      if (startResults.success.length > 0) {
        // Update session status
        service.updateGameSessionStatus(currentSession.gameId, 'active');
        
        // Start periodic monitoring (demo mode simulates this)
        if (isDemoMode) {
          const intervalId = service.startPeriodicInfoRequests(deviceIds, currentSession.gameId);
          // In demo mode, also simulate game timeout
          demoGameFlowService.simulateGameTimeout(
            currentSession.gameId, 
            deviceIds, 
            currentSession.duration * 60 * 1000 // Convert minutes to milliseconds
          );
        }
        
        console.log(`✅ Game started! ${startResults.success.length} devices are now active.`);
      } else {
        toast.error('Failed to start game on any devices');
      }
    } catch (error) {
      console.error('Failed to start game:', error);
      toast.error('Failed to start game');
    }
  };

  // Handle game stop
  const handleStopGame = async () => {
    if (!currentSession) return;
    
    console.log(`🛑 ${isDemoMode ? 'DEMO' : 'LIVE'}: Stopping game according to DeviceManagement.md`);
    
    try {
      const deviceIds = currentSession.devices.map(d => d.deviceId);
      const service = isDemoMode ? demoGameFlowService : deviceGameFlowService;
      
      // Send stop commands
      const stopResults = await service.stopGame(deviceIds, currentSession.gameId);
      
      if (stopResults.success.length > 0) {
        // Update session status
        service.updateGameSessionStatus(currentSession.gameId, 'stopped');
        
        toast.success(`Game stopped! Final scores recorded for ${stopResults.success.length} devices.`);
      } else {
        toast.error('Failed to stop game on any devices');
      }
    } catch (error) {
      console.error('Failed to stop game:', error);
      toast.error('Failed to stop game');
    }
  };

  // Handle countdown popup close
  const handleCountdownClose = () => {
    setShowCountdownPopup(false);
    setCountdownGameData(null);
    setCurrentStage('main-dashboard');
    setGameName('');
    selectDevices([]);
  };

  // Handle countdown popup end game
  const handleCountdownEndGame = async (gameSummary: GameSummary) => {
    if (currentSession) {
      // Save game to history with detailed statistics
      const service = isDemoMode ? demoGameFlowService : deviceGameFlowService;
      const session = service.getGameSession(currentSession.gameId);
      if (session) {
        // Update session with end time
        service.updateGameSessionStatus(currentSession.gameId, 'completed');
        
        // Save to history with detailed statistics
        const historyEntry: GameHistory = {
          gameId: session.gameId,
          gameName: session.gameName,
          duration: session.duration,
          startTime: session.startTime,
          endTime: Date.now(),
          deviceResults: session.devices.map(device => ({
            deviceId: device.deviceId,
            deviceName: device.name,
            hitCount: device.hitCount
          })),
          // Add detailed statistics
          totalHits: gameSummary.totalHits,
          actualDuration: gameSummary.gameDuration,
          averageHitInterval: gameSummary.averageHitInterval,
          targetStats: gameSummary.targetStats,
          crossTargetStats: gameSummary.crossTargetStats
        };
        
        // Add to game history
        addGameToHistory(historyEntry);
        console.log('💾 Saved detailed game to history:', historyEntry);
      }
      
      // Clean up resources
      if (isDemoMode) {
        demoGameFlowService.cleanup();
      }
    }
    
    await endGame();
    setShowCountdownPopup(false);
    setCountdownGameData(null);
    setCurrentStage('main-dashboard');
    setGameName('');
    selectDevices([]);
    
    toast.success('Game completed! Results saved to history.');
  };

  // Handle back to main dashboard
  const handleBackToMain = async () => {
    if (isGameActive) {
      // If game is running, stop it first
      await handleStopGame();
    }
    
    // Clean up based on mode
    if (isDemoMode && currentSession) {
      // Save demo game to history
      const service = demoGameFlowService;
      const session = service.getGameSession(currentSession.gameId);
      if (session && session.endTime) {
        const historyEntry: GameHistory = {
          gameId: session.gameId,
          gameName: session.gameName,
          duration: session.duration,
          startTime: session.startTime,
          endTime: session.endTime,
          deviceResults: session.devices.map(device => ({
            deviceId: device.deviceId,
            deviceName: device.name,
            hitCount: device.hitCount
          })),
          // Add required properties with default values
          totalHits: session.devices.reduce((sum, device) => sum + device.hitCount, 0),
          actualDuration: Math.round((session.endTime - session.startTime) / 1000),
          averageHitInterval: 0,
          targetStats: session.devices.map(device => ({
            deviceId: device.deviceId,
            deviceName: device.name,
            hitCount: device.hitCount,
            hitTimes: device.hitTimes || [],
            averageInterval: 0,
            firstHitTime: 0,
            lastHitTime: 0
          })),
          crossTargetStats: {
            totalSwitches: 0,
            averageSwitchTime: 0,
            switchTimes: []
          }
        };
        
        // Add to game history (we'll update the store to handle this)
        console.log('💾 DEMO: Saving game to history:', historyEntry);
      }
      
      // Clean up demo resources
      demoGameFlowService.cleanup();
    }
    
    await endGame();
    setCurrentStage('main-dashboard');
    setGameName('');
    selectDevices([]);
  };

  // Get device status badge
  const getDeviceStatusBadge = (device: DeviceStatus) => {
    if (!device.isOnline) {
      return <Badge variant="destructive" className="text-xs">Offline</Badge>;
    }
    
    switch (device.gameStatus) {
      case 'start':
        return <Badge className="text-xs bg-green-500 text-white">Active</Badge>;
      case 'stop':
        return <Badge variant="secondary" className="text-xs">Stopped</Badge>;
      case 'idle':
        return <Badge variant="outline" className="text-xs">Idle</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Unknown</Badge>;
    }
  };

  // Get WiFi strength indicator
  const getWifiIndicator = (strength: number) => {
    if (strength >= 80) return <Wifi className="h-4 w-4 text-green-500" />;
    if (strength >= 50) return <Wifi className="h-4 w-4 text-yellow-500" />;
    return <WifiOff className="h-4 w-4 text-red-500" />;
  };

  // Get ambient light indicator
  const getAmbientLightColor = (light: string) => {
    switch (light) {
      case 'good': return 'text-green-500';
      case 'average': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
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
            
            {/* Error Display */}
            {error && (
              <Card className="border-red-200 bg-red-50 mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-red-800 font-medium">{error}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearError}
                      className="ml-auto text-red-600 hover:text-red-800"
                    >
                      ×
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Dashboard Stage */}
            {currentStage === 'main-dashboard' && (
              <div className="space-y-6">
                {/* Header */}
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
                    {/* Demo Mode Toggle */}
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
                        disabled={isGameActive}
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs font-body border border-brand-secondary/30 text-brand-secondary hover:bg-brand-primary hover:text-white hover:border-brand-primary"
                      >
                        Toggle
                      </Button>
                    </div>

                    <Button
                      onClick={() => setCurrentStage('configuration')}
                      className="bg-brand-primary hover:bg-brand-primary/90 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Game
                    </Button>
                  </div>
                </div>

                {/* Game Statistics - Stats Card Style */}
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg">
                    <CardContent className="p-2 md:p-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
                          <p className="text-xs font-medium text-brand-dark/70 font-body">Total Devices</p>
                          <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">
                            {availableDevices.length}
                          </p>
                          <p className="text-xs text-brand-dark/50 font-body">
                            {availableDevices.filter(d => d.isOnline).length} online
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
                            {gameHistory.reduce((sum, game) => 
                              sum + game.deviceResults.reduce((gameSum, result) => gameSum + result.hitCount, 0), 0
                            )}
                          </p>
                          <p className="text-xs text-brand-dark/50 font-body">All time</p>
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
                            {gameHistory.length > 0 ? 
                              Math.max(...gameHistory.map(game => 
                                game.deviceResults.reduce((sum, result) => sum + result.hitCount, 0)
                              )) : 0
                            }
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

                {/* Device Status Cards */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <TargetIcon className="h-5 w-5" />
                    <h2 className="font-heading text-xl font-semibold text-brand-text">Device Status</h2>
                  </div>
                  
                  {loadingDevices ? (
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
                      {[...Array(6)].map((_, i) => (
                        <Card key={i} className="bg-white border-gray-200 shadow-sm rounded-sm md:rounded-lg">
                          <CardContent className="p-2 md:p-6">
                            <div className="animate-pulse space-y-3">
                              <div className="h-4 bg-gray-200 rounded"></div>
                              <div className="h-8 bg-gray-200 rounded"></div>
                              <div className="h-4 bg-gray-200 rounded"></div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : availableDevices.length === 0 ? (
                    <Card className="bg-white border-gray-200 shadow-sm rounded-sm md:rounded-lg">
                      <CardContent className="p-8 text-center">
                        <TargetIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Devices Found</h3>
                        <p className="text-gray-600">Connect devices to ThingsBoard to get started</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
                      {availableDevices.map(device => (
                        <Card 
                          key={device.deviceId} 
                          className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 rounded-sm md:rounded-lg"
                        >
                          <CardContent className="p-2 md:p-6">
                            <div className="flex items-start justify-between mb-2 md:mb-4">
                              <div className="flex-1 flex flex-col items-center">
                                <div className="flex items-center gap-1 md:gap-2 mb-1">
                                  <div className={`w-2 h-2 md:w-4 md:h-4 rounded-full ${
                                    device.isOnline ? 'bg-green-500' : 'bg-gray-400'
                                  }`}></div>
                                  <h3 className="font-heading font-semibold text-brand-dark text-xs md:text-base text-center">
                                    {device.name}
                                  </h3>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1 md:space-y-3">
                              {/* Hit Count - Primary Metric */}
                              <div className="text-center">
                                <div className="text-lg md:text-2xl font-bold text-brand-primary font-heading">
                                  {device.hitCount}
                                </div>
                                <div className="text-xs md:text-sm text-brand-dark/70 font-body">Hits</div>
                              </div>

                              {/* Device Status Indicators */}
                              <div className="space-y-1 md:space-y-2">
                                {/* WiFi Strength */}
                                <div className="flex items-center justify-between text-xs md:text-sm">
                                  <span className="text-brand-dark/70 font-body">WiFi</span>
                                  <div className="flex items-center gap-1">
                                    {getWifiIndicator(device.wifiStrength)}
                                    <span className="font-medium text-brand-dark">{device.wifiStrength}%</span>
                                  </div>
                                </div>

                                {/* Ambient Light */}
                                <div className="flex items-center justify-between text-xs md:text-sm">
                                  <span className="text-brand-dark/70 font-body">Light</span>
                                  <div className={`flex items-center gap-1 ${getAmbientLightColor(device.ambientLight)}`}>
                                    <div className="w-2 h-2 rounded-full bg-current"></div>
                                    <span className="font-medium capitalize">{device.ambientLight}</span>
                                  </div>
                                </div>

                                {/* Game Status */}
                                <div className="flex items-center justify-between text-xs md:text-sm">
                                  <span className="text-brand-dark/70 font-body">Status</span>
                                  <span className="font-medium text-brand-dark capitalize">{device.gameStatus}</span>
                                </div>

                                {/* Last Seen */}
                                {device.lastSeen > 0 && (
                                  <div className="flex items-center justify-between text-xs md:text-sm">
                                    <span className="text-brand-dark/70 font-body">Last Seen</span>
                                    <span className="font-medium text-brand-dark">
                                      {new Date(device.lastSeen).toLocaleTimeString()}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Status Badges */}
                              <div className="pt-1 md:pt-2 flex justify-center gap-1 md:gap-2">
                                <Badge 
                                  variant={device.isOnline ? 'default' : 'secondary'}
                                  className={`text-xs rounded-sm md:rounded ${
                                    device.isOnline 
                                      ? 'bg-green-100 text-green-700 border-green-200' 
                                      : 'bg-gray-100 text-gray-600 border-gray-200'
                                  }`}
                                >
                                  {device.isOnline ? 'Online' : 'Offline'}
                                </Badge>
                                
                                <Badge 
                                  variant="outline"
                                  className={`text-xs rounded-sm md:rounded ${
                                    device.gameStatus === 'start' 
                                      ? 'bg-red-50 text-red-700 border-red-200' 
                                      : device.gameStatus === 'stop'
                                      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                      : 'bg-gray-50 text-gray-600 border-gray-200'
                                  }`}
                                >
                                  {device.gameStatus === 'start' ? '🎯' + (!isMobile ? ' Active' : '') : 
                                   device.gameStatus === 'stop' ? '🛑' + (!isMobile ? ' Stopped' : '') : 
                                   '😴' + (!isMobile ? ' Idle' : '')}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Game History - Stats Card Style */}
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
                      {gameHistory.slice(0, 6).map((game) => {
                        const totalHits = game.deviceResults.reduce((sum, r) => sum + r.hitCount, 0);
                        const bestDevice = game.deviceResults.reduce((best, r) => 
                          r.hitCount > best.hitCount ? r : best
                        );
                        const avgHits = Math.round(totalHits / game.deviceResults.length);
                        
                        return (
                          <Card 
                            key={game.gameId} 
                            className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg cursor-pointer"
                          >
                            <CardContent className="p-2 md:p-4">
                              <div className="flex items-start gap-2">
                                <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
                                  <p className="text-xs font-medium text-brand-dark/70 font-body">
                                    {game.gameName}
                                  </p>
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
                              
                              {/* Game Stats */}
                              <div className="mt-1 md:mt-3 space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-brand-dark/70">Devices</span>
                                  <span className="font-medium text-brand-dark">{game.deviceResults.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-brand-dark/70">Best Score</span>
                                  <span className="font-medium text-brand-dark">{bestDevice.hitCount}</span>
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

            {/* Configuration Stage */}
            {currentStage === 'configuration' && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentStage('main-dashboard')}
                    className="p-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-left">
                    <h1 className="font-heading text-2xl md:text-3xl font-semibold text-brand-text mb-2">
                      Create New Game
                    </h1>
                    <p className="font-body text-brand-text/70 text-sm md:text-base">
                      Configure game settings and select devices
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-4">
                  {/* Game Configuration */}
                  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg h-fit">
                    <CardHeader className="pb-2">
                      <CardTitle className="font-heading text-lg font-semibold text-brand-dark">Game Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 md:p-4 space-y-3">
                      <div>
                        <Label htmlFor="gameName" className="text-xs font-medium text-brand-dark/70 font-body">Game Name</Label>
                        <Input
                          id="gameName"
                          value={gameName}
                          onChange={(e) => setGameName(e.target.value)}
                          placeholder="Enter game name"
                          className="mt-1 border-gray-300 focus:border-brand-primary h-9"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="gameDuration" className="text-xs font-medium text-brand-dark/70 font-body">Duration (minutes)</Label>
                        <select
                          id="gameDuration"
                          value={gameDuration}
                          onChange={(e) => setGameDuration(Number(e.target.value))}
                          className="w-full mt-1 p-2 h-9 border border-gray-300 rounded-md focus:border-brand-primary focus:outline-none text-sm"
                        >
                          <option value={1}>1 minute</option>
                          <option value={5}>5 minutes</option>
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={45}>45 minutes</option>
                          <option value={60}>60 minutes</option>
                        </select>
                      </div>

                      <Button
                        onClick={handleCreateGame}
                        disabled={!gameName.trim() || selectedDevices.length === 0 || isConfiguring}
                        className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white h-9 mt-4"
                      >
                        {isConfiguring ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2 animate-spin" />
                            Configuring...
                          </>
                        ) : (
                          <>
                            <Gamepad2 className="h-4 w-4 mr-2" />
                            Create Game
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Device Selection */}
                  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-heading text-lg font-semibold text-brand-dark flex items-center justify-between">
                        Select Devices
                        <Badge variant="outline" className="text-xs">
                          {selectedDevices.length} selected
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 md:p-4">
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {availableDevices.map(device => (
                          <Card
                            key={device.deviceId}
                            className={`border-gray-200 shadow-sm transition-all duration-200 rounded-sm md:rounded-lg ${
                              selectedDevices.includes(device.deviceId)
                                ? 'bg-red-50 border-red-200 shadow-md'
                                : 'bg-white hover:shadow-md'
                            } ${!device.isOnline ? 'opacity-50' : ''}`}
                          >
                            <CardContent className="p-2 md:p-3">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 flex items-center gap-2">
                                  <Checkbox
                                    id={`device-${device.deviceId}`}
                                    checked={selectedDevices.includes(device.deviceId)}
                                    onCheckedChange={(checked) => 
                                      handleDeviceSelection(device.deviceId, checked as boolean)
                                    }
                                    disabled={false}
                                    className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 data-[state=checked]:text-white"
                                  />
                                  <div className="flex items-center gap-1">
                                    <div className={`w-2 h-2 rounded-full ${
                                      device.isOnline ? 'bg-green-500' : 'bg-gray-400'
                                    }`}></div>
                                    <Label 
                                      htmlFor={`device-${device.deviceId}`}
                                      className={`font-heading font-semibold text-xs md:text-sm ${
                                        device.isOnline ? 'text-brand-dark' : 'text-gray-400'
                                      }`}
                                    >
                                      {device.name}
                                    </Label>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Device Status Indicators */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-brand-dark/70 font-body">WiFi</span>
                                  <div className="flex items-center gap-1">
                                    {getWifiIndicator(device.wifiStrength)}
                                    <span className="font-medium text-brand-dark">{device.wifiStrength}%</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-brand-dark/70 font-body">Light</span>
                                  <div className={`flex items-center gap-1 ${getAmbientLightColor(device.ambientLight)}`}>
                                    <div className="w-2 h-2 rounded-full bg-current"></div>
                                    <span className="font-medium capitalize">{device.ambientLight}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Status Badge */}
                              <div className="pt-2 flex justify-center">
                                <Badge 
                                  variant={device.isOnline ? 'default' : 'secondary'}
                                  className={`text-xs rounded-sm md:rounded ${
                                    device.isOnline 
                                      ? 'bg-green-100 text-green-700 border-green-200' 
                                      : 'bg-gray-100 text-gray-600 border-gray-200'
                                  }`}
                                >
                                  {device.isOnline ? 'Online' : 'Offline'}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Game Window Stage */}
            {currentStage === 'game-window' && currentSession && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      onClick={handleBackToMain}
                      className="p-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <h1 className="font-heading text-2xl md:text-3xl font-semibold text-brand-text">
                        {currentSession.gameName}
                      </h1>
                      <p className="font-body text-brand-text/70 text-sm md:text-base">
                        Game ID: {currentSession.gameId} • {currentSession.duration} minutes
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!isGameActive ? (
                      <Button
                        onClick={handleStartGame}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Game
                      </Button>
                    ) : (
                      <Button
                        onClick={handleStopGame}
                        variant="destructive"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Stop Game
                      </Button>
                    )}
                  </div>
                </div>

                {/* Game Status */}
                {isGameActive && (
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="font-semibold text-green-800">Game Active</span>
                        <span className="text-green-600">• Monitoring devices every 5 seconds</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Device Cards - Game Window */}
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
                  {currentSession.devices.map(device => (
                    <Card
                      key={device.deviceId}
                      className={`bg-white border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 rounded-sm md:rounded-lg ${
                        device.gameStatus === 'start' 
                          ? 'ring-2 ring-green-500 shadow-lg' 
                          : device.gameStatus === 'stop'
                          ? 'ring-2 ring-red-500 shadow-lg'
                          : ''
                      }`}
                    >
                      <CardContent className="p-2 md:p-6">
                        <div className="flex items-start justify-between mb-2 md:mb-4">
                          <div className="flex-1 flex flex-col items-center">
                            <div className="flex items-center gap-1 md:gap-2 mb-1">
                              <div className={`w-2 h-2 md:w-4 md:h-4 rounded-full ${
                                device.isOnline ? 'bg-green-500' : 'bg-gray-400'
                              }`}></div>
                              <h3 className="font-heading font-semibold text-brand-dark text-xs md:text-base text-center">
                                {device.name}
                              </h3>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 md:space-y-3">
                          {/* Hit Count - Primary Metric */}
                          <div className="text-center">
                            <div className="text-lg md:text-3xl font-bold text-brand-primary font-heading">
                              {device.hitCount}
                            </div>
                            <div className="text-xs md:text-sm text-brand-dark/70 font-body">Hits</div>
                          </div>

                          {/* Device Status Indicators */}
                          <div className="space-y-1 md:space-y-2">
                            {/* WiFi Strength */}
                            <div className="flex items-center justify-between text-xs md:text-sm">
                              <span className="text-brand-dark/70 font-body">WiFi</span>
                              <div className="flex items-center gap-1">
                                {getWifiIndicator(device.wifiStrength)}
                                <span className="font-medium text-brand-dark">{device.wifiStrength}%</span>
                              </div>
                            </div>

                            {/* Ambient Light */}
                            <div className="flex items-center justify-between text-xs md:text-sm">
                              <span className="text-brand-dark/70 font-body">Light</span>
                              <div className={`flex items-center gap-1 ${getAmbientLightColor(device.ambientLight)}`}>
                                <div className="w-2 h-2 rounded-full bg-current"></div>
                                <span className="font-medium capitalize">{device.ambientLight}</span>
                              </div>
                            </div>

                            {/* Game Status */}
                            <div className="flex items-center justify-between text-xs md:text-sm">
                              <span className="text-brand-dark/70 font-body">Status</span>
                              <span className="font-medium text-brand-dark capitalize">{device.gameStatus}</span>
                            </div>

                            {/* Last Seen */}
                            {device.lastSeen > 0 && (
                              <div className="flex items-center justify-between text-xs md:text-sm">
                                <span className="text-brand-dark/70 font-body">Last Seen</span>
                                <span className="font-medium text-brand-dark">
                                  {new Date(device.lastSeen).toLocaleTimeString()}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Status Badges */}
                          <div className="pt-1 md:pt-2 flex justify-center gap-1 md:gap-2">
                            <Badge 
                              variant={device.isOnline ? 'default' : 'secondary'}
                              className={`text-xs rounded-sm md:rounded ${
                                device.isOnline 
                                  ? 'bg-green-100 text-green-700 border-green-200' 
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}
                            >
                              {device.isOnline ? 'Online' : 'Offline'}
                            </Badge>
                            
                            <Badge 
                              variant="outline"
                              className={`text-xs rounded-sm md:rounded ${
                                device.gameStatus === 'start' 
                                  ? 'bg-red-50 text-red-700 border-red-200' 
                                  : device.gameStatus === 'stop'
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  : 'bg-gray-50 text-gray-600 border-gray-200'
                              }`}
                            >
                              {device.gameStatus === 'start' ? '🎯' + (!isMobile ? ' Active' : '') : 
                               device.gameStatus === 'stop' ? '🛑' + (!isMobile ? ' Stopped' : '') : 
                               '😴' + (!isMobile ? ' Idle' : '')}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Game Summary */}
                {currentSession && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Game Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-brand-primary">
                            {currentSession.devices.length}
                          </div>
                          <div className="text-sm text-gray-600">Devices</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-brand-primary">
                            {currentSession.devices.reduce((sum, d) => sum + d.hitCount, 0)}
                          </div>
                          <div className="text-sm text-gray-600">Total Hits</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-brand-primary">
                            {currentSession.duration}m
                          </div>
                          <div className="text-sm text-gray-600">Duration</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Countdown Popup */}
      {showCountdownPopup && countdownGameData && (
        <GameCountdownPopup
          isOpen={showCountdownPopup}
          onClose={handleCountdownClose}
          gameName={countdownGameData.gameName}
          duration={countdownGameData.duration}
          devices={countdownGameData.devices}
          onStartGame={handleStartGame}
          onStopGame={handleStopGame}
          onEndGame={handleCountdownEndGame}
          isDemoMode={isDemoMode}
        />
      )}
    </div>
  );
};

export default Games;
