
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { staticDb } from './lib/staticDb'
import { AuthProvider } from './providers/AuthProvider'

// Initialize MSW for development
if (import.meta.env.DEV) {
  import('./mocks/browser').then(({ worker }) => {
    worker.start({
      onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
    });
    console.log('MSW started for development');
  });
}

// Initialize static database and start simulated hit events
staticDb.ensureInitialized().then(() => {
  console.log('Database ready');
  // staticDb.simulateHits(); // Simulated hits disabled
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
