import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ProductsPage from './pages/ProductsPage';
import Dashboard from './pages/Dashboard';
import Targets from './pages/Targets';
import Rooms from './pages/Rooms';
import RoomDesigner from './pages/RoomDesigner';
import Sessions from './pages/Sessions';
import SessionJoin from './pages/SessionJoin';
import Leaderboard from './pages/Leaderboard';
import NotFound from './pages/NotFound';
import Profile from './pages/Profile';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Settings from './pages/Settings';
import AffiliateApplyPage from './pages/AffiliateApplyPage';
import { Toaster } from './components/ui/sonner';
import { useEffect } from 'react';
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
        <Route path="/" element={<LandingPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/targets" element={<Targets />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/rooms/:id" element={<RoomDesigner />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/sessions/join/:token" element={<SessionJoin />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/affiliate/apply" element={<AffiliateApplyPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="top-center" />
    </Router>
  );
}

export default App;
