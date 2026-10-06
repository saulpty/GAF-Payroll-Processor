// Attendance List live rows (prompt 4 of 2026-10-06 live attendance).
// Unit tests for liveListRows (pure, real dependencies injected) + static checks on the List page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  buildAttendanceReport,
  type ReportEmployee, type ReportPeriod, type ReportForm, type ReportRequest,
} from '../src/app/lib/attendanceReport.ts';
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '../src/app/lib/classificationEngine.ts';
import { whyFor, type ActivityDayRow } from '../src/app/lib/activityDays.ts';
import { liveWindow, applyLiveDays, liveToAttendanceRows } from '../src/app/lib/liveAttendance.ts';
import { liveListRows, NO_LIVE_WINDOW } from '../src/app/lib/liveListRows.ts';
import {
  computeEmployeeStats, computeCompanyKpis, type AttendanceRow,
} from '../src/app/lib/attendanceStats.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const exists = (p: string) => existsSync(new URL(`../${p}`, import.meta.url));
const A = 'src/app/pages/attendance/';

// ── fixtures: Ana, Mon–Fri 8:00 AM; Q2-Sep-2026 (to Sep 25) is the newest processed period ──
const TODAY = '2026-10-06';
const MON = '2026-09-28', WED = '2026-09-30', FRI = '2026-10-02', SAT = '2026-10-03';

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
const deps = {
  buildAttendanceReport, applyLiveDays, liveToAttendanceRows, whyFor,
  reportHelpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes },
};

