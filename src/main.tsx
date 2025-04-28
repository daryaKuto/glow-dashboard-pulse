
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { staticDb } from './lib/staticDb'
import { AuthProvider } from './providers/AuthProvider'

// Initialize static database and start simulated hit events
staticDb.simulateHits();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
