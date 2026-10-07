# Count unprocessed days, step 1 of 4: the logic

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Saul (2026-10-07): days payroll hasn't processed must **count in every total exactly as payroll
would count them** (late / on time from Teramind; Monday form / PTO / holiday as usual; a past
workday with no punches and nothing on file = absent; today counts only once someone has punched
in), and the **Live pills and notes go** — they were confusing. When payroll processes a day, its
row replaces the Teramind stand-in automatically.

Each unprocessed scheduled day gets a stand-in payroll row built from Teramind (late = entry −
scheduled start, no grace; holiday / PTO / permission / absence form as the engine records them),
built in a second report run for the live window only, whose rows replace the main report's rows
for those dates. `buildAttendanceReport` then decides every verdict with its usual rules. The List
maps the same verdicts to the exact status the database view gives a payroll row, so List and
Reports totals agree. Both pages wait for Teramind before showing numbers; if Teramind fails,
processed days only plus one quiet line. Reports drops the "Live, not yet processed" line.

**Only these four files may change** (each a whole file below): `src/app/lib/liveAttendance.ts`,
`src/app/lib/liveListRows.ts`, `src/app/pages/attendance/useLiveListRows.ts`,
`src/app/pages/attendance/AttendanceReport.tsx`. No other file may be touched (not
`attendanceReport.ts`, `classificationEngine.ts`, `attendanceStats.ts`, `attendanceReportTypes.ts`,
any other page, any action, or `src/components/ui/*`).

## `src/app/lib/liveAttendance.ts` (whole file)

