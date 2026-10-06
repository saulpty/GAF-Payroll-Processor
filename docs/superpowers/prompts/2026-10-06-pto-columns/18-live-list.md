# Live attendance, step 4 of 4: Attendance List shows live days (+ Warm look)

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Needs steps 1 and 3 (`liveAttendance.ts`, `attendanceStats` live fields, `LiveBadge.tsx`).

- **New `src/app/lib/liveListRows.ts` (pure):** builds the attendance report for the live window
  only, runs `applyLiveDays`, then `liveToAttendanceRows(rows, official)` — an existing List row
  for the same email + date always wins. All functions are passed in (no runtime imports).
- **New `src/app/pages/attendance/useLiveListRows.ts`:** loads periods, works out the live window
  (`easternDate` today), then loads ONLY that window (flat params): Teramind days, Monday forms
  and requests, holidays, DST. Builds rows only once the window's own data has arrived. Never
  blocks the page — live rows change no number.
- **Attendance.tsx (AttendanceInner):** appends the live rows before the manager / title / name
  filter; one-line note if Teramind fails.
- **AttendanceKpis:** when there are live days, "N live days not yet counted · M late" under the
  cards. **AttendanceTable:** a "Live · N" tag next to the name. **AttendancePanelDays:** live days
  show the Live tag and label. **AttendancePanelBody:** the arrival chart plots official days only.
- Warm look on those files: Title Case (no ALL CAPS), Excel colours, `shadow-card`.
- **ActivityByEmployee:** one label, "Needs A Look" → "Needs a Look".

**Only these eight files may change** (each a whole file below; the first two are new):
`src/app/lib/liveListRows.ts`, `src/app/pages/attendance/useLiveListRows.ts`,
`src/app/pages/Attendance.tsx`, `src/app/pages/attendance/AttendanceKpis.tsx`,
`src/app/pages/attendance/AttendanceTable.tsx`, `src/app/pages/attendance/AttendancePanelDays.tsx`,
`src/app/pages/attendance/AttendancePanelBody.tsx`,
`src/app/pages/attendance/activity/ActivityByEmployee.tsx`.
No other file may be touched (not `attendanceStats.ts`, `liveAttendance.ts`, `attendanceReport.ts`,
`LiveBadge.tsx`, any action, or `src/components/ui/*`).

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

## `src/app/pages/attendance/AttendanceKpis.tsx` (whole file)

