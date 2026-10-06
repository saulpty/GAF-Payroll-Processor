# Live attendance, step 1 of 4: the logic (no page changes yet)

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Saul (2026-10-06): Attendance List and Reports only show days Process Payroll has written to
`payroll_entries`, so a period not processed yet is blank. Decision: days with **no payroll row**
are filled from Teramind and tagged **Live**; a payroll row always wins. A live day with no
punches shows the Monday form / PTO / holiday reason if there is one, otherwise
"No records yet" — never an official absence, never counted in any KPI.

This step only adds pure logic (no imports at runtime, no Date objects, no page uses it yet):
- **New** `src/app/lib/liveAttendance.ts` — `liveWindow`, `applyLiveDays`, `liveSummary`,
  `liveToAttendanceRows`. Live rows keep their verdict (`not_processed` / `pto` / `permission` /
  `holiday`), so `reportRowsToKpis` never counts them; lateness = entry − scheduled start, the
  same rule Process Payroll uses.
- **New** `src/app/lib/attendancePeriods.ts` — the Periods picker's options: every named period
  plus not-yet-processed placeholders up to the one containing today (built with `nextPeriod`,
  injected), default = the period containing today.
- `src/app/lib/attendanceReportTypes.ts` — adds `LiveInfo` and an optional `live` on `ReportRow`.
- `src/app/lib/attendanceStats.ts` — `AttendanceRow` gets optional `live` / `live_label`; every
  count and rate leaves live rows out (they stay in `rows`); adds `liveDays` / `liveLate`.

**Only these four files may change** (each a whole file below). No other file may be touched
(not `attendanceReport.ts`, `activityDays.ts`, `activityTypes.ts`, `periodName.ts`,
`classificationEngine.ts`, any page, any action, or `src/components/ui/*`).

## `src/app/lib/liveAttendance.ts` (whole file)

