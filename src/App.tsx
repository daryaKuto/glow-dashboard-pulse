
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
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
        <Route path="/" element={<Index />} />
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
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="top-center" />
    </Router>
  );
}

export default App;
