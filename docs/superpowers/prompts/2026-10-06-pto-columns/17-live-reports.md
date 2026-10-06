# Live attendance, step 3 of 4: Attendance Reports shows live days (+ Warm look)

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Needs step 1 (`liveAttendance.ts`, `LiveInfo` on `ReportRow`). Saul (2026-10-06): days payroll
has not processed yet are filled from Teramind and tagged **Live**; a payroll row always wins.

- **New `LiveBadge.tsx`:** a small dashed "Live" pill with the tooltip "Not processed yet: shown
  from Teramind until payroll runs for this day. Not counted in any number." It also exports
  `fmtMins`, `liveInOut` (exit reads "… so far" today, "+1d" past midnight) and `liveLabelCls`.
- **AttendanceReport:** "today" for Teramind = `easternDate(Date.now())`; once periods load,
  `liveWindow(...)` gives the dates after the newest processed period; ONE extra loader,
  `loadTeramindActivityDays` with flat params `{ dateFrom, dateTo, viewAs }` (an impossible
  range when there is no window, so it returns nothing). After `buildAttendanceReport`,
  `applyLiveDays(...)` decorates those days — only once Teramind rows for THIS window have
  arrived (no flash of "No records yet"). A Teramind error shows official days plus a one-line
  note. KPI cards are computed exactly as before (`reportRowsToKpis(rows)`: not-run-yet days are
  never counted; PTO / permission / holiday days still are). Under the cards, only when there
  are live days: "Live, not yet processed: N days · M late · K no records yet".
- **Table / Cards:** a live day shows the Live tag, its label ("Late 20 min", "On time",
  "In progress", "PTO", "No records yet") and Teramind times. Warm look: Title Case headers (no
  ALL CAPS), Excel colours (on time green, late yellow, unexplained absence red, PTO /
  permission blue; reported absences keep their colours — ahead blue, after the shift orange),
  times like `9:54AM`, minutes like `20 min`, orange Cards/Table toggle.

**Only these four files may change** (each a whole file below; `LiveBadge.tsx` is new):
`src/app/pages/attendance/AttendanceReport.tsx`, `AttendanceReportTable.tsx`,
`AttendanceReportStrips.tsx`, `LiveBadge.tsx` (all in `src/app/pages/attendance/`).
No other file may be touched (not `attendanceReport.ts` (lib), `liveAttendance.ts`,
`reportKpis.ts`, `AttendanceKpis.tsx`, any action, or `src/components/ui/*`).

## `src/app/pages/attendance/LiveBadge.tsx` (whole file)

```tsx
// "Live" tag for a day Process Payroll has not run yet, shown from Teramind
// (liveAttendance.ts). Live days are shown but never counted in any number or rate.
// Modelled on activity/SourceBadge.tsx. Dashed border = not official yet.
import type { LiveInfo } from '@/app/lib/attendanceReportTypes';
import { fmtLiveTime } from '@/app/lib/liveAttendance';
import { fmtTime } from '@/app/lib/fmtTime';
import { fmtDuration } from '@/app/lib/teramindToday';

export const LIVE_TOOLTIP =
  'Not processed yet: shown from Teramind until payroll runs for this day. Not counted in any number.';

/** House minutes format: '45 min', '1h 15m'. */
export const fmtMins = (m: number): string => (m < 60 ? `${m} min` : fmtDuration(m));

/** Entry / exit of a live worked day: '9:05AM', '5:40PM so far', '1:10AM +1d'. */
export function liveInOut(l: LiveInfo): { entry: string; exit: string } {
  const t = (min: number | null) => fmtTime(fmtLiveTime(min));
  const exit = l.exitMin === null ? '' : t(l.exitMin);
  return {
    entry: t(l.entryMin),
    exit: exit === '' ? '' : l.inProgress ? `${exit} so far` : l.crossesMidnight ? `${exit} +1d` : exit,
  };
}

/** Text colour of a live label: late yellow, on time green, anything else neutral. */
export function liveLabelCls(l: LiveInfo): string {
  if (l.kind !== 'worked') return 'text-slate-600';
  return l.minutesLate > 0 ? 'text-status-yellow-ink' : 'text-status-green-ink';
}

type Props = { count?: number; title?: string };

export default function LiveBadge({ count, title }: Props) {
  return (
    <span
      title={title ?? LIVE_TOOLTIP}
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-400 bg-white px-1.5 py-px text-[11px] font-medium text-slate-600 whitespace-nowrap cursor-default"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warm shrink-0" aria-hidden="true" />
      Live{count !== undefined ? ` · ${count}` : ''}
    </span>
  );
}
```

