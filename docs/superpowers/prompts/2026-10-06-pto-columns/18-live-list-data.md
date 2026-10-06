# Live attendance, step 4a: Attendance List loads live days

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Needs steps 1 and 3 (`liveAttendance.ts`, `attendanceStats` live fields, `LiveBadge.tsx`).
Saul (2026-10-06): days payroll has not processed yet are filled from Teramind, tagged Live, and
never counted; a payroll (official List) row always wins.

- **New `src/app/lib/liveListRows.ts` (pure, no runtime imports):** builds the attendance report
  for the live window only, runs `applyLiveDays`, then `liveToAttendanceRows(rows, official)` so
  an existing List row for the same email + date wins. All functions are passed in.
- **New `src/app/pages/attendance/useLiveListRows.ts`:** loads periods, works out the live window
  (`easternDate` today), then loads ONLY that window (flat params): Teramind days, Monday forms
  and requests, holidays, DST. Builds rows only once the window's own data has arrived. Never
  blocks the page — live rows change no number.
- **`src/app/pages/Attendance.tsx` (AttendanceInner):** appends the live rows before the manager /
  title / name filter; a one-line note if Teramind fails. Error banner on the Excel red tokens.
- **AttendancePanelBody:** the arrival chart plots official days only (one edit).
- **ActivityByEmployee:** one label, "Needs A Look" → "Needs a Look" (one edit).

**Only these five files may change:** the three whole files below, plus exactly one edit in each
of `src/app/pages/attendance/AttendancePanelBody.tsx` and
`src/app/pages/attendance/activity/ActivityByEmployee.tsx`. No other file may be touched (not
`AttendanceKpis.tsx`, `AttendanceTable.tsx`, `AttendancePanelDays.tsx`, `attendanceStats.ts`,
`liveAttendance.ts`, `attendanceReport.ts`, any action, or `src/components/ui/*`).

## `src/app/lib/liveListRows.ts` (whole file)

```ts
// Attendance List live rows: days Process Payroll has not written yet, filled from Teramind.
// Builds the attendance report for the live window ONLY, decorates it (applyLiveDays) and turns
// the live days into List rows (liveToAttendanceRows), skipping any email|date the List already
// has from v_attendance_daily. Live rows carry live: true, so attendanceStats never counts them.
//
// NO RUNTIME IMPORTS — node --test cannot resolve extension-less imports (see reportKpis.ts).
// The three library functions and the classification helpers are injected by the caller.
// No payroll rows are passed in: every date in the live window is after the newest processed
// period, and a payroll row for such a date is already an official List row (deduped below).

import type {
  ReportInput, ReportOutput, ReportEmployee, ReportForm, ReportRequest, ReportHoliday,
  ReportPeriod, ReportHelpers, ReportRow,
} from './attendanceReportTypes';
import type { ActivityDayRow } from './activityTypes';
import type { AttendanceRow } from './attendanceStats';
import type { LiveWindow, LiveHelpers } from './liveAttendance';

/** Loader range used when there is no live window: ends before it starts, so 0 rows come back. */
export const NO_LIVE_WINDOW: LiveWindow = { from: '9999-12-31', to: '1970-01-01' };

export type LiveListDeps = {
  buildAttendanceReport(input: ReportInput): ReportOutput;
  applyLiveDays(input: {
    rows: ReportRow[]; payrollRows: ReportInput['payrollRows']; tmRows: ActivityDayRow[];
    employees: ReportEmployee[]; requests: ReportRequest[];
    window: LiveWindow | null; today: string; helpers: LiveHelpers;
  }): ReportRow[];
  liveToAttendanceRows(rows: ReportRow[], official: AttendanceRow[]): AttendanceRow[];
  reportHelpers: ReportHelpers;
  whyFor: LiveHelpers['whyFor'];
};

export function liveListRows(input: {
  window: LiveWindow | null;
  today: string;
  employees: ReportEmployee[];
  forms: ReportForm[];
  requests: ReportRequest[];
  holidays: ReportHoliday[];
  periods: ReportPeriod[];
  dstWindows: ReportInput['dstWindows'];
  tmRows: ActivityDayRow[];
  official: AttendanceRow[];
  deps: LiveListDeps;
}): AttendanceRow[] {
  const win = input.window;
  if (!win || win.from > win.to) return [];
  const d = input.deps;
  const { rows } = d.buildAttendanceReport({
    dateFrom: win.from,
    dateTo: win.to,
    employees: input.employees ?? [],
    payrollRows: [],
    forms: input.forms ?? [],
    requests: input.requests ?? [],
    holidays: input.holidays ?? [],
    periods: input.periods ?? [],
    dstWindows: input.dstWindows ?? [],
    helpers: d.reportHelpers,
  });
  const live = d.applyLiveDays({
    rows,
    payrollRows: [],
    tmRows: input.tmRows ?? [],
    employees: input.employees ?? [],
    requests: input.requests ?? [],
    window: win,
    today: input.today,
    helpers: { parseTimeToMinutes: d.reportHelpers.parseTimeToMinutes, whyFor: d.whyFor },
  });
  return d.liveToAttendanceRows(live, input.official ?? []);
}
```

