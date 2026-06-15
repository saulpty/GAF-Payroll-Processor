import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  PlayCircle, AlertTriangle, TableIcon, BarChart2,
  Settings, History, ChevronDown, Activity,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useLoadAction } from '@uibakery/data';
import loadUnresolvedCountAction from '@/actions/loadUnresolvedCount';

const ADMIN_LINKS = [
  { to: '/admin/employees', label: 'Employees' },
  { to: '/admin/directory-sync', label: 'Directory Sync' },
  { to: '/admin/aliases', label: 'Name Aliases' },
  { to: '/admin/schedules', label: 'Schedules' },
  { to: '/admin/holidays', label: 'Holidays' },
  { to: '/admin/dst-calendar', label: 'DST Calendar' },
  { to: '/admin/lookups', label: 'Rules & Config' },
  { to: '/admin/grace-list', label: 'Grace List' },
  { to: '/admin/macbook-swap', label: 'Macbook Swap' },
];

export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [adminOpen, setAdminOpen] = useState(false);
  const adminRef = useRef<HTMLDivElement>(null);
  const [unresolvedData] = useLoadAction(loadUnresolvedCountAction, [] as { count: number }[]);
  const unresolvedCount = (unresolvedData as { count: number }[])[0]?.count ?? 0;
  const isAdmin = location.pathname.startsWith('/admin');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) {
        setAdminOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const linkCls = (active: boolean) =>
    cn(
      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
      active
        ? 'bg-white/20 text-white'
        : 'text-blue-100 hover:bg-white/10 hover:text-white'
    );

  return (
    <header className="shrink-0 h-14 flex items-center px-4 gap-2 shadow-md z-40"
      style={{ background: 'var(--topnav)', color: 'var(--topnav-foreground)' }}>
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 mr-4 cursor-pointer select-none"
        onClick={() => navigate('/summary')}
      >
        {/* Logo mark — GAF initials styled */}
        <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center font-black text-white text-sm tracking-tight border border-white/20">
          GAF
        </div>
        <div className="leading-tight hidden sm:block">
          <div className="text-white font-bold text-sm">Planilla</div>
          <div className="text-blue-200 text-[10px]">Payroll System</div>
        </div>
      </div>

      <div className="h-6 w-px bg-white/20 mr-2" />

      {/* Main nav links */}
      <nav className="flex items-center gap-0.5 flex-1">
        <NavLink to="/summary" className={({ isActive }) => linkCls(isActive)}>
          <BarChart2 className="w-4 h-4" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/process" className={({ isActive }) => linkCls(isActive)}>
          <PlayCircle className="w-4 h-4" />
          <span>Process</span>
        </NavLink>

        <NavLink to="/action-required" className={({ isActive }) => linkCls(isActive)}>
          <AlertTriangle className="w-4 h-4" />
          <span>Action Required</span>
          {unresolvedCount > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
              {unresolvedCount > 99 ? '99+' : unresolvedCount}
            </span>
          )}
        </NavLink>

        <NavLink to="/payroll-master" className={({ isActive }) => linkCls(isActive)}>
          <TableIcon className="w-4 h-4" />
          <span>Payroll Master</span>
        </NavLink>

        <NavLink to="/period-log" className={({ isActive }) => linkCls(isActive)}>
          <History className="w-4 h-4" />
          <span>Period Log</span>
        </NavLink>

        <NavLink to="/attendance" className={({ isActive }) => linkCls(isActive)}>
          <Activity className="w-4 h-4" />
          <span>Attendance</span>
        </NavLink>

        {/* Admin dropdown */}
        <div className="relative" ref={adminRef}>
          <button
            onClick={() => setAdminOpen(o => !o)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
              isAdmin || adminOpen
                ? 'bg-white/20 text-white'
                : 'text-blue-100 hover:bg-white/10 hover:text-white'
            )}
          >
            <Settings className="w-4 h-4" />
            <span>Admin</span>
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', adminOpen && 'rotate-180')} />
          </button>
          {adminOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
              {ADMIN_LINKS.map(l => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={() => setAdminOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'block px-4 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-800 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    )
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