```ts
// Live days: Attendance List / Reports days that Process Payroll has not written yet,
// filled from Teramind. A payroll_entries row ALWAYS wins. Live rows keep their official
// verdict (not_processed, or pto / permission / holiday from coverage), so no KPI counts them.
//
// NO RUNTIME IMPORTS — node --test cannot resolve extension-less imports (see reportKpis.ts).
// whyFor (activityDays.ts) and parseTimeToMinutes (classificationEngine.ts) are injected.
// Dates are 'YYYY-MM-DD' strings compared as strings; no Date objects anywhere.

import type {
  ReportRow, ReportPayrollRow, ReportEmployee, ReportRequest, ReportPeriod, LiveInfo,
} from './attendanceReportTypes';
import type { ActivityDayRow, WhyChip } from './activityTypes';
import type { AttendanceRow } from './attendanceStats';

export type LiveWindow = { from: string; to: string };

export type LiveHelpers = {
  parseTimeToMinutes(t: string): number;
  whyFor(a: {
    reportRow: ReportRow | null; requests: ReportRequest[];
    scheduled: boolean; hasActivity: boolean;
  }): WhyChip | null;
};

export const NO_RECORDS_LABEL = 'No records yet';

// Verdicts a day outside every processed period can carry. Anything else is official.
const LIVE_VERDICTS = ['not_processed', 'pto', 'permission', 'holiday'];

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

/** 485 -> '8:05 AM' (payroll text style). Wraps past midnight: 1560 -> '2:00 AM'. */
export function fmtLiveTime(min: number | null): string | null {
  if (min === null) return null;
  const t = ((Math.trunc(min) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60), m = t % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${pad2(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

/** 485 -> '08:05' — v_attendance_daily's entry_time format (TO_CHAR HH24:MI). */
function fmt24(min: number | null): string | null {
  if (min === null) return null;
  const t = ((Math.trunc(min) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;
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

/**
 * Decorate the report's own rows with Teramind data. Never creates a row: a day the
 * report skips (day off, before start date) stays skipped, exactly like official days.
 */
export function applyLiveDays(input: {
  rows: ReportRow[]; payrollRows: ReportPayrollRow[]; tmRows: ActivityDayRow[];
  employees: ReportEmployee[]; requests: ReportRequest[];
  window: LiveWindow | null; today: string; helpers: LiveHelpers;
}): ReportRow[] {
  const win = input.window;
  const today = ymd10(input.today);
  if (!win || !isYmd(today)) return input.rows;
  const { parseTimeToMinutes, whyFor } = input.helpers;

  const paid = new Set<string>();
  for (const p of input.payrollRows ?? []) paid.add(key(p.employee_id, ymd10(p.work_date)));
  const tm = new Map<string, ActivityDayRow>();
  for (const r of input.tmRows ?? []) tm.set(key(r.employee_id, tmYmd(r.work_date)), r);
  const grace = new Map<number, number>();
  for (const e of input.employees ?? []) grace.set(Number(e.id), Number(e.grace_minutes) || 0);
  const reqs = new Map<number, ReportRequest[]>();
  for (const r of input.requests ?? []) {
    const list = reqs.get(Number(r.employee_id));
    if (list) list.push(r); else reqs.set(Number(r.employee_id), [r]);
  }

  return input.rows.map((r) => {
    const date = ymd10(r.date);
    if (date < win.from || date > win.to || date > today) return r;
    const k = key(r.employeeId, date);
    if (paid.has(k)) return r;                          // payroll always wins
    if (!LIVE_VERDICTS.includes(r.verdict)) return r;   // official verdict: leave it

    const row = tm.get(k) ?? null;
    const requests = reqs.get(Number(r.employeeId)) ?? [];
    const entryMin = toMin(row?.first_min);

    if (entryMin === null) {
      const why = whyFor({ reportRow: r, requests, scheduled: true, hasActivity: false });
      const reason = why !== null && why.kind !== 'none';
      const live: LiveInfo = {
        kind: reason ? 'reason' : 'no_records',
        entryMin: null, exitMin: null, crossesMidnight: false, inProgress: false,
        minutesLate: 0, lateAfterGrace: 0,
        label: reason ? why!.label : NO_RECORDS_LABEL,
        why: reason ? why : why ? { ...why, label: NO_RECORDS_LABEL } : null,
      };
      return { ...r, entryTime: null, exitTime: null, minutesLate: 0, live };
    }

    const exitMin = toMin(row?.last_min);
    const lastYmd = tmYmd(row?.last_ymd);
    const crossesMidnight = lastYmd !== '' && lastYmd > date;
    const inProgress = date === today;
    // Same rule as classificationEngine Step 7. A covered day (PTO, holiday...) is never late.
    const minutesLate = r.verdict === 'not_processed'
      ? Math.max(0, entryMin - parseTimeToMinutes(r.scheduledStart)) : 0;
    const lateAfterGrace = Math.max(0, minutesLate - (grace.get(Number(r.employeeId)) ?? 0));
    const why = whyFor({ reportRow: r, requests, scheduled: true, hasActivity: true });
    const live: LiveInfo = {
      kind: 'worked', entryMin, exitMin, crossesMidnight, inProgress,
      minutesLate, lateAfterGrace,
      label: inProgress ? 'In progress' : minutesLate > 0 ? `Late ${minutesLate} min` : 'On time',
      why,
    };
    return {
      ...r,
      entryTime: fmtLiveTime(entryMin),
      exitTime: inProgress ? null : fmtLiveTime(exitMin),
      minutesLate,
      live,
    };
  });
}

/** Counts over live rows only. */
export function liveSummary(rows: ReportRow[]): {
  days: number; worked: number; late: number; noRecords: number; reasons: number;
} {
  let days = 0, worked = 0, late = 0, noRecords = 0, reasons = 0;
  for (const r of rows ?? []) {
    const l = r.live;
    if (!l) continue;
    days += 1;
    if (l.kind === 'worked') { worked += 1; if (l.minutesLate > 0) late += 1; }
    else if (l.kind === 'reason') reasons += 1;
    else noRecords += 1;
  }
  return { days, worked, late, noRecords, reasons };
}

function bucketOf(late: number): string {
  if (late <= 0) return 'on_time';
  if (late <= 10) return 'late_1to10';
  if (late <= 30) return 'late_11to30';
  return 'late_830plus';
}

/**
 * Live ReportRows -> Attendance List rows (v_attendance_daily shape, entry_time 'HH:MM').
 * Status 'Live' and live: true keep them out of every count in attendanceStats.
 * Skips any email|date the official List rows already hold.
 */
export function liveToAttendanceRows(rows: ReportRow[], official: AttendanceRow[]): AttendanceRow[] {
  const seen = new Set<string>();
  for (const o of official ?? []) seen.add(`${String(o.email ?? '').trim().toLowerCase()}|${ymd10(o.date)}`);
  const out: AttendanceRow[] = [];
  for (const r of rows ?? []) {
    const l = r.live;
    if (!l) continue;
    const k = `${String(r.email ?? '').trim().toLowerCase()}|${ymd10(r.date)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const worked = l.kind === 'worked';
    out.push({
      email: r.email,
      name: r.employeeName,
      date: ymd10(r.date),
      entry_time: worked ? fmt24(l.entryMin) : null,
      exit_time: worked && !l.inProgress ? fmt24(l.exitMin) : null,
      status: 'Live',
      bucket: worked && r.verdict === 'not_processed' ? bucketOf(r.minutesLate) : null,
      filed_gaf: !!r.form,
      minutes_late: r.minutesLate,
      period_name: '',
      time_off_kind: null,
      live: true,
      live_label: l.label,
    });
  }
  return out;
}
```

## `src/app/lib/attendancePeriods.ts` (whole file)

```ts
// Periods picker for Attendance List / Reports: every named period, plus placeholder
// periods that Process Payroll has not run yet, up to the one containing today.
// NO RUNTIME IMPORTS (node --test, see reportKpis.ts): nextPeriod from periodName.ts is
// injected. Dates are 'YYYY-MM-DD' strings compared as strings; no Date objects.