## `src/app/pages/attendance/useLiveListRows.ts` (whole file)

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '@/app/lib/classificationEngine';
import { buildAttendanceReport } from '@/app/lib/attendanceReport';
import { liveWindow, applyLiveDays, liveToAttendanceRows } from '@/app/lib/liveAttendance';
import { liveListRows, NO_LIVE_WINDOW } from '@/app/lib/liveListRows';
import { whyFor } from '@/app/lib/activityDays';
import type { ActivityDayRow } from '@/app/lib/activityDays';
import type { ReportEmployee, ReportForm, ReportRequest, ReportHoliday, ReportPeriod } from '@/app/lib/attendanceReportTypes';
import type { AttendanceRow } from '@/app/lib/attendanceStats';
import { easternDate } from '@/app/lib/teramindTime';

import loadPeriodsAction                    from '@/actions/loadPeriods';
import loadTeramindActivityDaysAction       from '@/actions/loadTeramindActivityDays';
import loadMondayAttendanceFormsRangeAction from '@/actions/loadMondayAttendanceFormsRange';
import loadMondayRequestsRangeAction        from '@/actions/loadMondayRequestsRange';
import loadHolidaysAction                   from '@/actions/loadHolidays';
import loadDstCalendarAction                from '@/actions/loadDstCalendar';

type DstRow = { year: number; us_dst_start: string; us_dst_end: string };

/**
 * Attendance List live rows (2026-10-06): days payroll has not processed yet, from Teramind.
 * Only the live window is loaded (after the newest processed period, up to today). With no
 * window every ranged loader gets NO_LIVE_WINDOW and returns nothing. Never blocks the page:
 * live rows are never counted, so the List can show its official numbers first.
 */
