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
import { useEffect, useRef } from 'react';
import { useLoadAction } from '@uibakery/data';
import loadContractsExpiringCountAction from '@/actions/loadContractsExpiringCount';
import loadDisciplinaryDueCountAction from '@/actions/loadDisciplinaryDueCount';
import loadPtoReviewCountAction from '@/actions/loadPtoReviewCount';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import BrandLogo from '@/app/components/BrandLogo';
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
      { to: '/attendance/list',     label: 'List',     icon: Users },
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

export default function TopNav() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { ptoVersion } = useGlobalFilters();
  const { isSuper, isViewingAs, name, email, setViewAs, viewAs } = useViewer();
  const visibleSections = SECTIONS.filter(s => canSeeSection(isSuper, s.id));

  const [expiringData]    = useLoadAction(loadContractsExpiringCountAction, [] as { count: number }[], { viewAs });
  const expiringCount     = (expiringData as { count: number }[])[0]?.count ?? 0;
  const asOf              = toLocalYMD(new Date());
  const [dueData]         = useLoadAction(loadDisciplinaryDueCountAction, [] as { count: number }[], { asOf });
  const dueCount          = (dueData as { count: number }[])[0]?.count ?? 0;
  const [reviewData, , , reloadReview] = useLoadAction(loadPtoReviewCountAction, [] as { count: number }[], { today: asOf, manager: null, viewAs });
  const reviewCount       = (reviewData as { count: number }[])[0]?.count ?? 0;

  // Reload PTO review count whenever a PTO record is written anywhere in the app
  const ptoVersionRef = useRef(ptoVersion);
  useEffect(() => {
    if (ptoVersionRef.current !== ptoVersion) {
      ptoVersionRef.current = ptoVersion;
      reloadReview();
    }
  }, [ptoVersion, reloadReview]);

  function sectionBadge(id: string): { count: number; label: string } | null {
    if (!isSuper && id === 'disciplinary') return null;
    if (id === 'contracts' && expiringCount > 0) {
      return {
        count: expiringCount,
        label: `${expiringCount} contract${expiringCount === 1 ? '' : 's'} ending within 30 days`,
      };
    }
    if (id === 'disciplinary' && dueCount > 0) {
      return {
        count: dueCount,
        label: `${dueCount} disciplinary re-evaluation${dueCount === 1 ? '' : 's'} due`,
      };
    }
    if (id === 'pto' && reviewCount > 0) {
      return {
        count: reviewCount,
        label: `${reviewCount} PTO request${reviewCount === 1 ? '' : 's'} ready to record`,
      };
    }
    return null;
  }

  const activeSection = getActiveSection(location.pathname);

  return (
    <header className="topnav-dark shrink-0 h-14 bg-[var(--topnav)] text-[var(--topnav-foreground)] shadow-sm flex items-center px-4 gap-0 z-40 overflow-hidden">
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
      <nav aria-label="Sections" className="flex items-center h-14 flex-1 min-w-0 overflow-x-auto no-scrollbar">
        {visibleSections.map(s => {
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => navigate(s.home)}
              aria-current={isActive ? 'page' : undefined}
              style={isActive ? { borderBottomColor: s.color.icon } : undefined}
              className={cn(
                'flex items-center gap-2 px-3 h-14 border-b-[3px] text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 select-none focus:outline-none',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
              )}
            >
              <s.icon className="w-4 h-4" style={{ color: s.color.icon }} />
              <span>{s.label}</span>
              {(() => {
                const b = 'badge' in s && s.badge ? sectionBadge(s.id) : null;
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

      {isViewingAs ? (
        <button
          onClick={() => setViewAs('')}
          title="Stop viewing as this person"
          className="ml-3 shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200"
        >
          <Eye className="w-3.5 h-3.5" />
          Viewing As {name || email}
          <X className="w-3.5 h-3.5" />
        </button>
      ) : (
        <div
          title={email}
          className="ml-3 shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-white/10 text-white border border-white/20"
        >
          <UserCircle className="w-3.5 h-3.5" />
          {name || email}
          <span className="text-slate-300">· {isSuper ? 'Super User' : 'Manager'}</span>
        </div>
      )}
    </header>
  );
}
