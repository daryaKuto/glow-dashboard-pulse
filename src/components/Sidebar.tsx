
import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Target, Users, Calendar, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  title: string;
  icon: React.ElementType;
  path: string;
}

const navItems: NavItem[] = [
  { title: 'Dashboard', icon: Home, path: '/dashboard' },
  { title: 'Targets', icon: Target, path: '/dashboard/targets' },
  { title: 'Rooms', icon: Users, path: '/dashboard/rooms' },
  { title: 'Sessions', icon: Calendar, path: '/dashboard/sessions' }
];

const Sidebar: React.FC<SidebarProps> = ({ isMobile = false, isOpen = true, onClose }) => {
  const sidebarClasses = cn(
    'flex flex-col h-full bg-brand-brown transition-all duration-300 shadow-lg',
    isMobile ? 
      `fixed top-0 bottom-0 left-0 z-50 w-64 ${isOpen ? 'translate-x-0' : '-translate-x-full'}` :
      'w-16 hover:w-64 group'
  );

  return (
    <aside className={sidebarClasses}>
      {isMobile && (
        <div className="flex justify-between items-center p-4 border-b border-white/20">
          <a href="https://ailith.co" target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center border border-white/30 overflow-hidden">
            <img 
              src="/LogoFinal.png" 
              alt="Ailith Logo" 
              className="h-8 w-8 object-contain"
            />
          </a>
          <button onClick={onClose} className="text-white p-2 hover:bg-white/20 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      )}
      
      <nav className="flex-1 py-6">
        <ul className="space-y-2 px-3">
          {navItems.map((item) => (
            <li key={item.title}>
              <Link 
                to={item.path} 
                className="flex items-center p-3 rounded-lg text-white/80 hover:bg-white/10 hover:text-white group-hover:px-4 transition-all duration-200"
              >
                <item.icon className="w-6 h-6 flex-shrink-0" />
                <span className={`ml-3 font-medium ${!isMobile && 'opacity-0 group-hover:opacity-100'}`}>
                  {item.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-white/20">
        <div className={`text-xs text-white/60 ${!isMobile && 'opacity-0 group-hover:opacity-100'}`}>
          Ailith v1.0
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
