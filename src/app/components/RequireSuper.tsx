import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useViewer } from '@/app/context/ViewerContext';
import { homeFor } from '@/app/lib/access';

export default function RequireSuper({ children }: { children: ReactNode }) {
  const { isSuper } = useViewer();
  return isSuper ? <>{children}</> : <Navigate to="/attendance" replace />;
}

export function HomeRedirect() {
  const { isSuper } = useViewer();
  return <Navigate to={homeFor(isSuper)} replace />;
}
