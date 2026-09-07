// ---------------------------------------------------------------------------
// NO RUNTIME IMPORTS — intentional.
//
// This module is loaded directly by `node --test` (no bundler). Node cannot
// resolve extensionless relative imports, so importing from
// './classificationEngine' would break every test run. The pattern is copied
// from mondayResolve.ts: callers pass the three helpers through ReportInput
// instead. Do not add a runtime import here, and do not copy any DST or
// work-day logic into this file — one copy lives in classificationEngine.ts.
//
// `import type` is erased before the code runs, so the types file path is
// never resolved by Node's module loader at runtime.
// ---------------------------------------------------------------------------

import type {
  ReportEmployee, ReportPayrollRow, ReportForm, ReportRequest, ReportPeriod,
  ReportHoliday, Verdict, ReportFormView, ReportRow, ReportSummary,
  ReportHelpers, ReportInput, ReportOutput,
} from './attendanceReportTypes';

// Re-export all types so importers of this file continue to work unchanged.
export type {
  ReportEmployee, ReportPayrollRow, ReportForm, ReportRequest, ReportPeriod,
  ReportHoliday, Verdict, ReportFormView, ReportRow, ReportSummary,
  ReportHelpers, ReportInput, ReportOutput,
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

/** Postgres hands back a DATE as "2026-06-01T00:00:00.000Z" through ::text.
 *  Every date in this module is a plain YYYY-MM-DD string. */
function ymd(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : '';
}

/** Step a YYYY-MM-DD string forward by one day without new Date() for date math. */
function nextDate(s: string): string {
  const d = new Date(s + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Convert YYYY-MM-DD to a Date at noon (DST-safe for isScheduledWorkDay). */
function ymdToDate(s: string): Date {
  return new Date(s + 'T12:00:00');
}

/** Parse "YYYY-MM-DD HH:MM" → { datePart: "YYYY-MM-DD", minutes: number } or null.
 *  submitted_at keeps its full value; only its date part is compared as a day. */
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
  const s = ymd(r.start_date ?? '');
  if (!s || date < s) return false;
  if (r.return_date) {
    return date < ymd(r.return_date);
  }
  const e = ymd(r.end_date ?? r.start_date ?? '');
  return date <= e;
}

/** Is a date inside a processed period? */
function dateInProcessedPeriod(date: string, periods: ReportPeriod[]): boolean {
  for (const p of periods) {
    if (!p.processed_at) continue;
    if (!p.start_date || !p.end_date) continue;
    if (date >= ymd(p.start_date) && date <= ymd(p.end_date)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function buildAttendanceReport(input: ReportInput): ReportOutput {
  const { dateFrom, dateTo, employees, payrollRows, forms, requests, holidays, periods, dstWindows, helpers } = input;
  const { isScheduledWorkDay, getSchedule, parseTimeToMinutes } = helpers;

  // ── Index payroll rows: String(empId) → date → row ──────────────────────
  // Normalise at the boundary: ymd() strips T00:00:00.000Z; String() makes
  // bigint-as-string and bigint-as-number land on the same key.
  const payrollIndex = new Map<string, Map<string, ReportPayrollRow>>();
  for (const row of payrollRows) {
    const empId = String(row.employee_id);
    const workDate = ymd(row.work_date);
    if (!workDate) continue;
    let empMap = payrollIndex.get(empId);
    if (!empMap) { empMap = new Map(); payrollIndex.set(empId, empMap); }
    // DISTINCT ON already applied in SQL; first encountered wins
    if (!empMap.has(workDate)) empMap.set(workDate, row);
  }

  // ── Index forms: String(empId) → date → form[] ──────────────────────────
  const formIndex = new Map<string, Map<string, ReportForm[]>>();
  let unmatchedForms = 0;
  for (const f of forms) {
    if (f.employee_id == null) { unmatchedForms++; continue; }
    const empId = String(f.employee_id);
    const formDate = ymd(f.form_date);
    if (!formDate) continue;
    let empMap = formIndex.get(empId);
    if (!empMap) { empMap = new Map(); formIndex.set(empId, empMap); }
    const arr = empMap.get(formDate) ?? [];
    arr.push(f);
    empMap.set(formDate, arr);
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

  // ── Index requests: String(empId) → ReportRequest[] ─────────────────────
  const requestIndex = new Map<string, ReportRequest[]>();
  for (const r of requests) {
    const empId = String(r.employee_id);
    const arr = requestIndex.get(empId) ?? [];
    arr.push(r);
    requestIndex.set(empId, arr);
  }

  // ── Holiday set: date → name ─────────────────────────────────────────────
  const holidayMap = new Map<string, string>();
  for (const h of holidays) {
    const d = ymd(h.date);
    if (d) holidayMap.set(d, h.name);
  }

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

    const empIdStr = String(emp.id);
    const empPayroll = payrollIndex.get(empIdStr) ?? new Map();
    const empForms   = formIndex.get(empIdStr)   ?? new Map();
    const empRequests = requestIndex.get(empIdStr) ?? [];

    // Normalise employee start_date once
    const empStartDate = ymd(emp.start_date);

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
      if (empStartDate && date < empStartDate) continue;

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
