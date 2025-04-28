
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
    'flex flex-col h-full bg-brand-surface transition-all duration-300 shadow-card',
    isMobile ? 
      `fixed top-0 bottom-0 left-0 z-50 w-64 ${isOpen ? 'translate-x-0' : '-translate-x-full'}` :
      'w-16 hover:w-64 group'
  );

  return (
    <aside className={sidebarClasses}>
      {isMobile && (
        <div className="flex justify-between items-center p-4 border-b border-brand-lavender/20">
          <div className="h-8 w-8 rounded-md bg-brand-lavender flex items-center justify-center">
            <span className="text-white font-display font-bold">FG</span>
          </div>
          <button onClick={onClose} className="text-brand-lavender p-2 hover:bg-brand-lavender/20 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      )}
      
      <nav className="flex-1 py-4">
        <ul className="space-y-2 px-2">
          {navItems.map((item) => (
            <li key={item.title}>
              <Link 
                to={item.path} 
                className="flex items-center p-3 rounded-md text-brand-fg-secondary hover:bg-brand-lavender/10 group-hover:px-4 transition-all"
              >
                <item.icon className="icon w-6 h-6 flex-shrink-0" />
                <span className={`ml-3 ${!isMobile && 'opacity-0 group-hover:opacity-100'}`}>
                  {item.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-brand-lavender/20">
        <div className={`text-xs text-brand-fg-secondary/70 ${!isMobile && 'opacity-0 group-hover:opacity-100'}`}>
          FunGun v1.0
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
