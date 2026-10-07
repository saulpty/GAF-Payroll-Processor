import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import { Activity, AlertCircle, Info, LayoutGrid, TableIcon } from 'lucide-react';
import { toLocalYMD,
  isScheduledWorkDay, getSchedule, parseTimeToMinutes,
} from '@/app/lib/classificationEngine';
import { buildAttendanceReport } from '@/app/lib/attendanceReport';
import type { ReportEmployee, ReportPayrollRow, ReportForm, ReportRequest, ReportInput,
  ReportPeriod, ReportHoliday, ReportRow, ReportSummary } from '@/app/lib/attendanceReportTypes';
import { liveWindow, liveReport } from '@/app/lib/liveAttendance';
import type { ActivityDayRow } from '@/app/lib/activityDays';
import { easternDate } from '@/app/lib/teramindTime';

import loadAttendanceReportDaysAction    from '@/actions/loadAttendanceReportDays';
import { matchesManager }               from '@/app/lib/managerFilter';
import loadMondayAttendanceFormsRangeAction from '@/actions/loadMondayAttendanceFormsRange';
import loadMondayRequestsRangeAction     from '@/actions/loadMondayRequestsRange';
import loadAttendanceEmployeesAction     from '@/actions/loadAttendanceEmployees';
import loadHolidaysAction                from '@/actions/loadHolidays';
import loadPeriodsAction                 from '@/actions/loadPeriods';
import loadDstCalendarAction             from '@/actions/loadDstCalendar';
import loadTeramindActivityDaysAction    from '@/actions/loadTeramindActivityDays';

import { reportRowsToKpis } from '@/app/lib/reportKpis';
import { AttendanceKpis } from './AttendanceKpis';
import { AttendanceReportStrips } from './AttendanceReportStrips';
import { AttendanceReportTable }  from './AttendanceReportTable';

type View = 'strips' | 'table';

// No live window: a range that ends before it starts, so the Teramind loader returns no rows.
const NO_LIVE = { from: '9999-12-31', to: '1970-01-01' };

function today() { return toLocalYMD(new Date()); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return toLocalYMD(d);
}

