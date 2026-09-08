import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAttendanceReport,
  type ReportEmployee, type ReportPayrollRow, type ReportForm,
  type ReportRequest, type ReportPeriod, type ReportInput,
} from '../src/app/lib/attendanceReport.ts';
import {
  isScheduledWorkDay, getSchedule, parseTimeToMinutes,
} from '../src/app/lib/classificationEngine.ts';

// attendanceReport.ts has no imports of its own — the same rule mondayResolve.ts
// follows, so Node's TypeScript loader can load it directly. Callers hand it the
// engine's own helpers rather than the module growing a second copy of the
// work-day gate or the DST rule.
const helpers = { isScheduledWorkDay, getSchedule, parseTimeToMinutes };

// ── fixtures ──────────────────────────────────────────────────────────────
// Ana works Mon–Fri, 9:00 AM start. The processed period covers all of June.

const emp = (over: Partial<ReportEmployee> = {}): ReportEmployee => ({
  id: 1, name: 'Ana', email: 'ana@x.com', role: 'Intake 1', manager: 'Marcela Gordon',
  work_days: 'Mon,Tue,Wed,Thu,Fri', start_date: '2026-01-01',
  standard_start: '9:00 AM', standard_end: '5:00 PM',
  dst_start: '9:00 AM', dst_end: '5:00 PM', grace_minutes: 10, ...over,
});

const pay = (over: Partial<ReportPayrollRow> = {}): ReportPayrollRow => ({
  employee_id: 1, work_date: '2026-06-01', entry_time: '9:00 AM', exit_time: '5:00 PM',
  scheduled_start: '9:00 AM', late_minutes: 0, early_leave_minutes: 0,
  event_type_1: '', documentation: '', auto_notes: '', period_name: 'Q1-Jun-2026', ...over,
});

const form = (over: Partial<ReportForm> = {}): ReportForm => ({
  employee_id: 1, form_date: '2026-06-01', form_type: 'Tardiness', reason: '', details: '',
  eta: '', submitted_at: '2026-06-01 08:30', employee_email_raw: 'ana@x.com',
  monday_item_id: '1', ...over,
});

const req = (over: Partial<ReportRequest> = {}): ReportRequest => ({
  employee_id: 1, request_type: 'PTO / Vacation', permission_type: '',
  start_date: '2026-06-08', end_date: '2026-06-10', return_date: '2026-06-11', ...over,
});

const period: ReportPeriod = {
  period_name: 'Q1-Jun-2026', start_date: '2026-06-01', end_date: '2026-06-30',
  processed_at: '2026-07-01',
};

const DST = [{ year: 2026, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }];

const build = (over: Partial<ReportInput> = {}) => buildAttendanceReport({
  dateFrom: '2026-06-01', dateTo: '2026-06-01',
  employees: [emp()], payrollRows: [], forms: [], requests: [],
  holidays: [], periods: [period], dstWindows: DST, helpers, ...over,
});

const only = (input: Partial<ReportInput> = {}) => {
  const r = build(input);
  assert.equal(r.rows.length, 1, `expected exactly 1 row, got ${r.rows.length}`);
  return r.rows[0];
};

// ── the shape of a day ────────────────────────────────────────────────────

test('R1: a punctual day is on_time and counts toward the score', () => {
  const row = only({ payrollRows: [pay()] });
  assert.equal(row.verdict, 'on_time');
  assert.equal(row.countsToScore, true);
  assert.equal(row.entryTime, '9:00 AM');
  assert.equal(row.form, null);
});

test('R2: late with no form is late_no_form', () => {
  const row = only({ payrollRows: [pay({ entry_time: '9:20 AM', late_minutes: 20 })] });
  assert.equal(row.verdict, 'late_no_form');
  assert.equal(row.minutesLate, 20);
  assert.equal(row.countsToScore, true);
});

