// Attendance List rows for days payroll has not processed yet (2026-10-07: they COUNT, no Live tag).
// Unit tests for liveListRows (pure, real dependencies injected) + static checks on the List page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  buildAttendanceReport,
  type ReportEmployee, type ReportPeriod, type ReportForm, type ReportRequest, type ReportHoliday,
  type ReportInput, type ReportRow,
} from '../src/app/lib/attendanceReport.ts';
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '../src/app/lib/classificationEngine.ts';
import type { ActivityDayRow } from '../src/app/lib/activityDays.ts';
import { liveWindow, liveReport } from '../src/app/lib/liveAttendance.ts';
import { liveListRows, reportRowToList, to24, NO_LIVE_WINDOW } from '../src/app/lib/liveListRows.ts';
import { reportRowsToKpis } from '../src/app/lib/reportKpis.ts';
import {
  computeEmployeeStats, computeCompanyKpis, type AttendanceRow,
} from '../src/app/lib/attendanceStats.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const exists = (p: string) => existsSync(new URL(`../${p}`, import.meta.url));
const A = 'src/app/pages/attendance/';

// ── fixtures: Ana, Mon–Fri 8:00 AM; Q2-Sep-2026 (to Sep 25) is the newest processed period ──
const TODAY = '2026-10-06';
const MON = '2026-09-28', TUE = '2026-09-29', WED = '2026-09-30', THU = '2026-10-01';
const FRI = '2026-10-02', SAT = '2026-10-03', MON2 = '2026-10-05';

const emp = (over: Partial<ReportEmployee> = {}): ReportEmployee => ({
  id: 1, name: 'Ana', email: 'ana@x.com', role: 'Intake 1', manager: 'Marcela Gordon',
  work_days: 'Mon,Tue,Wed,Thu,Fri', start_date: '2026-01-01',
  standard_start: '8:00 AM', standard_end: '4:00 PM',
  dst_start: '8:00 AM', dst_end: '4:00 PM', grace_minutes: 3, ...over,
});
const ymdInt = (d: string) => Number(d.replace(/-/g, ''));
const tm = (date: string, over: Partial<ActivityDayRow> = {}): ActivityDayRow => ({
  employee_id: 1, work_date: ymdInt(date), first_min: 500, last_ymd: ymdInt(date), last_min: 965,
  active_s: 27000, records: 40, largest_gap_min: 30, gap_start_min: 720,
  has_manual: false, accounts: 1, synced_at: '', ghost_min: -1, ...over,
});
const PERIODS: ReportPeriod[] = [
  { period_name: 'Q2-Sep-2026', start_date: '2026-09-11', end_date: '2026-09-25', processed_at: '2026-09-26' },
];
const DST = [{ year: 2026, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }];
const reportHelpers = { isScheduledWorkDay, getSchedule, parseTimeToMinutes };
const deps = { buildAttendanceReport, liveReport, reportHelpers };
const PTO_WED: ReportRequest = { employee_id: 1, request_type: 'PTO / Vacation', permission_type: '',
  start_date: WED, end_date: WED, return_date: THU };

type Over = {
  from?: string; to?: string; today?: string; tmRows?: ActivityDayRow[]; official?: AttendanceRow[];
  forms?: ReportForm[]; requests?: ReportRequest[]; holidays?: ReportHoliday[];
};
function run(over: Over = {}): AttendanceRow[] {
  const today = over.today ?? TODAY;
  return liveListRows({
    window: liveWindow(PERIODS, over.from ?? '2026-09-11', over.to ?? '2026-10-09', today),
    today, employees: [emp()], forms: over.forms ?? [], requests: over.requests ?? [],
    holidays: over.holidays ?? [], periods: PERIODS, dstWindows: DST, tmRows: over.tmRows ?? [],
    official: over.official ?? [], deps,
  });
}
const on = (rows: AttendanceRow[], d: string) => rows.find(r => r.date === d);

test('LV1: no live window → no rows; NO_LIVE_WINDOW ends before it starts', () => {
  assert.deepEqual(run({ from: '2026-09-11', to: '2026-09-25' }), []);
  assert.ok(NO_LIVE_WINDOW.from > NO_LIVE_WINDOW.to);
  assert.deepEqual(liveListRows({
    window: null, today: TODAY, employees: [emp()], forms: [], requests: [], holidays: [],
    periods: PERIODS, dstWindows: DST, tmRows: [tm(MON)], official: [], deps,
  }), []);
});

