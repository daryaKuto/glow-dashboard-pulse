
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

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
  const { checkSession } = useAuth();
  
  useEffect(() => {
    checkSession();
  }, [checkSession]);
  
  return (
    // Remove nested Router if one exists in index.tsx or main.tsx
    <Routes>
      {/* Marketing routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/affiliate/apply" element={<AffiliateApplyPage />} />
      
      {/* Auth routes */}
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      
      {/* Dashboard routes - all prefixed with /dashboard */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/targets" element={<Targets />} />
      <Route path="/dashboard/rooms" element={<Rooms />} />
      <Route path="/dashboard/rooms/:id" element={<RoomDesigner />} />
      <Route path="/dashboard/sessions" element={<Sessions />} />
      <Route path="/dashboard/sessions/join/:token" element={<SessionJoin />} />
      <Route path="/dashboard/leaderboard" element={<Leaderboard />} />
      <Route path="/dashboard/profile" element={<Profile />} />
      <Route path="/dashboard/settings" element={<Settings />} />
      
      {/* Fallback route - redirect from old path structure */}
      <Route path="/profile" element={<Navigate to="/dashboard/profile" replace />} />
      <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
      
      {/* Fallback route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
