import { useLocation } from 'react-router-dom';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useLoadAction } from '@uibakery/data';
import { X, SlidersHorizontal } from 'lucide-react';
import { useMemo, useEffect, useRef } from 'react';
import EmployeeSearchInput from '@/app/components/EmployeeSearchInput';
import PeriodMultiSelect from '@/app/components/PeriodMultiSelect';
import loadPeriodsAction from '@/actions/loadPeriods';
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
  '/attendance':            { periods: true, employee: true, role: true, manager: true },
  '/attendance/reports':    { periods: true, employee: true, role: true, manager: true },
  '/pto':                   { employee: true, role: true, manager: true },
  '/contracts':             { employee: true, role: true, manager: true },
  '/disciplinary':          { employee: true, role: true, manager: true },
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

  const [periodsRaw, , , refetchPeriods] = useLoadAction(loadPeriodsAction, [] as PeriodRow[]);
  const [empsRaw]    = useLoadAction(loadAttendanceEmployeesAction, [] as EmpInfo[]);

  type CountsRow = { red_count: number; yellow_count: number };
  const [countsRaw] = useLoadAction(
    loadActionRequiredCountsAction,
    [] as CountsRow[],
    { periodName: period },
  );
  const counts = (countsRaw as CountsRow[])[0] ?? { red_count: 0, yellow_count: 0 };

  const versionRef = useRef(periodsVersion);
  useEffect(() => {
    if (periodsVersion !== versionRef.current) {
      versionRef.current = periodsVersion;
      refetchPeriods();
    }
  }, [periodsVersion, refetchPeriods]);

  // All periods for single-period select (action-required, payroll-master, hrk)
  const periods = (periodsRaw as PeriodRow[])
    .filter(p => !!p.period_name?.trim());

  // Processed periods for attendance multi-select, newest first
  const processedPeriods = useMemo(() => {
    return (periodsRaw as PeriodRow[])
      .filter(p => !!p.period_name?.trim() && !!p.processed_at)
      .map(p => ({
        period_name: p.period_name,
        start_date: String(p.start_date).slice(0, 10),
        end_date: String(p.end_date).slice(0, 10),
      }))
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
  }, [periodsRaw]);

  const rangeOf = (names: string[]) => {
    const selected = processedPeriods.filter(p => names.includes(p.period_name));
    if (!selected.length) return null;
    const from = selected.map(p => p.start_date).sort()[0];
    const to   = selected.map(p => p.end_date).sort().reverse()[0];
    return { from, to };
  };

  // Default: when on attendance route and no period selected, auto-select newest
  useEffect(() => {
    if (cfg?.periods && attendancePeriods.length === 0 && processedPeriods.length > 0) {
      const newest = processedPeriods[0];
      setAttendancePeriods([newest.period_name], rangeOf([newest.period_name]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.periods, processedPeriods.length, attendancePeriods.length]);

  const emps = empsRaw as EmpInfo[];
  const managers = useMemo(() => [...new Set(emps.map(e => e.manager).filter(Boolean))].sort(), [emps]);
  const roles    = useMemo(() => [...new Set(emps.map(e => e.role).filter(Boolean))].sort(),    [emps]);

  if (!cfg) return null;

  const inputCls = 'h-8 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30';
  const labelCls = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';
  const divider  = <div className="w-px h-5 bg-slate-200" />;

  return (
    <div className="shrink-0 bg-white border-b border-slate-200 px-4 flex items-center gap-3 flex-wrap z-30 min-h-[48px]">
      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />

      {cfg.period && (
        <>
          <label className={labelCls}>Period</label>
          <select value={period} onChange={e => setPeriod(e.target.value)} className={inputCls + ' min-w-40'}>
            <option value="">All periods</option>
            {periods.map(p => (
              <option key={p.period_name} value={p.period_name}>{p.period_name}</option>
            ))}
          </select>
          {(cfg.dateRange || cfg.employee || cfg.role || cfg.manager || cfg.statusTab || cfg.pmTab) && divider}
        </>
      )}

      {cfg.periods && (
        <>
          <label className={labelCls}>Periods</label>
          <PeriodMultiSelect
            periods={processedPeriods}
            selected={attendancePeriods}
            onChange={names => setAttendancePeriods(names, names.length ? rangeOf(names) : null)}
          />
          {(cfg.employee || cfg.role || cfg.manager) && divider}
        </>
      )}

      {cfg.dateRange && (
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
          <label className={labelCls}>Employee</label>
          <EmployeeSearchInput
            value={employee}
            onChange={setEmployee}
            options={emps}
            placeholder="Search…"
            className={inputCls + ' w-44'}
          />
          {(cfg.role || cfg.manager || cfg.statusTab || cfg.pmTab) && divider}
        </>
      )}

      {cfg.manager && (
        <>
          <label className={labelCls}>Manager</label>
          <select value={manager} onChange={e => setManager(e.target.value)} className={inputCls}>
            <option value="">All</option>
            {managers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {cfg.role && divider}
        </>
      )}

      {cfg.role && (
        <>
          <label className={labelCls}>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
            <option value="">All</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
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
                    isActive
                      ? 'bg-white/25 text-white'
                      : tab === 'RED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
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
          className="ml-auto flex items-center gap-1 text-[12px] text-slate-400 hover:text-red-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded px-1">
          <X className="w-3 h-3" />
          Clear filters
        </button>
      )}
    </div>
  );
}