test('LV2: only counted days after the processed period, up to today, on work days; no Live status', () => {
  const rows = run({ tmRows: [tm(MON)] });
  assert.ok(rows.every(r => r.date > '2026-09-25' && r.date <= TODAY), 'window is after Sep 25, to today');
  assert.equal(on(rows, SAT), undefined, 'a day off never becomes a row');
  assert.equal(on(rows, TODAY), undefined, 'today without punches is not counted');
  assert.ok(rows.every(r => r.status !== 'Live' && !('live' in r) && !('live_label' in r)));
  assert.equal(rows.length, 6);   // MON TUE WED THU FRI MON2
});

test('LV3: a worked late day → the view\'s Late - Unreported row with HH:MM times and bucket', () => {
  const r = on(run({ tmRows: [tm(MON)] }), MON)!;
  assert.deepEqual(r, {
    email: 'ana@x.com', name: 'Ana', date: MON, entry_time: '08:20', exit_time: '16:05',
    filed_gaf: false, minutes_late: 20, period_name: '', time_off_kind: null,
    status: 'Late - Unreported', bucket: 'late_11to30',
  });
  const reported = on(run({
    tmRows: [tm(MON)],
    forms: [{ employee_id: 1, form_date: MON, form_type: 'Tardiness', reason: '', details: '', eta: '',
      submitted_at: '2026-09-28 07:30', employee_email_raw: 'ana@x.com', monday_item_id: '1' }],
  }), MON)!;
  assert.equal(reported.status, 'Late - Reported');
  assert.equal(reported.filed_gaf, true);
});

test('LV4: no punches → absent; PTO → Excused pto; Absence form → Excused approved_absence; holiday', () => {
  const rows = run({
    forms: [{ employee_id: 1, form_date: FRI, form_type: 'Absence', reason: 'Car trouble', details: '',
      eta: '', submitted_at: '2026-10-02 07:30', employee_email_raw: 'ana@x.com', monday_item_id: '9' }],
    requests: [PTO_WED],
    holidays: [{ date: MON2, name: 'Feriado' }],
    tmRows: [tm(TUE, { first_min: 470 })],
  });
  assert.equal(on(rows, MON)!.status, 'Absent - Unexplained');
  assert.equal(on(rows, MON)!.bucket, 'absent');
  assert.equal(on(rows, MON)!.entry_time, null);
  assert.equal(on(rows, TUE)!.status, 'On Time');
  assert.equal(on(rows, WED)!.status, 'Excused (PTO/FH/Perm)');
  assert.equal(on(rows, WED)!.time_off_kind, 'pto');
  assert.equal(on(rows, FRI)!.status, 'Excused (PTO/FH/Perm)');
  assert.equal(on(rows, FRI)!.time_off_kind, 'approved_absence');
  assert.equal(on(rows, MON2)!.time_off_kind, 'holiday');
});

test('LV5: an official List row for the same email|date always wins', () => {
  const official: AttendanceRow = {
    email: 'ANA@x.com', name: 'Ana', date: MON, entry_time: '08:00', exit_time: '16:00',
    status: 'On Time', bucket: 'on_time', filed_gaf: false, minutes_late: 0,
    period_name: 'Q1-Oct-2026', time_off_kind: null,
  };
  const rows = run({ tmRows: [tm(MON)], official: [official] });
  assert.equal(on(rows, MON), undefined);
  const dates = rows.map(r => r.date);
  assert.equal(new Set(dates).size, dates.length, 'no duplicates');
});

test('LV6: today with punches counts, no exit yet; today without punches does not', () => {
  const r = on(run({ tmRows: [tm(TODAY)] }), TODAY)!;
  assert.equal(r.status, 'Late - Unreported');
  assert.equal(r.minutes_late, 20);
  assert.equal(r.exit_time, null);
  assert.equal(on(run({ from: TODAY }), TODAY), undefined);
});

test('LV7: unprocessed days now move the List numbers', () => {
  const official: AttendanceRow = {
    email: 'ana@x.com', name: 'Ana', date: '2026-09-25', entry_time: '08:00', exit_time: '16:00',
    status: 'On Time', bucket: 'on_time', filed_gaf: false, minutes_late: 0,
    period_name: 'Q2-Sep-2026', time_off_kind: null,
  };
  const live = run({ tmRows: [tm(MON), tm(TUE, { first_min: 470 })] });
  const k = computeCompanyKpis([official, ...live]);
  assert.equal(k.workDays, 7);      // Sep 25 + MON..FRI + MON2
  assert.equal(k.onTime, 2);
  assert.equal(k.lateDays, 1);
  assert.equal(k.absent, 4);
  const [s] = computeEmployeeStats([official, ...live], new Map(), new Set(['ana@x.com']));
  assert.equal(s.days, 7);
  assert.equal(s.rows.length, 7);
});

