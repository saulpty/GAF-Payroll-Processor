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
        defaultPeriod: processedPeriods[0]?.period_name ?? null,
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