test('R3: late with a form filed before the shift is late_reported_on_time', () => {
  const row = only({
    payrollRows: [pay({ entry_time: '9:20 AM', late_minutes: 20 })],
    forms: [form({ submitted_at: '2026-06-01 08:30' })],
  });
  assert.equal(row.verdict, 'late_reported_on_time');
  assert.equal(row.form?.onTime, true);
});

test('R4: one minute before the shift still counts as on time', () => {
  const row = only({
    payrollRows: [pay({ entry_time: '9:20 AM', late_minutes: 20 })],
    forms: [form({ submitted_at: '2026-06-01 08:59' })],
  });
  assert.equal(row.verdict, 'late_reported_on_time');
});

test('R5: a form filed exactly at the shift start is late — the policy says before', () => {
  const row = only({
    payrollRows: [pay({ entry_time: '9:20 AM', late_minutes: 20 })],
    forms: [form({ submitted_at: '2026-06-01 09:00' })],
  });
  assert.equal(row.verdict, 'late_reported_late');
  assert.equal(row.form?.onTime, false);
});

test('R6: one minute after the shift start is late', () => {
  const row = only({
    payrollRows: [pay({ entry_time: '9:20 AM', late_minutes: 20 })],
    forms: [form({ submitted_at: '2026-06-01 09:01' })],
  });
  assert.equal(row.verdict, 'late_reported_late');
});

test('R7: a form filed the day before is on time', () => {
  const row = only({
    payrollRows: [pay({ entry_time: '9:20 AM', late_minutes: 20 })],
    forms: [form({ submitted_at: '2026-05-29 16:00' })],
  });
  assert.equal(row.form?.onTime, true);
});

// ── absence ───────────────────────────────────────────────────────────────

test('R8: no punches and no form is an unexplained absence, and it counts', () => {
  const row = only({ payrollRows: [pay({ entry_time: null, exit_time: null })] });
  assert.equal(row.verdict, 'unexplained_absence');
  assert.equal(row.countsToScore, true);
});

test('R9: no punches with an Absence form filed early is absent_reported_on_time', () => {
  const row = only({
    payrollRows: [pay({ entry_time: null, exit_time: null })],
    forms: [form({ form_type: 'Absence', reason: 'Sick', submitted_at: '2026-06-01 07:05' })],
  });
  assert.equal(row.verdict, 'absent_reported_on_time');
  assert.equal(row.form?.reason, 'Sick');
});

test('R10: no punches with an Absence form filed after the shift began', () => {
  const row = only({
    payrollRows: [pay({ entry_time: null, exit_time: null })],
    forms: [form({ form_type: 'Absence', reason: 'Sick', submitted_at: '2026-06-01 11:51' })],
  });
  assert.equal(row.verdict, 'absent_reported_late');
});

test('R11: a Tardiness form on a day with no punches still explains the day', () => {
  // They said they would be late and never arrived. It is reported, not silent.
  const row = only({
    payrollRows: [pay({ entry_time: null, exit_time: null })],
    forms: [form({ form_type: 'Tardiness', submitted_at: '2026-06-01 08:47' })],
  });
  assert.equal(row.verdict, 'absent_reported_on_time');
  assert.equal(row.form?.type, 'Tardiness');
});

test('R12: an absence with no payroll row at all is still an unexplained absence', () => {
  // The engine does not always write a row. A silent gap must not vanish.
  const row = only({ payrollRows: [] });
  assert.equal(row.verdict, 'unexplained_absence');
});

// ── days that do not count against the score ──────────────────────────────

test('R13: a company holiday does not count toward the score', () => {
  const row = only({ holidays: [{ date: '2026-06-01', name: 'Test Holiday' }] });
  assert.equal(row.verdict, 'holiday');
  assert.equal(row.countsToScore, false);
  assert.equal(row.coveredBy?.label, 'Test Holiday');
});

