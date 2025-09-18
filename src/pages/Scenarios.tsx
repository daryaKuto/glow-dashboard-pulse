import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Target as TargetIcon, AlertCircle, Wifi, WifiOff, CheckCircle } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileDrawer from '@/components/MobileDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { SCENARIOS, type ScenarioTemplate } from '@/data/scenarios';
import { useScenarioRun } from '@/store/useScenarioRun';
import { useRooms } from '@/store/useRooms';
import { toast } from '@/components/ui/sonner';
import API from '@/lib/api';
import { useScenarioLiveData } from '@/hooks/useScenarioLiveData';
import { useScenarioLiveDataMock } from '@/hooks/useScenarioLiveDataMock';
import type { Target } from '@/store/useTargets';
import ScenarioCountdown from '@/components/ScenarioCountdown';
import { countdownService } from '@/services/countdown';

const Scenarios: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { rooms: storeRooms } = useRooms();
  const { active, current, error, start, stop, progress, timeRemaining, currentSession, useMockData, toggleMockMode } = useScenarioRun();

  // Provide mock rooms when in demo mode or when no rooms are available
  const mockRooms = [
    { id: 1, name: 'Training Room A', order: 1, targetCount: 4, icon: 'target' },
    { id: 2, name: 'Training Room B', order: 2, targetCount: 6, icon: 'target' },
    { id: 3, name: 'Practice Range', order: 3, targetCount: 8, icon: 'target' }
  ];

  const rooms = useMockData ? mockRooms : (storeRooms.length > 0 ? storeRooms : mockRooms);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [availableTargets, setAvailableTargets] = useState<Target[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [pendingScenario, setPendingScenario] = useState<ScenarioTemplate | null>(null);

  // Get token from localStorage
  const token = localStorage.getItem('tb_access');

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

  // Use mock or real live data based on mode
  const mockLiveDataResult = useScenarioLiveDataMock(liveDataConfig || defaultConfig);
  const realLiveDataResult = useScenarioLiveData(liveDataConfig || defaultConfig);

  const { liveData, isPolling } = useMockData ? mockLiveDataResult : realLiveDataResult;

  // Auto-select first room if available
  React.useEffect(() => {
    if (rooms.length > 0 && selectedRoomId === null) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  // Load targets when room changes
  useEffect(() => {
    const loadTargets = async () => {
      if (selectedRoomId === null) return;
      
      setLoadingTargets(true);
      try {
        if (useMockData) {
          // Provide mock targets for demo mode
          const mockTargets: Target[] = [
            { id: `target-${selectedRoomId}-1`, name: `Target ${selectedRoomId}A`, status: 'online', roomId: selectedRoomId },
            { id: `target-${selectedRoomId}-2`, name: `Target ${selectedRoomId}B`, status: 'online', roomId: selectedRoomId },
            { id: `target-${selectedRoomId}-3`, name: `Target ${selectedRoomId}C`, status: 'online', roomId: selectedRoomId },
            { id: `target-${selectedRoomId}-4`, name: `Target ${selectedRoomId}D`, status: 'online', roomId: selectedRoomId },
          ];
          setAvailableTargets(mockTargets);
        } else {
          const targets = await API.getTargets() as Target[];
          const roomTargets = targets.filter((t: Target) => t.roomId === selectedRoomId);
          setAvailableTargets(roomTargets);
        }
        setSelectedTargets([]); // Clear selection when room changes
      } catch (error) {
        console.error('Failed to load targets:', error);
        if (!useMockData) {
          toast.error('Failed to load targets');
        }
      } finally {
        setLoadingTargets(false);
      }
    };

    loadTargets();
  }, [selectedRoomId, useMockData]);

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
    if (!useMockData && selectedRoomId === null) {
      toast.error('Please select a room first');
      return;
    }

    // Use mock room ID if in demo mode and no room selected
    const roomIdToUse = useMockData ? (selectedRoomId || 1) : selectedRoomId;

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

    // Store scenario for countdown completion
    setPendingScenario(scenarioTemplate);
    setShowCountdown(true);
  };

  // Handle countdown completion - actually start the scenario
  const handleCountdownComplete = async () => {
    setShowCountdown(false);
    
    if (!pendingScenario) return;

    const roomIdToUse = useMockData ? (selectedRoomId || 1) : selectedRoomId;

    try {
      // Now actually start the scenario after countdown
      await start(pendingScenario, roomIdToUse!.toString(), selectedTargets);
      toast.success(`${pendingScenario.name} scenario started!`);
    } catch (err) {
      toast.error('Failed to start scenario');
    } finally {
      setPendingScenario(null);
    }
  };

  // Handle countdown cancellation
  const handleCountdownCancel = () => {
    setShowCountdown(false);
    setPendingScenario(null);
    toast.info('Scenario start cancelled');
  };

  // Handle stop scenario from countdown
  const handleStopFromCountdown = async () => {
    setShowCountdown(false);
    setPendingScenario(null);
    
    // Cancel countdown in service
    if (pendingScenario) {
      try {
        const roomIdToUse = useMockData ? (selectedRoomId || 1) : selectedRoomId;
        await countdownService.cancelCountdown({
          sessionId: `countdown_${Date.now()}`,
          scenarioId: pendingScenario.id,
          targetDeviceIds: selectedTargets,
          roomId: roomIdToUse!.toString(),
          userId: 'current_user',
          useMockData
        });
      } catch (error) {
        console.error('Failed to cancel countdown:', error);
      }
    }
    
    toast.success('Scenario stopped');
  };

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
                    useMockData 
                      ? 'bg-brand-primary/10 text-brand-primary' 
                      : 'bg-brand-secondary/10 text-brand-secondary'
                  }`}>
                    {useMockData ? '🎭 Demo' : '🔗 Live'}
                  </div>
                  <Button
                    onClick={toggleMockMode}
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

              {/* Stats Overview Bar - Desktop Only */}
              <div className="hidden lg:flex items-center justify-between p-6 bg-brand-surface rounded-2xl shadow-subtle border border-gray-100">
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className="text-2xl font-heading font-bold text-brand-primary mb-1">
                      {rooms.length}
                    </div>
                    <div className="text-sm text-brand-text/60 font-body">Available Rooms</div>
                  </div>
                  <div className="w-px h-12 bg-gray-200"></div>
                  <div className="text-center">
                    <div className="text-2xl font-heading font-bold text-brand-primary mb-1">
                      {availableTargets.filter(t => t.status === 'online').length}
                    </div>
                    <div className="text-sm text-brand-text/60 font-body">Online Targets</div>
                  </div>
                  <div className="w-px h-12 bg-gray-200"></div>
                  <div className="text-center">
                    <div className="text-2xl font-heading font-bold text-brand-primary mb-1">
                      {SCENARIOS.length}
                    </div>
                    <div className="text-sm text-brand-text/60 font-body">Training Scenarios</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {selectedTargets.length > 0 && (
                    <div className="px-4 py-2 bg-brand-primary/10 text-brand-primary rounded-xl text-sm font-body">
                      {selectedTargets.length} targets selected
                    </div>
                  )}
                  {active && current && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl text-sm font-body">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      {current.name} Active
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content Layout - Simplified 3-column design */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
              
              {/* Left Column - Room & Target Selection (Stacked) */}
              <div className="lg:col-span-3 space-y-4">
                
                {/* Room Selection - Compact */}
                <div className="bg-brand-surface rounded-xl p-4 shadow-subtle border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-heading text-sm font-semibold text-brand-text">Training Room</h3>
                    {useMockData && (
                      <div className="px-2 py-1 bg-brand-primary/10 text-brand-primary text-xs font-body rounded-full">
                        Demo
                      </div>
                    )}
                  </div>
                  
                  {rooms.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="w-8 h-8 bg-brand-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <TargetIcon className="w-4 h-4 text-brand-secondary" />
                      </div>
                      <p className="text-xs text-brand-text/60 font-body">
                        {useMockData ? 'Loading...' : 'No rooms'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <select
                          value={selectedRoomId || ''}
                          onChange={(e) => setSelectedRoomId(e.target.value ? parseInt(e.target.value) : null)}
                          disabled={useMockData}
                          className={`w-full px-3 py-2 pr-8 rounded-lg font-body text-sm appearance-none transition-all duration-200 ${
                            useMockData 
                              ? 'bg-gray-50 border border-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-brand-background border border-brand-secondary/20 text-brand-text cursor-pointer hover:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary'
                          }`}
                        >
                          <option value="">Select room...</option>
                          {rooms.map(room => (
                            <option key={room.id} value={room.id}>
                              {room.name}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                          <svg className={`w-4 h-4 ${useMockData ? 'text-gray-400' : 'text-brand-text/50'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      
                      {useMockData && (
                        <p className="text-xs text-brand-primary font-body">
                          Demo mode active
                        </p>
                      )}
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
                {selectedRoomId !== null && (
                  <div className="bg-brand-surface rounded-xl p-4 shadow-subtle border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-heading text-sm font-semibold text-brand-text">Select Targets</h3>
                      <div className="px-2 py-1 bg-brand-primary/10 text-brand-primary text-xs font-body rounded-full">
                        {selectedTargets.length}
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
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {availableTargets.map(target => {
                            const isOnline = target.status === 'online';
                            const isSelected = selectedTargets.includes(target.id);
                            
                            return (
                              <div 
                                key={target.id} 
                                className={`p-3 rounded-lg border transition-all duration-200 ${
                                  isSelected 
                                    ? 'border-brand-primary bg-brand-primary/5' 
                                    : 'border-gray-200 bg-brand-background hover:border-brand-secondary/50'
                                } ${!isOnline ? 'opacity-50' : ''}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={target.id}
                                      checked={isSelected}
                                      onCheckedChange={(checked) => handleTargetSelection(target.id, checked as boolean)}
                                      disabled={!isOnline}
                                      className="data-[state=checked]:bg-brand-primary data-[state=checked]:border-brand-primary"
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
                )}
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
                    {selectedTargets.length >= template.targetCount && !active && (
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
                      disabled={active || (!useMockData && selectedRoomId === null) || selectedTargets.length < template.targetCount}
                      className="w-full h-12 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-gray-300 disabled:text-gray-500 text-white font-body text-base font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <TargetIcon className="h-5 w-5 mr-2" />
                      {active && current?.id === template.id ? 'Scenario Running...' : 'Start Session'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Countdown Popup */}
      <ScenarioCountdown
        isOpen={showCountdown}
        onClose={handleCountdownCancel}
        onCountdownComplete={handleCountdownComplete}
        onStop={handleStopFromCountdown}
        scenarioName={pendingScenario?.name || ''}
        scenarioId={pendingScenario?.id || ''}
        targetCount={selectedTargets.length}
        targetDeviceIds={selectedTargets}
        sessionId={`countdown_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`}
        roomId={(useMockData ? (selectedRoomId || 1) : selectedRoomId)?.toString() || '1'}
        useMockData={useMockData}
      />
    </div>
  );
};

export default Scenarios; 