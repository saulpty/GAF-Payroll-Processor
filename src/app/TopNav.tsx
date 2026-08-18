import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  PlayCircle, AlertTriangle, TableIcon, BarChart2,
  Settings, History, Activity,
  Users, Clock, CalendarDays, Globe2,
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
    color: 'from-[#1B3A6B] to-[#254d8e]',
    activeBg: 'bg-[#1B3A6B]',
    hoverBg: 'hover:bg-[#152d54]',
    ring: 'ring-[#1B3A6B]/30',
    subActiveBg: 'bg-[#1B3A6B]/10 text-[#1B3A6B] font-semibold',
    subHover: 'hover:bg-[#1B3A6B]/5 text-slate-600',
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
    color: 'from-[#2AA876] to-[#22966a]',
    activeBg: 'bg-[#2AA876]',
    hoverBg: 'hover:bg-[#22966a]',
    ring: 'ring-[#2AA876]/30',
    subActiveBg: 'bg-[#2AA876]/10 text-[#1e7a56] font-semibold',
    subHover: 'hover:bg-[#2AA876]/5 text-slate-600',
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
    color: 'from-[#1B3A6B] to-[#2AA876]',
    activeBg: 'bg-slate-700',
    hoverBg: 'hover:bg-slate-800',
    ring: 'ring-slate-300',
    subActiveBg: 'bg-slate-700/10 text-slate-800 font-semibold',
    subHover: 'hover:bg-slate-100 text-slate-600',
    paths: ['/admin'],
    links: [
      { to: '/admin/employees',      label: 'Employees',           icon: Users },
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
    <header className="shrink-0 h-14 bg-white border-b border-slate-200 shadow-sm flex items-center px-4 gap-0 z-40 overflow-hidden" style={{ borderBottomColor: '#e8edf5' }}>
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 mr-4 cursor-pointer select-none shrink-0"
        onClick={() => navigate('/summary')}
      >
        {/* GAF Healthcare logomark: navy shield with teal heartbeat */}
        <div className="w-8 h-8 rounded-lg bg-[#1B3A6B] flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Heart/pulse line — teal */}
            <polyline points="2,10 5,10 7,6 9,14 11,8 13,10 18,10" stroke="#2AA876" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
        <div className="leading-tight hidden sm:block">
          <div className="flex items-baseline gap-1">
            <span className="text-[#1B3A6B] font-extrabold text-sm tracking-tight">GAF</span>
            <span className="text-[#2AA876] font-bold text-sm tracking-tight">Healthcare</span>
          </div>
          <div className="text-slate-400 text-[10px] tracking-wide">Planilla · Payroll System</div>
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