export type PeriodSourceRow = {
  period_name: string; start_date: string | null; end_date: string | null;
  processed_at: string | null;
};

export type PeriodOption = {
  period_name: string; start_date: string; end_date: string; processed: boolean;
};

/** periodName.nextPeriod's real signature. */
export type NextPeriodFn = (latest: { period_name: string; end_date: string | null }) =>
  { name: string; startDate: string; endDate: string } | null;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const ymd10 = (v: unknown): string => (v == null ? '' : String(v).slice(0, 10));

export function attendancePeriodOptions(
  rows: PeriodSourceRow[], today: string, nextPeriod: NextPeriodFn,
): {
  options: PeriodOption[];
  defaultName: string | null;
  rangeOf(names: string[]): { from: string; to: string } | null;
} {
  const t = ymd10(today);
  const byName = new Map<string, PeriodOption>();
  for (const r of rows ?? []) {
    const name = String(r?.period_name ?? '').trim();
    if (!name) continue;
    const opt: PeriodOption = {
      period_name: name, start_date: ymd10(r.start_date), end_date: ymd10(r.end_date),
      processed: !!r.processed_at,
    };
    const had = byName.get(name);
    if (!had || (opt.processed && !had.processed)) byName.set(name, opt);
  }

  // Placeholders after the newest processed period, while they start on or before today.
  let newest: PeriodOption | null = null;
  for (const o of byName.values()) {
    if (o.processed && YMD.test(o.end_date) && (!newest || o.end_date > newest.end_date)) newest = o;
  }
  if (newest && YMD.test(t)) {
    let cur = { period_name: newest.period_name, end_date: newest.end_date as string | null };
    for (let i = 0; i < 60; i++) {            // safety cap: ~2.5 years of periods
      const nx = nextPeriod(cur);
      if (!nx || !YMD.test(nx.startDate) || nx.startDate > t) break;
      if (!byName.has(nx.name)) {
        byName.set(nx.name, { period_name: nx.name, start_date: nx.startDate, end_date: nx.endDate, processed: false });
      }
      cur = { period_name: nx.name, end_date: nx.endDate };
    }
  }

  const options = [...byName.values()].sort((a, b) => {
    const ka = a.start_date || a.end_date, kb = b.start_date || b.end_date;
    if (ka !== kb) return ka < kb ? 1 : -1;
    return a.period_name < b.period_name ? 1 : a.period_name > b.period_name ? -1 : 0;
  });

  const containing = options.find((o) => o.start_date !== '' && o.start_date <= t && t <= o.end_date);
  const defaultName = containing ? containing.period_name : newest ? newest.period_name : null;

  function rangeOf(names: string[]): { from: string; to: string } | null {
    const pick = new Set((names ?? []).map((n) => String(n).trim()));
    let from = '', to = '';
    for (const o of options) {
      if (!pick.has(o.period_name) || !YMD.test(o.start_date) || !YMD.test(o.end_date)) continue;
      if (from === '' || o.start_date < from) from = o.start_date;
      if (to === '' || o.end_date > to) to = o.end_date;
    }
    if (from === '') return null;
    if (YMD.test(t) && to > t) to = t;
    return from <= to ? { from, to } : null;
  }

  return { options, defaultName, rangeOf };
}
```

## `src/app/lib/attendanceReportTypes.ts` (whole file)

```ts
// Pure type declarations. The one import is type-only (erased before Node runs it).
// Callers who need both types and runtime exports should import from attendanceReport.ts,
// which re-exports everything from here.