test('R14: a PTO day does not count toward the score', () => {
  const row = only({
    dateFrom: '2026-06-08', dateTo: '2026-06-08',
    requests: [req()],
  });
  assert.equal(row.verdict, 'pto');
  assert.equal(row.countsToScore, false);
});

test('R15: return_date is exclusive — the day back is a normal day', () => {
  const row = only({
    dateFrom: '2026-06-11', dateTo: '2026-06-11',
    payrollRows: [pay({ work_date: '2026-06-11' })],
    requests: [req()],
  });
  assert.equal(row.verdict, 'on_time');
});

test('R16: with no return_date, end_date is inclusive', () => {
  const row = only({
    dateFrom: '2026-06-10', dateTo: '2026-06-10',
    requests: [req({ return_date: null })],
  });
  assert.equal(row.verdict, 'pto');
});

test('R17: a permission is its own verdict and does not count', () => {
  const row = only({
    dateFrom: '2026-06-08', dateTo: '2026-06-08',
    requests: [req({ request_type: 'Time Off / Permission' })],
  });
  assert.equal(row.verdict, 'permission');
  assert.equal(row.countsToScore, false);
});

test('R18: Birthday Day Off, Floating Holiday and Compensatory Day are all away days', () => {
  for (const t of ['Birthday Day Off', 'Floating Holiday', 'Compensatory Day']) {
    const row = only({
      dateFrom: '2026-06-08', dateTo: '2026-06-08',
      requests: [req({ request_type: t })],
    });
    assert.equal(row.countsToScore, false, `${t} should not count`);
  }
});

test('R19: Work From Home is NOT an away day — they were working', () => {
  const row = only({
    dateFrom: '2026-06-08', dateTo: '2026-06-08',
    payrollRows: [pay({ work_date: '2026-06-08' })],
    requests: [req({ request_type: 'Work From Home' })],
  });
  assert.equal(row.verdict, 'on_time');
  assert.equal(row.countsToScore, true);
});

// ── days that produce no row at all ───────────────────────────────────────

test('R20: weekends produce no rows for a Mon-Fri employee', () => {
  // 2026-06-06 is a Saturday, 06-07 a Sunday.
  const r = build({ dateFrom: '2026-06-06', dateTo: '2026-06-07' });
  assert.equal(r.rows.length, 0);
});

test('R21: a Fri-to-Mon permission does not manufacture weekend rows', () => {
  const r = build({
    dateFrom: '2026-06-05', dateTo: '2026-06-08',
    requests: [req({ request_type: 'Time Off / Permission', start_date: '2026-06-05', end_date: '2026-06-08', return_date: '2026-06-09' })],
  });
  assert.deepEqual(r.rows.map(x => x.date), ['2026-06-05', '2026-06-08']);
});

test('R22: nothing is reported before the employee started', () => {
  const r = build({ employees: [emp({ start_date: '2026-06-15' })] });
  assert.equal(r.rows.length, 0);
});

test('R23: a weekend-shift employee gets rows on Saturday, not Monday', () => {
  const weekend = emp({ work_days: 'Wed,Thu,Fri,Sat,Sun' });
  const r = build({ dateFrom: '2026-06-01', dateTo: '2026-06-06', employees: [weekend] });
  assert.deepEqual(r.rows.map(x => x.date), ['2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06']);
});

// ── periods that have not been run ────────────────────────────────────────

test('R24: a day after the last processed period is not_processed, and does not count', () => {
  const row = only({
    dateFrom: '2026-07-06', dateTo: '2026-07-06',
    periods: [period], // June only
  });
  assert.equal(row.verdict, 'not_processed');
  assert.equal(row.countsToScore, false);
});

test('R25: a period that exists but has not been processed is also not_processed', () => {
  const row = only({
    dateFrom: '2026-07-06', dateTo: '2026-07-06',
    periods: [period, { period_name: 'Q1-Jul-2026', start_date: '2026-07-01', end_date: '2026-07-15', processed_at: null }],
  });
  assert.equal(row.verdict, 'not_processed');
});