```tsx
import { CompanyKpis } from '@/app/lib/attendanceStats';
import LiveBadge from './LiveBadge';

type Tone = 'lead' | 'alert' | 'plain';
type Props = { kpis: CompanyKpis };

function Kpi({
  label, value, sub, color, tone = 'plain', tooltip,
}: {
  label: string; value: string; sub?: string; color?: string; tone?: Tone; tooltip?: string;
}) {
  const cardCls = tone === 'lead'
    ? 'bg-white rounded-lg border border-primary p-3 shadow-[inset_3px_0_0_var(--primary)] min-w-0'
    : 'bg-white rounded-lg border border-border p-3 shadow-card min-w-0';

  const valueCls = tone === 'plain'
    ? 'text-2xl font-bold tracking-tight leading-none tabular-nums mb-0.5 text-foreground'
    : `text-2xl font-bold tracking-tight leading-none tabular-nums mb-0.5 ${color ?? ''}`;

  return (
    <div className={cardCls}>
      <div
        className="text-xs font-semibold text-slate-600 mb-1 truncate cursor-default"
        title={tooltip}
        tabIndex={tooltip ? 0 : undefined}
        aria-label={tooltip ? `${label}: ${tooltip}` : undefined}
      >
        {label}{tooltip && <span className="ml-0.5 opacity-50">ⓘ</span>}
      </div>
      <div className={valueCls}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

export function AttendanceKpis({ kpis }: Props) {
  const totalCheck = kpis.onTime + kpis.lateDays + kpis.absent + kpis.excused + kpis.permission;
  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-10 gap-2 mb-1">
        <Kpi
          label="On-Time Rate"
          value={`${kpis.onTimeRate.toFixed(1)}%`}
          sub={`${kpis.onTime} of ${kpis.daysTracked} Expected`}
          tone="lead"
          color="text-secondary"
          tooltip="On-time days divided by expected days (on time + late + absent). Time off and permissions are not counted either way."
        />
        <Kpi
          label="Late Rate"
          value={`${kpis.lateRate.toFixed(1)}%`}
          sub={`${kpis.lateDays} of ${kpis.daysTracked} Expected`}
          tone="alert"
          color="text-status-yellow-ink"
          tooltip="Late days divided by expected days (on time + late + absent)."
        />
        <Kpi
          label="Work Days"
          value={`${kpis.workDays}`}
          sub="Scheduled Shifts"
          tone="plain"
          tooltip="Every day someone was scheduled on their shift in this range, including time off and permissions."
        />
        <Kpi
          label="Late Days"
          value={`${kpis.lateDays}`}
          sub={`${kpis.lateReported} Reported · ${kpis.lateUnreported} Not`}
          tone="plain"
          tooltip="Days someone clocked in after their shift start."
        />
        <Kpi
          label="Avg Min Late"
          value={`${kpis.avgMinLate.toFixed(1)}m`}
          sub="Per Late Day"
          tone="plain"
          tooltip="Average minutes late across the late days only. On-time days and absences are not included."
        />
        <Kpi
          label="Absent Days"
          value={`${kpis.absent}`}
          sub="Reported or Not"
          tone="alert"
          color="text-status-red-ink"
          tooltip="Scheduled to work with no clock-in and no time off or permission covering the day, whether or not a form was filed."
        />
        <Kpi
          label="Reported"
          value={`${kpis.reported}`}
          sub="Late/Absent, Form Filed"
          tone="plain"
          tooltip="Late or absent days with an attendance form on file."
        />
        <Kpi
          label="Unreported"
          value={`${kpis.unreported}`}
          sub="Late/Absent, No Form"
          tone="alert"
          color="text-status-red-ink"
          tooltip="Late or absent days with no attendance form on file."
        />
        <Kpi
          label="Time Off"
          value={`${kpis.excused}`}
          sub="PTO, Holidays"
          tone="plain"
          tooltip="Approved days away: PTO, company holidays, birthday and compensatory days. These never affect the score."
        />
        <Kpi
          label="Permission"
          value={`${kpis.permission}`}
          sub="Approved"
          tone="plain"
          tooltip="An approved permission covered the day. Does not affect the score."
        />
      </div>
      <div className="text-[11px] text-muted-foreground px-1">
        On Time ({kpis.onTime}) + Late ({kpis.lateDays}) + Absent ({kpis.absent}) + Time Off ({kpis.excused}) + Permission ({kpis.permission}) = {totalCheck} = Work Days ({kpis.workDays})
      </div>
      {(kpis.liveDays ?? 0) > 0 && (
        <div className="flex items-center gap-2 mt-1 px-1 text-xs text-slate-600">
          <LiveBadge />
          <span>
            {kpis.liveDays} live day{kpis.liveDays === 1 ? '' : 's'} not yet counted
            {(kpis.liveLate ?? 0) > 0 ? ` · ${kpis.liveLate} late` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
```

## `src/app/pages/attendance/AttendanceTable.tsx` (whole file)

```tsx
import { useState } from 'react';
import { EmpStats } from '@/app/lib/attendanceStats';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import InfoTip from '@/app/components/InfoTip';
import LiveBadge from './LiveBadge';

type SortKey = keyof EmpStats | 'reporting';

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: 'asc' | 'desc' }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30 inline ml-0.5" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 inline ml-0.5 text-warm-text" />
    : <ChevronDown className="w-3 h-3 inline ml-0.5 text-warm-text" />;
}

function PctBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-status-green-ink' : pct >= 75 ? 'bg-status-yellow-ink' : 'bg-status-red-ink';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-border rounded-full min-w-10">
        <div className={`h-1 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

const STATUS_TOOLTIP = 'Based on on-time rate alone: Good is 90% or above, Fair is 75–89%, At Risk is below 75%.';

