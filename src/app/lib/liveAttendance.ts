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