```ts
// Live days: Attendance List / Reports days that Process Payroll has not written yet.
// Decision 2026-10-07 (Saul): they COUNT, exactly as payroll would count them, with no Live tag.
// How: each such day gets a stand-in payroll row built from Teramind (livePayrollRows), the way
// classificationEngine would write it, and the window is treated as processed (livePeriod).
// buildAttendanceReport then applies its usual rules: late / on time, forms, PTO, holidays,
// unexplained absence. A real payroll_entries row ALWAYS wins. Today without punches is never
// counted (the day is not over).
//
// NO RUNTIME IMPORTS — node --test cannot resolve extension-less imports (see reportKpis.ts).
// buildAttendanceReport and parseTimeToMinutes are injected by the caller.
// Dates are 'YYYY-MM-DD' strings compared as strings; no Date objects anywhere.

import type {
  ReportRow, ReportPayrollRow, ReportPeriod, ReportInput, ReportOutput, ReportSummary,
  ReportEmployee,
} from './attendanceReportTypes';
import type { ActivityDayRow } from './activityTypes';

export type LiveWindow = { from: string; to: string };

/** Verdicts payroll scores (same list as attendanceReport SCORED_VERDICTS). */
const SCORED = [
  'on_time', 'late_reported_on_time', 'late_reported_late', 'late_no_form',
  'absent_reported_on_time', 'absent_reported_late', 'unexplained_absence',
];
/** Verdicts a day can only get from a holiday or a Monday request when it has no payroll row. */
const COVERED = ['holiday', 'pto', 'permission'];

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const ymd10 = (v: unknown): string => (v == null ? '' : String(v).slice(0, 10));
const isYmd = (s: string): boolean => YMD.test(s);
const pad2 = (n: number): string => (n < 10 ? '0' + n : String(n));

/** Teramind dates arrive as 20261001 (int) or '2026-10-01'. */
function tmYmd(v: unknown): string {
  const s = String(v ?? '').trim();
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const d = ymd10(s);
  return isYmd(d) ? d : '';
}

function daysInMonth(y: number, m: number): number {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

/** '2026-09-30' -> '2026-10-01', integer stepping only. */
function dayAfter(date: string): string {
  let y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10)) + 1;
  if (d > daysInMonth(y, m)) { d = 1; m += 1; }
  if (m > 12) { m = 1; y += 1; }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Non-negative whole minutes, else null (Teramind uses -1 / null for "none"). */
function toMin(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

/** 485 -> '8:05 AM' (payroll text style, like formatTime12). Wraps past midnight: 1560 -> '2:00 AM'. */
export function fmtLiveTime(min: number | null): string | null {
  if (min === null) return null;
  const t = ((Math.trunc(min) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60), m = t % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${pad2(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

const key = (empId: unknown, date: string): string => `${Number(empId)}|${date}`;

/**
 * The dates that may be live: from the day after the newest PROCESSED period ends
 * (or dateFrom, whichever is later) up to today (or dateTo, whichever is earlier).
 */
export function liveWindow(
  periods: ReportPeriod[], dateFrom: string, dateTo: string, today: string,
): LiveWindow | null {
  const from0 = ymd10(dateFrom), to0 = ymd10(dateTo), t = ymd10(today);
  if (!isYmd(from0) || !isYmd(to0) || !isYmd(t)) return null;
  let newestEnd = '';
  for (const p of periods ?? []) {
    const end = ymd10(p?.end_date);
    if (p?.processed_at && isYmd(end) && end > newestEnd) newestEnd = end;
  }
  const afterProcessed = newestEnd ? dayAfter(newestEnd) : '';
  const from = afterProcessed > from0 ? afterProcessed : from0;
  const to = t < to0 ? t : to0;
  return from <= to ? { from, to } : null;
}

/** The live window as a processed period, so buildAttendanceReport scores its days. */
export function livePeriod(win: LiveWindow): ReportPeriod {
  return { period_name: '', start_date: win.from, end_date: win.to, processed_at: 'live' };
}

/**
 * Stand-in payroll rows for the live window, one per row the report already has there
 * (so day off / before start date stay skipped) with no real payroll row. Mirrors
 * classificationEngine: holiday keeps punches; a PTO / permission day has no times; an
 * Absence form → 'Ausencia Justificada.'; no punches and no Absence form →
 * 'Ausencia Injustificada'; punches → entry/exit and late = entry − scheduled start (Step 7).
 * Today with no punches gets no row unless a holiday / request covers it.
 */
export function livePayrollRows(input: {
  rows: ReportRow[]; payrollRows: ReportPayrollRow[]; tmRows: ActivityDayRow[];
  window: LiveWindow | null; today: string; parseTimeToMinutes(t: string): number;
}): ReportPayrollRow[] {
  const win = input.window, today = ymd10(input.today);
  if (!win || !isYmd(today)) return [];
  const paid = new Set<string>();
  for (const p of input.payrollRows ?? []) paid.add(key(p.employee_id, ymd10(p.work_date)));
  const tm = new Map<string, ActivityDayRow>();
  for (const r of input.tmRows ?? []) tm.set(key(r.employee_id, tmYmd(r.work_date)), r);

  const out: ReportPayrollRow[] = [];
  for (const r of input.rows ?? []) {
    const date = ymd10(r.date);
    if (date < win.from || date > win.to || date > today) continue;
    const k = key(r.employeeId, date);
    if (paid.has(k)) continue;                                  // payroll always wins
    paid.add(k);
    const t = tm.get(k) ?? null;
    const entryMin = toMin(t?.first_min);
    const covered = COVERED.includes(r.verdict);
    if (entryMin === null && date === today && !covered) continue;   // day not over
    const absenceForm = (r.allForms ?? []).some(f => /absence/i.test(String(f.type ?? '')));
    const away = r.verdict === 'pto' || r.verdict === 'permission';
    const punched = entryMin !== null && !away;
    const event = covered ? '' : absenceForm ? 'Ausencia Justificada.'
      : entryMin === null ? 'Ausencia Injustificada' : '';
    const late = punched && !covered && !absenceForm
      ? Math.max(0, entryMin! - input.parseTimeToMinutes(r.scheduledStart)) : 0;
    out.push({
      employee_id: Number(r.employeeId),
      work_date: date,
      entry_time: punched ? fmtLiveTime(entryMin) : null,
      exit_time: punched && date !== today ? fmtLiveTime(toMin(t?.last_min)) : null,
      scheduled_start: r.scheduledStart || null,
      late_minutes: late,
      early_leave_minutes: 0,
      event_type_1: event,
      documentation: absenceForm ? 'Attendance Form' : '',
      auto_notes: '',
      period_name: '',
    });
  }
  return out;
}

/** Per-employee totals, the same accumulators buildAttendanceReport uses. */
export function summarizeRows(rows: ReportRow[], employees: ReportEmployee[]): ReportSummary[] {
  const byEmp = new Map<string, ReportRow[]>();
  for (const r of rows ?? []) {
    const id = String(r.employeeId);
    const list = byEmp.get(id);
    if (list) list.push(r); else byEmp.set(id, [r]);
  }
  return (employees ?? []).map((emp) => {
    let expectedDays = 0, onTime = 0, lateDays = 0, lateDaysWithoutForm = 0;
    let unexplainedAbsences = 0, awayDays = 0, formsFiled = 0, formsOnTime = 0;
    for (const r of byEmp.get(String(emp.id)) ?? []) {
      const v = r.verdict;
      if (r.countsToScore) expectedDays++;
      if (v === 'on_time') onTime++;
      if (v === 'late_reported_on_time' || v === 'late_reported_late' || v === 'late_no_form') lateDays++;
      if (v === 'late_no_form') lateDaysWithoutForm++;
      if (v === 'unexplained_absence') unexplainedAbsences++;
      if (v === 'pto' || v === 'permission' || v === 'holiday') awayDays++;
      if ((r.allForms ?? []).length > 0) formsFiled++;
      if (r.form?.onTime) formsOnTime++;
    }
    return {
      employeeId: emp.id, employeeName: emp.name, role: emp.role, manager: emp.manager,
      expectedDays, onTime, lateDays, lateDaysWithoutForm, unexplainedAbsences, awayDays,
      formsFiled, formsOnTime,
      onTimeRate: expectedDays > 0 ? (onTime / expectedDays) * 100 : null,
    };
  });
}

/**
 * The report with live days counted. `main` is buildAttendanceReport(input) as before.
 * The live window is built again with the stand-in rows (plus any real payroll row in it)
 * and the window as a processed period; its rows replace main's rows for those dates.
 * Outside the window nothing changes. Today with no punches stays 'not_processed'.
 */
export function liveReport(a: {
  input: ReportInput; main: ReportOutput; window: LiveWindow | null; today: string;
  tmRows: ActivityDayRow[]; build(input: ReportInput): ReportOutput;
}): ReportOutput {
  const win = a.window, today = ymd10(a.today);
  if (!win || !isYmd(today)) return a.main;
  const inWin = (d: string) => d >= win.from && d <= win.to;
  const real = (a.input.payrollRows ?? []).filter(p => inWin(ymd10(p.work_date)));
  const stand = livePayrollRows({
    rows: a.main.rows, payrollRows: a.input.payrollRows ?? [], tmRows: a.tmRows,
    window: win, today, parseTimeToMinutes: a.input.helpers.parseTimeToMinutes,
  });
  const live = a.build({
    ...a.input, dateFrom: win.from, dateTo: win.to,
    payrollRows: [...real, ...stand], periods: [livePeriod(win)],
  });
  const worked = new Set<string>();
  for (const p of [...real, ...stand]) if (p.entry_time != null) worked.add(key(p.employee_id, ymd10(p.work_date)));
  const realKeys = new Set(real.map(p => key(p.employee_id, ymd10(p.work_date))));
  const liveRows = live.rows.map((r) => {
    const k = key(r.employeeId, r.date);
    if (r.date !== today || worked.has(k) || realKeys.has(k) || !SCORED.includes(r.verdict)) return r;
    return { ...r, verdict: 'not_processed' as const, countsToScore: false };
  });
  const rows = [...a.main.rows.filter(r => !inWin(ymd10(r.date))), ...liveRows];
  rows.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.employeeName.localeCompare(y.employeeName)));
  return { rows, perEmployee: summarizeRows(rows, a.input.employees), unmatchedForms: a.main.unmatchedForms };
}
```

