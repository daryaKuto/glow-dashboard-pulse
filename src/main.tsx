
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './providers/AuthProvider'
import { DemoModeProvider } from './providers/DemoModeProvider'

// Initialize application
console.log('Application starting...');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <DemoModeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </DemoModeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
