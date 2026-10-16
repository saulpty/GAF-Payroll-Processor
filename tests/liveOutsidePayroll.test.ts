// Punctuality and Reports for employees outside payroll (international agents, 2026-10-16).
// Prompts: docs/superpowers/prompts/2026-10-16-international-agents/06a, 06b.
// They never get a payroll row, so in a processed period they read "Not Run Yet". For them every
// date is live (from Teramind). The rule that must hold: payroll employees are computed exactly
// as before, row for row and total for total.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildAttendanceReport,
  type ReportEmployee, type ReportPayrollRow, type ReportInput, type ReportPeriod,
} from '../src/app/lib/attendanceReport.ts';
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '../src/app/lib/classificationEngine.ts';
import type { ActivityDayRow } from '../src/app/lib/activityDays.ts';
import * as live from '../src/app/lib/liveAttendance.ts';
import * as list from '../src/app/lib/liveListRows.ts';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const helpers = { isScheduledWorkDay, getSchedule, parseTimeToMinutes };

// Ana is in payroll; Zola is outside it. Payroll is processed through Fri 2026-10-02.
// Range Mon 2026-09-28 → Tue 2026-10-06, today Tue 2026-10-06.
const TODAY = '2026-10-06';
const FROM = '2026-09-28', TO = '2026-10-06';
const PROCESSED_DAYS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
const ALL_DAYS = [...PROCESSED_DAYS, '2026-10-05', '2026-10-06'];

const emp = (over: Partial<ReportEmployee>): ReportEmployee => ({
  id: 1, name: 'Ana', email: 'ana@x.com', role: 'Intake 1', manager: 'Marcela Gordon',
  work_days: 'Mon,Tue,Wed,Thu,Fri', start_date: '2026-01-01',
  standard_start: '8:00 AM', standard_end: '4:00 PM',
  dst_start: '8:00 AM', dst_end: '4:00 PM', grace_minutes: 3, ...over,
} as ReportEmployee);
const ANA = emp({ in_payroll: true } as Partial<ReportEmployee>);
const ZOLA = emp({ id: 2, name: 'Zola', email: 'zola@x.com', in_payroll: false } as Partial<ReportEmployee>);

const pay = (date: string, late = 0): ReportPayrollRow => ({
  employee_id: 1, work_date: date, entry_time: late ? '8:10 AM' : '7:58 AM', exit_time: '4:00 PM',
  scheduled_start: '8:00 AM', late_minutes: late, early_leave_minutes: 0,
  event_type_1: late ? 'Tardanza' : '', documentation: '', auto_notes: '', period_name: 'Q1-Oct-2026',
});
const ymdInt = (d: string) => Number(d.replace(/-/g, ''));
const tm = (id: number, date: string, first = 475): ActivityDayRow => ({
  employee_id: id, work_date: ymdInt(date), first_min: first, last_ymd: ymdInt(date), last_min: 965,
  active_s: 27000, records: 40, largest_gap_min: 30, gap_start_min: 720,
  has_manual: false, accounts: 1, synced_at: '', ghost_min: -1,
} as ActivityDayRow);

const PERIODS: ReportPeriod[] = [
  { period_name: 'Q1-Oct-2026', start_date: '2026-09-26', end_date: '2026-10-02', processed_at: '2026-10-03' },
];
const TM = [...ALL_DAYS.map(d => tm(1, d)), ...ALL_DAYS.map(d => tm(2, d, d === '2026-09-29' ? 490 : 475))];
const PAYROLL = PROCESSED_DAYS.map(d => pay(d, d === '2026-09-30' ? 10 : 0));

const input = (employees: ReportEmployee[]): ReportInput => ({
  dateFrom: FROM, dateTo: TO, employees, payrollRows: PAYROLL, forms: [], requests: [],
  holidays: [], periods: PERIODS, dstWindows: [], helpers,
});
const win = live.liveWindow(PERIODS, FROM, TO, TODAY);
const wide = live.liveWindow([], FROM, TO, TODAY);

function reports(employees: ReportEmployee[]) {
  const inp = input(employees);
  const main = buildAttendanceReport(inp);
  const before = live.liveReport({ input: inp, main, window: win, today: TODAY, tmRows: TM, build: buildAttendanceReport });
  const after = live.liveReportWithOutside!({ input: inp, main, window: win, wide, today: TODAY, tmRows: TM, build: buildAttendanceReport });
  return { before, after };
}

test('OP0: the helpers exist (fail until prompt 06a is exported)', () => {
  assert.equal(typeof live.liveReportWithOutside, 'function', 'liveReportWithOutside');
  assert.equal(typeof live.outsidePayrollIds, 'function', 'outsidePayrollIds');
  assert.equal(typeof list.liveListRowsWithOutside, 'function', 'liveListRowsWithOutside');
});

test('OP1: windows: payroll window starts after the processed period; wide covers the whole range', () => {
  assert.deepEqual(win, { from: '2026-10-03', to: '2026-10-06' });
  assert.deepEqual(wide, { from: FROM, to: TODAY });
});