## `src/app/lib/liveListRows.ts` (whole file)

```ts
// Attendance List rows for days payroll has not processed yet (2026-10-07: they COUNT).
// Builds the attendance report for the live window ONLY, counts its days exactly as payroll
// would (liveReport: Teramind stand-in payroll rows, window treated as processed), and turns
// each counted day into a List row with the status v_attendance_daily gives the matching
// payroll row. Any email|date the List already has from v_attendance_daily wins.
//
// NO RUNTIME IMPORTS — node --test cannot resolve extension-less imports (see reportKpis.ts).
// buildAttendanceReport, liveReport and the classification helpers are injected by the caller.
// No payroll rows are passed in: a payroll row for a live date is already an official List row.

import type {
  ReportInput, ReportOutput, ReportEmployee, ReportForm, ReportRequest, ReportHoliday,
  ReportPeriod, ReportHelpers, ReportRow,
} from './attendanceReportTypes';
import type { ActivityDayRow } from './activityTypes';
import type { AttendanceRow } from './attendanceStats';
import type { LiveWindow } from './liveAttendance';

/** Loader range used when there is no live window: ends before it starts, so 0 rows come back. */
export const NO_LIVE_WINDOW: LiveWindow = { from: '9999-12-31', to: '1970-01-01' };

export type LiveListDeps = {
  buildAttendanceReport(input: ReportInput): ReportOutput;
  liveReport(a: {
    input: ReportInput; main: ReportOutput; window: LiveWindow | null; today: string;
    tmRows: ActivityDayRow[]; build(input: ReportInput): ReportOutput;
  }): ReportOutput;
  reportHelpers: ReportHelpers;
};

const ymd10 = (v: unknown): string => (v == null ? '' : String(v).slice(0, 10));
const pad2 = (n: number): string => (n < 10 ? '0' + n : String(n));

/** '8:05 AM' -> '08:05' (v_attendance_daily's TO_CHAR HH24:MI). */
export function to24(t: string | null): string | null {
  const m = String(t ?? '').match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return `${pad2(h)}:${m[2]}`;
}

function bucketOf(late: number): string {
  if (late <= 0) return 'on_time';
  if (late <= 10) return 'late_1to10';
  if (late <= 30) return 'late_11to30';
  return 'late_830plus';
}

/** time_off_kind from the label that covered the day (payroll event or Monday request type). */
function kindOf(r: ReportRow): string {
  if (r.verdict === 'holiday') return 'holiday';
  const l = String(r.coveredBy?.label ?? '').toLowerCase();
  if (l.includes('birthday')) return 'birthday';
  if (l.includes('compensatory')) return 'comp_day';
  if (l.includes('ausencia justificada')) return 'approved_absence';
  if (l.includes('feriado')) return 'holiday';
  return 'pto';
}

/**
 * One report row -> one List row, with the status / bucket / time_off_kind / filed_gaf
 * v_attendance_daily gives the payroll row. null for a day that is not counted (not_processed).
 */
export function reportRowToList(r: ReportRow): AttendanceRow | null {
  const base = {
    email: r.email, name: r.employeeName, date: ymd10(r.date),
    entry_time: to24(r.entryTime), exit_time: to24(r.exitTime),
    filed_gaf: false, minutes_late: 0, period_name: '', time_off_kind: null as string | null,
  };
  switch (r.verdict) {
    case 'not_processed':
      return null;
    case 'holiday':
    case 'pto':
      return { ...base, status: 'Excused (PTO/FH/Perm)', bucket: null, time_off_kind: kindOf(r) };
    case 'permission':
      return { ...base, status: 'Permission', bucket: null };
    case 'on_time':
      return { ...base, status: 'On Time', bucket: 'on_time' };
    case 'late_no_form':
    case 'late_reported_on_time':
    case 'late_reported_late': {
      const reported = r.verdict !== 'late_no_form';
      return {
        ...base, status: reported ? 'Late - Reported' : 'Late - Unreported',
        bucket: bucketOf(r.minutesLate), filed_gaf: reported, minutes_late: r.minutesLate,
      };
    }
    default:   // unexplained_absence, absent_reported_* — the List only knows unexplained
      return { ...base, status: 'Absent - Unexplained', bucket: 'absent' };
  }
}

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
  const reportInput: ReportInput = {
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
  };
  const main = d.buildAttendanceReport(reportInput);
  const { rows } = d.liveReport({
    input: reportInput, main, window: win, today: input.today,
    tmRows: input.tmRows ?? [], build: d.buildAttendanceReport,
  });

  const seen = new Set<string>();
  for (const o of input.official ?? []) seen.add(`${String(o.email ?? '').trim().toLowerCase()}|${ymd10(o.date)}`);
  const out: AttendanceRow[] = [];
  for (const r of rows) {
    const k = `${String(r.email ?? '').trim().toLowerCase()}|${ymd10(r.date)}`;
    if (seen.has(k)) continue;
    const row = reportRowToList(r);
    if (!row) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}
```

