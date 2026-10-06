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