test('R26: a form on an unprocessed day is still shown', () => {
  const row = only({
    dateFrom: '2026-07-06', dateTo: '2026-07-06',
    forms: [form({ form_date: '2026-07-06', form_type: 'Absence', reason: 'Sick', submitted_at: '2026-07-06 07:00' })],
  });
  assert.equal(row.verdict, 'not_processed');
  assert.equal(row.form?.reason, 'Sick');
});

// ── the traps found in the live data ──────────────────────────────────────

test('R27: two forms on one day — the earliest submission wins, and it is flagged', () => {
  const row = only({
    payrollRows: [pay({ entry_time: null })],
    forms: [
      form({ monday_item_id: '2', form_type: 'Absence', reason: 'Sick', submitted_at: '2026-06-01 11:51' }),
      form({ monday_item_id: '1', form_type: 'Tardiness', submitted_at: '2026-06-01 08:47' }),
    ],
  });
  assert.equal(row.form?.mondayItemId, '1');
  assert.equal(row.flags.multipleForms, true);
  assert.equal(row.allForms.length, 2);
});

test('R28: a row recorded Ausencia Injustificada with a form on file is flagged', () => {
  // 13 of these exist live. The report must show the contradiction, not hide it.
  const row = only({
    payrollRows: [pay({ entry_time: null, event_type_1: 'Ausencia Injustificada', auto_notes: 'NO DATA + NO FORM (Suggested: Unpaid)' })],
    forms: [form({ form_type: 'Absence', reason: 'Sick', submitted_at: '2026-06-01 07:30' })],
  });
  assert.equal(row.verdict, 'absent_reported_on_time');
  assert.equal(row.flags.recordedUnexplainedButFormOnFile, true);
});

test('R29: a form filed under an unrecognised email is flagged', () => {
  // 113 such forms exist; the payroll engine cannot see any of them.
  const row = only({
    payrollRows: [pay({ entry_time: '9:20 AM', late_minutes: 20 })],
    forms: [form({ employee_email_raw: 'ana.personal@gmail.com', submitted_at: '2026-06-01 08:30' })],
  });
  assert.equal(row.flags.formEmailUnrecognised, true);
  assert.equal(row.verdict, 'late_reported_on_time');
});

test('R30: a matching email is not flagged, whatever its casing', () => {
  const row = only({
    payrollRows: [pay({ entry_time: '9:20 AM', late_minutes: 20 })],
    forms: [form({ employee_email_raw: 'ANA@X.COM' })],
  });
  assert.equal(row.flags.formEmailUnrecognised, false);
});

test('R31: a form belonging to nobody is counted, not silently dropped', () => {
  const r = build({
    payrollRows: [pay()],
    forms: [form(), { ...form(), employee_id: null as unknown as number, monday_item_id: '9' }],
  });
  assert.equal(r.unmatchedForms, 1);
});

test('R32: a later shift start moves the on-time boundary with it', () => {
  // Favian starts at 10:00. A form at 09:30 is early for him, late for Ana.
  const favian = emp({ id: 2, name: 'Favian', email: 'f@x.com', standard_start: '10:00 AM', dst_start: '10:00 AM' });
  const row = only({
    employees: [favian],
    payrollRows: [pay({ employee_id: 2, entry_time: '10:20 AM', late_minutes: 20, scheduled_start: '10:00 AM' })],
    forms: [form({ employee_id: 2, employee_email_raw: 'f@x.com', submitted_at: '2026-06-01 09:30' })],
  });
  assert.equal(row.verdict, 'late_reported_on_time');
});

test('R33: the shift start comes from the payroll row when it has one', () => {
  const row = only({ payrollRows: [pay({ scheduled_start: '8:00 AM' })] });
  assert.equal(row.scheduledStart, '8:00 AM');
});