import type { WhyChip } from './activityTypes';

export type ReportEmployee = {
  id: number; name: string; email: string; role: string; manager: string;
  work_days: string;
  start_date: string | null;
  standard_start: string; standard_end: string;
  dst_start: string; dst_end: string;
  grace_minutes: number;
};

export type ReportPayrollRow = {
  employee_id: number; work_date: string;
  entry_time: string | null; exit_time: string | null;
  scheduled_start: string | null;
  late_minutes: number; early_leave_minutes: number;
  event_type_1: string; documentation: string; auto_notes: string;
  period_name: string;
};

export type ReportForm = {
  employee_id: number; form_date: string; form_type: string;
  reason: string; details: string; eta: string;
  submitted_at: string | null; employee_email_raw: string; monday_item_id: string;
};

export type ReportRequest = {
  employee_id: number; request_type: string; permission_type: string;
  start_date: string | null; end_date: string | null; return_date: string | null;
};

export type ReportPeriod = {
  period_name: string; start_date: string | null; end_date: string | null;
  processed_at: string | null;
};

export type ReportHoliday = { date: string; name: string };

export type Verdict =
  | 'on_time' | 'late_reported_on_time' | 'late_reported_late' | 'late_no_form'
  | 'absent_reported_on_time' | 'absent_reported_late' | 'unexplained_absence'
  | 'pto' | 'permission' | 'holiday' | 'not_processed';

export type ReportFormView = {
  type: string; reason: string; details: string; eta: string;
  submittedAt: string | null;
  submittedMinutes: number | null;
  onTime: boolean;
  mondayItemId: string;
};

/** A day Process Payroll has not written yet, filled from Teramind (liveAttendance.ts).
 *  Never an official verdict: the row keeps not_processed / pto / permission / holiday. */
export type LiveInfo = {
  kind: 'worked' | 'reason' | 'no_records';
  entryMin: number | null; exitMin: number | null;
  crossesMidnight: boolean;
  inProgress: boolean;          // today, with punches so far
  minutesLate: number;          // entry - scheduled start, as Process Payroll computes it
  lateAfterGrace: number;       // tooltip only
  label: string;
  why: WhyChip | null;
};

