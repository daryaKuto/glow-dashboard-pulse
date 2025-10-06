import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface DemoModeContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  setDemoMode: (mode: boolean) => void;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

export const useDemoMode = () => {
  const context = useContext(DemoModeContext);
  if (!context) {
    throw new Error('useDemoMode must be used within DemoModeProvider');
  }
  return context;
};

interface DemoModeProviderProps {
  children: React.ReactNode;
}

export const DemoModeProvider: React.FC<DemoModeProviderProps> = ({ children }) => {
  // Initialize from localStorage or default to demo mode
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('demo_mode');
    // Default to demo mode (true) if not set
    return stored !== null ? stored === 'true' : true;
  });

  // Persist to localStorage whenever mode changes
  useEffect(() => {
    localStorage.setItem('demo_mode', String(isDemoMode));
    console.log(`🎭 Demo Mode ${isDemoMode ? 'ENABLED' : 'DISABLED'} - ${isDemoMode ? 'Using placeholder data' : 'Using real data from ThingsBoard and Supabase'}`);
  }, [isDemoMode]);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode(prev => !prev);
  }, []);

  const setDemoMode = useCallback((mode: boolean) => {
    setIsDemoMode(mode);
  }, []);

  const value: DemoModeContextType = {
    isDemoMode,
    toggleDemoMode,
    setDemoMode
  };

  return (
    <DemoModeContext.Provider value={value}>
      {children}
    </DemoModeContext.Provider>
  );
};