test('R34: with no payroll row the shift start falls back to the schedule', () => {
  const row = only({ payrollRows: [] });
  assert.equal(row.scheduledStart, '9:00 AM');
});

test('R35: a form with no submitted_at is shown but never counted as on time', () => {
  const row = only({
    payrollRows: [pay({ entry_time: '9:20 AM', late_minutes: 20 })],
    forms: [form({ submitted_at: null })],
  });
  assert.equal(row.form?.onTime, false);
  assert.equal(row.verdict, 'late_reported_late');
});

// ── the per-employee summary ──────────────────────────────────────────────

test('R36: the summary scores presence and ignores away days', () => {
  const r = build({
    dateFrom: '2026-06-01', dateTo: '2026-06-10',
    payrollRows: [
      pay({ work_date: '2026-06-01' }),                                        // on time
      pay({ work_date: '2026-06-02', entry_time: '9:30 AM', late_minutes: 30 }), // late, no form
      pay({ work_date: '2026-06-03', entry_time: null }),                       // unexplained
      pay({ work_date: '2026-06-04' }),                                        // on time
      pay({ work_date: '2026-06-05' }),                                        // on time
    ],
    requests: [req()], // 06-08 → 06-10 PTO
  });
  const s = r.perEmployee[0];
  assert.equal(s.expectedDays, 5);        // 5 work days; PTO days excluded
  assert.equal(s.onTime, 3);
  assert.equal(s.lateDays, 1);
  assert.equal(s.unexplainedAbsences, 1);
  assert.equal(s.awayDays, 3);
  assert.equal(Math.round(s.onTimeRate), 60);   // 3 of 5
});

test('R37: forms-on-time is counted over the days that had a form', () => {
  const r = build({
    dateFrom: '2026-06-01', dateTo: '2026-06-03',
    payrollRows: [
      pay({ work_date: '2026-06-01', entry_time: '9:20 AM', late_minutes: 20 }),
      pay({ work_date: '2026-06-02', entry_time: '9:20 AM', late_minutes: 20 }),
      pay({ work_date: '2026-06-03', entry_time: '9:20 AM', late_minutes: 20 }),
    ],
    forms: [
      form({ form_date: '2026-06-01', submitted_at: '2026-06-01 08:30' }),
      form({ form_date: '2026-06-02', submitted_at: '2026-06-02 09:30' }),
    ],
  });
  const s = r.perEmployee[0];
  assert.equal(s.formsFiled, 2);
  assert.equal(s.formsOnTime, 1);
  assert.equal(s.lateDaysWithoutForm, 1);
});

test('R38: an employee with only away days has no score, not a zero score', () => {
  const r = build({
    dateFrom: '2026-06-08', dateTo: '2026-06-10',
    requests: [req()],
  });
  const s = r.perEmployee[0];
  assert.equal(s.expectedDays, 0);
  assert.equal(s.onTimeRate, null);
});

test('R39: employees are summarised even when they have no rows in range', () => {
  const r = build({ dateFrom: '2026-06-06', dateTo: '2026-06-07' }); // weekend
  assert.equal(r.perEmployee.length, 1);
  assert.equal(r.perEmployee[0].expectedDays, 0);
});

// ── ordering and DST ──────────────────────────────────────────────────────

test('R40: rows come back sorted by date, then by employee name', () => {
  const bob = emp({ id: 2, name: 'Bob', email: 'b@x.com' });
  const r = build({
    dateFrom: '2026-06-01', dateTo: '2026-06-02',
    employees: [bob, emp()],
    payrollRows: [pay({ work_date: '2026-06-01' }), pay({ work_date: '2026-06-02' })],
  });
  assert.deepEqual(
    r.rows.map(x => `${x.date} ${x.employeeName}`),
    ['2026-06-01 Ana', '2026-06-01 Bob', '2026-06-02 Ana', '2026-06-02 Bob'],
  );
});