export type ReportRow = {
  employeeId: number; employeeName: string; email: string;
  role: string; manager: string;
  date: string;
  scheduledStart: string;
  entryTime: string | null; exitTime: string | null;
  minutesLate: number; earlyLeaveMinutes: number;
  form: ReportFormView | null;
  allForms: ReportFormView[];
  coveredBy: { kind: 'pto' | 'permission' | 'holiday'; label: string } | null;
  verdict: Verdict;
  countsToScore: boolean;
  flags: {
    multipleForms: boolean;
    recordedUnexplainedButFormOnFile: boolean;
    formEmailUnrecognised: boolean;
    /** payroll labelled the day time off / permission, but no Monday request covers it */
    excusedInPayrollNoRequest: boolean;
  };
  /** Set only on live days (no payroll row yet, filled from Teramind). */
  live?: LiveInfo;
};

export type ReportSummary = {
  employeeId: number; employeeName: string; role: string; manager: string;
  expectedDays: number;
  onTime: number;
  lateDays: number;
  lateDaysWithoutForm: number;
  unexplainedAbsences: number;
  awayDays: number;
  formsFiled: number;
  formsOnTime: number;
  onTimeRate: number | null;
};

export type ReportHelpers = {
  isScheduledWorkDay: (date: Date, workDays: string | undefined) => boolean;
  getSchedule: (
    emp: { dst_start: string; dst_end: string; standard_start: string; standard_end: string; grace_minutes: number },
    date: Date,
    dstWindows: { year: number; us_dst_start: string; us_dst_end: string }[],
  ) => { start: string; end: string; grace: string };
  parseTimeToMinutes: (t: string) => number;
};

export type ReportInput = {
  dateFrom: string; dateTo: string;
  employees: ReportEmployee[];
  payrollRows: ReportPayrollRow[];
  forms: ReportForm[];
  requests: ReportRequest[];
  holidays: ReportHoliday[];
  periods: ReportPeriod[];
  dstWindows: { year: number; us_dst_start: string; us_dst_end: string }[];
  helpers: ReportHelpers;
};

export type ReportOutput = {
  rows: ReportRow[];
  perEmployee: ReportSummary[];
  unmatchedForms: number;
};
```

## `src/app/lib/attendanceStats.ts` (whole file)

```ts
export const EXCUSED_STATUSES  = ['Excused (PTO/FH/Perm)'];
export const PERMISSION_STATUSES = ['Permission'];
export const ABSENT_STATUSES   = ['Absent - Unexplained'];

export type AttendanceRow = {
  email: string;
  name: string;
  date: string;
  entry_time: string | null;
  exit_time?: string | null;
  status: string;
  bucket: string | null;
  filed_gaf: boolean;
  minutes_late: number;
  period_name: string;
  time_off_kind: string | null;
  /** Live day: no payroll row yet, filled from Teramind (liveAttendance.ts). Never counted. */
  live?: boolean;
  live_label?: string;
};

/** Live days are shown but never counted in any number or rate. */
const official = (rows: AttendanceRow[]) => rows.filter(r => !r.live);
const liveLateOf = (rows: AttendanceRow[]) => rows.filter(r => r.live && r.minutes_late > 0).length;

export type EmpInfo = {
  email: string;
  name: string;
  role: string;
  manager: string;
  schedule_name: string;
  standard_start: string;
  standard_end: string;
};

export function isExcluded(status: string) {
  return EXCUSED_STATUSES.includes(status) || PERMISSION_STATUSES.includes(status);
}

export function isAbsent(status: string) {
  return ABSENT_STATUSES.includes(status);
}

export type EmpStats = {
  email: string;
  name: string;
  role: string;
  manager: string;
  schedule: string;
  days: number;
  onTime: number;
  totalLate: number;
  reported: number;
  unreported: number;
  excused: number;
  permission: number;
  absent: number;
  daysWorked: number;
  avgMinLate: number;
  pctOnTime: number;
  b1to10: number;
  b11to30: number;
  b31plus: number;
  /** GAF form reporting: filed = days with filed_gaf=true, needed = late+absent days */
  filing: { filed: number; needed: number };
  /** Live (not yet processed) days, and how many of them Teramind shows as late. Not in any rate. */
  liveDays: number;
  liveLate: number;
  rows: AttendanceRow[];   // includes live rows
};

