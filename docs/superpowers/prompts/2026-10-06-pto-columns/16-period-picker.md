# Live attendance, step 2 of 4: the Periods picker offers periods not processed yet

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Needs step 1 (`src/app/lib/attendancePeriods.ts`) to exist.

Attendance List / Reports' Periods picker used to list only processed periods, and picked the
newest processed one by itself. Now:
- it lists every period **plus** not-yet-processed ones up to the period containing today
  (built with `nextPeriod`), each unprocessed one tagged **Not processed** (Excel yellow);
- by itself it picks the **period containing today**;
- choosing periods sets From/To through one shared `rangeOf` (clamped to today), used by both
  FilterBar and AttendanceRangeControls (the second, unclamped copy is removed).
The Payroll pages' single Period select is unchanged.

**Only these three files may change** (each a whole file below): `src/app/FilterBar.tsx`,
`src/app/components/AttendanceRangeControls.tsx`, `src/app/components/PeriodMultiSelect.tsx`.
No other file may be touched (not `attendancePeriods.ts`, `periodName.ts`,
`classificationEngine.ts`, `filterRoutes.ts`, `GlobalFilterContext.tsx`, any page, any action,
or `src/components/ui/*`).

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
import { getConfig, ATTENDANCE_SWITCH_ROUTES, hasVisibleFilter } from '@/app/lib/filterRoutes';
import { attendancePeriodOptions } from '@/app/lib/attendancePeriods';
import { nextPeriod } from '@/app/lib/periodName';
import { toLocalYMD } from '@/app/lib/classificationEngine';

type PeriodRow = {
  period_name: string;
  start_date: string;
  end_date: string;
  processed_at: string | null;
};

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
    clearAll,
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

  // Attendance Periods picker: every named period plus not-yet-processed ones up to today
  // (live attendance, 2026-10-06); default = the period containing today.
  const periodPick = useMemo(
    () => attendancePeriodOptions(periodsRaw as PeriodRow[], toLocalYMD(new Date()), nextPeriod),
    [periodsRaw],
  );
  const periodOptions = periodPick.options;

  // All periods for single-period select (action-required, payroll-master, hrk)
  const periods = (periodsRaw as PeriodRow[]).filter(p => !!p.period_name?.trim());

  const rangeOf = periodPick.rangeOf;

  // Auto-select the default period (the one containing today) in Periods mode when none is chosen
  useEffect(() => {
    const def = periodPick.defaultName;
    if (cfg?.periods && attendanceMode === 'periods' && attendancePeriods.length === 0 && def) {
      setAttendancePeriods([def], rangeOf([def]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.periods, attendanceMode, periodPick.defaultName, attendancePeriods.length]);

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
  const bareSel  = 'h-full max-w-[130px] bg-transparent text-[13px] text-slate-900 focus:outline-none';
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
          periods={periodOptions}
          rangeOf={rangeOf}
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
            periods={periodOptions}
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
            className={inputCls + ' w-40'}
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

      {hasVisibleFilter(cfg, {
        period, employee, role, manager, isSuper, attendanceMode, attendancePeriods,
        defaultPeriod: periodPick.defaultName,
      }) && (
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

## `src/app/components/AttendanceRangeControls.tsx` (whole file)

```tsx
// Attendance Periods | Dates segmented switch rendered in FilterBar.
// Reads GlobalFilterContext directly; receives processed/all periods as props.
import { useMemo } from 'react';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { fmtDate } from '@/app/lib/fmtDate';
import PeriodMultiSelect from '@/app/components/PeriodMultiSelect';

export type NormalizedPeriod = {
  period_name: string;
  start_date: string;
  end_date: string;
};

export type AllNamedPeriod = NormalizedPeriod & { processed_at: string | null };

/** Add n days to a YYYY-MM-DD string (uses Date only for arithmetic, not TZ conversion). */
function addDaysStr(ymd: string, n: number): string {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toLocalYMD(d);
}

/** Monday of the ISO week containing todayYmd. */
function mondayOf(todayYmd: string): string {
  const d = new Date(todayYmd + 'T12:00:00');
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return toLocalYMD(d);
}

type Handler = (() => void) | null;

// Compact look (navigation option A, 2026-10-06): the filters share SectionBar's white row
// with the tabs, so From / To carry their name inside the box and the five quick ranges are
// one "Quick" dropdown instead of five buttons (they pushed the row onto a second line).
const BOX = 'h-8 flex items-center gap-1.5 pl-2.5 pr-1 border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-warm-ring';
const IN_LABEL = 'text-[12px] font-medium text-slate-500 whitespace-nowrap';
const BARE = 'h-full bg-transparent text-[13px] text-slate-900 focus:outline-none';

interface Props {
  /** Every period the picker offers (processed or not), newest first. */
  periods: (NormalizedPeriod & { processed?: boolean })[];
  /** Selected period names → the date range (clamped to today), from FilterBar. */
  rangeOf: (names: string[]) => { from: string; to: string } | null;
  allNamedPeriods: AllNamedPeriod[];
  /** Show a divider after the range block when employee/manager/role follow */
  showDivider: boolean;
  /** Kept for FilterBar; the compact boxes above set their own look. */
  inputCls: string;
  labelCls: string;
  divider: React.ReactNode;
}

export default function AttendanceRangeControls({
  periods, rangeOf, allNamedPeriods, showDivider, divider,
}: Props) {
  const {
    attendanceMode, setAttendanceMode,
    attendancePeriods, setAttendancePeriods,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
  } = useGlobalFilters();


  const today = toLocalYMD(new Date());

  const quickPicks = useMemo(() => {
    return [
      { label: 'Today',         handler: (() => { setDateFrom(today); setDateTo(today); }) as Handler },
      { label: 'This Week',     handler: (() => { setDateFrom(mondayOf(today)); setDateTo(today); }) as Handler },
      { label: 'Last 14 Days',  handler: (() => { setDateFrom(addDaysStr(today, -13)); setDateTo(today); }) as Handler },
      { label: 'Last 30 Days',  handler: (() => { setDateFrom(addDaysStr(today, -29)); setDateTo(today); }) as Handler },
      { label: 'Last 90 Days',  handler: (() => { setDateFrom(addDaysStr(today, -89)); setDateTo(today); }) as Handler },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  return (
    <>
      {/* Segmented switch */}
      <div className="flex rounded-md border border-slate-300 overflow-hidden h-8">
        {(['periods', 'dates'] as const).map(mode => {
          const isActive = attendanceMode === mode;
          return (
            <button
              key={mode}
              onClick={() => setAttendanceMode(mode)}
              className={`px-3 text-[12px] font-semibold border-r last:border-r-0 transition-colors ${
                isActive ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {mode === 'periods' ? 'Periods' : 'Dates'}
            </button>
          );
        })}
      </div>

      {attendanceMode === 'periods' ? (
        <>
          <PeriodMultiSelect
            periods={periods}
            selected={attendancePeriods}
            onChange={names => setAttendancePeriods(names, names.length ? rangeOf(names) : null)}
          />
          {attendancePeriods.length > 0 && dateFrom && dateTo && (
            <span className="text-[12px] text-slate-500 tabular-nums whitespace-nowrap">
              {fmtDate(dateFrom)} → {fmtDate(dateTo)}
            </span>
          )}
        </>
      ) : (
        <>
          <label className={BOX}>
            <span className={IN_LABEL}>From</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={BARE} />
          </label>
          <label className={BOX}>
            <span className={IN_LABEL}>To</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={BARE} />
          </label>
          <label className={BOX}>
            <span className={IN_LABEL}>Quick</span>
            <select
              value=""
              onChange={e => quickPicks.find(q => q.label === e.target.value)?.handler?.()}
              className={BARE}
            >
              <option value="">Pick a range</option>
              {quickPicks.map(({ label }) => <option key={label} value={label}>{label}</option>)}
            </select>
          </label>
        </>
      )}
      {showDivider && divider}
    </>
  );
}
```

## `src/app/components/PeriodMultiSelect.tsx` (whole file)

```tsx
import { useRef, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fmtDate } from '@/app/lib/fmtDate';

