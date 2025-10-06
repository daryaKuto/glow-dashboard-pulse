import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { countdownService, type CountdownConfig } from '@/services/countdown';

interface ScenarioCountdownProps {
  isOpen: boolean;
  onClose: () => void;
  onCountdownComplete: () => void;
  onStop: () => void;
  scenarioName: string;
  scenarioId: string;
  targetCount: number;
  targetDeviceIds: string[];
  sessionId: string;
  roomId: string;
  useMockData: boolean;
}

interface CountdownState {
  phase: 'ready' | 'countdown' | 'go' | 'complete';
  count: number;
  message: string;
}

const ScenarioCountdown: React.FC<ScenarioCountdownProps> = ({
  isOpen,
  onClose,
  onCountdownComplete,
  onStop,
  scenarioName,
  scenarioId,
  targetCount,
  targetDeviceIds,
  sessionId,
  roomId,
  useMockData
}) => {
  const [countdownState, setCountdownState] = useState<CountdownState>({
    phase: 'ready',
    count: 3,
    message: 'Get Ready'
  });

  // Beep sound function (will be replaced with ThingsBoard signal)
  const playBeep = useCallback((frequency: number = 800, duration: number = 200) => {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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

  // Create countdown config for service
  const countdownConfig: CountdownConfig = {
    sessionId,
    scenarioId,
    targetDeviceIds,
    roomId,
    userId: 'current_user', // TODO: Get from auth context
    useMockData
  };

  // Send countdown signal using the countdown service
  const sendCountdownSignal = useCallback(async (signal: 'start_countdown' | 'countdown_3' | 'countdown_2' | 'countdown_1' | 'go') => {
    try {
      await countdownService.sendCountdownSignal(countdownConfig, signal);
    } catch (error) {
      console.error('Failed to send countdown signal:', error);
    }
  }, [countdownConfig]);

  // Countdown sequence
  useEffect(() => {
    if (!isOpen) return;

    const runCountdown = async () => {
      // Initial ready state
      setCountdownState({ phase: 'ready', count: 3, message: 'Get Ready' });
      await sendCountdownSignal('start_countdown');
      
      // Wait 1 second, then start countdown
      setTimeout(async () => {
        // 3
        setCountdownState({ phase: 'countdown', count: 3, message: 'Get Ready' });
        await sendCountdownSignal('countdown_3');
        playBeep(600, 300);
        
        setTimeout(async () => {
          // 2
          setCountdownState({ phase: 'countdown', count: 2, message: 'Get Set' });
          await sendCountdownSignal('countdown_2');
          playBeep(700, 300);
          
          setTimeout(async () => {
            // 1
            setCountdownState({ phase: 'countdown', count: 1, message: 'Almost...' });
            await sendCountdownSignal('countdown_1');
            playBeep(800, 300);
            
            setTimeout(async () => {
              // GO!
              setCountdownState({ phase: 'go', count: 0, message: 'GO!' });
              await sendCountdownSignal('go');
              playBeep(1000, 500); // Higher pitch, longer beep for GO
              
              setTimeout(() => {
                setCountdownState({ phase: 'complete', count: 0, message: 'Scenario Started' });
                setTimeout(() => {
                  onCountdownComplete();
                }, 500);
              }, 1000);
            }, 1000);
          }, 1000);
        }, 1000);
      }, 1000);
    };

    runCountdown();
  }, [isOpen, sendCountdownSignal, playBeep, onCountdownComplete]);

  if (!isOpen) return null;

  const getCountdownColor = () => {
    switch (countdownState.phase) {
      case 'ready': return 'text-brand-surface';
      case 'countdown': return countdownState.count === 1 ? 'text-amber-400' : 'text-brand-surface';
      case 'go': return 'text-brand-primary';
      case 'complete': return 'text-green-400';
      default: return 'text-brand-surface';
    }
  };

  const getBackgroundGradient = () => {
    switch (countdownState.phase) {
      case 'ready': return 'bg-gradient-to-br from-brand-text via-brand-secondary to-brand-text';
      case 'countdown': return countdownState.count === 1 
        ? 'bg-gradient-to-br from-amber-600 via-brand-secondary to-brand-text'
        : 'bg-gradient-to-br from-brand-text via-brand-secondary to-brand-text';
      case 'go': return 'bg-gradient-to-br from-brand-primary via-brand-secondary to-brand-primary';
      case 'complete': return 'bg-gradient-to-br from-green-600 via-brand-secondary to-green-600';
      default: return 'bg-gradient-to-br from-brand-text via-brand-secondary to-brand-text';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className={`relative w-full h-full flex flex-col items-center justify-center transition-all duration-500 ${getBackgroundGradient()}`}>
        
        {/* Top Controls - Mobile Optimized */}
        <div className="absolute top-3 md:top-6 left-3 right-3 md:left-6 md:right-6 flex items-center justify-between z-10">
          {/* Close Button - Mobile Optimized */}
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-8 w-8 md:h-10 md:w-10 p-0 text-brand-surface hover:bg-brand-surface/20 border border-brand-surface/30 rounded-lg"
          >
            <X className="h-4 w-4 md:h-5 md:w-5" />
          </Button>

          {/* Stop Scenario Button - Mobile Optimized */}
          <Button
            onClick={onStop}
            className="h-8 md:h-10 bg-red-500 hover:bg-red-600 text-white font-body text-xs md:text-sm px-3 md:px-4 shadow-lg rounded-lg"
          >
            <span className="hidden sm:inline">Stop Scenario</span>
            <span className="sm:hidden">Stop</span>
          </Button>
        </div>

        {/* Scenario Info - Mobile Optimized */}
        <div className="text-center mb-6 md:mb-10 px-4">
          <h2 className="font-heading text-xl md:text-2xl lg:text-3xl font-semibold text-brand-surface mb-2 md:mb-3">
            {scenarioName}
          </h2>
          <p className="font-body text-brand-surface/80 text-sm md:text-base">
            {targetCount} targets selected
          </p>
          {useMockData && (
            <div className="mt-2 md:mt-3 px-3 py-1 md:px-4 md:py-2 bg-brand-primary/20 text-brand-surface border border-brand-surface/30 text-xs md:text-sm font-body rounded-lg inline-block">
              🎭 Demo Mode
            </div>
          )}
        </div>

        {/* Countdown Display - Mobile Optimized */}
        <div className="text-center px-4">
          <div className={`font-heading font-bold transition-all duration-300 ${getCountdownColor()}`}>
            {countdownState.phase === 'countdown' && (
              <div className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-[10rem] leading-none animate-pulse drop-shadow-2xl">
                {countdownState.count}
              </div>
            )}
            {countdownState.phase === 'go' && (
              <div className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl leading-none animate-bounce drop-shadow-2xl">
                GO!
              </div>
            )}
            {countdownState.phase === 'ready' && (
              <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-none drop-shadow-xl">
                Ready?
              </div>
            )}
            {countdownState.phase === 'complete' && (
              <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-none drop-shadow-xl">
                Started!
              </div>
            )}
          </div>
          
          <p className={`font-body text-base md:text-lg lg:text-xl mt-3 md:mt-4 lg:mt-6 transition-all duration-300 drop-shadow-lg px-2 ${
            countdownState.phase === 'go' ? 'text-brand-surface font-semibold' : 'text-brand-surface/90'
          }`}>
            {countdownState.message}
          </p>
        </div>

        {/* Progress Indicator - Mobile Optimized */}
        <div className="absolute bottom-6 md:bottom-10 left-1/2 transform -translate-x-1/2">
          <div className="flex items-center gap-2 md:gap-3">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`w-2.5 h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-4 rounded-full transition-all duration-300 border-2 ${
                  countdownState.phase === 'ready' ? 'bg-brand-surface/30 border-brand-surface/50' :
                  countdownState.phase === 'countdown' && countdownState.count >= (4 - step) ? 'bg-brand-surface border-brand-surface shadow-lg' :
                  countdownState.phase === 'go' || countdownState.phase === 'complete' ? 'bg-brand-primary border-brand-primary shadow-lg' :
                  'bg-brand-surface/30 border-brand-surface/50'
                }`}
              />
            ))}
          </div>
          
          {/* Phase Indicator - Mobile Optimized */}
          <div className="text-center mt-2 md:mt-3">
            <p className="text-brand-surface/70 font-body text-xs md:text-sm">
              {countdownState.phase === 'ready' && 'Preparing...'}
              {countdownState.phase === 'countdown' && 'Get Ready!'}
              {countdownState.phase === 'go' && 'Scenario Starting!'}
              {countdownState.phase === 'complete' && 'Launching...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScenarioCountdown;
