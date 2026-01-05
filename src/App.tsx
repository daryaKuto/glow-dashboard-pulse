
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
import DashboardPage from './features/dashboard/ui/dashboard-page';
import TargetsPage from './features/targets/ui/targets-page';
import RoomsPage from './features/rooms/ui/rooms-page';
import RoomDesigner from './features/rooms/ui/room-designer-page';
import GamesPage from './features/games/ui/games-page';
// import Scenarios from './pages/Scenarios'; // Commented out - moved to scenarios folder
import LeaderboardPage from './features/leaderboard/ui/leaderboard-page';
import ProfilePage from './features/profile/ui/profile-page';
import SettingsPage from './features/settings/ui/settings-page';
import NotFound from './pages/NotFound';

// Components
import { Toaster } from './components/ui/sonner';
import { useAuth } from '@/shared/hooks/use-auth';

import './App.css';

function App() {
  const { checkSession, user, loading } = useAuth();
  
  useEffect(() => {
    checkSession();
  }, [checkSession]);
  
  
  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-light">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-brand-dark/70 font-body">
            Loading...
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <Routes>
        {/* Default route - always redirect to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Auth routes - redirect to dashboard if already logged in */}
        <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/dashboard" replace />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
        <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/dashboard" replace />} />
        <Route path="/reset-password" element={!user ? <ResetPassword /> : <Navigate to="/dashboard" replace />} />
        <Route path="/change-password" element={user ? <ChangePassword /> : <Navigate to="/login" replace />} />
        <Route path="/auth/callback" element={<OAuthCallback />} />
        
        {/* Dashboard routes - require authentication */}
        <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/targets" element={user ? <TargetsPage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/rooms" element={user ? <RoomsPage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/rooms/:id" element={user ? <RoomDesigner /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/games" element={user ? <GamesPage /> : <Navigate to="/login" replace />} />
        {/* <Route path="/dashboard/scenarios" element={user ? <Scenarios /> : <Navigate to="/login" replace />} /> */}
        <Route path="/dashboard/leaderboard" element={user ? <LeaderboardPage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/profile" element={user ? <ProfilePage /> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/settings" element={user ? <SettingsPage /> : <Navigate to="/login" replace />} />
        
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
