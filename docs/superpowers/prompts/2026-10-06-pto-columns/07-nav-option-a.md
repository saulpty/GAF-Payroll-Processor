# Navigation option A: coloured sections on the navy bar + a white second row with tabs and filters

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Saul chose navigation option A (2026-10-06, mockup https://claude.ai/artifact/UB7uj557cZ7gA6gLpYghwo):

- **Row 1, navy (`TopNav.tsx`):** only the six sections. Each always shows its own colour on its
  icon (Payroll blue, Attendance green, Disciplinary pink, Contracts yellow, PTO violet, Admin
  grey). The active one is lit (`bg-white/10`) with a 3px underline in its colour. The sub-page
  links leave this bar. `SECTIONS`, `getActiveSection` and `BADGE` are now exported.
- **Row 2, white (new `SectionBar.tsx`):** the active section's name with its colour mark, its
  pages as tabs (active tab underlined in the section colour, Action Required keeps its badge), and
  on the right that page's filters. On a narrow window the filters wrap under the tabs.
- **`FilterBar.tsx` is no longer its own row:** it renders inline inside SectionBar, compact —
  each select carries its name inside its box ("Period …", "Manager All", "Title All"), labels
  are Title Case (no ALL CAPS), no dividers. "Role" is shown as "Title". Every filter keeps
  exactly the same state, options and behaviour.
- **`app.tsx`:** renders `<SectionBar />` where `<FilterBar />` was.

The Action Required count (`loadUnresolvedCount`, reloaded on `arVersion`) moves from TopNav to
SectionBar, where its tab now lives. The Contracts / Disciplinary / PTO badges stay on TopNav.

**Only these four files may change:**
- `src/app/TopNav.tsx`: whole file below.
- **New** `src/app/SectionBar.tsx`: whole file below.
- `src/app/FilterBar.tsx`: whole file below.
- `src/app/app.tsx`: two edits below. Nothing else in it changes.

No other file may be touched (not `AttendanceRangeControls.tsx`, `EmployeeSearchInput.tsx`,
`PeriodMultiSelect.tsx`, `GlobalFilterContext.tsx`, `index.css`, any page, any action, or
`src/components/ui/*`).

## `src/app/TopNav.tsx` (whole file)

```tsx
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
```

## `src/app/SectionBar.tsx` (new file, whole)

```tsx
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLoadAction } from '@uibakery/data';
import { cn } from '@/lib/utils';
import loadUnresolvedCountAction from '@/actions/loadUnresolvedCount';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import FilterBar from '@/app/FilterBar';
import { SECTIONS, getActiveSection, BADGE } from '@/app/TopNav';

// Navigation option A, row 2 (Saul, 2026-10-06): the active section's name and its
// pages as tabs on the left, that page's filters on the right (FilterBar, compact).
// On a narrow window the filters wrap onto a second line under the tabs instead of
// being cut off; the tabs always keep the first line.
export default function SectionBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { arVersion } = useGlobalFilters();

  const [unresolvedData, , , reloadUnresolved] = useLoadAction(loadUnresolvedCountAction, [] as { count: number }[]);
  const unresolvedCount = (unresolvedData as { count: number }[])[0]?.count ?? 0;

  // Reload the Action Required tab badge whenever entries are committed or reverted
  const arVersionRef = useRef(arVersion);
  useEffect(() => {
    if (arVersionRef.current !== arVersion) {
      arVersionRef.current = arVersion;
      reloadUnresolved();
    }
  }, [arVersion, reloadUnresolved]);

  const activeId = getActiveSection(location.pathname);
  const sec = SECTIONS.find(s => s.id === activeId) ?? null;

  return (
    <div className="shrink-0 bg-white border-b border-slate-200 px-5 min-h-[48px] flex flex-wrap items-center gap-x-3 z-30">
      {sec && (
        <div className="flex items-center gap-2 h-12 min-w-0 max-w-full">
          <span
            className="flex items-center gap-2 pr-3 border-r border-slate-200 text-[13px] font-bold whitespace-nowrap shrink-0"
            style={{ color: sec.color.ink }}
          >
            <span className="w-2 h-2 rounded-sm" style={{ background: sec.color.accent }} aria-hidden="true" />
            {sec.label}
          </span>
          {sec.links.length > 0 && (
            <nav aria-label={`${sec.label} pages`} className="flex h-12 min-w-0 overflow-x-auto no-scrollbar">
              {sec.links.map(l => {
                const isActive =
                  location.pathname === l.to ||
                  (l.to !== '/' && location.pathname.startsWith(l.to + '/'));
                return (
                  <button
                    key={l.to}
                    onClick={() => navigate(l.to)}
                    aria-current={isActive ? 'page' : undefined}
                    style={isActive ? { borderBottomColor: sec.color.accent } : undefined}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 h-12 border-b-2 text-[13px] whitespace-nowrap shrink-0 transition-colors duration-100 focus:outline-none',
                      isActive
                        ? 'font-semibold text-slate-900'
                        : 'border-transparent font-medium text-slate-500 hover:text-slate-900'
                    )}
                  >
                    <l.icon className="w-3.5 h-3.5 opacity-70 shrink-0" />
                    <span>{l.label}</span>
                    {'badge' in l && l.badge && unresolvedCount > 0 && (
                      <span className={BADGE}>
                        {unresolvedCount > 99 ? '99+' : unresolvedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      )}
      <div className="flex-1" />
      <FilterBar />
    </div>
  );
}
```

## `src/app/FilterBar.tsx` (whole file)

```tsx
import { useLocation } from 'react-router-dom';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import { useLoadAction } from '@uibakery/data';
import { X } from 'lucide-react';
import { useMemo, useEffect, useRef } from 'react';
import { fmtDate } from '@/app/lib/fmtDate';
import EmployeeSearchInput from '@/app/components/EmployeeSearchInput';
import PeriodMultiSelect from '@/app/components/PeriodMultiSelect';
import AttendanceRangeControls from '@/app/components/AttendanceRangeControls';
import loadPeriodsAction from '@/actions/loadPeriods';
import { managerOptions } from '@/app/lib/managerFilter';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import loadActionRequiredCountsAction from '@/actions/loadActionRequiredCounts';
import type { EmpInfo } from '@/app/lib/attendanceStats';

type PeriodRow = {
  period_name: string;
  start_date: string;
  end_date: string;
  processed_at: string | null;
};

type RouteConfig = {
  period?: boolean; dateRange?: boolean; employee?: boolean;
  role?: boolean; manager?: boolean; statusTab?: boolean; pmTab?: boolean;
  periods?: boolean;
};

const ROUTE_CONFIG: Record<string, RouteConfig> = {
  '/action-required':       { period: true, employee: true, statusTab: true },
  '/payroll-master':        { period: true, employee: true, pmTab: true },
  '/hrk-summary':           { period: true },
  '/process':               { dateRange: true },
  '/attendance/today':      { employee: true, role: true, manager: true },
  '/attendance/list':       { periods: true, dateRange: true, employee: true, role: true, manager: true },
  '/attendance':            { employee: true, role: true, manager: true },
  '/attendance/reports':    { periods: true, dateRange: true, employee: true, role: true, manager: true },
  '/attendance/activity':   { periods: true, dateRange: true, employee: true, role: true, manager: true },
  '/pto':                   { employee: true, role: true, manager: true },
  '/contracts':             { employee: true, role: true, manager: true },
  '/disciplinary':          { employee: true, role: true, manager: true },
};

// Routes with a Periods/Dates switch, keyed to their default mode
const ATTENDANCE_SWITCH_ROUTES: Record<string, 'periods' | 'dates'> = {
  '/attendance/list':      'periods',
  '/attendance/reports':   'periods',
  '/attendance/activity':  'dates',
};

function getConfig(pathname: string): RouteConfig | null {
  if (ROUTE_CONFIG[pathname]) return ROUTE_CONFIG[pathname];
  for (const key of Object.keys(ROUTE_CONFIG)) {
    if (key !== '/' && pathname.startsWith(key + '/')) return ROUTE_CONFIG[key];
  }
  return null;
}

const PM_TAB_STYLES: Record<string, { active: string; idle: string; dot?: string }> = {
  ALL:    { active: 'bg-slate-700 text-white', idle: 'bg-white text-slate-600 hover:bg-slate-50' },
  GREEN:  { active: 'bg-green-600 text-white', idle: 'bg-white text-green-700 hover:bg-green-50', dot: 'bg-green-400' },
  YELLOW: { active: 'bg-amber-500 text-white', idle: 'bg-white text-amber-700 hover:bg-amber-50', dot: 'bg-amber-300' },
  RED:    { active: 'bg-red-600 text-white',   idle: 'bg-white text-red-700 hover:bg-red-50',     dot: 'bg-red-400' },
};

export default function FilterBar() {
  const location = useLocation();
  const cfg = getConfig(location.pathname);

  const {
    periodsVersion,
    arVersion,
    attendanceMode, setAttendanceMode,
    period, setPeriod,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    attendancePeriods, setAttendancePeriods,
    employee, setEmployee,
    role, setRole,
    manager, setManager,
    statusTab, setStatusTab,
    pmTab, setPmTab,
    hasAny, clearAll,
  } = useGlobalFilters();

  const { viewAs, isSuper } = useViewer();

  const [periodsRaw, , , refetchPeriods] = useLoadAction(loadPeriodsAction, [] as PeriodRow[]);
  const [empsRaw]    = useLoadAction(loadAttendanceEmployeesAction, [] as EmpInfo[], { viewAs });

  type CountsRow = { red_count: number; yellow_count: number };
  const [countsRaw, , , reloadCounts] = useLoadAction(
    loadActionRequiredCountsAction,
    [] as CountsRow[],
    { periodName: period },
  );
  const counts = (countsRaw as CountsRow[])[0] ?? { red_count: 0, yellow_count: 0 };

  const arVersionRef = useRef(arVersion);
  useEffect(() => {
    if (arVersionRef.current !== arVersion) {
      arVersionRef.current = arVersion;
      reloadCounts();
    }
  }, [arVersion, reloadCounts]);

  const versionRef = useRef(periodsVersion);
  useEffect(() => {
    if (periodsVersion !== versionRef.current) {
      versionRef.current = periodsVersion;
      refetchPeriods();
    }
  }, [periodsVersion, refetchPeriods]);

  useEffect(() => {
    if (period === '__all__' && location.pathname !== '/payroll-master') setPeriod('');
  }, [period, location.pathname]);

  // All named periods sorted newest-first (includes unprocessed, used by quick picks)
  const allNamedPeriods = useMemo(() => {
    return (periodsRaw as PeriodRow[])
      .filter(p => !!p.period_name?.trim())
      .map(p => ({
        period_name: p.period_name,
        start_date: String(p.start_date).slice(0, 10),
        end_date: String(p.end_date).slice(0, 10),
        processed_at: p.processed_at,
      }))
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
  }, [periodsRaw]);

  // Processed periods for attendance multi-select, newest first
  const processedPeriods = useMemo(() => {
    return allNamedPeriods
      .filter(p => !!p.processed_at)
      .map(p => ({ period_name: p.period_name, start_date: p.start_date, end_date: p.end_date }));
  }, [allNamedPeriods]);

  // All periods for single-period select (action-required, payroll-master, hrk)
  const periods = (periodsRaw as PeriodRow[]).filter(p => !!p.period_name?.trim());

  const rangeOf = (names: string[]) => {
    const selected = processedPeriods.filter(p => names.includes(p.period_name));
    if (!selected.length) return null;
    const from = selected.map(p => p.start_date).sort()[0]!;
    const to   = selected.map(p => p.end_date).sort().reverse()[0]!;
    return { from, to };
  };

  // Auto-select newest processed period when in Periods mode and nothing is selected
  useEffect(() => {
    if (cfg?.periods && attendanceMode === 'periods' && attendancePeriods.length === 0 && processedPeriods.length > 0) {
      const newest = processedPeriods[0]!;
      setAttendancePeriods([newest.period_name], rangeOf([newest.period_name]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.periods, attendanceMode, processedPeriods.length, attendancePeriods.length]);

  // Reset mode to route default on attendance sub-route change
  const prevRouteRef = useRef<string | null>(null);
  useEffect(() => {
    const matchKey = Object.keys(ATTENDANCE_SWITCH_ROUTES)
      .filter(k => location.pathname === k || location.pathname.startsWith(k + '/'))
      .sort((a, b) => b.length - a.length)[0];
    const routeKey = matchKey ?? null;
    if (routeKey !== null && routeKey !== prevRouteRef.current) {
      prevRouteRef.current = routeKey;
      setAttendanceMode(ATTENDANCE_SWITCH_ROUTES[routeKey]!);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const emps = empsRaw as EmpInfo[];
  const managers = useMemo(() => managerOptions(emps), [emps]);
  const roles    = useMemo(() => [...new Set(emps.map(e => e.role).filter(Boolean))].sort(), [emps]);

  if (!cfg) return null;

  // Compact filters (navigation option A, 2026-10-06): they sit in SectionBar's white row,
  // to the right of the tabs. A select carries its name inside its box ("Manager All").
  const inputCls = 'h-8 px-2.5 text-[13px] border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-warm-ring';
  const labelCls = 'text-[12px] font-medium text-slate-500';
  const boxCls   = 'h-8 flex items-center gap-1.5 pl-2.5 pr-1 border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-warm-ring';
  const inLabel  = 'text-[12px] font-medium text-slate-500 whitespace-nowrap';
  const bareSel  = 'h-full max-w-[200px] bg-transparent text-[13px] text-slate-900 focus:outline-none';
  const divider  = null;

  const hasBothModes = !!(cfg.periods && cfg.dateRange);

  return (
    <div className="flex items-center justify-end gap-2 flex-wrap py-2 min-w-0">

      {cfg.period && (
        <>
          <label className={boxCls}>
            <span className={inLabel}>Period</span>
            <select value={period} onChange={e => setPeriod(e.target.value)} className={bareSel}>
              <option value="">{location.pathname === '/payroll-master' ? 'Choose A Period' : 'All periods'}</option>
              {location.pathname === '/payroll-master' && <option value="__all__">All Periods</option>}
              {periods.map(p => (
                <option key={p.period_name} value={p.period_name}>{p.period_name}</option>
              ))}
            </select>
          </label>
          {(cfg.dateRange || cfg.employee || cfg.role || cfg.manager || cfg.statusTab || cfg.pmTab) && divider}
        </>
      )}

      {/* Periods | Dates switch (attendance routes only) */}
      {hasBothModes && (
        <AttendanceRangeControls
          processedPeriods={processedPeriods}
          allNamedPeriods={allNamedPeriods}
          showDivider={!!(cfg.employee || cfg.role || cfg.manager)}
          inputCls={inputCls}
          labelCls={labelCls}
          divider={divider}
        />
      )}

      {/* Periods-only (no dateRange, kept for future routes) */}
      {cfg.periods && !hasBothModes && (
        <>
          <label className={labelCls}>Periods</label>
          <PeriodMultiSelect
            periods={processedPeriods}
            selected={attendancePeriods}
            onChange={names => setAttendancePeriods(names, names.length ? rangeOf(names) : null)}
          />
          {attendancePeriods.length > 0 && dateFrom && dateTo && (
            <span className="text-[12px] text-slate-500 tabular-nums whitespace-nowrap">
              {fmtDate(dateFrom)} → {fmtDate(dateTo)}
            </span>
          )}
          {(cfg.employee || cfg.role || cfg.manager) && divider}
        </>
      )}

      {/* DateRange-only (e.g. /process — unchanged) */}
      {cfg.dateRange && !hasBothModes && (
        <>
          <label className={labelCls}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          <label className={labelCls}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          {(cfg.employee || cfg.role || cfg.manager) && divider}
        </>
      )}

      {cfg.employee && (
        <>
          <EmployeeSearchInput
            value={employee}
            onChange={setEmployee}
            options={emps}
            placeholder="Search employee…"
            className={inputCls + ' w-44'}
          />
          {(cfg.role || cfg.manager || cfg.statusTab || cfg.pmTab) && divider}
        </>
      )}

      {cfg.manager && isSuper && (
        <>
          <label className={boxCls}>
            <span className={inLabel}>Manager</span>
            <select value={manager} onChange={e => setManager(e.target.value)} className={bareSel}>
              <option value="">All</option>
              {managers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          {cfg.role && divider}
        </>
      )}

      {cfg.role && (
        <>
          <label className={boxCls}>
            <span className={inLabel}>Title</span>
            <select value={role} onChange={e => setRole(e.target.value)} className={bareSel}>
              <option value="">All</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </>
      )}

      {cfg.statusTab && (
        <div className="flex rounded-lg border overflow-hidden shadow-sm h-8">
          {(['RED', 'YELLOW'] as const).map(tab => {
            const isActive = statusTab === tab;
            const cls = tab === 'RED'
              ? isActive ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-50'
              : isActive ? 'bg-amber-500 text-white' : 'bg-white text-amber-700 hover:bg-amber-50';
            const tabCount = tab === 'RED' ? counts.red_count : counts.yellow_count;
            return (
              <button key={tab} onClick={() => setStatusTab(tab)}
                className={`flex items-center gap-1.5 px-3 text-xs font-semibold border-r last:border-r-0 transition-colors ${cls}`}>
                <span className={`w-2 h-2 rounded-full ${tab === 'RED' ? 'bg-red-400' : 'bg-amber-300'} ${isActive ? 'opacity-70' : ''}`} />
                {tab}
                {tabCount > 0 && (
                  <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                    isActive ? 'bg-white/25 text-white'
                      : tab === 'RED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {tabCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {cfg.pmTab && (
        <div className="flex rounded-lg border overflow-hidden shadow-sm h-8">
          {(['ALL', 'GREEN', 'YELLOW', 'RED'] as const).map(tab => {
            const s = PM_TAB_STYLES[tab];
            const isActive = pmTab === tab;
            return (
              <button key={tab} onClick={() => setPmTab(tab)}
                className={`flex items-center gap-1.5 px-3 text-xs font-semibold border-r last:border-r-0 transition-colors ${isActive ? s.active : s.idle}`}>
                {s.dot && <span className={`w-2 h-2 rounded-full ${s.dot} ${isActive ? 'opacity-70' : 'opacity-60'}`} />}
                {tab}
              </button>
            );
          })}
        </div>
      )}

      {hasAny && (
        <button onClick={clearAll}
          className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-red-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded px-1">
          <X className="w-3 h-3" />
          Clear Filters
        </button>
      )}
    </div>
  );
}
```

## `src/app/app.tsx`: two edits

1. Replace exactly `import FilterBar from '@/app/FilterBar';` with exactly
   `import SectionBar from '@/app/SectionBar';`
2. Replace exactly the line `              <FilterBar />` with exactly `              <SectionBar />`
   (same indentation, directly under `<TopNav />`).

## Report
- Byte size of the four files (FilterBar.tsx must stay under 15,000); confirm no other file
  changed; open Payroll → Action Required, Attendance → Activity, PTO Tracker and Admin →
  Employees and confirm each shows both rows with no console errors.