test('LV8: List KPIs match Report KPIs for the same unprocessed days', () => {
  const s: Over = {
    from: MON, to: TODAY,
    tmRows: [tm(MON), tm(TUE, { first_min: 470 }), tm(TODAY, { first_min: 485 })],
    requests: [PTO_WED, { employee_id: 1, request_type: 'Time Off / Permission', permission_type: '',
      start_date: THU, end_date: THU, return_date: null }],
    holidays: [{ date: MON2, name: 'Feriado' }],
  };
  const list = computeCompanyKpis(run(s));
  const input: ReportInput = {
    dateFrom: MON, dateTo: TODAY, employees: [emp()], payrollRows: [], forms: [],
    requests: s.requests!, holidays: s.holidays!, periods: PERIODS, dstWindows: DST, helpers: reportHelpers,
  };
  const main = buildAttendanceReport(input);
  const rep = reportRowsToKpis(liveReport({
    input, main, window: liveWindow(PERIODS, MON, TODAY, TODAY), today: TODAY,
    tmRows: s.tmRows!, build: buildAttendanceReport,
  }).rows);
  for (const k of ['onTime', 'lateDays', 'absent', 'excused', 'permission', 'daysTracked', 'workDays', 'avgMinLate'] as const) {
    assert.equal(list[k], rep[k], k);
  }
  assert.equal(list.workDays, 7);   // MON late, TUE on time, WED pto, THU perm, FRI absent, MON2 holiday, TODAY late
});

test('LV9: reportRowToList maps every verdict like v_attendance_daily; to24 converts payroll text', () => {
  const base = {
    employeeId: 1, employeeName: 'Ana', email: 'ana@x.com', role: '', manager: '', date: MON,
    scheduledStart: '8:00 AM', entryTime: '8:42 AM', exitTime: '12:15 PM', minutesLate: 42,
    earlyLeaveMinutes: 0, form: null, allForms: [], coveredBy: null, countsToScore: true,
    flags: { multipleForms: false, recordedUnexplainedButFormOnFile: false, formEmailUnrecognised: false, excusedInPayrollNoRequest: false },
  };
  const as = (verdict: ReportRow['verdict'], over: Partial<ReportRow> = {}) =>
    reportRowToList({ ...base, verdict, ...over } as ReportRow);
  assert.equal(as('not_processed'), null);
  assert.equal(as('late_reported_late')!.bucket, 'late_830plus');
  assert.equal(as('absent_reported_on_time')!.status, 'Absent - Unexplained');
  assert.equal(as('permission')!.status, 'Permission');
  assert.equal(as('pto', { coveredBy: { kind: 'pto', label: 'Birthday Day Off' } })!.time_off_kind, 'birthday');
  assert.equal(as('pto', { coveredBy: { kind: 'pto', label: 'Compensatory Day' } })!.time_off_kind, 'comp_day');
  assert.equal(as('on_time')!.entry_time, '08:42');
  assert.equal(as('on_time')!.exit_time, '12:15');
  assert.equal(to24('12:05 AM'), '00:05');
  assert.equal(to24('12:30 PM'), '12:30');
  assert.equal(to24('9:07 pm'), '21:07');
  assert.equal(to24(null), null);
  assert.equal(to24('garbage'), null);
});

// ── static checks on the List page ──────────────────────────────────────────