export function computeEmployeeStats(
  rows: AttendanceRow[],
  empMap: Map<string, EmpInfo>,
  emails: Set<string>
): EmpStats[] {
  const byEmp = new Map<string, AttendanceRow[]>();
  emails.forEach(em => byEmp.set(em, []));
  rows.forEach(r => {
    if (emails.has(r.email)) byEmp.get(r.email)!.push(r);
  });

  return Array.from(byEmp.entries()).map(([email, allRows]) => {
    const info = empMap.get(email);
    const empRows = official(allRows);
    // active = rows that count toward on-time rate (excused & permission excluded)
    const active  = empRows.filter(r => !isExcluded(r.status));
    // arrived = active rows that are NOT an unexplained absence (have real arrival)
    const arrived = active.filter(r => !isAbsent(r.status));
    const absent  = active.filter(r => isAbsent(r.status)).length;
    const onTime       = arrived.filter(r => r.status === 'On Time').length;
    const reported     = arrived.filter(r => r.status === 'Late - Reported').length;
    const unreported   = arrived.filter(r => r.status === 'Late - Unreported').length;
    const excused      = empRows.filter(r => r.status === 'Excused (PTO/FH/Perm)').length;
    const permission   = empRows.filter(r => r.status === 'Permission').length;
    const sumMin       = arrived.reduce((s, r) => s + r.minutes_late, 0);
    const daysWorked   = arrived.length;
    const avgMinLate   = daysWorked > 0 ? sumMin / daysWorked : 0;
    const days         = active.length;   // includes absent rows → "expected"
    const pctOnTime    = days > 0 ? (onTime / days) * 100 : 0;
    const b1to10  = arrived.filter(r => r.bucket === 'late_1to10').length;
    const b11to30 = arrived.filter(r => r.bucket === 'late_11to30').length;
    const b31plus = arrived.filter(r => r.bucket === 'late_830plus').length;
    // Reporting: needed = late + absent days; filed = those with filed_gaf=true
    const needReporting = [...arrived.filter(r => r.status !== 'On Time'), ...active.filter(r => isAbsent(r.status))];
    const filedCount  = needReporting.filter(r => r.filed_gaf).length;
    const neededCount = needReporting.length;
    return {
      email,
      name: info?.name ?? email,
      role: info?.role ?? '',
      manager: info?.manager ?? '',
      schedule: info ? `${info.standard_start} – ${info.standard_end}` : '—',
      days, onTime, totalLate: reported + unreported,
      reported, unreported, excused, permission, absent, daysWorked,
      avgMinLate, pctOnTime, b1to10, b11to30, b31plus,
      filing: { filed: filedCount, needed: neededCount },
      liveDays: allRows.length - empRows.length,
      liveLate: liveLateOf(allRows),
      rows: allRows,
    };
  });
}

export type CompanyKpis = {
  daysTracked: number;     // expected days = on time + late + absent (rate denominator)
  onTime: number;
  lateReported: number;
  lateUnreported: number;
  lateDays: number;        // lateReported + lateUnreported
  excused: number;         // "Time off"
  permission: number;
  absent: number;
  reported: number;        // late or absent days with a form
  unreported: number;      // late or absent days without a form
  totalRows: number;
  workDays: number;        // every scheduled shift day, incl. time off and permission
  avgMinLate: number;      // over late days only
  onTimeRate: number;
  lateRate: number;
  /** List only: live days shown alongside, never counted above. */
  liveDays?: number;
  liveLate?: number;
};

