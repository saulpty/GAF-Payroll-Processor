import { useMemo, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { Activity, AlertCircle, Info, LayoutGrid, TableIcon } from 'lucide-react';
import { toLocalYMD,
  isScheduledWorkDay, getSchedule, parseTimeToMinutes,
} from '@/app/lib/classificationEngine';
import { buildAttendanceReport } from '@/app/lib/attendanceReport';
import type { ReportEmployee, ReportPayrollRow, ReportForm, ReportRequest,
  ReportPeriod, ReportHoliday, ReportRow, ReportSummary } from '@/app/lib/attendanceReportTypes';

import loadAttendanceReportDaysAction    from '@/actions/loadAttendanceReportDays';
import loadMondayAttendanceFormsRangeAction from '@/actions/loadMondayAttendanceFormsRange';
import loadMondayRequestsRangeAction     from '@/actions/loadMondayRequestsRange';
import loadAttendanceEmployeesAction     from '@/actions/loadAttendanceEmployees';
import loadHolidaysAction                from '@/actions/loadHolidays';
import loadPeriodsAction                 from '@/actions/loadPeriods';
import loadDstCalendarAction             from '@/actions/loadDstCalendar';

import { AttendanceReportStrips } from './AttendanceReportStrips';
import { AttendanceReportTable }  from './AttendanceReportTable';

type View = 'strips' | 'table';

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

  const safeFrom = dateFrom || daysAgo(30);
  const safeTo   = dateTo   || today();

  // ── Data loads ─────────────────────────────────────────────────────────────
  const [rawDays,     loadingDays,    errDays]    = useLoadAction(
    loadAttendanceReportDaysAction, [] as ReportPayrollRow[],
    { dateFrom: safeFrom, dateTo: safeTo, manager: manager || '' },
  );
  const [rawForms,    loadingForms,   errForms]   = useLoadAction(
    loadMondayAttendanceFormsRangeAction, [] as ReportForm[],
    { dateFrom: safeFrom, dateTo: safeTo, manager: manager || '' },
  );
  const [rawRequests, loadingReqs,    errReqs]    = useLoadAction(
    loadMondayRequestsRangeAction, [] as ReportRequest[],
    { dateFrom: safeFrom, dateTo: safeTo, manager: manager || '' },
  );
  const [rawEmps,     loadingEmps,    errEmps]    = useLoadAction(
    loadAttendanceEmployeesAction, [] as ReportEmployee[],
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

  const loading = loadingDays || loadingForms || loadingReqs || loadingEmps ||
                  loadingHols || loadingPeriods || loadingDst;
  const anyError = errDays || errForms || errReqs || errEmps;

  // ── Build report ───────────────────────────────────────────────────────────
  const { rows, perEmployee, unmatchedForms } = useMemo(() => {
    if (loading) return { rows: [] as ReportRow[], perEmployee: [] as ReportSummary[], unmatchedForms: 0 };

    const employees = (rawEmps as ReportEmployee[]).filter(e => {
      if (manager && e.manager !== manager) return false;
      if (role    && e.role    !== role)    return false;
      if (globalEmployee) {
        const q = globalEmployee.toLowerCase();
        if (!e.name?.toLowerCase().includes(q) && !e.email?.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    return buildAttendanceReport({
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
    });
  }, [loading, rawEmps, rawDays, rawForms, rawRequests, rawHolidays, rawPeriods, rawDst,
      safeFrom, safeTo, manager, role, globalEmployee]);

  // ── Summary strip KPIs ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const scored       = rows.filter(r => r.countsToScore);
    const onTime       = scored.filter(r => r.verdict === 'on_time').length;
    const late         = scored.filter(r => r.verdict.startsWith('late')).length;
    // absent = all three absence verdicts; unexplained = the subset needing attention
    const absent       = scored.filter(r =>
      r.verdict === 'unexplained_absence' ||
      r.verdict === 'absent_reported_on_time' ||
      r.verdict === 'absent_reported_late',
    ).length;
    const unexplained  = scored.filter(r => r.verdict === 'unexplained_absence').length;
    const pct          = scored.length > 0 ? Math.round((onTime / scored.length) * 100) : null;
    return { total: scored.length, onTime, late, absent, unexplained, pct };
  }, [rows]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-auto px-4 py-4">

        {/* Error */}
        {anyError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
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
            {/* KPI bar */}
            <div className="flex flex-wrap items-center gap-4 mb-4 bg-white border border-border rounded-xl px-5 py-3 shadow-sm">
              <KpiChip label="Scheduled days" value={String(kpis.total)}       color="slate" />
              <KpiChip label="On-time"        value={String(kpis.onTime)}      color="green" />
              <KpiChip label="Late"           value={String(kpis.late)}        color="amber" />
              <KpiChip label="Absent"         value={String(kpis.absent)}      color="slate" />
              <KpiChip label="Unexplained"    value={String(kpis.unexplained)} color="red"   />
              {kpis.pct !== null ? (
                <span className={[
                  'ml-auto text-lg font-bold tabular-nums',
                  kpis.pct >= 90 ? 'text-green-600' : kpis.pct >= 75 ? 'text-amber-600' : 'text-red-600',
                ].join(' ')}>
                  {kpis.pct}% on-time
                </span>
              ) : (
                <span className="ml-auto text-sm text-muted-foreground">No scored days</span>
              )}

              {/* View toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden shadow-sm ml-2">
                <button
                  onClick={() => setView('strips')}
                  className={['flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors',
                    view === 'strips' ? 'bg-[#2AA876] text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Cards
                </button>
                <button
                  onClick={() => setView('table')}
                  className={['flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l',
                    view === 'table' ? 'bg-[#2AA876] text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
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

function KpiChip({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    slate: 'text-slate-700 bg-slate-100',
    green: 'text-green-700 bg-green-50',
    amber: 'text-amber-700 bg-amber-50',
    red:   'text-red-700 bg-red-50',
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`text-base font-bold tabular-nums px-2 py-0.5 rounded-md ${colors[color] ?? colors.slate}`}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
