
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

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
    <Router>
      <Routes>
        {/* Marketing routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/affiliate/apply" element={<AffiliateApplyPage />} />
        
        {/* Auth routes */}
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        
        {/* Dashboard routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/targets" element={<Targets />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/rooms/:id" element={<RoomDesigner />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/sessions/join/:token" element={<SessionJoin />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        
        {/* Fallback route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="top-center" />
    </Router>
  );
}

export default App;
