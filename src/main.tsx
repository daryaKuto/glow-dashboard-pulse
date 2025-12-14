
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './providers/AuthProvider'

// Initialize application
console.info('[Main] Application bootstrapping', {
  environment: import.meta.env.MODE,
  buildTime: import.meta.env.VITE_BUILD_TIME ?? 'unknown',
  version: import.meta.env.VITE_APP_VERSION ?? 'dev',
  timestamp: new Date().toISOString(),
  supabaseProjectUrl: import.meta.env.VITE_SUPABASE_URL ?? 'unknown',
  supabaseAnonKeyPresent: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
  thingsboardHost: import.meta.env.VITE_TB_HOST ?? 'unknown',
  dataSources: [
    'Supabase Edge Functions (sessions, rooms, analytics)',
    'Supabase Tables (user_profiles, sessions, user_rooms, user_room_targets)',
    'ThingsBoard REST/WebSocket telemetry',
  ],
});

// Global error handler for unhandled promise rejections
// Suppress MetaMask and other browser extension errors that don't affect our app
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const errorMessage = error?.message || String(error);
  const errorStack = error?.stack || '';
  
  // Check if this is a MetaMask-related error
  const isMetaMaskError = 
    errorMessage?.includes('MetaMask') ||
    errorMessage?.includes('metamask') ||
    errorStack?.includes('inpage.js') ||
    errorStack?.includes('metamask') ||
    error?.code === 'UNPREDICTABLE_GAS_LIMIT' ||
    error?.code === 'ACTION_REJECTED';
  
  if (isMetaMaskError) {
    // Suppress MetaMask errors - they're from browser extensions, not our app
    event.preventDefault();
    console.debug('[Main] Suppressed MetaMask extension error:', errorMessage);
    return;
  }
  
  // Log other unhandled promise rejections for debugging
  console.error('[Main] Unhandled promise rejection:', {
    message: errorMessage,
    stack: errorStack,
    error: error,
  });
});

// Global error handler for regular errors
window.addEventListener('error', (event) => {
  const errorMessage = event.message || String(event.error);
  const errorSource = event.filename || 'unknown';
  
  // Check if this is a MetaMask-related error
  const isMetaMaskError = 
    errorMessage?.includes('MetaMask') ||
    errorMessage?.includes('metamask') ||
    errorSource?.includes('inpage.js') ||
    errorSource?.includes('metamask');
  
  if (isMetaMaskError) {
    // Suppress MetaMask errors
    event.preventDefault();
    console.debug('[Main] Suppressed MetaMask extension error:', errorMessage);
    return;
  }
  
  // Log other errors for debugging
  console.error('[Main] Global error:', {
    message: errorMessage,
    source: errorSource,
    line: event.lineno,
    col: event.colno,
    error: event.error,
  });
});

// Demo mode provider removed - app uses live data only

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