test('LP1: the List loads unprocessed days through useLiveListRows and appends them before filtering', () => {
  const page = read('src/app/pages/Attendance.tsx');
  assert.match(page, /import \{ useLiveListRows \} from '@\/app\/pages\/attendance\/useLiveListRows';/);
  assert.match(page, /useLiveListRows\(\{\s+dateFrom: safeFrom, dateTo: safeTo, viewAs,/);
  assert.match(page, /\[\.\.\.rows, \.\.\.live\.rows\]/);
  assert.match(page, /allRows\.filter\(r => matchEmails\.has\(r\.email\)\)/);
  assert.match(page, /const loading = loadingRows \|\| loadingEmps \|\| live\.loading;/, 'numbers wait for those days');
});

test('LP2: the hook loads only the live window, flat params with viewAs, and uses the libs', () => {
  const hook = read(`${A}useLiveListRows.ts`);
  assert.doesNotMatch(hook, /\{\s*params:\s*\{/, 'params go flat, never wrapped');
  assert.match(hook, /liveWindow\(/);
  assert.match(hook, /const range = win \?\? NO_LIVE_WINDOW;/);
  assert.match(hook, /useLoadAction\(\s*loadTeramindActivityDaysAction, \[\] as ActivityDayRow\[\],\s*\{ dateFrom: range\.from, dateTo: range\.to, viewAs \},/);
  assert.match(hook, /loadMondayAttendanceFormsRangeAction, \[\] as ReportForm\[\],\s*\{ dateFrom: range\.from, dateTo: range\.to, manager: '', viewAs \}/);
  assert.match(hook, /loadMondayRequestsRangeAction, \[\] as ReportRequest\[\],\s*\{ dateFrom: range\.from, dateTo: range\.to, manager: '', viewAs \}/);
  assert.match(hook, /easternDate\(Date\.now\(\)\)/, "Teramind's today is US Eastern");
  assert.match(hook, /liveListRows\(\{/);
  assert.match(hook, /buildAttendanceReport, liveReport,/);
  assert.doesNotMatch(hook, /applyLiveDays|liveToAttendanceRows|whyFor/);
  assert.doesNotMatch(hook, /loadAttendanceReportDays/, 'payroll rows come from the List itself');
});

test('LP3: no Live tag anywhere on the List: KPI note, per-employee chip, panel label all gone', () => {
  for (const f of ['src/app/pages/Attendance.tsx', `${A}AttendanceKpis.tsx`, `${A}AttendanceTable.tsx`,
    `${A}AttendancePanelDays.tsx`, `${A}AttendancePanelBody.tsx`]) {
    const src = read(f);
    assert.doesNotMatch(src, /LiveBadge|Live ·|not yet counted|live_label|liveDays|liveLate|\b(r|s|att\??|row)\.live\b/, f);
  }
  assert.match(read(`${A}AttendancePanelBody.tsx`), /computeArrivalScatter\(stats\.rows\)/, 'chart includes every day');
  assert.equal(exists(`${A}LiveBadge.tsx`), false, 'LiveBadge.tsx deleted');
});

test('LP4: List files use the Warm look and stay under 15 KB', () => {
  for (const f of ['AttendanceKpis.tsx', 'AttendanceTable.tsx', 'AttendancePanelDays.tsx', 'useLiveListRows.ts']) {
    const src = read(A + f);
    assert.doesNotMatch(src, /uppercase/, `${f}: Title Case, never ALL CAPS`);
    assert.doesNotMatch(src, /#2AA876|#B91C1C/i, `${f}: no hardcoded hex`);
    assert.doesNotMatch(src, /bg-(primary|warm|secondary)\/\d+/, `${f}: no opacity modifier on a CSS-variable colour`);
    assert.ok(Buffer.byteLength(src) < 15000, `${f} must stay under 15 KB`);
  }
  for (const f of ['src/app/pages/Attendance.tsx', 'src/app/lib/liveListRows.ts']) {
    assert.ok(Buffer.byteLength(read(f)) < 15000, `${f} must stay under 15 KB`);
  }
  const t = read(`${A}AttendanceTable.tsx`);
  assert.match(t, /bg-status-green-fill text-status-green-ink/);
  assert.match(t, /bg-status-yellow-fill text-status-yellow-ink/);
  assert.match(t, /bg-status-red-fill text-status-red-ink/);
  const d = read(`${A}AttendancePanelDays.tsx`);
  assert.match(d, /Needs a Look/);
  assert.match(d, /const fmtMins = \(m: number\): string => \(m < 60 \? `\$\{m\} min` : fmtDuration\(m\)\);/);
});

test('LP5: Activity header reads "Needs a Look"', () => {
  const src = read(`${A}activity/ActivityByEmployee.tsx`);
  assert.match(src, /\{ key: 'needsLook',\s+label: 'Needs a Look' \}/);
});

test('LP6: List rows wait for the window\'s own data, and loading says so', () => {
  const hook = read(`${A}useLiveListRows.ts`);
  assert.match(hook, /if \(loading \|\| error \|\| !win \|\| dataFor !== winKey\) return \[\] as AttendanceRow\[\];/);
  assert.match(hook, /else if \(wasBusy\.current\) \{ wasBusy\.current = false; setDataFor\(winKey\); \}/);
  assert.match(hook, /const loading = loadingPeriods \|\| \(win !== null && !error &&\s+\(loadingTm \|\| loadingForms \|\| loadingReqs \|\| loadingHols \|\| loadingDst \|\| dataFor !== winKey\)\);/);
});

test('LP7: List keeps its column headers and % On-Time stays sortable (UIB once renamed them)', () => {
  const t = read(`${A}AttendanceTable.tsx`);
  assert.match(t, /<Th label="% On-Time"\s+col="pctOnTime"/);
  for (const label of ['Reported', 'Unreported', 'Avg Min (Worked)', '1–10m', '11–30m', '31+m']) {
    assert.ok(t.includes(`<Th label="${label}"`), `header ${label}`);
  }
  assert.doesNotMatch(t, /On-Time %/);
});