function StatusBadge({ pct, days }: { pct: number; days: number }) {
  if (days === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (pct >= 90) return (
    <span
      title={STATUS_TOOLTIP}
      tabIndex={0}
      aria-label={`Good — ${STATUS_TOOLTIP}`}
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-green-fill text-status-green-ink cursor-default"
    >
      Good
    </span>
  );
  if (pct >= 75) return (
    <span
      title={STATUS_TOOLTIP}
      tabIndex={0}
      aria-label={`Fair — ${STATUS_TOOLTIP}`}
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-yellow-fill text-status-yellow-ink cursor-default"
    >
      Fair
    </span>
  );
  return (
    <span
      title={STATUS_TOOLTIP}
      tabIndex={0}
      aria-label={`At Risk — ${STATUS_TOOLTIP}`}
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-red-fill text-status-red-ink cursor-default"
    >
      At Risk
    </span>
  );
}

const REPORTING_TOOLTIP = 'Of the days that needed an explanation — late or absent — how many had a GAF Attendance form on file.';

/** Ratio for sorting: -1 means needed=0 (always last in both directions) */
function reportingRatio(s: EmpStats): number {
  if (s.filing.needed === 0) return -1;
  return s.filing.filed / s.filing.needed;
}

function ReportingBadge({ s }: { s: EmpStats }) {
  const { filed, needed } = s.filing;
  if (needed === 0) {
    return <span className="text-muted-foreground text-xs tabular-nums">—</span>;
  }
  const label = `${filed}/${needed}`;
  if (filed === needed) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-green-fill text-status-green-ink">Complete</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{label}</span>
      </span>
    );
  }
  const missing = needed - filed;
  if (missing < needed / 2) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-yellow-fill text-status-yellow-ink">Gaps</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-red-fill text-status-red-ink">Rarely</span>
      <span className="text-[11px] text-muted-foreground tabular-nums">{label}</span>
    </span>
  );
}

type Props = { stats: EmpStats[]; onRowClick: (email: string) => void; search: string };

