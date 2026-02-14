
import React, { useEffect, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Auth pages (keep static - needed for initial login flow)
import Signup from './pages/auth/Signup';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import ChangePassword from './pages/auth/ChangePassword';
import OAuthCallback from './pages/auth/callback';

// Dashboard pages - lazy loaded for code splitting
const DashboardPage = React.lazy(() => import('./features/dashboard/ui/dashboard-page'));
const TargetsPage = React.lazy(() => import('./features/targets/ui/targets-page'));
const RoomsPage = React.lazy(() => import('./features/rooms/ui/rooms-page'));
const GamesPage = React.lazy(() => import('./features/games/ui/games-page'));
const LeaderboardPage = React.lazy(() => import('./features/leaderboard/ui/leaderboard-page'));
const ProfilePage = React.lazy(() => import('./features/profile/ui/profile-page'));
const SettingsPage = React.lazy(() => import('./features/settings/ui/settings-page'));
const RoomEditorPage = React.lazy(() => import('./features/rooms/ui/room-editor/RoomEditorPage'));
import NotFound from './pages/NotFound';

// Loading fallback for lazy-loaded pages
const PageLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-brand-light">
    <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

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
        
        {/* Dashboard routes - require authentication, wrapped in Suspense for lazy loading */}
        <Route path="/dashboard" element={user ? <Suspense fallback={<PageLoading />}><DashboardPage /></Suspense> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/targets" element={user ? <Suspense fallback={<PageLoading />}><TargetsPage /></Suspense> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/rooms" element={user ? <Suspense fallback={<PageLoading />}><RoomsPage /></Suspense> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/rooms/layout/new" element={user ? <Suspense fallback={<PageLoading />}><RoomEditorPage /></Suspense> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/rooms/:roomId/layout" element={user ? <Suspense fallback={<PageLoading />}><RoomEditorPage /></Suspense> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/games" element={user ? <Suspense fallback={<PageLoading />}><GamesPage /></Suspense> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/leaderboard" element={user ? <Suspense fallback={<PageLoading />}><LeaderboardPage /></Suspense> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/profile" element={user ? <Suspense fallback={<PageLoading />}><ProfilePage /></Suspense> : <Navigate to="/login" replace />} />
        <Route path="/dashboard/settings" element={user ? <Suspense fallback={<PageLoading />}><SettingsPage /></Suspense> : <Navigate to="/login" replace />} />
        
        {/* Fallback route - redirect from old path structure */}
        <Route path="/profile" element={<Navigate to="/dashboard/profile" replace />} />
        <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
        <Route path="/targets" element={<Navigate to="/dashboard/targets" replace />} />
        <Route path="/rooms" element={<Navigate to="/dashboard/rooms" replace />} />
        <Route path="/sessions" element={<Navigate to="/dashboard/games" replace />} />
        <Route path="/leaderboard" element={<Navigate to="/dashboard/leaderboard" replace />} />
        
        {/* 404 route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      <Toaster />
    </>
  );
}

export default App;