export function useLiveListRows({ dateFrom, dateTo, viewAs, employees, official }: {
  dateFrom: string; dateTo: string; viewAs: string;
  employees: ReportEmployee[]; official: AttendanceRow[];
}): { rows: AttendanceRow[]; loading: boolean; error: boolean } {
  const today = easternDate(Date.now());   // Teramind's "today" is US Eastern

  const [rawPeriods, loadingPeriods, errPeriods] = useLoadAction(loadPeriodsAction, [] as ReportPeriod[]);
  const win = useMemo(
    () => (loadingPeriods ? null : liveWindow((rawPeriods as ReportPeriod[]) ?? [], dateFrom, dateTo, today)),
    [loadingPeriods, rawPeriods, dateFrom, dateTo, today],
  );
  const range = win ?? NO_LIVE_WINDOW;

  const [rawTm,    loadingTm,    errTm]    = useLoadAction(
    loadTeramindActivityDaysAction, [] as ActivityDayRow[],
    { dateFrom: range.from, dateTo: range.to, viewAs },
  );
  const [rawForms, loadingForms, errForms] = useLoadAction(
    loadMondayAttendanceFormsRangeAction, [] as ReportForm[],
    { dateFrom: range.from, dateTo: range.to, manager: '', viewAs },
  );
  const [rawReqs,  loadingReqs,  errReqs]  = useLoadAction(
    loadMondayRequestsRangeAction, [] as ReportRequest[],
    { dateFrom: range.from, dateTo: range.to, manager: '', viewAs },
  );
  const [rawHols,  loadingHols]  = useLoadAction(loadHolidaysAction, [] as ReportHoliday[]);
  const [rawDst,   loadingDst]   = useLoadAction(loadDstCalendarAction, [] as DstRow[]);

  const loading = loadingPeriods || (win !== null &&
    (loadingTm || loadingForms || loadingReqs || loadingHols || loadingDst));
  const error = !!(errPeriods || (win !== null && (errTm || errForms || errReqs)));

  // Build live rows only once the window's own data has arrived (no one-render flash of
  // "No records yet" with the previous, empty results).
  const winKey = win ? `${win.from}|${win.to}` : '';
  const busy = loadingTm || loadingForms || loadingReqs;
  const [dataFor, setDataFor] = useState('');
  const wasBusy = useRef(false);
  useEffect(() => {
    if (busy) wasBusy.current = true;
    else if (wasBusy.current) { wasBusy.current = false; setDataFor(winKey); }
  }, [busy, winKey]);

  const rows = useMemo(() => {
    if (loading || error || !win || dataFor !== winKey) return [] as AttendanceRow[];
    return liveListRows({
      window: win,
      today,
      employees: employees ?? [],
      forms: (rawForms as ReportForm[]) ?? [],
      requests: (rawReqs as ReportRequest[]) ?? [],
      holidays: (rawHols as ReportHoliday[]) ?? [],
      periods: (rawPeriods as ReportPeriod[]) ?? [],
      dstWindows: (rawDst as DstRow[]) ?? [],
      tmRows: (rawTm as ActivityDayRow[]) ?? [],
      official: official ?? [],
      deps: {
        buildAttendanceReport, applyLiveDays, liveToAttendanceRows, whyFor,
        reportHelpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes },
      },
    });
  }, [loading, error, win, winKey, dataFor, today, employees, rawForms, rawReqs, rawHols, rawPeriods, rawDst, rawTm, official]);

  return { rows, loading, error };
}
```

## `src/app/pages/Attendance.tsx` (whole file)

```tsx
import { useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import { useLocation } from 'react-router-dom';
import { Activity } from 'lucide-react';
import loadAttendanceDailyAction from '@/actions/loadAttendanceDaily';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import {
  AttendanceRow, EmpInfo, computeEmployeeStats, computeCompanyKpis,
} from '@/app/lib/attendanceStats';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { AttendanceKpis }   from '@/app/pages/attendance/AttendanceKpis';
import { AttendanceTable }  from '@/app/pages/attendance/AttendanceTable';
import { AttendancePanel }  from '@/app/pages/attendance/AttendancePanel';
import AttendanceReport     from '@/app/pages/attendance/AttendanceReport';
import AttendanceToday      from '@/app/pages/attendance/AttendanceToday';
import AttendanceActivity   from '@/app/pages/attendance/activity/AttendanceActivity';
import { matchesManager }   from '@/app/lib/managerFilter';
import type { ReportEmployee } from '@/app/lib/attendanceReportTypes';
import { useLiveListRows } from '@/app/pages/attendance/useLiveListRows';
import { useState } from 'react';

type Tab = 'list' | 'reports' | 'today' | 'activity';

function tabFromPath(pathname: string): Tab {
  if (pathname.includes('/reports'))  return 'reports';
  if (pathname.includes('/activity')) return 'activity';
  if (pathname.includes('/list'))     return 'list';
  return 'today';
}

// Reports/Today/Activity tabs have their own data layer — render them without loading the heavy daily view
export default function Attendance() {
  const { pathname } = useLocation();

  const tab: Tab = tabFromPath(pathname);

  if (tab === 'today')    return <AttendanceToday />;
  if (tab === 'reports')  return <AttendanceReport />;
  if (tab === 'activity') return <AttendanceActivity />;

  return <AttendanceInner tab="list" />;
}

function AttendanceInner({ tab }: { tab: 'list' }) {
  const {
    dateFrom, dateTo,
    employee: globalEmployee,
    manager, role,
  } = useGlobalFilters();
  const { viewAs } = useViewer();

  const [panelEmail, setPanelEmail] = useState<string | null>(null);

  function today() { return toLocalYMD(new Date()); }
  function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return toLocalYMD(d); }
  const safeFrom = dateFrom || daysAgo(30);
  const safeTo   = dateTo   || today();

  const [rawRows, loadingRows, rowsError] = useLoadAction(
    loadAttendanceDailyAction,
    [] as AttendanceRow[],
    { dateFrom: safeFrom, dateTo: safeTo, email: '', viewAs },
  );
  const [empList, loadingEmps] = useLoadAction(
    loadAttendanceEmployeesAction,
    [] as EmpInfo[],
    { viewAs },
  );

  const rows = (rawRows as AttendanceRow[]) ?? [];
  const emps = (empList as EmpInfo[]) ?? [];

  // Live days (not processed yet, from Teramind) are appended; attendanceStats never counts them.
  const live = useLiveListRows({
    dateFrom: safeFrom, dateTo: safeTo, viewAs,
    employees: empList as unknown as ReportEmployee[], official: rows,
  });
  const allRows = useMemo(
    () => (live.rows.length > 0 ? [...rows, ...live.rows] : rows),
    [rows, live.rows],
  );

  const empMap = useMemo(() => {
    const m = new Map<string, EmpInfo>();
    emps.forEach(e => m.set(e.email, e));
    return m;
  }, [emps]);

  const matchEmails = useMemo(
    () => new Set(
      emps
        .filter(e =>
          matchesManager(e, manager) &&
          (!role || e.role === role) &&
          (!globalEmployee || e.name?.toLowerCase().includes(globalEmployee.toLowerCase()) ||
            e.email?.toLowerCase().includes(globalEmployee.toLowerCase()))
        )
        .map(e => e.email),
    ),
    [emps, manager, role, globalEmployee],
  );

  const filteredRows = useMemo(
    () => allRows.filter(r => matchEmails.has(r.email)),
    [allRows, matchEmails],
  );

  const empStats = useMemo(
    () => computeEmployeeStats(filteredRows, empMap, matchEmails),
    [filteredRows, empMap, matchEmails],
  );

  const kpis = useMemo(() => computeCompanyKpis(filteredRows), [filteredRows]);

  const panelStats = panelEmail ? empStats.find(s => s.email === panelEmail) ?? null : null;
  const panelEmpId = panelEmail ? Number((empMap.get(panelEmail) as { id?: number } | undefined)?.id) : NaN;
  const loading = loadingRows || loadingEmps;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-auto px-4 py-4 w-full">
        <div className="w-full">
          {loading && rows.length === 0 && (
            <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
              <Activity className="w-5 h-5 animate-pulse" />
              Loading attendance data…
            </div>
          )}

          {rowsError && (
            <div className="bg-status-red-tint border border-status-red-fill rounded-lg px-4 py-3 text-sm text-status-red-ink mb-4">
              Error loading data. The view may not be created yet — apply the migration first.
            </div>
          )}

          {(!loading || rows.length > 0) && (
            <>
              <AttendanceKpis kpis={kpis} />
              {live.error && (
                <div className="-mt-2 mb-4 px-1 text-xs text-slate-500">
                  Live days could not be loaded from Teramind. Showing processed days only.
                </div>
              )}

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
            </>
          )}
        </div>
      </div>

      {panelEmail && (
        <AttendancePanel stats={panelStats} employeeId={Number.isFinite(panelEmpId) ? panelEmpId : undefined} onClose={() => setPanelEmail(null)} />
      )}
    </div>
  );
}
```

## `src/app/pages/attendance/AttendancePanelBody.tsx`: one edit

Replace exactly

```tsx
  const scatterPoints = computeArrivalScatter(stats.rows).map(p => ({
```

with exactly

```tsx
  const scatterPoints = computeArrivalScatter(stats.rows.filter(r => !r.live)).map(p => ({
```

## `src/app/pages/attendance/activity/ActivityByEmployee.tsx`: one edit

Replace exactly `  { key: 'needsLook',    label: 'Needs A Look' },` with exactly
`  { key: 'needsLook',    label: 'Needs a Look' },`

## Report
- Byte size of the five files; confirm no other file changed; Attendance → List renders with no
  console errors.
