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
