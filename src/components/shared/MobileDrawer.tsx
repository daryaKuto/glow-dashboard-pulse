
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Target, Users, Gamepad2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: Home, path: '/dashboard' },
  { label: 'Targets', icon: Target, path: '/dashboard/targets' },
  { label: 'Rooms', icon: Users, path: '/dashboard/rooms' },
  { label: 'Games', icon: Gamepad2, path: '/dashboard/games' },
  { label: 'Profile', icon: User, path: '/dashboard/profile' },
];

const MobileNavBar: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed top-12 left-0 right-0 z-40 bg-brand-black shadow-sm">
      <div className="flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const isActive =
            item.path === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors duration-200 min-w-[56px]',
                isActive
                  ? 'text-brand-primary'
                  : 'text-white/70 hover:text-white'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span
                className={cn(
                  'text-[10px] font-body leading-tight',
                  isActive ? 'font-semibold' : 'font-medium'
                )}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="w-5 h-0.5 rounded-full bg-brand-primary mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavBar;
