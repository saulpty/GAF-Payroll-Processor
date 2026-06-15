import { Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="h-full overflow-auto">
      <Outlet />
    </div>
  );
}