test('R41: a schedule whose summer and winter starts differ uses the right one', () => {
  const shifting = emp({ standard_start: '9:00 AM', dst_start: '10:00 AM' });
  const summer = only({
    dateFrom: '2026-06-01', dateTo: '2026-06-01', employees: [shifting], payrollRows: [],
  });
  assert.equal(summer.scheduledStart, '10:00 AM');

  const winterPeriod: ReportPeriod = {
    period_name: 'Q1-Dec-2026', start_date: '2026-12-01', end_date: '2026-12-31', processed_at: '2027-01-01',
  };
  const r = buildAttendanceReport({
    dateFrom: '2026-12-01', dateTo: '2026-12-01',
    employees: [shifting], payrollRows: [], forms: [], requests: [],
    holidays: [], periods: [winterPeriod], dstWindows: DST, helpers,
  });
  assert.equal(r.rows[0].scheduledStart, '9:00 AM');
});

test('R42: dates are compared as strings — no row drifts a day', () => {
  const r = build({
    dateFrom: '2026-06-01', dateTo: '2026-06-05',
    payrollRows: [pay({ work_date: '2026-06-03' })],
  });
  const dated = r.rows.find(x => x.date === '2026-06-03');
  assert.equal(dated?.entryTime, '9:00 AM');
  assert.equal(r.rows.filter(x => x.entryTime !== null).length, 1);
});

// ── what Postgres actually hands back ─────────────────────────────────────
// docs/LESSONS.md: "Postgres hands back full timestamps — slice to 10."
// A DATE column read through ::text arrives as "2026-06-01T00:00:00.000Z", and
// a BIGINT can arrive as a string. The module must survive both, because the
// alternative is a silent miss that renders every day as an absence.

test('R43: ISO timestamps from a DATE column still match the day', () => {
  const row = only({
    payrollRows: [pay({ work_date: '2026-06-01T00:00:00.000Z' })],
    periods: [{ ...period, start_date: '2026-06-01T00:00:00.000Z', end_date: '2026-06-30T00:00:00.000Z' }],
  });
  assert.equal(row.verdict, 'on_time');
  assert.equal(row.date, '2026-06-01');
});

test('R44: an ISO form_date and an ISO request window still line up', () => {
  const row = only({
    payrollRows: [pay({ entry_time: '9:20 AM', late_minutes: 20 })],
    forms: [form({ form_date: '2026-06-01T00:00:00.000Z', submitted_at: '2026-06-01 08:30' })],
  });
  assert.equal(row.verdict, 'late_reported_on_time');

  const away = only({
    dateFrom: '2026-06-08', dateTo: '2026-06-08',
    requests: [req({
      start_date: '2026-06-08T00:00:00.000Z',
      end_date: '2026-06-10T00:00:00.000Z',
      return_date: '2026-06-11T00:00:00.000Z',
    })],
  });
  assert.equal(away.verdict, 'pto');
});

test('R45: an ISO start_date does not hide a day the employee worked', () => {
  const row = only({
    employees: [emp({ start_date: '2026-01-01T00:00:00.000Z' })],
    payrollRows: [pay()],
  });
  assert.equal(row.verdict, 'on_time');
});

test('R46: ids match whether they arrive as numbers or as strings', () => {
  // BIGINT commonly arrives as a string. If the employee and the punch row
  // disagree, every lookup misses and every day becomes an absence.
  const row = only({
    employees: [emp({ id: 1 })],
    payrollRows: [{ ...pay(), employee_id: '1' as unknown as number }],
    forms: [{ ...form(), employee_id: '1' as unknown as number, submitted_at: '2026-06-01 08:30' }],
  });
  assert.equal(row.verdict, 'on_time');
  assert.equal(row.form?.mondayItemId, '1');
});

test('R47: an ISO holiday date still cancels the day', () => {
  const row = only({ holidays: [{ date: '2026-06-01T00:00:00.000Z', name: 'Test Holiday' }] });
  assert.equal(row.verdict, 'holiday');
});

