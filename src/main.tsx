
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { staticDb } from './lib/staticDb'
import { AuthProvider } from './providers/AuthProvider'

// Initialize static database and start simulated hit events
staticDb.ensureInitialized().then(() => {
  console.log('Database ready, starting simulated hits');
  staticDb.simulateHits();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </React.StrictMode>,
)