type Period = {
  period_name: string;
  start_date: string;
  end_date: string;
  /** false = Process Payroll has not run it yet; its days show live Teramind data. */
  processed?: boolean;
};

type Props = {
  periods: Period[];
  selected: string[];
  onChange: (names: string[]) => void;
};

export default function PeriodMultiSelect({ periods, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter(n => n !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  const label =
    selected.length === 0
      ? 'Choose…'
      : selected.length === 1
      ? selected[0]
      : `${selected.length} periods`;

  const btnCls =
    'h-8 px-2.5 text-[13px] border border-slate-300 rounded-md bg-white flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 transition-colors min-w-[140px]';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className={btnCls}
      >
        <span className="flex-1 text-left truncate">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-auto min-w-[260px]">
          {periods.length === 0 && (
            <div className="px-3 py-2 text-[13px] text-slate-400">No periods</div>
          )}
          {periods.map(p => {
            const checked = selected.includes(p.period_name);
            return (
              <label
                key={p.period_name}
                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(p.period_name)}
                  className="w-3.5 h-3.5 rounded accent-[#1B3A6B] cursor-pointer shrink-0"
                />
                <span className="font-medium text-[13px] text-slate-800 flex-1">{p.period_name}</span>
                {p.processed === false && (
                  <span className="rounded-full bg-status-yellow-fill px-2 py-0.5 text-[11px] font-medium text-status-yellow-ink whitespace-nowrap">
                    Not processed
                  </span>
                )}
                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                  {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
                </span>
              </label>
            );
          })}
          {periods.length > 0 && (
            <div className="border-t border-slate-100 px-3 py-1.5">
              <button
                type="button"
                onClick={() => {
                  if (periods[0]) onChange([periods[0].period_name]);
                  setOpen(false);
                }}
                className="text-[12px] text-slate-500 hover:text-warm-text transition-colors"
              >
                Newest Only
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Report
- Byte size of the three files (FilterBar.tsx under 15,000); confirm no other file changed; on
  Attendance → List the picker shows the current period tagged "Not processed" and selected by
  default; no console errors.
