import { useState, useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Search, Calendar, RefreshCw, Activity } from 'lucide-react';
import loadAttendanceDailyAction from '@/actions/loadAttendanceDaily';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import {
  AttendanceRow, EmpInfo, computeEmployeeStats, computeCompanyKpis,
} from '@/app/lib/attendanceStats';
import { AttendanceKpis }   from '@/app/pages/attendance/AttendanceKpis';
import { AttendanceDonuts } from '@/app/pages/attendance/AttendanceDonuts';
import { AttendanceTable }  from '@/app/pages/attendance/AttendanceTable';
import { AttendancePanel }  from '@/app/pages/attendance/AttendancePanel';
import { AttendanceTrends } from '@/app/pages/attendance/AttendanceTrends';

type Tab = 'dashboard' | 'employees' | 'trends';

function fmt(d: Date) { return d.toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); }

export default function Attendance() {
  const today = fmt(new Date());
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo,   setDateTo]   = useState(today);
  const [tab,      setTab]      = useState<Tab>('dashboard');
  const [search,   setSearch]   = useState('');
  const [panelEmail, setPanelEmail] = useState<string | null>(null);

  // Load data
  const [rawRows, loadingRows, rowsError, refreshRows] = useLoadAction(
    loadAttendanceDailyAction,
    [] as AttendanceRow[],
    { dateFrom, dateTo, email: '' },
  );
  const [empList, loadingEmps] = useLoadAction(
    loadAttendanceEmployeesAction,
    [] as EmpInfo[],
  );

  const rows = (rawRows as AttendanceRow[]) ?? [];
  const emps = (empList as EmpInfo[]) ?? [];

  const empMap = useMemo(() => {
    const m = new Map<string, EmpInfo>();
    emps.forEach(e => m.set(e.email, e));
    return m;
  }, [emps]);

  const emails = useMemo(() => new Set(emps.map(e => e.email)), [emps]);

  const empStats = useMemo(
    () => computeEmployeeStats(rows, empMap, emails),
    [rows, empMap, emails],
  );

  const kpis = useMemo(() => computeCompanyKpis(rows), [rows]);

  const panelStats = panelEmail ? empStats.find(s => s.email === panelEmail) ?? null : null;

  const loading = loadingRows || loadingEmps;

  const setPreset = (days: number) => { setDateFrom(daysAgo(days)); setDateTo(today); };
  const reset = () => { setDateFrom(daysAgo(30)); setDateTo(today); setSearch(''); };

  const tabCls = (t: Tab) =>
    `px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t
      ? 'bg-white shadow-sm text-foreground'
      : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Filter bar */}
      <div className="bg-white border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap sticky top-0 z-30">
        <div className="flex items-center gap-1.5 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">From</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-8 px-2.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">To</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-8 px-2.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="w-px h-6 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quick</span>
        {[30, 60, 90].map(d => (
          <button key={d} onClick={() => setPreset(d)}
            className="h-8 px-3 text-xs font-semibold border border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-all">
            {d}d
          </button>
        ))}
        <div className="w-px h-6 bg-border" />
        <button onClick={reset}
          className="h-8 px-3 text-xs border border-border text-muted-foreground rounded-lg hover:bg-muted transition-all">
          Reset
        </button>
        <button onClick={() => refreshRows?.()}
          className="h-8 px-3 text-xs border border-border text-muted-foreground rounded-lg hover:bg-muted transition-all flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <div className="ml-auto flex items-center gap-2 bg-muted rounded-xl p-1">
          <button className={tabCls('dashboard')} onClick={() => setTab('dashboard')}>Dashboard</button>
          <button className={tabCls('employees')} onClick={() => setTab('employees')}>Employees</button>
          <button className={tabCls('trends')}    onClick={() => setTab('trends')}>Trends</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-6 max-w-screen-xl mx-auto w-full">
        {loading && rows.length === 0 && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Activity className="w-5 h-5 animate-pulse" />
            Loading attendance data…
          </div>
        )}

        {rowsError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
            Error loading data. The view may not be created yet — apply the migration first.
          </div>
        )}

        {!loading || rows.length > 0 ? (
          <>
            {/* KPIs — always visible */}
            <AttendanceKpis kpis={kpis} />

            {/* Dashboard tab */}
            {tab === 'dashboard' && (
              <AttendanceDonuts kpis={kpis} empStats={empStats} />
            )}

            {/* Employees tab */}
            {tab === 'employees' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold">Employee Directory</span>
                    <span className="bg-muted text-muted-foreground text-xs font-medium px-2.5 py-1 rounded-full">
                      {empStats.length} employees
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search employees…"
                      className="h-8 pl-8 pr-3 text-sm border border-border rounded-lg bg-white w-56 focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>
                <AttendanceTable stats={empStats} onRowClick={setPanelEmail} search={search} />
              </div>
            )}

            {/* Trends tab */}
            {tab === 'trends' && (
              <AttendanceTrends rows={rows} empStats={empStats} />
            )}
          </>
        ) : null}
      </div>

      {/* Slide panel */}
      {panelEmail && (
        <AttendancePanel stats={panelStats} onClose={() => setPanelEmail(null)} />
      )}
    </div>
  );
}