// ── review findings, 2026-09-08 ───────────────────────────────────────────
// Found by an adversarial pass over the day's work, confirmed against the code.

test('R48: a form whose submitted_at has no time is not automatically "filed late"', () => {
  // syncAttendanceForms writes submitted_at verbatim from Monday and says so:
  // "may include time on some Monday column types". A date-only value used to
  // return null from the parser, which left onTime false — so a form filed two
  // days EARLY was reported as filed late.
  const row = only({
    payrollRows: [pay({ entry_time: null })],
    forms: [form({ form_type: 'Absence', reason: 'Sick', submitted_at: '2026-05-29' })],
  });
  assert.equal(row.verdict, 'absent_reported_on_time');
  assert.equal(row.form?.onTime, true);
});

test('R49: a date-only submitted_at on the same day is not counted as on time', () => {
  // Without a clock time there is no evidence it beat the shift. Not proven
  // late either — but the policy claim we can defend is "not proven on time".
  const row = only({
    payrollRows: [pay({ entry_time: '9:20 AM', late_minutes: 20 })],
    forms: [form({ submitted_at: '2026-06-01' })],
  });
  assert.equal(row.form?.onTime, false);
  assert.equal(row.form?.submittedMinutes, null);
});

test('R50: an ISO T separator in submitted_at parses like a space', () => {
  const row = only({
    payrollRows: [pay({ entry_time: '9:20 AM', late_minutes: 20 })],
    forms: [form({ submitted_at: '2026-06-01T08:30' })],
  });
  assert.equal(row.verdict, 'late_reported_on_time');
});

test('R51: an employee with no payroll rows at all is not marked absent every day', () => {
  // The processed-period gate asks "was the period run?", never "does this
  // employee appear in it?". A new hire added mid-period, or anyone an operator
  // excluded from a run, would otherwise read 0% on-time with a month of
  // unexplained absences.
  const r = build({
    dateFrom: '2026-06-01', dateTo: '2026-06-05',
    payrollRows: [],
  });
  assert.equal(r.rows.every(x => x.verdict === 'not_processed'), true,
    `expected every day to be not_processed, got ${[...new Set(r.rows.map(x => x.verdict))].join(', ')}`);
  assert.equal(r.perEmployee[0].expectedDays, 0);
  assert.equal(r.perEmployee[0].onTimeRate, null);
});

test('R52: an employee WITH payroll rows still gets absences on their blank days', () => {
  // The guard above must not suppress real absences. Ana worked 06-01 and
  // 06-02; 06-03 has no row and no explanation, and must still be flagged.
  const r = build({
    dateFrom: '2026-06-01', dateTo: '2026-06-03',
    payrollRows: [pay({ work_date: '2026-06-01' }), pay({ work_date: '2026-06-02' })],
  });
  const third = r.rows.find(x => x.date === '2026-06-03');
  assert.equal(third?.verdict, 'unexplained_absence');
});

test('R53: request types match regardless of case and surrounding whitespace', () => {
  // The engine matches these with a lowercased substring test. This module used
  // an exact === against a fixed list, so the two could disagree on the same
  // board row and show opposite verdicts on the same day.
  const row = only({
    dateFrom: '2026-06-08', dateTo: '2026-06-08',
    requests: [req({ request_type: '  pto / vacation  ' })],
  });
  assert.equal(row.verdict, 'pto');
  assert.equal(row.countsToScore, false);
});

test('R54: a one-day request whose return_date equals start_date still covers that day', () => {
  // Someone reading "return date" as "the day I am off" records both the same.
  // return_date being exclusive then covered zero days and the day became a
  // scored unexplained absence.
  const row = only({
    dateFrom: '2026-06-08', dateTo: '2026-06-08',
    requests: [req({ start_date: '2026-06-08', end_date: '2026-06-08', return_date: '2026-06-08' })],
  });
  assert.equal(row.verdict, 'pto');
});
