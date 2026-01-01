
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './providers/AuthProvider'
import { Providers } from './app/providers'
import { ErrorBoundary } from './shared/lib/error-boundary'

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
// Demo mode provider removed - app uses live data only

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Providers>
          <AuthProvider>
            <App />
          </AuthProvider>
        </Providers>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