test('OP2: only an explicit in_payroll === false is outside payroll', () => {
  assert.deepEqual([...live.outsidePayrollIds!([ANA, ZOLA, emp({ id: 3 })])], ['2']);
});

test('OP3: a payroll employee is computed exactly as before, rows and totals', () => {
  const { before, after } = reports([ANA, ZOLA]);
  const ana = (rows: { employeeId: unknown }[]) => rows.filter(r => String(r.employeeId) === '1');
  assert.deepEqual(ana(after.rows), ana(before.rows));
  assert.deepEqual(after.perEmployee.find(s => s.employeeId === 1), before.perEmployee.find(s => s.employeeId === 1));
  assert.equal(after.unmatchedForms, before.unmatchedForms);
});

test('OP4: the outside employee is counted from Teramind on processed dates (was Not Run Yet)', () => {
  const { before, after } = reports([ANA, ZOLA]);
  const day = (out: typeof after, d: string) => out.rows.find(r => r.employeeId === 2 && r.date === d);
  assert.equal(day(before, '2026-09-28')?.verdict, 'not_processed', 'the bug, before the fix');
  assert.equal(day(after, '2026-09-28')?.verdict, 'on_time');
  assert.equal(day(after, '2026-09-29')?.verdict, 'late_no_form', '8:10 vs 8:00, no form');
  const z = after.perEmployee.find(s => s.employeeId === 2)!;
  assert.equal(z.lateDays, 1);
  assert.equal(z.expectedDays, 7, 'Mon Sep 28 → Tue Oct 6 work days, today has punches');
  assert.equal(after.rows.filter(r => r.employeeId === 2).length, before.rows.filter(r => r.employeeId === 2).length,
    'no duplicated or lost days');
});

test('OP5: nobody outside payroll, or no wide window → exactly liveReport', () => {
  const only = reports([ANA]);
  assert.deepEqual(only.after, only.before);
  const inp = input([ANA, ZOLA]);
  const main = buildAttendanceReport(inp);
  const before = live.liveReport({ input: inp, main, window: win, today: TODAY, tmRows: TM, build: buildAttendanceReport });
  assert.deepEqual(live.liveReportWithOutside!({ input: inp, main, window: win, wide: null, today: TODAY, tmRows: TM, build: buildAttendanceReport }), before);
});

test('OP6: List rows: payroll employee unchanged; the outside employee gets processed dates', () => {
  const base = {
    window: win, today: TODAY, forms: [], requests: [], holidays: [], periods: PERIODS, dstWindows: [],
    tmRows: TM, official: [],
    deps: { buildAttendanceReport, liveReport: live.liveReport, reportHelpers: helpers },
  };
  const before = list.liveListRows({ ...base, employees: [ANA, ZOLA] });
  const after = list.liveListRowsWithOutside!({ ...base, employees: [ANA, ZOLA], wide });
  const of = (rows: typeof after, email: string) => rows.filter(r => r.email === email);
  assert.deepEqual(of(after, 'ana@x.com'), of(before, 'ana@x.com'));
  const dates = of(after, 'zola@x.com').map(r => String(r.date).slice(0, 10));
  assert.ok(dates.includes('2026-09-28') && dates.includes('2026-10-02'), 'processed dates are there');
  assert.equal(new Set(dates).size, dates.length, 'one row per day');
});

test('OP7: the pages use the helpers and load the wide range (fail until prompt 06b)', () => {
  const rep = read('src/app/pages/attendance/AttendanceReport.tsx');
  assert.match(rep, /return liveReportWithOutside\(\{\s+input, main, window: win, wide, today: tmToday,/);
  assert.match(rep, /\{ dateFrom: tmWin\?\.from \?\? NO_LIVE\.from, dateTo: tmWin\?\.to \?\? NO_LIVE\.to, viewAs \}/);
  assert.match(rep, /liveWindow\(\[\], safeFrom, safeTo, tmToday\)/);
  const hook = read('src/app/pages/attendance/useLiveListRows.ts');
  assert.match(hook, /return liveListRowsWithOutside\(\{\s+window: win,\s+wide,/);
  assert.match(hook, /const range = wide \?\? win \?\? NO_LIVE_WINDOW;/);
  assert.match(hook, /liveWindow\(\[\], dateFrom, dateTo, today\)/);
  assert.match(read('src/actions/loadAttendanceEmployees.ts'), /\) AS in_payroll,/);
  assert.ok(existsSync(join(root, 'src/app/lib/liveAttendance.ts')));
  for (const f of ['src/app/lib/liveAttendance.ts', 'src/app/lib/liveListRows.ts',
    'src/app/pages/attendance/AttendanceReport.tsx', 'src/app/pages/attendance/useLiveListRows.ts']) {
    assert.ok(Buffer.byteLength(read(f)) < 15000, `${f} must stay under 15 KB`);
  }
});
