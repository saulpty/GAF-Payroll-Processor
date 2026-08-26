import { useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useLocation } from 'react-router-dom';
import { Activity } from 'lucide-react';
import loadAttendanceDailyAction from '@/actions/loadAttendanceDaily';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import {
  AttendanceRow, EmpInfo, computeEmployeeStats, computeCompanyKpis,
} from '@/app/lib/attendanceStats';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { AttendanceKpis }   from '@/app/pages/attendance/AttendanceKpis';
import { AttendanceDonuts } from '@/app/pages/attendance/AttendanceDonuts';
import { AttendanceTable }  from '@/app/pages/attendance/AttendanceTable';
import { AttendancePanel }  from '@/app/pages/attendance/AttendancePanel';
import { AttendanceTrends } from '@/app/pages/attendance/AttendanceTrends';
import { useState } from 'react';

type Tab = 'dashboard' | 'employees' | 'trends';

function tabFromPath(pathname: string): Tab {
  if (pathname.includes('/employees')) return 'employees';
  if (pathname.includes('/trends'))    return 'trends';
  return 'dashboard';
}

export default function Attendance() {
  const { pathname } = useLocation();
  const tab: Tab = tabFromPath(pathname);

  const {
    dateFrom, dateTo,
    employee: globalEmployee,
    manager, role,
  } = useGlobalFilters();

  const [panelEmail, setPanelEmail] = useState<string | null>(null);

  // Guard against blank dates (e.g. user clears the input) — fall back to safe defaults
  function today() { return toLocalYMD(new Date()); }
  function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return toLocalYMD(d); }
  const safeFrom = dateFrom || daysAgo(30);
  const safeTo   = dateTo   || today();

  // Load data — single instance, no remount on tab change
  const [rawRows, loadingRows, rowsError] = useLoadAction(
    loadAttendanceDailyAction,
    [] as AttendanceRow[],
    { dateFrom: safeFrom, dateTo: safeTo, email: '' },
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

  const matchEmails = useMemo(
    () => new Set(
      emps
        .filter(e =>
          (!manager || e.manager === manager) &&
          (!role || e.role === role) &&
          (!globalEmployee || e.name?.toLowerCase().includes(globalEmployee.toLowerCase()) ||
            e.email?.toLowerCase().includes(globalEmployee.toLowerCase()))
        )
        .map(e => e.email),
    ),
    [emps, manager, role, globalEmployee],
  );

  const filteredRows = useMemo(
    () => rows.filter(r => matchEmails.has(r.email)),
    [rows, matchEmails],
  );

  const empStats = useMemo(
    () => computeEmployeeStats(filteredRows, empMap, matchEmails),
    [filteredRows, empMap, matchEmails],
  );

  const kpis = useMemo(() => computeCompanyKpis(filteredRows), [filteredRows]);

  const panelStats = panelEmail ? empStats.find(s => s.email === panelEmail) ?? null : null;
  const loading = loadingRows || loadingEmps;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Scrollable body */}
      <div className="flex-1 overflow-auto px-4 py-4 w-full">
        <div className="w-full">
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

          {(!loading || rows.length > 0) && (
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
                  </div>
                  <AttendanceTable stats={empStats} onRowClick={setPanelEmail} search={globalEmployee} />
                </div>
              )}

              {/* Trends tab */}
              {tab === 'trends' && (
                <AttendanceTrends rows={filteredRows} empStats={empStats} search={globalEmployee} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Slide panel */}
      {panelEmail && (
        <AttendancePanel stats={panelStats} onClose={() => setPanelEmail(null)} />
      )}
    </div>
  );
}
