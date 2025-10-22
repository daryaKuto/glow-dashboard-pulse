import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Target as TargetIcon, 
  Play, 
  Square, 
  Wifi, 
  WifiOff, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Activity
} from 'lucide-react';
import { useGameFlow } from '@/store/useGameFlow';
import { DeviceStatus } from '@/services/device-game-flow';
import { toast } from '@/components/ui/sonner';

interface GameFlowDashboardProps {
  availableDevices: DeviceStatus[];
  onGameComplete?: (results: any) => void;
}

const GameFlowDashboard: React.FC<GameFlowDashboardProps> = ({
  availableDevices,
  onGameComplete
}) => {
  const {
    currentSession,
    devices,
    selectedDevices,
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
    clearError
  } = useGameFlow();

  const [gameName, setGameName] = useState('');
  const [gameDuration, setGameDuration] = useState(30);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Initialize devices when component mounts
  useEffect(() => {
    if (availableDevices.length > 0) {
      void initializeDevices(availableDevices);
    }
  }, [availableDevices, initializeDevices]);

  // Handle device selection
  const handleDeviceSelection = (deviceId: string, checked: boolean) => {
    const currentSelection = selectedDevices;
    if (checked) {
      selectDevices([...currentSelection, deviceId]);
    } else {
      selectDevices(currentSelection.filter(id => id !== deviceId));
    }
  };

  // Handle new game creation
  const handleCreateGame = async () => {
    if (!gameName.trim()) {
      setError('Please enter a game name');
      return;
    }
    
    if (selectedDevices.length === 0) {
      setError('Please select at least one device');
      return;
    }

    const success = await createGame(gameName, gameDuration);
    if (success) {
      setShowConfigModal(false);
      toast.success('Game created successfully');
    }
  };

  // Handle device configuration
  const handleConfigureDevices = async () => {
    const result = await configureDevices();

    if (result.warnings.length > 0) {
      result.warnings.forEach(({ deviceId, warning }) => {
        const deviceName = devices.find(device => device.deviceId === deviceId)?.name ?? deviceId;
        toast.warning(`Configure warning for ${deviceName}`, {
          description: warning,
        });
      });
    }

    if (!result.ok) {
      if (result.failed.length > 0) {
        result.failed.forEach((deviceId) => {
          const deviceName = devices.find(device => device.deviceId === deviceId)?.name ?? deviceId;
          toast.error(`Failed to configure ${deviceName}`);
        });
      } else {
        toast.error('Failed to configure devices');
      }
      return;
    }

    toast.success(`Configured ${result.success.length} device${result.success.length === 1 ? '' : 's'} successfully`);
  };

  // Handle game start
  const handleStartGame = async () => {
    const success = await startGame();
    if (success) {
      toast.success('Game started!');
    }
  };

  // Handle game stop
  const handleStopGame = async () => {
    const success = await stopGame();
    if (success) {
      toast.success('Game stopped');
    }
  };

  // Handle game end
  const handleEndGame = async () => {
    await endGame();
    if (onGameComplete) {
      onGameComplete(currentSession);
    }
    toast.success('Game completed');
  };

  // Get device status badge
  const getDeviceStatusBadge = (device: DeviceStatus) => {
    if (!device.isOnline) {
      return <Badge variant="destructive" className="text-xs">Offline</Badge>;
    }
    
    switch (device.gameStatus) {
      case 'start':
        return <Badge variant="default" className="text-xs bg-green-500">Active</Badge>;
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

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
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

      {/* Main Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Device Management */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* Device Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TargetIcon className="h-5 w-5" />
                Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {devices.map(device => (
                  <div
                    key={device.deviceId}
                    className={`p-3 rounded-lg border transition-all ${
                      selectedDevices.includes(device.deviceId)
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`device-${device.deviceId}`}
                          checked={selectedDevices.includes(device.deviceId)}
                          onCheckedChange={(checked) => 
                            handleDeviceSelection(device.deviceId, checked as boolean)
                          }
                          disabled={!device.isOnline}
                        />
                        <Label 
                          htmlFor={`device-${device.deviceId}`}
                          className={`font-medium ${
                            device.isOnline ? 'text-gray-900' : 'text-gray-400'
                          }`}
                        >
                          {device.name}
                        </Label>
                      </div>
                      {getDeviceStatusBadge(device)}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        {getWifiIndicator(device.wifiStrength)}
                        <span>{device.wifiStrength}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        <span>{device.hitCount} hits</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* New Game Button */}
          <Button
            onClick={() => setShowConfigModal(true)}
            disabled={selectedDevices.length === 0 || isGameActive}
            className="w-full"
          >
            <TargetIcon className="h-4 w-4 mr-2" />
            New Game
          </Button>
        </div>

        {/* Right Column - Game Management */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Current Game Status */}
          {currentSession ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  {currentSession.gameName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  
                  {/* Game Info */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-brand-primary">
                        {currentSession.devices.length}
                      </div>
                      <div className="text-sm text-gray-600">Devices</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-brand-primary">
                        {currentSession.duration}m
                      </div>
                      <div className="text-sm text-gray-600">Duration</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-brand-primary">
                        {currentSession.devices.reduce((sum, d) => sum + d.hitCount, 0)}
                      </div>
                      <div className="text-sm text-gray-600">Total Hits</div>
                    </div>
                  </div>

                  {/* Game Controls */}
                  <div className="flex gap-2">
                    {!isGameActive && !isConfiguring && (
                      <Button
                        onClick={handleConfigureDevices}
                        disabled={currentSession.status !== 'configuring'}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Configure Devices
                      </Button>
                    )}
                    
                    {currentSession.status === 'configuring' && !isGameActive && (
                      <Button
                        onClick={handleStartGame}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Game
                      </Button>
                    )}
                    
                    {isGameActive && (
                      <Button
                        onClick={handleStopGame}
                        variant="destructive"
                        className="flex-1"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Stop Game
                      </Button>
                    )}
                    
                    <Button
                      onClick={handleEndGame}
                      variant="outline"
                    >
                      End Game
                    </Button>
                  </div>

                  {/* Device Status in Game */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Device Status</h4>
                    {currentSession.devices.map(device => (
                      <div
                        key={device.deviceId}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <span className="font-medium">{device.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600">
                            {device.hitCount} hits
                          </span>
                          {getDeviceStatusBadge(device)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <TargetIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Active Game
                </h3>
                <p className="text-gray-600 mb-4">
                  Select devices and create a new game to get started
                </p>
                <Button
                  onClick={() => setShowConfigModal(true)}
                  disabled={selectedDevices.length === 0}
                >
                  <TargetIcon className="h-4 w-4 mr-2" />
                  Create New Game
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create New Game</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="gameName">Game Name</Label>
                <Input
                  id="gameName"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  placeholder="Enter game name"
                />
              </div>
              
              <div>
                <Label htmlFor="gameDuration">Duration (minutes)</Label>
                <select
                  id="gameDuration"
                  value={gameDuration}
                  onChange={(e) => setGameDuration(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCreateGame}
                  className="flex-1"
                  disabled={!gameName.trim() || selectedDevices.length === 0}
                >
                  Create Game
                </Button>
                <Button
                  onClick={() => setShowConfigModal(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default GameFlowDashboard;
