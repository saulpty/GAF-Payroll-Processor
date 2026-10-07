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
