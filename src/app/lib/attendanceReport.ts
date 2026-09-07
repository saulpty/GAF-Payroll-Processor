// ---------------------------------------------------------------------------
// NO IMPORTS — intentional.
//
// This module is loaded directly by `node --test` (no bundler). Node cannot
// resolve extensionless relative imports, so importing from
// './classificationEngine' would break every test run. The pattern is copied
// from mondayResolve.ts: callers pass the three helpers through ReportInput
// instead. Do not add an import here, and do not copy any DST or work-day
// logic into this file — one copy lives in classificationEngine.ts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

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
  };
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AWAY_REQUEST_TYPES: string[] = [
  'PTO / Vacation',
  'Floating Holiday',
  'Birthday Day Off',
  'Compensatory Day',
  'Time Off / Permission',
];

export const SCORED_VERDICTS: string[] = [
  'on_time',
  'late_reported_on_time',
  'late_reported_late',
  'late_no_form',
  'absent_reported_on_time',
  'absent_reported_late',
  'unexplained_absence',
];

// Not-away pass-through request types (fall through verdict logic)
const PASSTHROUGH_REQUEST_TYPES = new Set([
  'Work From Home',
  'Work on a Holiday',
]);

const PTO_REQUEST_TYPES = new Set([
  'PTO / Vacation',
  'Floating Holiday',
  'Birthday Day Off',
  'Compensatory Day',
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Step a YYYY-MM-DD string forward by one day without new Date() for date math. */
function nextDate(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Convert YYYY-MM-DD to a Date at noon (DST-safe for isScheduledWorkDay). */
function ymdToDate(ymd: string): Date {
  return new Date(ymd + 'T12:00:00');
}

/** Parse "YYYY-MM-DD HH:MM" → { datePart: "YYYY-MM-DD", minutes: number } or null. */
function parseSubmittedAt(
  submittedAt: string | null,
): { datePart: string; minutes: number } | null {
  if (!submittedAt) return null;
  const spaceIdx = submittedAt.indexOf(' ');
  if (spaceIdx < 0) return null;
  const datePart = submittedAt.slice(0, 10);
  const timePart = submittedAt.slice(spaceIdx + 1); // "HH:MM"
  const [hStr, mStr] = timePart.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { datePart, minutes: h * 60 + m };
}

/** Build a ReportFormView for a given ReportForm and the scheduled-start of that day. */
function buildFormView(
  f: ReportForm,
  rowDate: string,
  scheduledStartMinutes: number,
): ReportFormView {
  const parsed = parseSubmittedAt(f.submitted_at);
  let submittedMinutes: number | null = null;
  let onTime = false;

  if (parsed) {
    if (parsed.datePart < rowDate) {
      // Submitted before the day — always on time
      onTime = true;
    } else if (parsed.datePart === rowDate) {
      submittedMinutes = parsed.minutes;
      onTime = parsed.minutes < scheduledStartMinutes;
    }
    // submitted_at date after the row date → not on time, submittedMinutes null
  }

  return {
    type: f.form_type,
    reason: f.reason,
    details: f.details,
    eta: f.eta,
    submittedAt: f.submitted_at,
    submittedMinutes,
    onTime,
    mondayItemId: f.monday_item_id,
  };
}

/** Does an away request cover a given date?
 *  Coverage: start_date <= date < return_date, or start_date <= date <= end_date when return_date is null.
 */
function requestCoversDate(r: ReportRequest, date: string): boolean {
  const s = r.start_date ?? '';
  if (!s || date < s) return false;
  if (r.return_date) {
    return date < r.return_date;
  }
  const e = r.end_date ?? r.start_date ?? '';
  return date <= e;
}

/** Is a date inside a processed period? */
function dateInProcessedPeriod(date: string, periods: ReportPeriod[]): boolean {
  for (const p of periods) {
    if (!p.processed_at) continue;
    if (!p.start_date || !p.end_date) continue;
    if (date >= p.start_date && date <= p.end_date) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function buildAttendanceReport(input: ReportInput): ReportOutput {
  const { dateFrom, dateTo, employees, payrollRows, forms, requests, holidays, periods, dstWindows, helpers } = input;
  const { isScheduledWorkDay, getSchedule, parseTimeToMinutes } = helpers;

  // Index payroll rows: empId → date → row
  const payrollIndex = new Map<number, Map<string, ReportPayrollRow>>();
  for (const row of payrollRows) {
    let empMap = payrollIndex.get(row.employee_id);
    if (!empMap) { empMap = new Map(); payrollIndex.set(row.employee_id, empMap); }
    // DISTINCT ON already applied in SQL; first encountered wins
    if (!empMap.has(row.work_date)) empMap.set(row.work_date, row);
  }

  // Index forms: empId → date → form[]
  const formIndex = new Map<number, Map<string, ReportForm[]>>();
  let unmatchedForms = 0;
  for (const f of forms) {
    if (f.employee_id == null) { unmatchedForms++; continue; }
    let empMap = formIndex.get(f.employee_id);
    if (!empMap) { empMap = new Map(); formIndex.set(f.employee_id, empMap); }
    const arr = empMap.get(f.form_date) ?? [];
    arr.push(f);
    empMap.set(f.form_date, arr);
  }

  // Sort each employee's forms per date by submitted_at asc, nulls last
  for (const empMap of formIndex.values()) {
    for (const [date, arr] of empMap) {
      arr.sort((a, b) => {
        if (!a.submitted_at && !b.submitted_at) return 0;
        if (!a.submitted_at) return 1;
        if (!b.submitted_at) return -1;
        return a.submitted_at < b.submitted_at ? -1 : a.submitted_at > b.submitted_at ? 1 : 0;
      });
      empMap.set(date, arr);
    }
  }

  // Index requests per employee
  const requestIndex = new Map<number, ReportRequest[]>();
  for (const r of requests) {
    const arr = requestIndex.get(r.employee_id) ?? [];
    arr.push(r);
    requestIndex.set(r.employee_id, arr);
  }

  // Holiday set: date → name
  const holidayMap = new Map<string, string>();
  for (const h of holidays) holidayMap.set(h.date, h.name);

  // Employee map for fast lookup
  const empMap = new Map<number, ReportEmployee>();
  for (const e of employees) empMap.set(e.id, e);

  const rows: ReportRow[] = [];
  const summaries: ReportSummary[] = [];

  for (const emp of employees) {
    // Build EmployeeRecord shape expected by classificationEngine helpers
    const engEmp = {
      standard_start: emp.standard_start,
      standard_end: emp.standard_end,
      dst_start: emp.dst_start,
      dst_end: emp.dst_end,
      grace_minutes: emp.grace_minutes,
      work_days: emp.work_days,
    };

    const empPayroll = payrollIndex.get(emp.id) ?? new Map();
    const empForms = formIndex.get(emp.id) ?? new Map();
    const empRequests = requestIndex.get(emp.id) ?? [];

    let expectedDays = 0, onTimeCt = 0, lateDays = 0, lateDaysWithoutForm = 0;
    let unexplainedAbsences = 0, awayDays = 0, formsFiled = 0, formsOnTime = 0;

    // Iterate every date in [dateFrom, dateTo]
    let cur = dateFrom;
    while (cur <= dateTo) {
      const date = cur;
      cur = nextDate(cur);

      const dateObj = ymdToDate(date);

      // Rule 1: skip non-work days
      if (!isScheduledWorkDay(dateObj, emp.work_days)) continue;

      // Rule 2: skip before employee's start date
      if (emp.start_date && date < emp.start_date) continue;

      // Determine scheduled start
      const sched = getSchedule(engEmp, dateObj, dstWindows);
      const payrollRow = empPayroll.get(date) ?? null;
      const scheduledStart = (payrollRow?.scheduled_start) || sched.start;
      const scheduledStartMinutes = parseTimeToMinutes(scheduledStart);

      // Collect forms for this date
      const rawForms = empForms.get(date) ?? [];
      const allForms: ReportFormView[] = rawForms.map(f =>
        buildFormView(f, date, scheduledStartMinutes)
      );
      const form: ReportFormView | null = allForms[0] ?? null;

      // Verdict determination
      let verdict: Verdict;
      let coveredBy: ReportRow['coveredBy'] = null;

      // Check holiday
      const holidayName = holidayMap.get(date);
      if (holidayName) {
        verdict = 'holiday';
        coveredBy = { kind: 'holiday', label: holidayName };
      } else {
        // Check away requests
        const awayRequest = empRequests.find(r => {
          if (PASSTHROUGH_REQUEST_TYPES.has(r.request_type)) return false;
          if (!AWAY_REQUEST_TYPES.includes(r.request_type)) return false;
          return requestCoversDate(r, date);
        });

        if (awayRequest) {
          verdict = PTO_REQUEST_TYPES.has(awayRequest.request_type) ? 'pto' : 'permission';
          coveredBy = { kind: verdict as 'pto' | 'permission', label: awayRequest.request_type };
        } else if (!dateInProcessedPeriod(date, periods)) {
          verdict = 'not_processed';
        } else if (payrollRow && payrollRow.entry_time != null) {
          // Has punches
          if (payrollRow.late_minutes > 0) {
            if (!form) verdict = 'late_no_form';
            else if (form.onTime) verdict = 'late_reported_on_time';
            else verdict = 'late_reported_late';
          } else {
            verdict = 'on_time';
          }
        } else {
          // No punches
          if (form) {
            verdict = form.onTime ? 'absent_reported_on_time' : 'absent_reported_late';
          } else {
            verdict = 'unexplained_absence';
          }
        }
      }

      const countsToScore = SCORED_VERDICTS.includes(verdict);

      // Flags
      const multipleForms = allForms.length > 1;
      const recordedUnexplainedButFormOnFile =
        (payrollRow?.event_type_1 === 'Ausencia Injustificada') && form !== null;
      const winningForm = rawForms[0] ?? null;
      const formEmailUnrecognised =
        winningForm != null &&
        winningForm.employee_email_raw.trim() !== '' &&
        winningForm.employee_email_raw.trim().toLowerCase() !== emp.email.toLowerCase();

      // Accumulators
      if (countsToScore) expectedDays++;
      if (verdict === 'on_time') onTimeCt++;
      if (verdict === 'late_reported_on_time' || verdict === 'late_reported_late' || verdict === 'late_no_form') lateDays++;
      if (verdict === 'late_no_form') lateDaysWithoutForm++;
      if (verdict === 'unexplained_absence') unexplainedAbsences++;
      if (verdict === 'pto' || verdict === 'permission' || verdict === 'holiday') awayDays++;
      if (allForms.length > 0) formsFiled++;
      if (form?.onTime) formsOnTime++;

      rows.push({
        employeeId: emp.id,
        employeeName: emp.name,
        email: emp.email,
        role: emp.role,
        manager: emp.manager,
        date,
        scheduledStart,
        entryTime: payrollRow?.entry_time ?? null,
        exitTime: payrollRow?.exit_time ?? null,
        minutesLate: payrollRow?.late_minutes ?? 0,
        earlyLeaveMinutes: payrollRow?.early_leave_minutes ?? 0,
        form,
        allForms,
        coveredBy,
        verdict,
        countsToScore,
        flags: { multipleForms, recordedUnexplainedButFormOnFile, formEmailUnrecognised },
      });
    }

    summaries.push({
      employeeId: emp.id,
      employeeName: emp.name,
      role: emp.role,
      manager: emp.manager,
      expectedDays,
      onTime: onTimeCt,
      lateDays,
      lateDaysWithoutForm,
      unexplainedAbsences,
      awayDays,
      formsFiled,
      formsOnTime,
      onTimeRate: expectedDays > 0 ? (onTimeCt / expectedDays) * 100 : null,
    });
  }

  // Sort rows: date asc, then employeeName asc
  rows.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return a.employeeName.localeCompare(b.employeeName);
  });

  return { rows, perEmployee: summaries, unmatchedForms };
}