## `src/app/pages/attendance/AttendanceReport.tsx` (whole file)

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import { Activity, AlertCircle, Info, LayoutGrid, TableIcon } from 'lucide-react';
import { toLocalYMD,
  isScheduledWorkDay, getSchedule, parseTimeToMinutes,
} from '@/app/lib/classificationEngine';
import { buildAttendanceReport } from '@/app/lib/attendanceReport';
import type { ReportEmployee, ReportPayrollRow, ReportForm, ReportRequest,
  ReportPeriod, ReportHoliday, ReportRow, ReportSummary } from '@/app/lib/attendanceReportTypes';
import { liveWindow, applyLiveDays, liveSummary } from '@/app/lib/liveAttendance';
import { whyFor } from '@/app/lib/activityDays';
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
import LiveBadge from './LiveBadge';

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

  const loading = loadingDays || loadingForms || loadingReqs || loadingEmps ||
                  loadingHols || loadingPeriods || loadingDst || (win !== null && loadingTm);
  const anyError = errDays || errForms || errReqs || errEmps;

  // Which window the loaded Teramind rows belong to. Until the load for the current window has
  // finished, show official rows only (otherwise live days flash "No records yet" for a render).
  const winKey = win ? `${win.from}|${win.to}` : '';
  const [tmFor, setTmFor] = useState('');
  const tmWasLoading = useRef(false);
  useEffect(() => {
    if (loadingTm) tmWasLoading.current = true;
    else if (tmWasLoading.current) { tmWasLoading.current = false; setTmFor(winKey); }
  }, [loadingTm, winKey]);

  // ── Build report ───────────────────────────────────────────────────────────
  const { rows: officialRows, perEmployee, unmatchedForms } = useMemo(() => {
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

  // ── Live days (Teramind) on top. Payroll rows always win; a Teramind error shows official only.
  const rows = useMemo(() => {
    if (!win || errTm || tmFor !== winKey) return officialRows;
    return applyLiveDays({
      rows: officialRows,
      payrollRows: (rawDays as ReportPayrollRow[]) ?? [],
      tmRows: (rawTm as ActivityDayRow[]) ?? [],
      employees: (rawEmps as ReportEmployee[]) ?? [],
      requests: (rawRequests as ReportRequest[]) ?? [],
      window: win,
      today: tmToday,
      helpers: { parseTimeToMinutes, whyFor },
    });
  }, [officialRows, win, winKey, tmFor, errTm, rawDays, rawTm, rawEmps, rawRequests, tmToday]);

  // ── Summary strip KPIs: same as before live days existed. Live rows keep their verdict, so
  // not-processed days are never counted and PTO / permission / holiday days still are.
  const kpis = useMemo(() => reportRowsToKpis(rows), [rows]);
  const live = useMemo(() => liveSummary(rows), [rows]);

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

            {/* Live days: shown, never counted above */}
            {live.days > 0 && (
              <div className="flex items-center gap-2 -mt-2 mb-4 px-1 text-xs text-slate-600">
                <LiveBadge />
                <span>
                  Live, not yet processed: {live.days} day{live.days === 1 ? '' : 's'}
                  {' · '}{live.late} late{' · '}{live.noRecords} no records yet
                </span>
              </div>
            )}
            {win && errTm && (
              <div className="flex items-center gap-2 -mt-2 mb-4 px-1 text-xs text-slate-500">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Live days could not be loaded from Teramind. Showing processed days only.
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
```

## `src/app/pages/attendance/AttendanceReportTable.tsx` (whole file)

```tsx
import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Info } from 'lucide-react';
import type { ReportRow, Verdict } from '@/app/lib/attendanceReportTypes';
import { fmtDay } from '@/app/lib/fmtDay';
import { fmtTime } from '@/app/lib/fmtTime';
import { VERDICT_LABEL } from './AttendanceReportStrips';
import LiveBadge, { fmtMins, liveInOut, liveLabelCls } from './LiveBadge';
import WhyChipBadge from './activity/WhyChipBadge';

type Props = { rows: ReportRow[] };

// Excel colours: on time green, late yellow, unexplained absence red, time off / permission blue.
// Reported absences keep their earlier colours (Saul's call): ahead blue, after the shift orange.
const VERDICT_BADGE: Record<Verdict, string> = {
  on_time:                 'bg-status-green-fill text-status-green-ink',
  late_reported_on_time:   'bg-status-yellow-fill text-status-yellow-ink',
  late_reported_late:      'bg-status-yellow-fill text-status-yellow-ink',
  late_no_form:            'bg-status-yellow-fill text-status-yellow-ink',
  absent_reported_on_time: 'bg-blue-50 text-blue-700',
  absent_reported_late:    'bg-orange-100 text-orange-800',
  unexplained_absence:     'bg-status-red-fill text-status-red-ink',
  pto:                     'bg-blue-50 text-blue-700',
  permission:              'bg-blue-50 text-blue-700',
  holiday:                 'bg-slate-100 text-slate-600',
  not_processed:           'bg-slate-100 text-slate-500',
};

type SortKey = 'date' | 'employeeName' | 'verdict' | 'minutesLate';
type Dir = 'asc' | 'desc';

const ALL_VERDICTS: Verdict[] = [
  'on_time', 'late_reported_on_time', 'late_reported_late',
  'late_no_form', 'absent_reported_on_time', 'absent_reported_late',
  'unexplained_absence', 'pto', 'permission', 'holiday', 'not_processed',
];

/** Payroll times are US Eastern "H:MM AM" text; fmtTime only reshapes them ('9:54AM'). */
const time = (t: string | null) => fmtTime(t) || '—';

/** In / Out cell. Live days use Teramind: exit 'so far' while in progress, '+1d' past midnight. */
function inOut(r: ReportRow): string {
  if (r.live) {
    if (r.live.kind !== 'worked') return '—';
    const { entry, exit } = liveInOut(r.live);
    return exit ? `${entry} → ${exit}` : entry;
  }
  return `${time(r.entryTime)}${r.exitTime ? ` → ${time(r.exitTime)}` : ''}`;
}

const TH = 'px-3 py-2.5 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-border whitespace-nowrap';

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: Dir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30 inline ml-0.5" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 inline ml-0.5 text-warm-text" />
    : <ChevronDown className="w-3 h-3 inline ml-0.5 text-warm-text" />;
}

export function AttendanceReportTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<Dir>('asc');
  const [activeVerdicts, setActiveVerdicts] = useState<Set<Verdict>>(new Set());

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function toggleVerdict(v: Verdict) {
    setActiveVerdicts(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  }

  // Verdicts present in the data
  const presentVerdicts = useMemo(() =>
    ALL_VERDICTS.filter(v => rows.some(r => r.verdict === v)),
  [rows]);

  const filtered = useMemo(() =>
    activeVerdicts.size === 0 ? rows : rows.filter(r => activeVerdicts.has(r.verdict)),
  [rows, activeVerdicts]);

  const thisYear = rows.length > 0 ? rows[0].date.slice(0, 4) : '';

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      if (sortKey === 'date')         { av = a.date; bv = b.date; }
      if (sortKey === 'employeeName') { av = a.employeeName; bv = b.employeeName; }
      if (sortKey === 'verdict')      { av = a.verdict; bv = b.verdict; }
      if (sortKey === 'minutesLate')  { av = a.minutesLate; bv = b.minutesLate; }
      if (typeof av === 'string' && typeof bv === 'string')
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      if (typeof av === 'number' && typeof bv === 'number')
        return sortDir === 'asc' ? av - bv : bv - av;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const Th = ({ label, col }: { label: string; col: SortKey }) => (
    <th
      onClick={() => toggleSort(col)}
      className={`${TH} cursor-pointer select-none hover:text-foreground`}
    >
      {label}<SortIcon col={col} sortKey={sortKey} dir={sortDir} />
    </th>
  );

  return (
    <div>
      {/* Verdict filter chips — use shared VERDICT_LABEL for consistency */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {presentVerdicts.map(v => {
          const active = activeVerdicts.has(v);
          return (
            <button
              key={v}
              onClick={() => toggleVerdict(v)}
              className={[
                'px-2.5 py-1 rounded-full text-xs font-semibold border transition-all',
                active
                  ? `${VERDICT_BADGE[v]} border-current ring-1 ring-current`
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400',
              ].join(' ')}
            >
              {VERDICT_LABEL[v]}
              {' '}
              <span className="opacity-70">({rows.filter(r => r.verdict === v).length})</span>
            </button>
          );
        })}
        {activeVerdicts.size > 0 && (
          <button
            onClick={() => setActiveVerdicts(new Set())}
            className="px-2.5 py-1 rounded-full text-xs text-slate-500 hover:text-status-red-ink border border-transparent transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <Th label="Date"        col="date" />
                <Th label="Employee"    col="employeeName" />
                <th className={TH}>Scheduled</th>
                <th className={TH}>In / Out</th>
                <Th label="Late"       col="minutesLate" />
                <Th label="Verdict"    col="verdict" />
                <th className={TH}>Form</th>
                <th className={TH}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr
                  key={`${r.employeeId}-${r.date}`}
                  className="border-b border-border/60 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                    {fmtDay(r.date, thisYear)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-medium text-sm">{r.employeeName}</span>
                    {r.role && <span className="ml-1.5 text-xs text-muted-foreground">{r.role}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {time(r.scheduledStart)}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap text-muted-foreground">
                    {inOut(r)}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-right whitespace-nowrap">
                    {r.minutesLate > 0
                      ? <span className="text-status-yellow-ink font-semibold">{fmtMins(r.minutesLate)}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.live ? (
                      <span className="inline-flex items-center gap-1.5">
                        <LiveBadge />
                        <span className={`text-[11px] font-semibold ${liveLabelCls(r.live)}`}>{r.live.label}</span>
                        {r.live.kind === 'worked' && r.live.why && <WhyChipBadge chip={r.live.why} />}
                      </span>
                    ) : (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${VERDICT_BADGE[r.verdict]}`}>
                        {VERDICT_LABEL[r.verdict]}
                      </span>
                    )}
                    {/* Subtle flags */}
                    {r.flags.recordedUnexplainedButFormOnFile && (
                      <Info className="w-3 h-3 inline ml-1 text-slate-400"
                        title="Recorded as an unjustified absence even though a form was filed." />
                    )}
                    {r.flags.formEmailUnrecognised && (
                      <Info className="w-3 h-3 inline ml-1 text-slate-400"
                        title="Form submitted under a different email" />
                    )}
                    {r.flags.excusedInPayrollNoRequest && (
                      <Info className="w-3 h-3 inline ml-1 text-slate-400"
                        title="Excused in payroll — no Monday request found" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[180px] truncate">
                    {r.form
                      ? <span title={`${r.form.type}${r.form.reason ? ': ' + r.form.reason : ''}`}>
                          {r.form.type}{r.form.onTime ? ' ✓' : ' (late)'}
                        </span>
                      : r.coveredBy
                        ? <span className="text-slate-400">{r.coveredBy.label}</span>
                        : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400 max-w-[200px] truncate">
                    {r.flags.multipleForms && (
                      <span className="mr-1 text-slate-500">Multiple forms</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
          {sorted.length} row{sorted.length !== 1 ? 's' : ''}
          {activeVerdicts.size > 0 ? ` (filtered from ${rows.length})` : ''}
        </div>
      </div>
    </div>
  );
}
```

## `src/app/pages/attendance/AttendanceReportStrips.tsx` (whole file)

```tsx
import { useMemo } from 'react';
import { Info, AlertTriangle, Copy } from 'lucide-react';
import type { ReportRow, ReportSummary, Verdict, LiveInfo } from '@/app/lib/attendanceReportTypes';
import { fmtDay } from '@/app/lib/fmtDay';
import { fmtTime } from '@/app/lib/fmtTime';
import LiveBadge, { fmtMins, liveInOut } from './LiveBadge';

type Props = { rows: ReportRow[]; perEmployee: ReportSummary[] };

// ── Tone system: Excel colours (on time green, late yellow, absent red, away blue) ──
type Tone = 'green' | 'yellow' | 'red' | 'blue' | 'orange' | 'grey';

const VERDICT_TONE: Record<Verdict, Tone> = {
  on_time:                 'green',
  late_reported_on_time:   'yellow',
  late_reported_late:      'yellow',
  late_no_form:            'yellow',
  absent_reported_on_time: 'blue',
  absent_reported_late:    'orange',
  unexplained_absence:     'red',
  pto:                     'blue',
  permission:              'blue',
  holiday:                 'grey',
  not_processed:           'grey',
};

const TONE: Record<Tone, { stripe: string; dot: string; text: string; pill: string }> = {
  green:  { stripe: 'border-t-status-green-ink',  dot: 'bg-status-green-ink',  text: 'text-status-green-ink',  pill: 'bg-status-green-fill text-status-green-ink border-transparent' },
  yellow: { stripe: 'border-t-status-yellow-ink', dot: 'bg-status-yellow-ink', text: 'text-status-yellow-ink', pill: 'bg-status-yellow-fill text-status-yellow-ink border-transparent' },
  red:    { stripe: 'border-t-status-red-ink',    dot: 'bg-status-red-ink',    text: 'text-status-red-ink',    pill: 'bg-status-red-fill text-status-red-ink border-transparent' },
  blue:   { stripe: 'border-t-blue-500',          dot: 'bg-blue-500',          text: 'text-blue-700',          pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  orange: { stripe: 'border-t-orange-500',        dot: 'bg-orange-500',        text: 'text-orange-700',        pill: 'bg-orange-100 text-orange-800 border-transparent' },
  grey:   { stripe: 'border-t-slate-300',         dot: 'bg-slate-400',         text: 'text-slate-500',         pill: 'bg-slate-50 text-slate-600 border-slate-200' },
};

// Full wording shared by the table chips and the card tooltips (Title Case)
export const VERDICT_LABEL: Record<Verdict, string> = {
  on_time:                 'On Time',
  late_reported_on_time:   'Late — Reported Ahead',
  late_reported_late:      'Late — Form Sent After Shift',
  late_no_form:            'Late — No Form',
  absent_reported_on_time: 'Absent — Reported Ahead',
  absent_reported_late:    'Absent — Reported After Shift',
  unexplained_absence:     'Absent — Unexplained',
  pto:                     'PTO',
  permission:              'Permission',
  holiday:                 'Holiday',
  not_processed:           'Payroll Not Run Yet',
};

// Card wording (Title Case, shorter than VERDICT_LABEL)
const CARD_LABEL: Record<Verdict, string> = {
  on_time:                 'On Time',
  late_reported_on_time:   'Late · Reported Ahead',
  late_reported_late:      'Late · Reported After Shift',
  late_no_form:            'Late · No Form',
  absent_reported_on_time: 'Absent · Reported Ahead',
  absent_reported_late:    'Absent · Reported After Shift',
  unexplained_absence:     'Absent · Unexplained',
  pto:                     'PTO',
  permission:              'Permission',
  holiday:                 'Holiday',
  not_processed:           'Not Run Yet',
};

/** Live day tone: late yellow, worked green, a reason (PTO, form…) blue, no records grey. */
function liveTone(l: LiveInfo): Tone {
  if (l.kind === 'worked') return l.minutesLate > 0 ? 'yellow' : 'green';
  return l.kind === 'reason' ? 'blue' : 'grey';
}

/** Payroll times are US Eastern "H:MM AM" text; fmtTime reshapes them ('9:54AM'). */
const time = (t: string | null) => fmtTime(t) || '—';

// ── Tile ──────────────────────────────────────────────────────────────────────
function DayTile({ row, thisYear }: { row: ReportRow; thisYear: string }) {
  const live = row.live ?? null;
  const t = TONE[live ? liveTone(live) : VERDICT_TONE[row.verdict]];

  // Split "Mon Aug 10" into weekday and month-day — no Date object
  const dayStr = fmtDay(row.date, thisYear);
  const spaceIdx = dayStr.indexOf(' ');
  const wd = spaceIdx >= 0 ? dayStr.slice(0, spaceIdx) : dayStr;
  const md = spaceIdx >= 0 ? dayStr.slice(spaceIdx + 1) : '';

  // Live days: dashed border = not official yet
  const frame = live ? 'border-dashed border-slate-400' : 'border-slate-200';
  const liveTimes = live && live.kind === 'worked' ? liveInOut(live) : null;

  return (
    <div
      className={`relative w-[170px] shrink-0 bg-white border ${frame} border-t-[3px] ${t.stripe} rounded-md px-2.5 pt-1.5 pb-2 shadow-card text-[11px] leading-snug`}
      title={live ? `Live: ${live.label}` : VERDICT_LABEL[row.verdict]}
    >
      {/* Date */}
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-[11px] font-semibold text-slate-500">{wd}</span>
        <span className="text-[14px] font-bold text-slate-900">{md}</span>
        {live && <span className="ml-auto self-center"><LiveBadge /></span>}
      </div>

      {/* Status label */}
      <div className={`flex items-center gap-1.5 font-semibold mb-1 whitespace-nowrap ${t.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dot}`} />
        <span className="truncate">{live ? live.label : CARD_LABEL[row.verdict]}</span>
      </div>

      {/* Time line */}
      {liveTimes ? (
        <div className="tabular-nums text-slate-900 whitespace-nowrap">
          {liveTimes.entry} <span className="text-slate-400">→</span>{' '}
          {liveTimes.exit || <span className="text-slate-400">no exit</span>}
        </div>
      ) : live ? (
        <div className="text-slate-500 truncate">{live.kind === 'reason' ? 'No punches' : 'No Teramind records'}</div>
      ) : row.entryTime ? (
        <div className="tabular-nums text-slate-900 whitespace-nowrap">
          {time(row.entryTime)} <span className="text-slate-400">→</span>{' '}
          {row.exitTime ? time(row.exitTime) : <span className="text-slate-400">no exit</span>}
        </div>
      ) : (
        <div className="text-slate-500">{row.coveredBy ? row.coveredBy.label : 'No punches'}</div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-1.5 mt-1.5 min-h-[18px]">
        {row.minutesLate > 0 && (
          <span className={`rounded-full border px-1.5 py-px text-[11px] font-semibold ${t.pill}`}>+{fmtMins(row.minutesLate)}</span>
        )}
        {row.form && (
          <span className="text-slate-500 truncate" title={row.form.onTime ? 'Form sent before the shift' : 'Form sent after the shift'}>
            {row.form.onTime ? '✓' : '⚠'} {row.form.type}
          </span>
        )}
      </div>

      {/* Subtle flags — bottom-right */}
      {(row.flags.recordedUnexplainedButFormOnFile || row.flags.formEmailUnrecognised || row.flags.excusedInPayrollNoRequest) && (
        <span className="absolute bottom-1 right-5">
          <Info className="w-3 h-3 text-slate-400" title={
            row.flags.recordedUnexplainedButFormOnFile
              ? 'Recorded as an unjustified absence even though a form was filed.'
              : row.flags.formEmailUnrecognised
                ? 'Form submitted by a different email'
                : 'Excused in payroll, no Monday request found'
          } />
        </span>
      )}
      {row.flags.multipleForms && (
        <span className="absolute bottom-1 right-1">
          <Copy className="w-3 h-3 text-slate-400" title="Multiple forms submitted" />
        </span>
      )}
    </div>
  );
}

// ── Employee card ─────────────────────────────────────────────────────────────
function EmployeeCard({ summary, rows, thisYear }: { summary: ReportSummary; rows: ReportRow[]; thisYear: string }) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  const rateColor = summary.onTimeRate === null ? 'text-slate-400'
    : summary.onTimeRate >= 90 ? 'text-status-green-ink'
    : summary.onTimeRate >= 75 ? 'text-status-yellow-ink'
    : 'text-status-red-ink';

  // Average minutes late across official late days (live days never count)
  const lateRows = rows.filter(r => !r.live && r.verdict.startsWith('late'));
  const avgLate = lateRows.length > 0
    ? Math.round(lateRows.reduce((s, r) => s + (r.minutesLate ?? 0), 0) / lateRows.length)
    : null;
  const liveDays = rows.filter(r => r.live).length;

  return (
    <div className="bg-white border border-border rounded-lg shadow-card p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <span className="font-semibold text-sm text-foreground">{summary.employeeName}</span>
          <span className="ml-2 text-xs text-muted-foreground">{summary.role}</span>
          {summary.manager && (
            <span className="ml-2 text-xs text-slate-500">• {summary.manager}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{summary.expectedDays} days</span>
          {liveDays > 0 && (
            <LiveBadge count={liveDays}
              title={`${liveDays} day${liveDays === 1 ? '' : 's'} not processed yet, shown from Teramind. Not counted in any number.`} />
          )}
          {summary.lateDays > 0 && (
            <span className="text-status-yellow-ink font-medium">
              <AlertTriangle className="w-3 h-3 inline mr-0.5" />
              {summary.lateDays} late
            </span>
          )}
          {avgLate !== null && (
            <span className="text-status-yellow-ink">avg +{fmtMins(avgLate)}</span>
          )}
          {summary.unexplainedAbsences > 0 && (
            <span className="text-status-red-ink font-medium">
              {summary.unexplainedAbsences} absent
            </span>
          )}
          {summary.onTimeRate !== null && (
            <span className={`font-bold ${rateColor}`}>{Math.round(summary.onTimeRate)}% on time</span>
          )}
        </div>
      </div>

      {/* Tile grid */}
      <div className="flex flex-wrap gap-2">
        {sorted.map(r => <DayTile key={r.date + r.employeeId} row={r} thisYear={thisYear} />)}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function AttendanceReportStrips({ rows, perEmployee }: Props) {
  const byEmp = useMemo(() => {
    const m = new Map<number, ReportRow[]>();
    for (const r of rows) {
      const arr = m.get(r.employeeId) ?? [];
      arr.push(r);
      m.set(r.employeeId, arr);
    }
    return m;
  }, [rows]);

  const thisYear = rows.length > 0 ? rows[0].date.slice(0, 4) : '';

  const sorted = [...perEmployee].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName),
  );

  return (
    <div>
      {sorted.map(s => (
        <EmployeeCard
          key={s.employeeId}
          summary={s}
          rows={byEmp.get(s.employeeId) ?? []}
          thisYear={thisYear}
        />
      ))}
    </div>
  );
}
```

## Report
- Byte size of the four files (each under 15,000); confirm no other file changed; Attendance →
  Reports with the current period shows live rows tagged Live, and no console errors.
