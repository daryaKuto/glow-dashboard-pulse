
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Auth pages
import Signup from './pages/auth/Signup';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import ChangePassword from './pages/auth/ChangePassword';
import OAuthCallback from './pages/auth/callback';

// Dashboard pages
import Dashboard from './pages/dashboard/Dashboard';
import Targets from './pages/targets/Targets';
import Rooms from './pages/Rooms';
import RoomDesigner from './pages/RoomDesigner';
import Games from './pages/Games';
// import Scenarios from './pages/Scenarios'; // Commented out - moved to scenarios folder
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

import { Toaster } from './components/ui/sonner';
import { useAuth } from './providers/AuthProvider';

import './App.css';

function App() {
  const { checkSession, user, loading } = useAuth();
  const isDevelopment = import.meta.env.DEV;
  
  useEffect(() => {
    checkSession();
  }, [checkSession]);
  
  // Show development mode indicator only once
  useEffect(() => {
    if (isDevelopment) {
      console.log('[App] Development mode - auto-login enabled');
    }
  }, [isDevelopment]);
  
  // Show loading spinner while checking authentication (only in production)
  if (loading && !isDevelopment) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-light">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-brand-dark/70 font-body">Loading...</p>
        </div>
      </div>
    );
  }

  // In development mode, if we're still loading, show a brief loading state
  if (loading && isDevelopment) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-light">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-brand-dark/70 font-body">Development Mode - Setting up...</p>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <Routes>
        {/* Default route - always redirect to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Auth routes - redirect to dashboard if already logged in (or in dev mode) */}
        <Route path="/signup" element={(!user && !isDevelopment) ? <Signup /> : <Navigate to="/dashboard" replace />} />
        <Route path="/login" element={(!user && !isDevelopment) ? <Login /> : <Navigate to="/dashboard" replace />} />
        <Route path="/forgot-password" element={(!user && !isDevelopment) ? <ForgotPassword /> : <Navigate to="/dashboard" replace />} />
        <Route path="/reset-password" element={(!user && !isDevelopment) ? <ResetPassword /> : <Navigate to="/dashboard" replace />} />
        <Route path="/change-password" element={(user || isDevelopment) ? <ChangePassword /> : <Navigate to="/login" replace />} />
        <Route path="/auth/callback" element={<OAuthCallback />} />
        
        {/* Dashboard routes - require authentication (bypass in dev mode) */}
        <Route path="/dashboard" element={(user || isDevelopment) ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/targets" element={(user || isDevelopment) ? <Targets /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/rooms" element={(user || isDevelopment) ? <Rooms /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/rooms/:id" element={(user || isDevelopment) ? <RoomDesigner /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/games" element={(user || isDevelopment) ? <Games /> : <Navigate to="/login" replace />} />
        {/* <Route path="/dashboard/scenarios" element={(user || isDevelopment) ? <Scenarios /> : <Navigate to="/login" replace />} /> */}
        <Route path="/dashboard/leaderboard" element={(user || isDevelopment) ? <Leaderboard /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/profile" element={(user || isDevelopment) ? <Profile /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/settings" element={(user || isDevelopment) ? <Settings /> : <Navigate to="/login" replace />} />
        
        {/* Fallback route - redirect from old path structure */}
        <Route path="/profile" element={<Navigate to="/dashboard/profile" replace />} />
        <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
        <Route path="/targets" element={<Navigate to="/dashboard/targets" replace />} />
        <Route path="/rooms" element={<Navigate to="/dashboard/rooms" replace />} />
        {/* <Route path="/scenarios" element={<Navigate to="/dashboard/scenarios" replace />} /> */}
        <Route path="/sessions" element={<Navigate to="/dashboard/scenarios" replace />} />
        <Route path="/leaderboard" element={<Navigate to="/dashboard/leaderboard" replace />} />
        
        {/* 404 route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      <Toaster />
    </>
  );
}

export default App;
