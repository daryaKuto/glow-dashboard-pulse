/**
 * Game Countdown Popup Component
 * Shows countdown, live scoring, timer, and game controls
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeviceStatus } from '@/services/device-game-flow';
import { Play, Square, Trophy, Clock, Target, Activity, Target as TargetIcon, Gamepad2 } from 'lucide-react';
import { useGameTelemetry } from '@/hooks/useGameTelemetry';

interface GameCountdownPopupProps {
  isOpen: boolean;
  onClose: () => void;
  gameName: string;
  duration: number; // in minutes
  devices: DeviceStatus[];
  gameId: string;
  onStartGame: () => void;
  onStopGame: () => void;
  onEndGame: (gameSummary: GameSummary) => void;
}

interface LiveScore {
  deviceId: string;
  deviceName: string;
  hitCount: number;
  lastHitTime: number;
  hitTimes: number[]; // Array of timestamps when hits occurred
}

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

// StatCard component for game summary
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  isLoading?: boolean;
}> = ({ title, value, subtitle, icon, isLoading = false }) => (
  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow rounded-md md:rounded-lg">
    <CardContent className="p-1.5 md:p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-0.5 md:space-y-1 text-center md:text-left">
          <p className="text-xs font-medium text-brand-dark/70 font-body">{title}</p>
          {isLoading ? (
            <div className="h-4 md:h-6 w-10 md:w-14 bg-gray-200 rounded animate-pulse mx-auto md:mx-0"></div>
          ) : (
            <p className="text-sm md:text-xl lg:text-2xl font-bold text-brand-dark font-heading">{value}</p>
          )}
          {subtitle && (
            <p className="text-xs text-brand-dark/50 font-body">{subtitle}</p>
          )}
        </div>
        <div className="flex-shrink-0 p-1 md:p-2 bg-brand-secondary/10 rounded-sm md:rounded-lg">
          <div className="text-brand-primary w-3 h-3 md:w-5 md:h-5">
            {icon}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

export const GameCountdownPopup: React.FC<GameCountdownPopupProps> = ({
  isOpen,
  onClose,
  gameName,
  duration,
  devices,
  gameId,
  onStartGame,
  onStopGame,
  onEndGame
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(duration * 60); // Convert to seconds
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummary | null>(null);
  
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);

  const telemetry = useGameTelemetry({
    gameId,
    isGameActive: gameStarted && !gameEnded,
    devices: devices.map((device) => ({
      deviceId: device.deviceId,
      deviceName: device.name,
    })),
  });

  const liveScores = useMemo<LiveScore[]>(() => {
    return devices.map((device) => {
      const hitTimes = telemetry.hitTimesByDevice[device.deviceId] ?? [];
      const lastHitTime = hitTimes.length > 0 ? hitTimes[hitTimes.length - 1] : 0;

      return {
        deviceId: device.deviceId,
        deviceName: device.name,
        hitCount: telemetry.hitCounts[device.deviceId] ?? 0,
        lastHitTime,
        hitTimes,
      };
    });
  }, [devices, telemetry.hitCounts, telemetry.hitTimesByDevice]);

  // Start countdown when popup opens
  useEffect(() => {
    if (isOpen && !gameStarted && !gameEnded) {
      startCountdown();
    }
    
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (gameTimerRef.current) {
        clearInterval(gameTimerRef.current);
        gameTimerRef.current = null;
      }
    };
  }, [isOpen, gameStarted, gameEnded]);

  const startCountdown = () => {
    setCountdown(3);
    
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          // Countdown finished, start game
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          startGame();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startGame = () => {
    setGameStarted(true);
    setGameStartTime(Date.now());
    setTimeRemaining(duration * 60);
    onStartGame();
    
    // Start game timer
    gameTimerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Game time finished
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const endGame = (): GameSummary | null => {
    setGameEnded(true);
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
    }
    
    // Calculate game summary
    const summary = calculateGameSummary();
    setGameSummary(summary);
    console.log('📊 Game Summary:', summary);
    
    onStopGame();
    return summary;
  };

  const handleEndGame = () => {
    const summary = endGame();
    if (summary) {
      onEndGame(summary);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalHits = (): number => {
    return Object.values(telemetry.hitCounts).reduce((total, count) => total + count, 0);
  };

  const getTopScorer = (): LiveScore | null => {
    if (liveScores.length === 0) return null;
    return liveScores.reduce((top, current) => 
      current.hitCount > top.hitCount ? current : top
    );
  };

  const calculateGameSummary = (): GameSummary => {
    const totalHits = Object.values(telemetry.hitCounts).reduce((sum, count) => sum + count, 0);
    const gameDuration = gameStartTime ? (Date.now() - gameStartTime) / 1000 : 0; // in seconds
    const averageHitInterval = totalHits > 0 ? gameDuration / totalHits : 0;

    // Calculate target-specific stats
    const targetStats = devices.map(device => {
      const hitTimes = [...(telemetry.hitTimesByDevice[device.deviceId] ?? [])].sort((a, b) => a - b);
      const intervals = [];
      
      for (let i = 1; i < hitTimes.length; i++) {
        intervals.push((hitTimes[i] - hitTimes[i - 1]) / 1000); // Convert to seconds
      }
      
      const averageInterval = intervals.length > 0 
        ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length 
        : 0;

      return {
        deviceId: device.deviceId,
        deviceName: device.name,
        hitCount: telemetry.hitCounts[device.deviceId] ?? 0,
        hitTimes: hitTimes,
        averageInterval: averageInterval,
        firstHitTime:
          hitTimes.length > 0 && gameStartTime
            ? (hitTimes[0] - gameStartTime) / 1000
            : 0,
        lastHitTime:
          hitTimes.length > 0 && gameStartTime
            ? (hitTimes[hitTimes.length - 1] - gameStartTime) / 1000
            : 0,
      };
    });

    // Calculate cross-target switching stats
    const allHits = telemetry.hitHistory
      .map(hit => ({ deviceId: hit.deviceId, time: hit.timestamp }))
      .sort((a, b) => a.time - b.time);

    const switchTimes = [];
    for (let i = 1; i < allHits.length; i++) {
      if (allHits[i].deviceId !== allHits[i - 1].deviceId) {
        switchTimes.push((allHits[i].time - allHits[i - 1].time) / 1000);
      }
    }

    const averageSwitchTime = switchTimes.length > 0 
      ? switchTimes.reduce((sum, time) => sum + time, 0) / switchTimes.length 
      : 0;

    return {
      totalHits,
      gameDuration,
      averageHitInterval,
      targetStats,
      crossTargetStats: {
        totalSwitches: switchTimes.length,
        averageSwitchTime,
        switchTimes
      }
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0">
      <Card className="w-[calc(100vw-30px)] h-[calc(100vh-40px)] max-w-none max-h-none bg-white shadow-2xl rounded-lg flex flex-col">
        <CardContent className="p-0 h-full flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white p-3 md:p-6 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold font-heading">{gameName}</h2>
                <p className="text-white/80 font-body">
                  🔗 Live Mode • {duration} minute{duration !== 1 ? 's' : ''}
                </p>
              </div>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
              >
                ✕
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col p-3 md:p-6 overflow-y-auto min-h-0">
            {!gameStarted && !gameEnded && (
              /* Countdown Phase */
              <div className="text-center flex-1 flex flex-col justify-center items-center min-h-0">
                <div className="mb-4 md:mb-8">
                  <h3 className="text-2xl md:text-3xl font-bold font-heading text-gray-800 mb-2 md:mb-4">
                    Get Ready!
                  </h3>
                  <p className="text-gray-600 font-body text-base md:text-lg">
                    Game starting in...
                  </p>
                </div>
                
                {countdown !== null && (
                  <div className="text-6xl md:text-9xl font-bold text-brand-primary mb-4 md:mb-8 animate-pulse">
                    {countdown === 0 ? 'GO!' : countdown}
                  </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 max-w-2xl mx-auto">
                  {devices.map(device => (
                    <div key={device.deviceId} className="text-center">
                      <div className="w-16 h-16 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                        <Target className="h-8 w-8 text-gray-600" />
                      </div>
                      <p className="font-body text-sm text-gray-600 truncate">
                        {device.name}
                      </p>
                      <Badge 
                        variant={device.isOnline ? "default" : "destructive"}
                        className="text-xs mt-1"
                      >
                        {device.isOnline ? 'Ready' : 'Offline'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {gameStarted && !gameEnded && (
              /* Game Active Phase */
              <div className="space-y-4 md:space-y-6 flex-1 flex flex-col min-h-0">
                {/* Timer and Controls */}
                <div className="flex flex-col md:flex-row items-center justify-between bg-gray-50 rounded-lg p-3 md:p-4 gap-3 md:gap-0">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-brand-primary font-heading">
                        {formatTime(timeRemaining)}
                      </div>
                      <p className="text-sm text-gray-600 font-body">Time Remaining</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 font-heading">
                        {getTotalHits()}
                      </div>
                      <p className="text-sm text-gray-600 font-body">Total Hits</p>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleEndGame}
                    variant="destructive"
                    size="lg"
                    className="font-body"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    End Game
                  </Button>
                </div>

                {/* Live Scores */}
                <div className="flex-1 flex flex-col min-h-0">
                  <h4 className="text-lg md:text-xl font-bold font-heading text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
                    <Trophy className="h-4 w-4 md:h-5 md:w-5 text-yellow-500" />
                    Live Scores
                  </h4>
                  
                  <div className="flex justify-center">
                    <div className="grid grid-cols-2 gap-6 w-fit">
                      {liveScores.map((score, index) => {
                        const isTopScorer = getTopScorer()?.deviceId === score.deviceId;
                        const timeSinceLastHit = score.lastHitTime > 0 ? Date.now() - score.lastHitTime : 999999;
                        const recentlyHit = score.lastHitTime > 0 && timeSinceLastHit < 2000; // 2 seconds, only if actually hit
                        
                        return (
                          <div
                            key={score.deviceId}
                            className={`w-42 h-42 p-3 rounded-lg border-2 transition-all duration-500 flex flex-col items-center justify-center ${
                              isTopScorer 
                                ? 'border-yellow-400 bg-yellow-50' 
                                : recentlyHit
                                ? 'border-green-400 bg-green-50 shadow-lg scale-105'
                                : 'border-gray-200 bg-white'
                            } ${recentlyHit ? 'animate-pulse' : ''}`}
                          >
                            {/* Target name at top */}
                            <div className="text-center mb-3 w-full">
                              <p className="font-body font-medium text-gray-800 text-sm break-words leading-tight">
                                {score.deviceName}
                              </p>
                              <div className="h-2.5"></div>
                              {recentlyHit && (
                                <p className="text-sm text-green-600 font-body animate-bounce">
                                  Hit! 🎯
                                </p>
                              )}
                            </div>
                            
                            {/* Hit count in center */}
                            <div className="text-center">
                              <div className={`text-xl font-bold font-heading transition-all duration-300 ${
                                recentlyHit 
                                  ? 'text-green-600 scale-110' 
                                  : isTopScorer 
                                  ? 'text-yellow-600' 
                                  : 'text-brand-primary'
                              }`}>
                                {score.hitCount}
                              </div>
                              <p className="text-sm text-gray-500 font-body">hits</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {gameEnded && (
              /* Game Summary Phase */
              <div className="text-center flex-1 flex flex-col items-center min-h-0">
                <div className="mb-4 md:mb-8">
                  <Trophy className="h-12 w-12 md:h-16 md:w-16 text-yellow-500 mx-auto mb-3 md:mb-4" />
                  <h3 className="text-2xl md:text-3xl font-bold font-heading text-gray-800 mb-2">
                    Game Complete!
                  </h3>
                  <p className="text-gray-600 font-body text-base md:text-lg">
                    Final Results for {gameName}
                  </p>
                </div>

                {/* Final Scores */}
                <div className="max-w-2xl mx-auto mb-3 md:mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                    {liveScores
                      .sort((a, b) => b.hitCount - a.hitCount)
                      .map((score, index) => (
                        <div
                          key={score.deviceId}
                          className={`p-2 md:p-3 rounded-lg border-2 ${
                            index === 0 
                              ? 'border-yellow-400 bg-yellow-50' 
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm ${
                                index === 0 ? 'bg-yellow-500' : 'bg-brand-primary'
                              }`}>
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-body font-medium text-gray-800 text-sm">
                                  {score.deviceName}
                                </p>
                                {index === 0 && (
                                  <p className="text-xs text-yellow-600 font-body">
                                    Winner! 🏆
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg md:text-xl font-bold text-brand-primary font-heading">
                                {score.hitCount}
                              </div>
                              <p className="text-xs text-gray-500 font-body">hits</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="max-w-4xl mx-auto mb-3 md:mb-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1 md:gap-3">
                    <StatCard
                      title="Total Hits"
                      value={gameSummary?.totalHits || getTotalHits()}
                      icon={<Target className="w-full h-full" />}
                    />
                    <StatCard
                      title="Hit Rate"
                      value={gameSummary ? Math.round(gameSummary.totalHits / (gameSummary.gameDuration / 60)) : Math.round(getTotalHits() / (duration * 60) * 60)}
                      subtitle="/min"
                      icon={<Activity className="w-full h-full" />}
                    />
                    <StatCard
                      title="Target Switches"
                      value={gameSummary?.crossTargetStats.totalSwitches || 0}
                      icon={<Gamepad2 className="w-full h-full" />}
                    />
                    <StatCard
                      title="Duration"
                      value={gameSummary ? formatTime(Math.round(gameSummary.gameDuration)) : formatTime(duration * 60)}
                      icon={<Clock className="w-full h-full" />}
                    />
                  </div>
                </div>

                {/* Detailed Target Statistics */}
                {gameSummary && (
                  <div className="max-w-4xl mx-auto space-y-3 md:space-y-4">
                    <h5 className="text-sm md:text-base font-bold font-heading text-gray-800 text-center">Target Performance</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                      {gameSummary.targetStats.map((target, index) => (
                        <Card key={target.deviceId} className="bg-white border-gray-200 shadow-sm">
                          <CardContent className="p-2 md:p-3">
                            <div className="flex items-center justify-between mb-2 md:mb-3">
                              <h6 className="font-medium text-gray-800 font-body text-sm">{target.deviceName}</h6>
                              <div className="flex items-center gap-1">
                                <TargetIcon className="w-3 h-3 md:w-4 md:h-4 text-brand-primary" />
                                <span className="text-lg md:text-xl font-bold text-brand-primary font-heading">
                                  {target.hitCount}
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-1 text-xs md:text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600 font-body">Avg. Interval:</span>
                                <span className="font-medium">
                                  {target.averageInterval > 0 ? `${target.averageInterval.toFixed(1)}s` : 'N/A'}
                                </span>
                              </div>
                              
                              {target.hitCount > 0 && (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 font-body">First Hit:</span>
                                    <span className="font-medium">{target.firstHitTime.toFixed(1)}s</span>
                                  </div>
                                  
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 font-body">Last Hit:</span>
                                    <span className="font-medium">{target.lastHitTime.toFixed(1)}s</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Cross-Target Statistics */}
                    {gameSummary.crossTargetStats.totalSwitches > 0 && (
                      <Card className="bg-white border-gray-200 shadow-sm">
                        <CardContent className="p-2 md:p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Gamepad2 className="w-3 h-3 md:w-4 md:h-4 text-brand-primary" />
                            <h6 className="font-medium text-gray-800 font-body text-sm">Target Switching</h6>
                          </div>
                          <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs md:text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 font-body">Total Switches:</span>
                              <span className="font-medium">{gameSummary.crossTargetStats.totalSwitches}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 font-body">Avg. Switch Time:</span>
                              <span className="font-medium">{gameSummary.crossTargetStats.averageSwitchTime.toFixed(1)}s</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col md:flex-row gap-2 md:gap-3 justify-center mt-3 md:mt-0">
                  <Button
                    onClick={onClose}
                    variant="outline"
                    size="sm"
                    className="font-body text-xs md:text-sm"
                  >
                    Back to Games
                  </Button>
                  <Button
                    onClick={() => {
                      // Reset for new game
                      setGameStarted(false);
                      setGameEnded(false);
                      setCountdown(null);
                      setTimeRemaining(duration * 60);
                      setGameSummary(null);
                      startCountdown();
                    }}
                    className="bg-brand-primary hover:bg-brand-primary/90 text-white font-body text-xs md:text-sm"
                    size="sm"
                  >
                    <Play className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    Play Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GameCountdownPopup;
