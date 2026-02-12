
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Target, Users, User, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  { title: 'Profile', icon: User, path: '/dashboard/profile' }
];

const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <aside className="flex flex-col bg-brand-black w-64 shadow-sm fixed top-16 left-0 bottom-0 z-40">
      <nav className="py-2">
        <ul className="px-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.path === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname.startsWith(item.path);

            return (
              <li key={item.title}>
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center p-3 rounded-lg transition-all duration-200',
                    isActive
                      ? 'text-brand-primary'
                      : 'text-white/50 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className={cn(
                    'ml-3 pb-0.5',
                    isActive
                      ? 'font-semibold border-b-2 border-brand-primary'
                      : 'font-medium'
                  )}>
                    {item.title}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