export function AttendanceTable({ stats, onRowClick, search }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = stats.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'reporting') {
      const ar = reportingRatio(a), br = reportingRatio(b);
      // needed=0 rows always last (ratio=-1) regardless of direction
      if (ar === -1 && br === -1) return 0;
      if (ar === -1) return 1;
      if (br === -1) return -1;
      return sortDir === 'asc' ? ar - br : br - ar;
    }
    const av = a[sortKey as keyof EmpStats], bv = b[sortKey as keyof EmpStats];
    if (typeof av === 'string' && typeof bv === 'string')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    if (typeof av === 'number' && typeof bv === 'number')
      return sortDir === 'asc' ? av - bv : bv - av;
    return 0;
  });

  const Th = ({ label, col, tooltip }: { label: string; col: SortKey; tooltip?: string }) => (
    <th
      className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap bg-slate-50 border-b border-border hover:text-foreground"
      onClick={() => handleSort(col)}
      title={tooltip}
    >
      {label}{tooltip && <InfoTip text={tooltip} />}<SortIcon col={col} sortKey={sortKey} dir={sortDir} />
    </th>
  );

  return (
    <div className="bg-white rounded-lg border border-border shadow-card overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th label="Employee"         col="name"      tooltip="Name from the roster. Click a row to open the viewer." />
              <Th label="Role"             col="role"      tooltip="Role from the Employee Directory." />
              <Th label="Manager"          col="manager"   tooltip="Manager from the Employee Directory." />
              <Th label="Schedule"         col="schedule"  tooltip="The shift assigned in Admin → Schedules; lateness is measured against its start time." />
              <th
                className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-border whitespace-nowrap cursor-default"
                title={STATUS_TOOLTIP}
              >
                Status<InfoTip text={STATUS_TOOLTIP} />
              </th>
              <Th label="Reporting" col="reporting" tooltip={REPORTING_TOOLTIP} />
              <Th label="Expected"         col="days"        tooltip="Scheduled work days in range, excluding time off and permissions." />
              <Th label="On Time"          col="onTime"      tooltip="Days clocked in at or before the scheduled start." />
              <Th label="Total Late"       col="totalLate"   tooltip="Days clocked in after the scheduled start (Reported + Unreported)." />
              <Th label="Reported"         col="reported"    tooltip="Late days that had a GAF Attendance form on file." />
              <Th label="Unreported"       col="unreported"  tooltip="Late days with no GAF Attendance form." />
              <Th label="Absent"           col="absent"      tooltip="Scheduled days with no clock-in and no time off or permission." />
              <Th label="Avg Min (Worked)" col="avgMinLate"  tooltip="Average minutes late across the days someone actually worked." />
              <Th label="% On-Time"        col="pctOnTime"   tooltip="On Time ÷ Expected. Green 90%+, amber 75–89%, red below 75%." />
              <Th label="1–10m"            col="b1to10"      tooltip="Late days where the delay was 1 to 10 minutes." />
              <Th label="11–30m"           col="b11to30"     tooltip="Late days where the delay was 11 to 30 minutes." />
              <Th label="31+m"             col="b31plus"     tooltip="Late days where the delay was more than 30 minutes." />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={17} className="px-4 py-12 text-center text-muted-foreground">No employees match these filters.</td></tr>
            )}
            {sorted.map(s => (
              <tr key={s.email}
                className="border-b border-border/60 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => onRowClick(s.email)}>
                <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">
                  {s.name}
                  {s.liveDays > 0 && (
                    <span className="ml-2 align-middle">
                      <LiveBadge count={s.liveDays}
                        title={`${s.liveDays} day${s.liveDays === 1 ? '' : 's'} not processed yet, shown from Teramind${s.liveLate > 0 ? ` (${s.liveLate} late)` : ''}. Not counted in any number.`} />
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.role || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.manager || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.schedule}</td>
                <td className="px-3 py-2.5"><StatusBadge pct={s.pctOnTime} days={s.days} /></td>
                <td className="px-3 py-2.5"><ReportingBadge s={s} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums">{s.days}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-status-green-ink font-medium">{s.onTime}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-status-yellow-ink font-medium">{s.totalLate}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-status-yellow-ink">{s.reported}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-status-red-ink">{s.unreported}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-status-red-ink">{s.absent}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{s.avgMinLate.toFixed(1)}</td>
                <td className="px-3 py-2.5 min-w-[120px]"><PctBar pct={s.pctOnTime} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs">{s.b1to10}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs">{s.b11to30}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs">{s.b31plus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## `src/app/pages/attendance/AttendancePanelDays.tsx` (whole file)

```tsx
import type { ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import type { AttendanceRow } from '@/app/lib/attendanceStats';
import { STATUS_COLORS } from './AttendancePanelBody';
import WhyChipBadge from './activity/WhyChipBadge';
import SourceBadge from './activity/SourceBadge';
import GhostMark from './activity/GhostMark';
import LiveBadge, { fmtMins } from './LiveBadge';

type Props = {
  days: ActivityDay[];
  attendanceRows?: AttendanceRow[];
};

const TH = 'px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap';
const TD = 'px-3 py-2 text-xs text-slate-700';

function toDateKey(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

export default function AttendancePanelDays({ days, attendanceRows = [] }: Props) {
  // Index attendance rows by YYYY-MM-DD for O(1) lookup
  const attByDate = new Map<string, AttendanceRow>();
  for (const r of attendanceRows) {
    const key = toDateKey(r.date);
    if (key) attByDate.set(key, r);
  }

  // Newest first
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-semibold mb-3">
        <div className="w-0.5 h-3.5 bg-primary rounded-full" />
        Day by Day
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No activity data for this range.
        </p>
      ) : (
        <div className="bg-white border border-border rounded-lg shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className={TH}>Date</th>
                  <th className={TH}>Entry</th>
                  <th className={TH}>Exit</th>
                  <th className={TH}>Active</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Late</th>
                  <th className={TH}>Why</th>
                  <th className={TH}>Source</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(d => {
                  const att = attByDate.get(d.date);
                  const rowBg = d.needsLook ? 'bg-status-yellow-tint' : 'hover:bg-slate-50';
                  return (
                    <tr key={d.date} className={`border-b border-border/50 ${rowBg}`}>
                      <td className={TD}>{fmtDayShort(d.date)}</td>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>
                        {d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'}
                        <GhostMark ghostMin={d.ghostMin} />
                      </td>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>
                        {d.shownLastMin !== null
                          ? fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')
                          : '—'}
                      </td>
                      <td className={`${TD} tabular-nums`}>{fmtDuration(d.activeMin)}</td>
                      <td className={TD}>
                        {att?.live ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <LiveBadge />
                            <span>{att.live_label}</span>
                          </span>
                        ) : att ? (
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: STATUS_COLORS[att.status] ?? '#ccc' }}
                            />
                            <span className="whitespace-nowrap">{att.status}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className={`${TD} tabular-nums whitespace-nowrap`}>
                        {att && att.minutes_late > 0
                          ? <span className="text-status-yellow-ink">{fmtMins(att.minutes_late)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={TD}>
                        <div className="flex flex-wrap gap-1">
                          {d.needsLook && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-status-yellow-fill text-status-yellow-ink">
                              Needs a Look
                            </span>
                          )}
                          {d.flag === 'long_break' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Long Break
                            </span>
                          )}
                          {d.why ? <WhyChipBadge chip={d.why} /> : <span className="text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className={TD}>
                        <SourceBadge official={d.official} edited={d.edited} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

## `src/app/pages/attendance/AttendancePanelBody.tsx` (whole file)

```tsx
import { EmpStats, computeArrivalScatter, ArrivalPoint } from '@/app/lib/attendanceStats';

import { AttendanceDonuts } from './AttendanceDonuts';
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

type Props = { stats: EmpStats };

export const STATUS_COLORS: Record<string, string> = {
  'On Time':                '#2AA876',
  'Late - Reported':        '#FBBF24',
  'Late - Unreported':      '#EF4444',
  'Excused (PTO/FH/Perm)':  '#94A3B8',
  'Permission':             '#6366F1',
  'Absent - Unexplained':   '#B91C1C',
};

function MiniKpi({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 text-center">
      <div className="font-bold text-xl tracking-tight" style={{ color }}>{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function fmtMinutes(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtClock(t: string | null | undefined): string {
  const s = (t ?? '').trim();
  if (!s) return '—';
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return s;
  return fmtMinutes(Number(m[1]) * 60 + Number(m[2]));
}


const SCATTER_LEGEND = [
  { label: 'On Time',  color: '#2AA876' },
  { label: '1–10 min', color: '#FBBF24' },
  { label: '11–30 min', color: '#D97706' },
  { label: '31+ min',  color: '#EF4444' },
  { label: 'Absent',   color: '#B91C1C' },
  { label: 'Time Off', color: '#94A3B8' },
  { label: 'Permission', color: '#6366F1' },
];

const EXCUSED_Y = 7 * 60 - 20;
const ABSENT_Y  = 11 * 60 + 10;

type ScatterTooltipProps = {
  active?: boolean;
  payload?: { payload: ArrivalPoint }[];
};

function ArrivalTooltip({ active, payload }: ScatterTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-border rounded-lg shadow-md px-3 py-2 text-xs">
      <div className="font-semibold mb-0.5">{p.date}</div>
      <div>Arrival: <span className="font-medium">{fmtClock(p.entry_time)}</span></div>
      <div>Status: <span className="font-medium" style={{ color: p.color }}>{p.status}</span></div>
      {p.minutes_late > 0 && <div>Min Late: <span className="font-medium">{p.minutes_late}</span></div>}
    </div>
  );
}

export default function AttendancePanelBody({ stats }: Props) {
  const scatterPoints = computeArrivalScatter(stats.rows.filter(r => !r.live)).map(p => ({
    ...p,
    minutesSinceMidnight: p.minutesSinceMidnight ?? (
      p.status === 'Absent - Unexplained'       ? ABSENT_Y  :
      (p.status === 'Excused (PTO/FH/Perm)' || p.status === 'Permission') ? EXCUSED_Y :
      null
    ),
  }));

  const yTicks = [EXCUSED_Y, 7*60, 7*60+30, 8*60, 8*60+30, 9*60, 9*60+10, 9*60+30, 10*60, 11*60, ABSENT_Y];
  const step = Math.max(1, Math.floor(scatterPoints.length / 10));

  return (
    <div className="flex flex-col gap-6">
      {/* Mini KPIs */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        <MiniKpi label="Expected"         value={stats.days}                        color="#1B3A6B" />
        <MiniKpi label="On Time"          value={stats.onTime}                      color="#2AA876" />
        <MiniKpi label="Reported"         value={stats.reported}                    color="#FBBF24" />
        <MiniKpi label="Unreported"       value={stats.unreported}                  color="#EF4444" />
        <MiniKpi label="Absent"           value={stats.absent}                      color="#B91C1C" />
        <MiniKpi label="Avg Min (worked)" value={stats.avgMinLate.toFixed(1)}       color="#94A3B8" />
        <MiniKpi label="% On-Time"        value={`${stats.pctOnTime.toFixed(0)}%`}  color="#2AA876" />
      </div>

      {/* Day-by-day arrival scatter */}
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold mb-1">
          <div className="w-0.5 h-3.5 bg-primary rounded-full" />
          Arrival Trend (Day-by-Day)
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Each dot = one workday. Time off/Permission at bottom band; Absent (no-show) at top band.
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          {SCATTER_LEGEND.map(l => (
            <div key={l.label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
        <div className="bg-white border border-border rounded-xl p-4" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={scatterPoints} margin={{ top: 8, right: 12, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={step - 1}
                angle={-35}
                textAnchor="end"
                height={42}
              />
              <YAxis
                domain={[EXCUSED_Y - 5, ABSENT_Y + 5]}
                ticks={yTicks}
                tickFormatter={v => v === EXCUSED_Y ? 'Time off' : v === ABSENT_Y ? 'Absent' : fmtMinutes(v)}
                tick={{ fontSize: 10 }}
                width={66}
              />
              <Tooltip content={<ArrivalTooltip />} />
              <ReferenceLine y={ABSENT_Y} stroke="#B91C1C" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: 'Absent', position: 'insideTopRight', fontSize: 9, fill: '#B91C1C' }} />
              <ReferenceLine y={EXCUSED_Y} stroke="#94A3B8" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: 'Time off/Perm', position: 'insideTopRight', fontSize: 9, fill: '#94A3B8' }} />
              <ReferenceLine y={9 * 60} stroke="#2AA876" strokeDasharray="4 3" strokeWidth={1.5}
                label={{ value: '9:00 AM', position: 'insideTopRight', fontSize: 9, fill: '#2AA876' }} />
              <ReferenceLine y={9 * 60 + 10} stroke="#FBBF24" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: '9:10', position: 'insideTopRight', fontSize: 9, fill: '#FBBF24' }} />
              <ReferenceLine y={9 * 60 + 30} stroke="#D97706" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: '9:30', position: 'insideTopRight', fontSize: 9, fill: '#D97706' }} />
              <Line
                dataKey="minutesSinceMidnight"
                stroke="#1B3A6B"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Scatter dataKey="minutesSinceMidnight" isAnimationActive={false}>
                {scatterPoints.map((p, i) => (
                  <Cell key={i} fill={p.color} stroke="#fff" strokeWidth={1} r={4} />
                ))}
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donuts */}
      <AttendanceDonuts stats={stats} />
    </div>
  );
}
```

## `src/app/pages/attendance/activity/ActivityByEmployee.tsx` (whole file)

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { EmployeeActivitySummary, ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import WhyChipBadge from './WhyChipBadge';
import SourceBadge from './SourceBadge';
import GhostMark from './GhostMark';
import { AttendancePanel } from '@/app/pages/attendance/AttendancePanel';
import DataTable from '@/app/components/DataTable';
import type { Col } from '@/app/components/DataTable';

type SortKey = 'employeeName' | 'daysWorked' | 'avgActiveMin' | 'avgFirstMin' | 'avgLastMin' | 'needsLook' | 'awayDays';

type Props = {
  byEmployee: EmployeeActivitySummary[];
  shiftMinutes?: number;
  expandedId?: number | null;
  onToggle?: (id: number) => void;
};

const TD = 'px-3 py-2 text-sm text-slate-700 align-top';
const SUBTD = 'px-3 py-1.5 text-xs text-slate-600';
const SUBTH = 'sticky top-[33px] z-[9] px-3 py-1.5 text-left text-[12px] font-semibold text-slate-500 whitespace-nowrap bg-slate-50';

const MAX_BAR = 480;

const COLUMNS: Col<EmployeeActivitySummary>[] = [
  { key: 'employeeName', label: 'Employee' },
  { key: 'daysWorked',   label: 'Days With Work' },
  { key: 'avgActiveMin', label: 'Avg Active' },
  { key: 'avgFirstMin',  label: 'Avg Entry' },
  { key: 'avgLastMin',   label: 'Avg Exit' },
  { key: 'needsLook',    label: 'Needs a Look' },
  { key: 'awayDays',     label: 'Away Days' },
];

function ActiveBar({ activeMin, shiftMin }: { activeMin: number | null; shiftMin: number }) {
  if (activeMin === null) return <span className="text-slate-400">—</span>;
  const pct = Math.min(100, Math.round((activeMin / Math.max(shiftMin, 1)) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums text-sm font-medium">{fmtDuration(activeMin)}</span>
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ExpandedDayRow({ d }: { d: ActivityDay }) {
  const rowBg = d.needsLook ? 'bg-amber-50 hover:bg-amber-100/50' : 'bg-slate-50 hover:bg-slate-100/50';
  return (
    <tr className={`${rowBg} transition-colors`}>
      <td className={SUBTD}>{fmtDayShort(d.date)}</td>
      <td className={`${SUBTD} whitespace-nowrap tabular-nums`}>
        {d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'}
        <GhostMark ghostMin={d.ghostMin} />
      </td>
      <td className={`${SUBTD} whitespace-nowrap tabular-nums`}>
        {d.shownLastMin !== null
          ? fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')
          : '—'}
      </td>
      <td className={SUBTD}>{fmtDuration(d.activeMin)}</td>
      <td className={SUBTD}>{d.records <= 1 ? '—' : fmtDuration(d.breaksMin)}</td>
      <td className={SUBTD}>
        <div className="flex flex-wrap gap-1">
          {d.needsLook && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Needs A Look
            </span>
          )}
          {d.flag === 'long_break' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              Long Break
            </span>
          )}
          {d.why ? <WhyChipBadge chip={d.why} /> : null}
        </div>
      </td>
      <td className={SUBTD}><SourceBadge official={d.official} edited={d.edited} /></td>
    </tr>
  );
}

function ExpandedHeader() {
  return (
    <tr>
      <th className={SUBTH}>Date</th>
      <th className={SUBTH}>Entry</th>
      <th className={SUBTH}>Exit</th>
      <th className={SUBTH}>Active</th>
      <th className={SUBTH}>Breaks</th>
      <th className={SUBTH}>Why</th>
      <th className={SUBTH}>Source</th>
    </tr>
  );
}

type EmployeeRowProps = {
  emp: EmployeeActivitySummary;
  onOpenPanel: (emp: EmployeeActivitySummary) => void;
  expanded: boolean;
  onToggle: () => void;
};

function EmployeeRow({ emp, onOpenPanel, expanded, onToggle }: EmployeeRowProps) {
  const avgShift = emp.days.length > 0 ? (emp.days[0]?.shiftMinutes ?? MAX_BAR) : MAX_BAR;

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className={TD}>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className="shrink-0 text-slate-400 hover:text-slate-600"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded
                ? <ChevronDown className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />}
            </button>
            <div>
              <button
                className="font-medium text-slate-800 hover:text-warm-text hover:underline underline-offset-2 text-left transition-colors"
                onClick={() => onOpenPanel(emp)}
              >
                {emp.employeeName}
              </button>
              <div className="text-xs text-slate-400">{emp.role}</div>
            </div>
          </div>
        </td>
        <td className={TD}>
          <span className="font-medium">{emp.daysWorked}</span>
          <span className="text-slate-400"> / {emp.scheduledDays}</span>
        </td>
        <td className={TD}>
          <ActiveBar activeMin={emp.avgActiveMin} shiftMin={avgShift} />
        </td>
        <td className={TD}>{emp.avgFirstMin !== null ? fmtClock(emp.avgFirstMin) : '—'}</td>
        <td className={TD}>{emp.avgLastMin  !== null ? fmtClock(emp.avgLastMin)  : '—'}</td>
        <td className={TD}>
          {emp.needsLook > 0
            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                {emp.needsLook}
              </span>
            : null}
        </td>
        <td className={TD}>
          {emp.awayDays > 0 ? emp.awayLabel : <span className="text-slate-400">—</span>}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} className="p-0">
            <table className="w-full divide-y divide-slate-100">
              <thead><ExpandedHeader /></thead>
              <tbody className="divide-y divide-slate-100">
                {emp.days.map(d => <ExpandedDayRow key={d.date} d={d} />)}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

function sortEmployees(list: EmployeeActivitySummary[], key: SortKey, dir: 'asc' | 'desc'): EmployeeActivitySummary[] {
  return [...list].sort((a, b) => {
    let av: number | string | null, bv: number | string | null;
    if (key === 'employeeName') { av = a.employeeName; bv = b.employeeName; }
    else if (key === 'daysWorked') { av = a.daysWorked; bv = b.daysWorked; }
    else if (key === 'avgActiveMin') { av = a.avgActiveMin ?? -1; bv = b.avgActiveMin ?? -1; }
    else if (key === 'avgFirstMin') { av = a.avgFirstMin ?? -1; bv = b.avgFirstMin ?? -1; }
    else if (key === 'avgLastMin') { av = a.avgLastMin ?? -1; bv = b.avgLastMin ?? -1; }
    else if (key === 'needsLook') { av = a.needsLook; bv = b.needsLook; }
    else { av = a.awayDays; bv = b.awayDays; }

    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const an = av as number, bn = bv as number;
    return dir === 'asc' ? an - bn : bn - an;
  });
}

export default function ActivityByEmployee({ byEmployee, expandedId, onToggle }: Props) {
  const [panelEmp, setPanelEmp] = useState<EmployeeActivitySummary | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('employeeName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // local expanded state fallback when parent doesn't control it
  const [localExpandedId, setLocalExpandedId] = useState<number | null>(null);
  const effectiveExpandedId = expandedId !== undefined ? expandedId : localExpandedId;

  function handleSort(key: string) {
    const k = key as SortKey;
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }

  function handleToggle(id: number) {
    if (onToggle) {
      onToggle(id);
    } else {
      setLocalExpandedId(prev => prev === id ? null : id);
    }
  }

  if (byEmployee.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <span className="text-sm">No activity for these filters.</span>
      </div>
    );
  }

  const sorted = sortEmployees(byEmployee, sortKey, sortDir);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        titleCase
        className="max-h-[70vh]"
      >
        {sorted.map(emp => (
          <EmployeeRow
            key={emp.employeeId}
            emp={emp}
            onOpenPanel={setPanelEmp}
            expanded={effectiveExpandedId === emp.employeeId}
            onToggle={() => handleToggle(emp.employeeId)}
          />
        ))}
      </DataTable>

      {panelEmp && (
        <AttendancePanel
          stats={null}
          employeeId={panelEmp.employeeId}
          days={panelEmp.days}
          displayName={panelEmp.employeeName}
          displayRole={panelEmp.role}
          displayManager={panelEmp.manager}
          onClose={() => setPanelEmp(null)}
        />
      )}
    </>
  );
}
```

## Report
- Byte size of the eight files (each under 15,000); confirm no other file changed; Attendance →
  List with the current period shows "Live · N" next to names and the live-days note; opening an
  employee shows live days tagged Live; no console errors.
