import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  PlayCircle, AlertTriangle, TableIcon, BarChart2,
  Settings, History, Activity,
  Users, RefreshCw, Tag, Clock, CalendarDays, Globe2,
  SlidersHorizontal, FileSpreadsheet,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import loadUnresolvedCountAction from '@/actions/loadUnresolvedCount';

// ── Section definitions ────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'payroll',
    label: 'Payroll',
    icon: TableIcon,
    home: '/summary',
    color: 'from-blue-600 to-blue-500',
    activeBg: 'bg-blue-600',
    hoverBg: 'hover:bg-blue-700',
    ring: 'ring-blue-300',
    subActiveBg: 'bg-blue-600/15 text-blue-700 font-semibold',
    subHover: 'hover:bg-blue-50 text-slate-600',
    paths: ['/summary', '/process', '/action-required', '/payroll-master', '/hrk-summary', '/period-log'],
    links: [
      { to: '/summary',         label: 'Dashboard',      icon: BarChart2 },
      { to: '/process',         label: 'Process',         icon: PlayCircle },
      { to: '/action-required', label: 'Action Required', icon: AlertTriangle, badge: true },
      { to: '/payroll-master',  label: 'Payroll Master',  icon: TableIcon },
      { to: '/hrk-summary',     label: 'HRK Summary',     icon: FileSpreadsheet },
      { to: '/period-log',      label: 'Period Log',       icon: History },
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: Activity,
    home: '/attendance',
    color: 'from-emerald-600 to-emerald-500',
    activeBg: 'bg-emerald-600',
    hoverBg: 'hover:bg-emerald-700',
    ring: 'ring-emerald-300',
    subActiveBg: 'bg-emerald-600/15 text-emerald-700 font-semibold',
    subHover: 'hover:bg-emerald-50 text-slate-600',
    paths: ['/attendance'],
    links: [
      { to: '/attendance',          label: 'Dashboard', icon: Activity },
      { to: '/attendance/employees',label: 'Employees', icon: Users },
      { to: '/attendance/trends',   label: 'Trends',    icon: TrendingUp },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: Settings,
    home: '/admin/employees',
    color: 'from-violet-600 to-violet-500',
    activeBg: 'bg-violet-600',
    hoverBg: 'hover:bg-violet-700',
    ring: 'ring-violet-300',
    subActiveBg: 'bg-violet-600/15 text-violet-700 font-semibold',
    subHover: 'hover:bg-violet-50 text-slate-600',
    paths: ['/admin'],
    links: [
      { to: '/admin/employees',      label: 'Employees',          icon: Users },
      { to: '/admin/directory-sync', label: 'Directory Sync',     icon: RefreshCw },
      { to: '/admin/aliases',        label: 'Name Aliases',        icon: Tag },
      { to: '/admin/schedules',      label: 'Schedules',           icon: Clock },
      { to: '/admin/holidays',       label: 'Holidays',            icon: CalendarDays },
      { to: '/admin/dst-calendar',   label: 'DST Calendar',        icon: Globe2 },
      { to: '/admin/lookups',        label: 'Rules & Config',      icon: SlidersHorizontal },

    ],
  },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

function getActiveSection(pathname: string): SectionId | null {
  for (const s of SECTIONS) {
    if (s.paths.some(p => pathname === p || pathname.startsWith(p + '/'))) return s.id;
  }
  return null;
}

// ── TopNav ─────────────────────────────────────────────────────────────────────

export default function TopNav() {
  const location  = useLocation();
  const navigate  = useNavigate();

  const [unresolvedData] = useLoadAction(loadUnresolvedCountAction, [] as { count: number }[]);
  const unresolvedCount  = (unresolvedData as { count: number }[])[0]?.count ?? 0;

  const activeSection = getActiveSection(location.pathname);
  const activeSectionDef = SECTIONS.find(s => s.id === activeSection) ?? null;

  // Animate sub-links: track previous section to detect change
  const prevSection = useRef<SectionId | null>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (prevSection.current !== activeSection) {
      setAnimKey(k => k + 1);
      prevSection.current = activeSection;
    }
  }, [activeSection]);

  return (
    <header className="shrink-0 h-14 bg-white border-b border-slate-200 shadow-sm flex items-center px-4 gap-0 z-40 overflow-hidden">
      {/* Brand */}
      <div
        className="flex items-center gap-2 mr-4 cursor-pointer select-none shrink-0"
        onClick={() => navigate('/summary')}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center font-black text-white text-xs tracking-tight shadow">
          GAF
        </div>
        <div className="leading-tight hidden sm:block">
          <div className="text-slate-800 font-bold text-sm">Planilla</div>
          <div className="text-slate-400 text-[10px]">Payroll System</div>
        </div>
      </div>

      <div className="w-px h-6 bg-slate-200 mr-3 shrink-0" />

      {/* Section buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {SECTIONS.map(s => {
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => navigate(s.home)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 select-none',
                isActive
                  ? `${s.activeBg} text-white shadow-sm`
                  : `text-slate-600 hover:text-slate-900 hover:bg-slate-100`
              )}
            >
              <s.icon className="w-4 h-4" />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Divider between sections and sub-links */}
      {activeSectionDef && (
        <div className="w-px h-6 bg-slate-200 mx-3 shrink-0" />
      )}

      {/* Sub-links – animated slide-in */}
      {activeSectionDef && (
        <nav
          key={animKey}
          className="flex items-center gap-0.5 flex-1 overflow-x-auto no-scrollbar"
          style={{ animation: 'slideInLeft 220ms cubic-bezier(.22,.68,0,1.2) both' }}
        >
          {activeSectionDef.links.map(l => {
            const isLinkActive =
              location.pathname === l.to ||
              (l.to !== '/' && location.pathname.startsWith(l.to + '/') && l.to !== '/attendance');
            // Special case: /attendance should only match exactly or via sub-routes not matched by deeper links
            const isAttDash = l.to === '/attendance' && location.pathname === '/attendance';
            const finalActive = l.to === '/attendance' ? isAttDash : isLinkActive;
            return (
              <button
                key={l.to}
                onClick={() => navigate(l.to)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-100 whitespace-nowrap shrink-0',
                  finalActive
                    ? activeSectionDef.subActiveBg
                    : `${activeSectionDef.subHover} hover:bg-slate-50`
                )}
              >
                <l.icon className="w-3.5 h-3.5 opacity-70 shrink-0" />
                <span>{l.label}</span>
                {'badge' in l && l.badge && unresolvedCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                    {unresolvedCount > 99 ? '99+' : unresolvedCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