export function computeCompanyKpis(allRows: AttendanceRow[]): CompanyKpis {
  const rows    = official(allRows);
  const active  = rows.filter(r => !isExcluded(r.status));
  const arrived = active.filter(r => !isAbsent(r.status));
  const onTime        = arrived.filter(r => r.status === 'On Time').length;
  const lateReported  = arrived.filter(r => r.status === 'Late - Reported').length;
  const lateUnreported = arrived.filter(r => r.status === 'Late - Unreported').length;
  const excused       = rows.filter(r => r.status === 'Excused (PTO/FH/Perm)').length;
  const permission    = rows.filter(r => r.status === 'Permission').length;
  const absent        = active.filter(r => isAbsent(r.status)).length;
  const lateRows      = arrived.filter(r => r.status === 'Late - Reported' || r.status === 'Late - Unreported');
  const sumLate       = lateRows.reduce((s, r) => s + r.minutes_late, 0);
  const lateDays      = lateReported + lateUnreported;
  const daysTracked   = active.length;   // expected (includes absent)
  const totalRows     = rows.length;
  const workDays      = totalRows;
  // List only knows unexplained absences, so every absence here is unreported
  const reported      = lateReported;
  const unreported    = lateUnreported + absent;
  const avgMinLate    = lateRows.length > 0 ? sumLate / lateRows.length : 0;
  const onTimeRate    = daysTracked > 0 ? (onTime / daysTracked) * 100 : 0;
  const lateRate      = daysTracked > 0 ? (lateDays / daysTracked) * 100 : 0;
  return {
    daysTracked, onTime, lateReported, lateUnreported, lateDays, excused, permission, absent,
    reported, unreported, totalRows, workDays, avgMinLate, onTimeRate, lateRate,
    liveDays: allRows.length - rows.length, liveLate: liveLateOf(allRows),
  };
}

// ── Arrival scatter (day-by-day) ──────────────────────────────────────────

export type ArrivalPoint = {
  date: string;       // "YYYY-MM-DD" — used as X label
  label: string;      // short formatted date
  minutesSinceMidnight: number | null;  // Y axis value
  color: string;      // dot color based on bucket/status
  status: string;
  entry_time: string | null;
  minutes_late: number;
};

/** Convert "HH:MM" (24h) string to minutes since midnight */
function hmToMinutes(hm: string | null): number | null {
  if (!hm) return null;
  const [h, m] = hm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

const BUCKET_COLORS: Record<string, string> = {
  'On Time':                '#2AA876',
  'late_1to10':             '#FBBF24',
  'late_11to30':            '#D97706',
  'late_830plus':           '#EF4444',
  'Excused (PTO/FH/Perm)':  '#94A3B8',
  'Permission':             '#6366F1',
  'Absent - Unexplained':   '#B91C1C',
};

function arrivalColor(row: AttendanceRow): string {
  if (row.status === 'Excused (PTO/FH/Perm)') return BUCKET_COLORS['Excused (PTO/FH/Perm)'];
  if (row.status === 'Permission')             return BUCKET_COLORS['Permission'];
  if (row.status === 'Absent - Unexplained')   return BUCKET_COLORS['Absent - Unexplained'];
  if (row.status === 'On Time')                return BUCKET_COLORS['On Time'];
  return BUCKET_COLORS[row.bucket ?? 'late_830plus'] ?? '#EF4444';
}

/** Normalize a date value that may arrive as a Date object or ISO string → "YYYY-MM-DD" */
function toDateStr(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val);
  return s.slice(0, 10);
}

function fmtShortDate(dateStr: string): string {
  const safe = toDateStr(dateStr);
  if (!safe) return '—';
  const d = new Date(safe + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

export function computeArrivalScatter(rows: AttendanceRow[]): ArrivalPoint[] {
  return [...rows]
    .map(r => ({ ...r, date: toDateStr(r.date) }))
    .filter(r => r.date.length === 10)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({
      date: r.date,
      label: fmtShortDate(r.date),
      minutesSinceMidnight: hmToMinutes(r.entry_time),
      color: arrivalColor(r),
      status: r.status,
      entry_time: r.entry_time,
      minutes_late: r.minutes_late,
    }));
}


```

## Report
- Byte size of the four files (each under 15,000); confirm no other file changed and that the
  app still builds (Attendance List and Reports render exactly as before).
