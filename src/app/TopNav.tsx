import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  PlayCircle, AlertTriangle, TableIcon,
  Settings, History, Activity,
  Users, Clock, CalendarDays, Globe2,
  SlidersHorizontal, FileSpreadsheet,
  Palmtree, FileSignature, ShieldAlert, FileText,
  Eye, X, KeyRound, UserCircle,
} from 'lucide-react';
import type { NavBadges } from '@/app/lib/useNavBadges';
import { useIsPhone } from '@/app/lib/useIsPhone';
import { navBadge } from '@/app/lib/mobileNav';
import BrandLogo from '@/app/components/BrandLogo';
import RefreshButton from '@/app/components/RefreshButton';
import { useViewer } from '@/app/context/ViewerContext';
import { canSeeSection, homeFor } from '@/app/lib/access';

// ── Section definitions ────────────────────────────────────────────────────────
// Navigation option A (Saul, 2026-10-06): row 1 = the six sections, each with its
// own colour; row 2 (SectionBar.tsx) = the active section's pages + the filters.
// color.icon: icon + underline on the navy bar (light tint, readable on navy).
// color.accent: the active tab's underline and the section mark on the white row.
// color.ink: the section name on the white row (≥ 4.5:1 on white).

export const SECTIONS = [
  {
    id: 'payroll',
    label: 'Payroll',
    icon: TableIcon,
    home: '/payroll-master',
    color: { icon: '#7DD3FC', accent: '#2563EB', ink: '#1D4ED8' },
    paths: ['/process', '/action-required', '/payroll-master', '/hrk-summary', '/period-log'],
    links: [
      { to: '/payroll-master',  label: 'Payroll Master',  icon: TableIcon },
      { to: '/process',         label: 'Process',         icon: PlayCircle },
      { to: '/action-required', label: 'Action Required', icon: AlertTriangle, badge: true },
      { to: '/hrk-summary',     label: 'HRK Summary',     icon: FileSpreadsheet },
      { to: '/period-log',      label: 'Period Log',       icon: History },
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: Activity,
    home: '/attendance/today',
    color: { icon: '#6EE7B7', accent: '#059669', ink: '#047857' },
    paths: ['/attendance'],
    links: [
      { to: '/attendance/today',    label: 'Today',    icon: Clock },
      { to: '/attendance/activity', label: 'Activity', icon: Activity },
      { to: '/attendance/list',     label: 'Punctuality', icon: Users },
      { to: '/attendance/reports',  label: 'Reports',  icon: FileText },
    ],
  },
  {
    id: 'disciplinary',
    label: 'Disciplinary',
    icon: ShieldAlert,
    home: '/disciplinary',
    color: { icon: '#FDA4AF', accent: '#E11D48', ink: '#BE123C' },
    paths: ['/disciplinary'],
    links: [],
    badge: true,
  },
  {
    id: 'contracts',
    label: 'Contracts',
    icon: FileSignature,
    home: '/contracts',
    color: { icon: '#FCD34D', accent: '#D97706', ink: '#B45309' },
    paths: ['/contracts'],
    links: [],
    badge: true,
  },
  {
    id: 'pto',
    label: 'PTO Tracker',
    icon: Palmtree,
    home: '/pto',
    color: { icon: '#C4B5FD', accent: '#7C3AED', ink: '#6D28D9' },
    paths: ['/pto'],
    links: [],
    badge: true,
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: Settings,
    home: '/admin/employees',
    color: { icon: '#CBD5E1', accent: '#64748B', ink: '#475569' },
    paths: ['/admin'],
    links: [
      { to: '/admin/employees',      label: 'Employees',           icon: Users },
      { to: '/admin/access',         label: 'Access',              icon: KeyRound },
      { to: '/admin/schedules',      label: 'Schedules',           icon: Clock },
      { to: '/admin/holidays',       label: 'Holidays',            icon: CalendarDays },
      { to: '/admin/dst-calendar',   label: 'DST Calendar',        icon: Globe2 },
      { to: '/admin/lookups',        label: 'Rules & Config',      icon: SlidersHorizontal },

    ],
  },
] as const;

export type SectionId = 'payroll' | 'attendance' | 'disciplinary' | 'contracts' | 'pto' | 'admin';

export function getActiveSection(pathname: string): SectionId | null {
  for (const s of SECTIONS) {
    if (s.paths.some(p => pathname === p || pathname.startsWith(p + '/'))) return s.id;
  }
  return null;
}

// Orange badge with navy ink: white on orange fails contrast.
export const BADGE = 'bg-warm text-warm-ink text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none';

// ── TopNav ─────────────────────────────────────────────────────────────────────

export default function TopNav({ badges }: { badges: NavBadges }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { isSuper, isViewingAs, name, email, setViewAs } = useViewer();
  const visibleSections = SECTIONS.filter(s => canSeeSection(isSuper, s.id));

  // On a phone the sections live in the bottom bar (BottomNav); this bar names the current one.
  const isPhone = useIsPhone();
  const activeSection = getActiveSection(location.pathname);
  const current = SECTIONS.find(s => s.id === activeSection) ?? null;

  return (
    <>
    <header className="topnav-dark shrink-0 h-14 bg-[var(--topnav)] text-[var(--topnav-foreground)] shadow-sm flex items-center px-4 gap-0 z-40 overflow-hidden phone:h-12">
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 mr-3 pr-4 border-r border-white/20 cursor-pointer select-none shrink-0"
        onClick={() => navigate(homeFor(isSuper))}
      >
        <BrandLogo />
        <div className="leading-tight hidden sm:block">
          <div className="text-white font-bold text-[14px] tracking-tight">GAF Panama</div>
          <div className="text-slate-300 text-[10px] tracking-wide">HR Hub</div>
        </div>
      </div>

      {/* Sections: each keeps its colour; the active one is lit with an underline in its colour */}
      {isPhone ? (
        <div className="flex-1 min-w-0 flex items-center gap-2 text-[14px] font-semibold text-white">
          {current && (
            <>
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: current.color.icon }} aria-hidden="true" />
              <span className="truncate">{current.label}</span>
            </>
          )}
        </div>
      ) : (
      <nav aria-label="Sections" className="flex items-center h-14 flex-1 min-w-0 overflow-x-auto no-scrollbar phone:h-12">
        {visibleSections.map(s => {
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => navigate(s.home)}
              aria-current={isActive ? 'page' : undefined}
              style={isActive ? { borderBottomColor: s.color.icon } : undefined}
              className={cn(
                'flex items-center gap-2 px-3 h-14 border-b-[3px] text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 select-none focus:outline-none phone:h-12',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
              )}
            >
              <s.icon className="w-4 h-4" style={{ color: s.color.icon }} />
              <span>{s.label}</span>
              {(() => {
                const b = 'badge' in s && s.badge ? navBadge(s.id, badges, isSuper) : null;
                return b && (
                  <span className={BADGE} aria-label={b.label}>
                    {b.count > 99 ? '99+' : b.count}
                  </span>
                );
              })()}
            </button>
          );
        })}
      </nav>
      )}

      <RefreshButton />

      {isViewingAs ? (
        <button
          onClick={() => setViewAs('')}
          title="Stop viewing as this person"
          className="ml-3 shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 phone:hidden"
        >
          <Eye className="w-3.5 h-3.5" />
          <span><span className="phone:hidden">Viewing As </span>{name || email}</span>
          <X className="w-3.5 h-3.5" />
        </button>
      ) : (
        <div
          title={email}
          className="ml-3 shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-white/10 text-white border border-white/20"
        >
          <UserCircle className="w-3.5 h-3.5" />
          <span className="phone:hidden">{name || email}</span>
          <span className="text-slate-300 phone:hidden">· {isSuper ? 'Super User' : 'Manager'}</span>
        </div>
      )}
    </header>
    {/* Phone, viewing as someone: a full-width strip under the bar. The name is never hidden. */}
    {isViewingAs && isPhone && (
      <div className="shrink-0 min-h-11 flex items-center gap-2 pl-4 bg-amber-100 text-amber-800 border-b border-amber-300 text-[13px] font-medium z-40">
        <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0 py-1 break-words">Viewing As {name || email}</span>
        <button
          type="button"
          onClick={() => setViewAs('')}
          aria-label="Stop viewing as this person"
          className="shrink-0 min-h-11 min-w-11 px-4 flex items-center justify-center font-semibold underline underline-offset-2"
        >
          Stop
        </button>
      </div>
    )}
    </>
  );
}
