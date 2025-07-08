
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Auth pages
import Signup from './pages/Signup';
import Login from './pages/Login';

// Dashboard pages
import Dashboard from './pages/dashboard/Dashboard';
import Targets from './pages/Targets';
import Rooms from './pages/Rooms';
import RoomDesigner from './pages/RoomDesigner';
import Scenarios from './pages/Scenarios';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

import { Toaster } from './components/ui/sonner';
import { useAuth } from './providers/AuthProvider';

import './App.css';

function App() {
  const { checkSession, user } = useAuth();
  
  useEffect(() => {
    checkSession();
  }, [checkSession]);
  
  return (
    <>
      <Routes>
        {/* Default route - redirect to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Auth routes - redirect to dashboard if already logged in */}
        <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/dashboard" replace />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
        
        {/* Dashboard routes - accessible without authentication */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/targets" element={<Targets />} />
        <Route path="/dashboard/rooms" element={<Rooms />} />
        <Route path="/dashboard/rooms/:id" element={<RoomDesigner />} />
        <Route path="/dashboard/scenarios" element={<Scenarios />} />
        <Route path="/dashboard/leaderboard" element={<Leaderboard />} />
        <Route path="/dashboard/profile" element={<Profile />} />
        <Route path="/dashboard/settings" element={<Settings />} />
        
        {/* Fallback route - redirect from old path structure */}
        <Route path="/profile" element={<Navigate to="/dashboard/profile" replace />} />
        <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
        <Route path="/targets" element={<Navigate to="/dashboard/targets" replace />} />
        <Route path="/rooms" element={<Navigate to="/dashboard/rooms" replace />} />
        <Route path="/scenarios" element={<Navigate to="/dashboard/scenarios" replace />} />
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
