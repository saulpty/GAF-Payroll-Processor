import { useLocation } from 'react-router-dom';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useLoadAction } from '@uibakery/data';
import { X, SlidersHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import loadPeriodsAction from '@/actions/loadPeriods';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import type { EmpInfo } from '@/app/lib/attendanceStats';

// Which controls appear on which routes
const ROUTE_CONFIG: Record<string, { period?: boolean; dateRange?: boolean; employee?: boolean; role?: boolean; manager?: boolean }> = {
  '/summary':         { period: true, employee: true },
  '/action-required': { period: true, employee: true },
  '/payroll-master':  { period: true, employee: true },
  '/hrk-summary':     { period: true },
  '/process':         { dateRange: true },
  '/attendance':      { dateRange: true, employee: true, role: true, manager: true },
  '/attendance/employees': { dateRange: true, employee: true, role: true, manager: true },
  '/attendance/trends':    { dateRange: true, role: true, manager: true },
};

function getConfig(pathname: string) {
  if (ROUTE_CONFIG[pathname]) return ROUTE_CONFIG[pathname];
  // prefix match for /attendance/*
  for (const key of Object.keys(ROUTE_CONFIG)) {
    if (key !== '/' && pathname.startsWith(key + '/')) return ROUTE_CONFIG[key];
  }
  return null;
}

export default function FilterBar() {
  const location = useLocation();
  const cfg = getConfig(location.pathname);

  const {
    period, setPeriod,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    employee, setEmployee,
    role, setRole,
    manager, setManager,
    hasAny, clearAll,
  } = useGlobalFilters();

  const [periodsRaw] = useLoadAction(loadPeriodsAction, [] as { period_name: string }[]);
  const [empsRaw]    = useLoadAction(loadAttendanceEmployeesAction, [] as EmpInfo[]);

  const periods = (periodsRaw as { period_name: string }[])
    .filter(p => {
      const n = p.period_name?.toLowerCase().trim();
      return n && !n.includes('test') && !n.includes('draft');
    });

  const emps = empsRaw as EmpInfo[];

  const managers = useMemo(() => [...new Set(emps.map(e => e.manager).filter(Boolean))].sort(), [emps]);
  const roles    = useMemo(() => [...new Set(emps.map(e => e.role).filter(Boolean))].sort(),    [emps]);

  // Don't render if no config for this route
  if (!cfg) return null;

  const inputCls = 'h-8 px-2.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30';
  const labelCls = 'text-[10px] font-bold uppercase tracking-widest text-slate-400';
  const divider  = <div className="w-px h-5 bg-slate-200" />;

  return (
    <div className="shrink-0 bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-3 flex-wrap z-30 shadow-sm">
      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />

      {cfg.period && (
        <>
          <label className={labelCls}>Period</label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className={inputCls + ' min-w-40'}
          >
            <option value="">All periods</option>
            {periods.map(p => (
              <option key={p.period_name} value={p.period_name}>{p.period_name}</option>
            ))}
          </select>
          {(cfg.dateRange || cfg.employee || cfg.role || cfg.manager) && divider}
        </>
      )}

      {cfg.dateRange && (
        <>
          <label className={labelCls}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          <label className={labelCls}>To</label>
          <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className={inputCls} />
          {(cfg.employee || cfg.role || cfg.manager) && divider}
        </>
      )}

      {cfg.employee && (
        <>
          <label className={labelCls}>Employee</label>
          <input
            type="text"
            value={employee}
            onChange={e => setEmployee(e.target.value)}
            placeholder="Search…"
            className={inputCls + ' w-44'}
          />
          {(cfg.role || cfg.manager) && divider}
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

      {hasAny && (
        <button
          onClick={clearAll}
          className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-300 rounded-lg px-2.5 h-7 transition-colors"
        >
          <X className="w-3 h-3" />
          Clear filters
        </button>
      )}
    </div>
  );
}
