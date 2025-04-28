
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Marketing pages
import LandingPage from './pages/marketing/LandingPage';
import ProductsPage from './pages/marketing/ProductsPage';
import AffiliateApplyPage from './pages/marketing/AffiliateApplyPage';

// Auth pages
import Signup from './pages/Signup';
import Login from './pages/Login';

// Dashboard pages
import Dashboard from './pages/dashboard/Dashboard';
import Targets from './pages/Targets';
import Rooms from './pages/Rooms';
import RoomDesigner from './pages/RoomDesigner';
import Sessions from './pages/Sessions';
import SessionJoin from './pages/SessionJoin';
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
        {/* Marketing routes - always accessible */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/affiliate/apply" element={<AffiliateApplyPage />} />
        
        {/* Auth routes - redirect to dashboard if already logged in */}
        <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/dashboard" replace />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
        
        {/* Dashboard routes - require authentication */}
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/targets" element={user ? <Targets /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/rooms" element={user ? <Rooms /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/rooms/:id" element={user ? <RoomDesigner /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/sessions" element={user ? <Sessions /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/sessions/join/:token" element={user ? <SessionJoin /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/leaderboard" element={user ? <Leaderboard /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/profile" element={user ? <Profile /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/settings" element={user ? <Settings /> : <Navigate to="/login" replace />} />
        
        {/* Fallback route - redirect from old path structure */}
        <Route path="/profile" element={<Navigate to="/dashboard/profile" replace />} />
        <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
        
        {/* Fallback route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
