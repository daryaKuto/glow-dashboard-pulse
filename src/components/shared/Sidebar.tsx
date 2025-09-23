
import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Target, Users, Calendar, User, Gamepad2 } from 'lucide-react';
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
  { title: 'Games', icon: Gamepad2, path: '/dashboard/games' },
  // { title: 'Scenarios', icon: Calendar, path: '/dashboard/scenarios' }, // Commented out - moved to scenarios folder
  { title: 'Profile', icon: User, path: '/dashboard/profile' }
];

const Sidebar: React.FC<SidebarProps> = ({ isMobile = false, isOpen = true, onClose }) => {
  const sidebarClasses = cn(
    'flex flex-col h-full bg-brand-black transition-all duration-300 shadow-sm',
    isMobile ? 
      `fixed top-0 bottom-0 left-0 z-50 w-56 md:w-64 ${isOpen ? 'translate-x-0' : '-translate-x-full'}` :
      'w-64' // Fixed width on desktop, no hover expansion
  );

  return (
    <aside className={sidebarClasses}>
      {isMobile && (
        <div className="flex justify-between items-center p-2 md:p-4 border-b border-brand-surface/20">
          <a href="https://ailith.co" target="_blank" rel="noopener noreferrer" className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-white/20 flex items-center justify-center border border-white/30 overflow-hidden">
            <img 
              src="/ailith_dark.png" 
              alt="ailith.co Logo" 
              className="h-6 w-6 md:h-8 md:w-8 object-contain"
            />
          </a>
          <button onClick={onClose} className="text-white p-1 md:p-2 hover:bg-white/20 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-6 md:h-6"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      )}
      
      <nav className={`flex-1 ${isMobile ? 'py-3' : 'py-6'}`}>
        <ul className={`space-y-1 md:space-y-2 ${isMobile ? 'px-2' : 'px-3'}`}>
          {navItems.map((item) => (
            <li key={item.title}>
              <Link 
                to={item.path} 
                className={`flex items-center ${isMobile ? 'p-2' : 'p-3'} rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-all duration-200`}
                onClick={isMobile ? onClose : undefined}
              >
                <item.icon className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} flex-shrink-0`} />
                <span className={`${isMobile ? 'ml-2' : 'ml-3'} font-medium ${isMobile ? 'text-sm' : ''}`}>
                  {item.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className={`${isMobile ? 'p-2' : 'p-4'} border-t border-white/20`}>
        <div className="text-xs text-white/60">
          ailith.co v1.0
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