function run(over: {
  from?: string; to?: string; today?: string; tmRows?: ActivityDayRow[]; official?: AttendanceRow[];
  forms?: ReportForm[]; requests?: ReportRequest[];
} = {}): AttendanceRow[] {
  const today = over.today ?? TODAY;
  return liveListRows({
    window: liveWindow(PERIODS, over.from ?? '2026-09-11', over.to ?? '2026-10-09', today),
    today, employees: [emp()], forms: over.forms ?? [], requests: over.requests ?? [],
    holidays: [], periods: PERIODS, dstWindows: DST, tmRows: over.tmRows ?? [],
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

test('LV2: only days after the processed period, up to today, on work days', () => {
  const rows = run({ tmRows: [tm(MON)] });
  assert.ok(rows.every(r => r.date > '2026-09-25' && r.date <= TODAY), 'window is after Sep 25, to today');
  assert.equal(on(rows, SAT), undefined, 'a day off never becomes a row');
  assert.ok(rows.every(r => r.live === true && r.status === 'Live'));
});

test('LV3: a worked late day → HH:MM entry, minutes late, bucket, label', () => {
  const r = on(run({ tmRows: [tm(MON)] }), MON)!;
  assert.equal(r.entry_time, '08:20');
  assert.equal(r.exit_time, '16:05');
  assert.equal(r.minutes_late, 20);
  assert.equal(r.bucket, 'late_11to30');
  assert.equal(r.live_label, 'Late 20 min');
  assert.equal(r.email, 'ana@x.com');
});

test('LV4: no punches → the Monday form or PTO is the reason, else "No records yet"', () => {
  const rows = run({
    forms: [{ employee_id: 1, form_date: FRI, form_type: 'Absence', reason: 'Car trouble', details: '',
      eta: '', submitted_at: '2026-10-02 07:30', employee_email_raw: 'ana@x.com', monday_item_id: '9' }],
    requests: [{ employee_id: 1, request_type: 'PTO / Vacation', permission_type: '',
      start_date: WED, end_date: WED, return_date: '2026-10-01' }],
  });
  assert.equal(on(rows, FRI)!.live_label, 'Absence');
  assert.equal(on(rows, FRI)!.filed_gaf, true);
  assert.equal(on(rows, WED)!.live_label, 'PTO');
  assert.equal(on(rows, MON)!.live_label, 'No records yet');
  assert.equal(on(rows, MON)!.entry_time, null);
});

test('LV5: an official List row for the same email|date always wins', () => {
  const official: AttendanceRow = {
    email: 'ANA@x.com', name: 'Ana', date: MON, entry_time: '08:00', exit_time: '16:00',
    status: 'On Time', bucket: 'on_time', filed_gaf: false, minutes_late: 0,
    period_name: 'Q1-Oct-2026', time_off_kind: null,
  };
  assert.equal(on(run({ tmRows: [tm(MON)], official: [official] }), MON), undefined);
});

test('LV6: today is in progress: no exit yet', () => {
  const r = on(run({ tmRows: [tm(TODAY)] }), TODAY)!;
  assert.equal(r.live_label, 'In progress');
  assert.equal(r.exit_time, null);
});

test('LV7: live rows never move a number on the List', () => {
  const official: AttendanceRow = {
    email: 'ana@x.com', name: 'Ana', date: '2026-09-25', entry_time: '08:00', exit_time: '16:00',
    status: 'On Time', bucket: 'on_time', filed_gaf: false, minutes_late: 0,
    period_name: 'Q2-Sep-2026', time_off_kind: null,
  };
  const live = run({ tmRows: [tm(MON)] });
  const before = computeCompanyKpis([official]);
  const after = computeCompanyKpis([official, ...live]);
  assert.equal(after.onTimeRate, before.onTimeRate);
  assert.equal(after.workDays, before.workDays);
  assert.equal(after.lateDays, before.lateDays);
  assert.equal(after.liveDays, live.length);
  assert.equal(after.liveLate, 1);
  const [s] = computeEmployeeStats([official, ...live], new Map(), new Set(['ana@x.com']));
  assert.equal(s.days, 1);
  assert.equal(s.liveDays, live.length);
});

// ── static checks on the List page ──────────────────────────────────────────

test('LP1: the List loads live rows through useLiveListRows and appends them before filtering', () => {
  const page = read('src/app/pages/Attendance.tsx');
  assert.match(page, /import \{ useLiveListRows \} from '@\/app\/pages\/attendance\/useLiveListRows';/);
  assert.match(page, /useLiveListRows\(\{\s+dateFrom: safeFrom, dateTo: safeTo, viewAs,/);
  assert.match(page, /\[\.\.\.rows, \.\.\.live\.rows\]/);
  assert.match(page, /allRows\.filter\(r => matchEmails\.has\(r\.email\)\)/);
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
  assert.match(hook, /buildAttendanceReport, applyLiveDays, liveToAttendanceRows, whyFor/);
  assert.doesNotMatch(hook, /loadAttendanceReportDays/, 'payroll rows come from the List itself');
});

test('LP3: the KPI note, the per-employee Live tag and the panel Live label', () => {
  const k = read(`${A}AttendanceKpis.tsx`);
  assert.match(k, /\(kpis\.liveDays \?\? 0\) > 0 &&/);
  assert.match(k, /live day\{kpis\.liveDays === 1 \? '' : 's'\} not yet counted/);
  const t = read(`${A}AttendanceTable.tsx`);
  assert.match(t, /s\.liveDays > 0 &&/);
  assert.match(t, /<LiveBadge count=\{s\.liveDays\}/);
  const d = read(`${A}AttendancePanelDays.tsx`);
  assert.match(d, /att\?\.live \?/);
  assert.match(d, /<LiveBadge \/>\s*<span>\{att\.live_label\}<\/span>/);
  assert.match(read(`${A}AttendancePanelBody.tsx`), /computeArrivalScatter\(stats\.rows\.filter\(r => !r\.live\)\)/);
});

test('LP4: List files use the Warm look and stay under 15 KB', () => {
  for (const f of ['AttendanceKpis.tsx', 'AttendanceTable.tsx', 'AttendancePanelDays.tsx', 'useLiveListRows.ts', 'LiveBadge.tsx']) {
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
  assert.match(read(`${A}AttendancePanelDays.tsx`), /Needs a Look/);
});

test('LP5: Activity header reads "Needs a Look"', () => {
  const src = read(`${A}activity/ActivityByEmployee.tsx`);
  assert.match(src, /\{ key: 'needsLook',\s+label: 'Needs a Look' \}/);
  assert.ok(exists(`${A}LiveBadge.tsx`));
});

test('LP6: List live rows wait for the window\'s own data (no flash of "No records yet")', () => {
  const hook = readFileSync(new URL('../src/app/pages/attendance/useLiveListRows.ts', import.meta.url), 'utf8');
  assert.match(hook, /if \(loading \|\| error \|\| !win \|\| dataFor !== winKey\) return \[\] as AttendanceRow\[\];/);
  assert.match(hook, /else if \(wasBusy\.current\) \{ wasBusy\.current = false; setDataFor\(winKey\); \}/);
});

test('LP7: List keeps its column headers and % On-Time stays sortable (UIB once renamed them)', () => {
  const t = readFileSync(new URL('../src/app/pages/attendance/AttendanceTable.tsx', import.meta.url), 'utf8');
  assert.match(t, /<Th label="% On-Time"\s+col="pctOnTime"/);
  for (const label of ['Reported', 'Unreported', 'Avg Min (Worked)', '1–10m', '11–30m', '31+m']) {
    assert.ok(t.includes(`<Th label="${label}"`), `header ${label}`);
  }
  assert.doesNotMatch(t, /On-Time %/);
});