export default function AttendanceReport() {
  const [view, setView] = useState<View>('strips');

  const {
    dateFrom, dateTo,
    employee: globalEmployee,
    manager, role,
  } = useGlobalFilters();
  const { viewAs } = useViewer();

  const safeFrom = dateFrom || daysAgo(30);
  const safeTo   = dateTo   || today();
  // Teramind's "today" is US Eastern (same as the Today tab).
  const tmToday  = easternDate(Date.now());

  // ── Data loads ─────────────────────────────────────────────────────────────
  const [rawDays,     loadingDays,    errDays]    = useLoadAction(
    loadAttendanceReportDaysAction, [] as ReportPayrollRow[],
    { dateFrom: safeFrom, dateTo: safeTo, manager: manager || '', viewAs },
  );
  const [rawForms,    loadingForms,   errForms]   = useLoadAction(
    loadMondayAttendanceFormsRangeAction, [] as ReportForm[],
    { dateFrom: safeFrom, dateTo: safeTo, manager: manager || '', viewAs },
  );
  const [rawRequests, loadingReqs,    errReqs]    = useLoadAction(
    loadMondayRequestsRangeAction, [] as ReportRequest[],
    { dateFrom: safeFrom, dateTo: safeTo, manager: manager || '', viewAs },
  );
  const [rawEmps,     loadingEmps,    errEmps]    = useLoadAction(
    loadAttendanceEmployeesAction, [] as ReportEmployee[],
    { viewAs },
  );
  const [rawHolidays, loadingHols]                = useLoadAction(
    loadHolidaysAction, [] as ReportHoliday[],
  );
  const [rawPeriods,  loadingPeriods]             = useLoadAction(
    loadPeriodsAction, [] as ReportPeriod[],
  );
  const [rawDst,      loadingDst]                 = useLoadAction(
    loadDstCalendarAction, [] as { year: number; us_dst_start: string; us_dst_end: string }[],
  );

  // Live days: after the newest processed period, up to today. Null until periods load.
  const win = useMemo(
    () => (loadingPeriods ? null
      : liveWindow((rawPeriods as ReportPeriod[]) ?? [], safeFrom, safeTo, tmToday)),
    [loadingPeriods, rawPeriods, safeFrom, safeTo, tmToday],
  );
  const [rawTm,       loadingTm,      errTm]      = useLoadAction(
    loadTeramindActivityDaysAction, [] as ActivityDayRow[],
    { dateFrom: win?.from ?? NO_LIVE.from, dateTo: win?.to ?? NO_LIVE.to, viewAs },
  );

  // Which window the loaded Teramind rows belong to. Until the load for the current window has
  // finished the page keeps loading, so the numbers never flash without the unprocessed days.
  const winKey = win ? `${win.from}|${win.to}` : '';
  const [tmFor, setTmFor] = useState('');
  const tmWasLoading = useRef(false);
  useEffect(() => {
    if (loadingTm) tmWasLoading.current = true;
    else if (tmWasLoading.current) { tmWasLoading.current = false; setTmFor(winKey); }
  }, [loadingTm, winKey]);

  const loading = loadingDays || loadingForms || loadingReqs || loadingEmps ||
                  loadingHols || loadingPeriods || loadingDst ||
                  (win !== null && (loadingTm || (!errTm && tmFor !== winKey)));
  const anyError = errDays || errForms || errReqs || errEmps;

  // ── Build report ───────────────────────────────────────────────────────────
  // Days payroll has not processed yet (the live window) are counted exactly as payroll would
  // count them, from Teramind (liveReport). A payroll row always wins. A Teramind error leaves
  // those days uncounted, as before payroll runs.
  const { rows, perEmployee, unmatchedForms } = useMemo(() => {
    if (loading) return { rows: [] as ReportRow[], perEmployee: [] as ReportSummary[], unmatchedForms: 0 };

    const employees = (rawEmps as ReportEmployee[]).filter(e => {
      if (!matchesManager(e, manager)) return false;
      if (role    && e.role    !== role)    return false;
      if (globalEmployee) {
        const q = globalEmployee.toLowerCase();
        if (!e.name?.toLowerCase().includes(q) && !e.email?.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    const input: ReportInput = {
      dateFrom: safeFrom,
      dateTo: safeTo,
      employees,
      payrollRows: (rawDays    as ReportPayrollRow[]) ?? [],
      forms:       (rawForms   as ReportForm[])       ?? [],
      requests:    (rawRequests as ReportRequest[])   ?? [],
      holidays:    (rawHolidays as ReportHoliday[])   ?? [],
      periods:     (rawPeriods  as ReportPeriod[])    ?? [],
      dstWindows:  (rawDst as { year: number; us_dst_start: string; us_dst_end: string }[]) ?? [],
      helpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes },
    };
    const main = buildAttendanceReport(input);
    if (!win || errTm) return main;
    return liveReport({
      input, main, window: win, today: tmToday,
      tmRows: (rawTm as ActivityDayRow[]) ?? [], build: buildAttendanceReport,
    });
  }, [loading, rawEmps, rawDays, rawForms, rawRequests, rawHolidays, rawPeriods, rawDst,
      safeFrom, safeTo, manager, role, globalEmployee, win, errTm, rawTm, tmToday]);

  // ── Summary strip KPIs: every counted day, processed or not.
  const kpis = useMemo(() => reportRowsToKpis(rows), [rows]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const toggleCls = (on: boolean) => [
    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors',
    on ? 'bg-warm text-warm-ink' : 'bg-white text-slate-600 hover:bg-slate-50',
  ].join(' ');

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-auto px-4 py-4">

        {/* Error */}
        {anyError && (
          <div className="flex items-start gap-2 bg-status-red-tint border border-status-red-fill rounded-lg px-4 py-3 text-sm text-status-red-ink mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            Error loading report data. Check the database connection.
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Activity className="w-5 h-5 animate-pulse" />
            Building attendance report…
          </div>
        )}

        {!loading && !anyError && (
          <>
            <AttendanceKpis kpis={kpis} />

            {win && errTm && (
              <div className="flex items-center gap-2 -mt-2 mb-4 px-1 text-xs text-slate-500">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Teramind could not be loaded, so days payroll has not processed yet are not counted.
              </div>
            )}

            {/* View toggle */}
            <div className="flex justify-end mb-3">
              <div className="flex rounded-md border border-border overflow-hidden shadow-card">
                <button onClick={() => setView('strips')} className={toggleCls(view === 'strips')}>
                  <LayoutGrid className="w-3.5 h-3.5" /> Cards
                </button>
                <button onClick={() => setView('table')} className={toggleCls(view === 'table') + ' border-l'}>
                  <TableIcon className="w-3.5 h-3.5" /> Table
                </button>
              </div>
            </div>

            {/* Unmatched forms notice */}
            {unmatchedForms > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
                <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                {unmatchedForms} Monday form{unmatchedForms === 1 ? '' : 's'} could not be matched to an employee.
                Check <strong>Admin → Employees → Monday</strong> email mappings.
              </div>
            )}

            {/* Empty state */}
            {rows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
                <Activity className="w-8 h-8 opacity-30" />
                <p className="text-sm">No scheduled work days in this range for these filters.</p>
              </div>
            )}

            {/* Views */}
            {rows.length > 0 && view === 'strips' && (
              <AttendanceReportStrips rows={rows} perEmployee={perEmployee} />
            )}
            {rows.length > 0 && view === 'table' && (
              <AttendanceReportTable rows={rows} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