## `src/app/pages/attendance/useLiveListRows.ts` (whole file)

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '@/app/lib/classificationEngine';
import { buildAttendanceReport } from '@/app/lib/attendanceReport';
import { liveWindow, liveReport } from '@/app/lib/liveAttendance';
import { liveListRows, NO_LIVE_WINDOW } from '@/app/lib/liveListRows';
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
 * Attendance List rows for days payroll has not processed yet, from Teramind (2026-10-07: they
 * count, exactly as payroll would count them). Only the live window is loaded (after the newest
 * processed period, up to today). With no window every ranged loader gets NO_LIVE_WINDOW and
 * returns nothing. `loading` stays true until the window's own data has arrived, so the page can
 * wait and its numbers never flash without these days.
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

  const error = !!(errPeriods || (win !== null && (errTm || errForms || errReqs)));

  // Build rows only once the window's own data has arrived (no one-render flash with the
  // previous, empty results).
  const winKey = win ? `${win.from}|${win.to}` : '';
  const busy = loadingTm || loadingForms || loadingReqs;
  const [dataFor, setDataFor] = useState('');
  const wasBusy = useRef(false);
  useEffect(() => {
    if (busy) wasBusy.current = true;
    else if (wasBusy.current) { wasBusy.current = false; setDataFor(winKey); }
  }, [busy, winKey]);

  const loading = loadingPeriods || (win !== null && !error &&
    (loadingTm || loadingForms || loadingReqs || loadingHols || loadingDst || dataFor !== winKey));

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
        buildAttendanceReport, liveReport,
        reportHelpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes },
      },
    });
  }, [loading, error, win, winKey, dataFor, today, employees, rawForms, rawReqs, rawHols, rawPeriods, rawDst, rawTm, official]);

  return { rows, loading, error };
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
```

## Report
- Byte size of the four files; confirm no other file changed; Attendance → Reports renders with no console errors.
