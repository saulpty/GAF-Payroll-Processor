import { Outlet } from 'react-router-dom';
import DesktopCanvas from '@/app/components/mobile/DesktopCanvas';

export default function AdminLayout() {
  return (
    <div className="h-full overflow-auto">
      <DesktopCanvas>
        <Outlet />
      </DesktopCanvas>
    </div>
  );
}
