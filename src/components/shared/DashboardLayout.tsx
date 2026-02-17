import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileDrawer from './MobileDrawer';
import { useIsMobile } from '@/shared/hooks/use-mobile';

export default function DashboardLayout() {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen flex flex-col bg-brand-light responsive-container pt-[116px] lg:pt-16">
      <Header />
      {isMobile ? <MobileDrawer /> : <Sidebar />}
      <div className="flex flex-1 no-overflow lg:pl-64">
        <main className="flex-1 overflow-y-auto responsive-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
