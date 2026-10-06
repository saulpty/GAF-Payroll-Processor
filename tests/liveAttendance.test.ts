import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildAttendanceReport,
  type ReportEmployee, type ReportPayrollRow, type ReportForm,
  type ReportRequest, type ReportPeriod, type ReportHoliday, type ReportRow,
} from '../src/app/lib/attendanceReport.ts';
import {
  isScheduledWorkDay, getSchedule, parseTimeToMinutes,
} from '../src/app/lib/classificationEngine.ts';
import { whyFor, type ActivityDayRow } from '../src/app/lib/activityDays.ts';
import { reportRowsToKpis } from '../src/app/lib/reportKpis.ts';
import { computeCompanyKpis, type AttendanceRow } from '../src/app/lib/attendanceStats.ts';
import {
  liveWindow, applyLiveDays, liveSummary, liveToAttendanceRows,
} from '../src/app/lib/liveAttendance.ts';

// Live days (2026-10-06): a day with no payroll_entries row is filled from Teramind and
// tagged live. A payroll row always wins. Live rows keep their official verdict, so no
// KPI ever counts them. The report rows come from the real buildAttendanceReport with the
// engine's helpers; whyFor is the real one from activityDays.ts.

const helpers = { isScheduledWorkDay, getSchedule, parseTimeToMinutes };
const liveHelpers = { parseTimeToMinutes, whyFor };

// ── fixtures ──────────────────────────────────────────────────────────────
// Ana works Mon–Fri, 8:00 AM start. Q2-Sep-2026 (Sep 11 → Sep 25) is the newest
// processed period. Today is Tue 2026-10-06.

const TODAY = '2026-10-06';
const MON = '2026-09-28', TUE = '2026-09-29', WED = '2026-09-30', THU = '2026-10-01';
const FRI = '2026-10-02', SAT = '2026-10-03', MON2 = '2026-10-05';

const emp = (over: Partial<ReportEmployee> = {}): ReportEmployee => ({
  id: 1, name: 'Ana', email: 'ana@x.com', role: 'Intake 1', manager: 'Marcela Gordon',
  work_days: 'Mon,Tue,Wed,Thu,Fri', start_date: '2026-01-01',
  standard_start: '8:00 AM', standard_end: '4:00 PM',
  dst_start: '8:00 AM', dst_end: '4:00 PM', grace_minutes: 3, ...over,
});

const pay = (over: Partial<ReportPayrollRow> = {}): ReportPayrollRow => ({
  employee_id: 1, work_date: '2026-09-25', entry_time: '8:00 AM', exit_time: '4:00 PM',
  scheduled_start: '8:00 AM', late_minutes: 0, early_leave_minutes: 0,
  event_type_1: '', documentation: '', auto_notes: '', period_name: 'Q2-Sep-2026', ...over,
});

const ymdInt = (d: string) => Number(d.replace(/-/g, ''));
const tm = (date: string, over: Partial<ActivityDayRow> = {}): ActivityDayRow => ({
  employee_id: 1, work_date: ymdInt(date), first_min: 485, last_ymd: ymdInt(date), last_min: 965,
  active_s: 27000, records: 40, largest_gap_min: 30, gap_start_min: 720,
  has_manual: false, accounts: 1, synced_at: '', ghost_min: -1, ...over,
});

const PERIODS: ReportPeriod[] = [
  { period_name: 'Q1-Sep-2026', start_date: '2026-08-27', end_date: '2026-09-10', processed_at: '2026-09-11' },
  { period_name: 'Q2-Sep-2026', start_date: '2026-09-11', end_date: '2026-09-25', processed_at: '2026-09-26' },
];
const DST = [{ year: 2026, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }];

type Scn = {
  dateFrom?: string; dateTo?: string; today?: string;
  employees?: ReportEmployee[]; payrollRows?: ReportPayrollRow[]; tmRows?: ActivityDayRow[];
  forms?: ReportForm[]; requests?: ReportRequest[]; holidays?: ReportHoliday[];
};

// The processed Sep 25 payroll row is always there, so Ana "has payroll" like a real employee.
function run(s: Scn = {}): ReportRow[] {
  const dateFrom = s.dateFrom ?? MON, dateTo = s.dateTo ?? '2026-10-09', today = s.today ?? TODAY;
  const employees = s.employees ?? [emp()];
  const payrollRows = [pay(), ...(s.payrollRows ?? [])];
  const requests = s.requests ?? [];
  const rep = buildAttendanceReport({
    dateFrom, dateTo, employees, payrollRows, forms: s.forms ?? [], requests,
    holidays: s.holidays ?? [], periods: PERIODS, dstWindows: DST, helpers,
  });
  return applyLiveDays({
    rows: rep.rows, payrollRows, tmRows: s.tmRows ?? [], employees, requests,
    window: liveWindow(PERIODS, dateFrom, dateTo, today), today, helpers: liveHelpers,
  });
}
const day = (rows: ReportRow[], date: string, id = 1) =>
  rows.find((r) => r.date === date && r.employeeId === id);

// ── liveWindow ────────────────────────────────────────────────────────────

test('LW1: window starts the day after the newest processed period and ends today', () => {
  assert.deepEqual(liveWindow(PERIODS, '2026-09-21', '2026-10-31', TODAY), { from: '2026-09-26', to: TODAY });
  assert.deepEqual(liveWindow(PERIODS, '2026-10-01', '2026-10-03', TODAY), { from: '2026-10-01', to: '2026-10-03' });
});

test('LW2: no window when the range is all processed, all future, or invalid', () => {
  assert.equal(liveWindow(PERIODS, '2026-09-01', '2026-09-25', TODAY), null);
  assert.equal(liveWindow(PERIODS, '2026-10-07', '2026-10-09', TODAY), null);
  assert.equal(liveWindow(PERIODS, '', '2026-10-09', TODAY), null);
  assert.equal(liveWindow(PERIODS, '2026-10-01', '2026-10-09', 'garbage'), null);
});

test('LW3: an unprocessed period row does not move the window; no processed periods → dateFrom', () => {
  const withOpen = [...PERIODS, { period_name: 'Q1-Oct-2026', start_date: '2026-09-26', end_date: '2026-10-10', processed_at: null }];
  assert.equal(liveWindow(withOpen, '2026-09-21', '2026-10-09', TODAY)!.from, '2026-09-26');
  assert.deepEqual(liveWindow([], '2026-09-21', '2026-10-09', TODAY), { from: '2026-09-21', to: TODAY });
});

// ── payroll wins ─────────────────────────────────────────────────────────

test('LA1: a processed payroll row wins — the day before the window is untouched even with punches', () => {
  const rows = run({ dateFrom: '2026-09-21', tmRows: [tm('2026-09-24'), tm('2026-09-25')] });
  const sep24 = day(rows, '2026-09-24')!;      // processed, no payroll row: official absence
  assert.equal(sep24.verdict, 'unexplained_absence');
  assert.equal(sep24.live, undefined);
  assert.equal(sep24.entryTime, null);
  const sep25 = day(rows, '2026-09-25')!;
  assert.equal(sep25.verdict, 'on_time');
  assert.equal(sep25.live, undefined);
  assert.equal(sep25.entryTime, '8:00 AM');
});

test('LA2: a payroll row in an UNPROCESSED period still wins over Teramind', () => {
  const rows = run({
    payrollRows: [pay({ work_date: TUE, entry_time: '8:30 AM', late_minutes: 30, period_name: 'Q1-Oct-2026' })],
    tmRows: [tm(TUE, { first_min: 470 })],
  });
  const r = day(rows, TUE)!;
  assert.equal(r.live, undefined);
  assert.equal(r.entryTime, '8:30 AM');
  assert.equal(r.verdict, 'not_processed');
});

// ── worked days ──────────────────────────────────────────────────────────

test('LA3: unprocessed day with punches at 8:05 → late 5, verdict unchanged, KPIs count nothing', () => {
  const rows = run({ tmRows: [tm(MON, { first_min: 485, last_min: 965 })] });
  const r = day(rows, MON)!;
  assert.equal(r.verdict, 'not_processed');
  assert.equal(r.countsToScore, false);
  assert.equal(r.entryTime, '8:05 AM');
  assert.equal(r.exitTime, '4:05 PM');
  assert.equal(r.minutesLate, 5);
  assert.equal(r.live!.kind, 'worked');
  assert.equal(r.live!.minutesLate, 5);
  assert.equal(r.live!.lateAfterGrace, 2);
  assert.equal(r.live!.inProgress, false);
  assert.equal(r.live!.label, 'Late 5 min');
  const k = reportRowsToKpis(rows.filter((x) => x.live));
  assert.equal(k.lateDays, 0);
  assert.equal(k.absent, 0);
  assert.equal(k.daysTracked, 0);
});

test('LA4: punches at 7:55 → on time', () => {
  const r = day(run({ tmRows: [tm(MON, { first_min: 475 })] }), MON)!;
  assert.equal(r.entryTime, '7:55 AM');
  assert.equal(r.minutesLate, 0);
  assert.equal(r.live!.lateAfterGrace, 0);
  assert.equal(r.live!.label, 'On time');
});

test('LA5: midnight-crossing shift (10 PM start) → crossesMidnight, exit 2:00 AM', () => {
  const night = emp({ id: 2, name: 'Nico', email: 'nico@x.com',
    standard_start: '10:00 PM', standard_end: '6:00 AM', dst_start: '10:00 PM', dst_end: '6:00 AM' });
  const rows = run({
    employees: [night],
    tmRows: [tm(THU, { employee_id: 2, first_min: 1320, last_ymd: ymdInt(FRI), last_min: 120 })],
  });
  const r = day(rows, THU, 2)!;
  assert.equal(r.live!.crossesMidnight, true);
  assert.equal(r.entryTime, '10:00 PM');
  assert.equal(r.exitTime, '2:00 AM');
  assert.equal(r.minutesLate, 0);
});

test('LA6: today with punches → inProgress, no exit yet', () => {
  const r = day(run({ tmRows: [tm(TODAY, { first_min: 478, last_min: 600 })] }), TODAY)!;
  assert.equal(r.live!.inProgress, true);
  assert.equal(r.live!.label, 'In progress');
  assert.equal(r.entryTime, '7:58 AM');
  assert.equal(r.exitTime, null);
  assert.equal(r.live!.exitMin, 600);
});

// ── no punches ───────────────────────────────────────────────────────────

test('LA7: no punches + PTO request → reason PTO, verdict pto', () => {
  const r = day(run({
    requests: [{ employee_id: 1, request_type: 'PTO / Vacation', permission_type: '',
      start_date: WED, end_date: WED, return_date: THU }],
  }), WED)!;
  assert.equal(r.verdict, 'pto');
  assert.equal(r.live!.kind, 'reason');
  assert.equal(r.live!.label, 'PTO');
  assert.equal(r.live!.why!.kind, 'pto');
});

test('LA8: no punches + Monday form → the form type is the reason', () => {
  const r = day(run({
    forms: [{ employee_id: 1, form_date: FRI, form_type: 'Absence', reason: 'Car trouble', details: '',
      eta: '', submitted_at: '2026-10-02 07:30', employee_email_raw: 'ana@x.com', monday_item_id: '9' }],
  }), FRI)!;
  assert.equal(r.verdict, 'not_processed');
  assert.equal(r.live!.kind, 'reason');
  assert.equal(r.live!.label, 'Absence');
  assert.equal(r.live!.why!.kind, 'form');
});

test('LA9: nothing at all → "No records yet", never an absence in either KPI path', () => {
  const rows = run();
  const r = day(rows, WED)!;
  assert.equal(r.verdict, 'not_processed');
  assert.equal(r.live!.kind, 'no_records');
  assert.equal(r.live!.label, 'No records yet');
  assert.equal(r.live!.why!.label, 'No records yet');
  const live = rows.filter((x) => x.live);
  const rk = reportRowsToKpis(live);
  assert.equal(rk.absent, 0);
  assert.equal(rk.daysTracked, 0);
  const ck = computeCompanyKpis(liveToAttendanceRows(live, []));
  assert.equal(ck.absent, 0);
  assert.equal(ck.daysTracked, 0);
  assert.equal(ck.totalRows, 0);
  assert.equal(ck.liveDays, live.length);
});

test('LA10: holiday → reason Holiday', () => {
  const r = day(run({ holidays: [{ date: MON2, name: 'Feriado' }] }), MON2)!;
  assert.equal(r.verdict, 'holiday');
  assert.equal(r.live!.kind, 'reason');
  assert.equal(r.live!.label, 'Holiday');
  assert.equal(r.live!.why!.kind, 'holiday');
});

// ── edges of the window ──────────────────────────────────────────────────

test('LA11: future dates are untouched, even if Teramind somehow has a row', () => {
  const rows = run({ tmRows: [tm('2026-10-07')] });
  const r = day(rows, '2026-10-07')!;
  assert.equal(r.live, undefined);
  assert.equal(r.entryTime, null);
  assert.equal(r.verdict, 'not_processed');
});

test('LA12: only decorates existing rows — a weekend with punches gets no row, like official days', () => {
  const rows = run({ tmRows: [tm(SAT)] });
  assert.equal(day(rows, SAT), undefined);
});

test('LA13: no window → rows returned unchanged', () => {
  const rows = run({ dateFrom: '2026-09-01', dateTo: '2026-09-25', tmRows: [tm('2026-09-24')] });
  assert.equal(rows.some((r) => r.live), false);
});

// ── summary + List conversion ────────────────────────────────────────────

test('LS1: liveSummary counts live rows only', () => {
  const rows = run({
    tmRows: [tm(MON, { first_min: 485 }), tm(TUE, { first_min: 470 })],
    holidays: [{ date: MON2, name: 'Feriado' }],
  });
  // MON late, TUE on time, WED THU FRI no records, MON2 holiday, TODAY no records
  assert.deepEqual(liveSummary(rows), { days: 7, worked: 2, late: 1, noRecords: 4, reasons: 1 });
});

test('LL1: liveToAttendanceRows → List rows: HH:MM times, status Live, no period, filed_gaf from form', () => {
  const rows = run({
    tmRows: [tm(MON, { first_min: 485, last_min: 965 })],
    forms: [{ employee_id: 1, form_date: MON, form_type: 'Tardiness', reason: '', details: '',
      eta: '', submitted_at: '2026-09-28 07:30', employee_email_raw: 'ana@x.com', monday_item_id: '1' }],
  });
  const list = liveToAttendanceRows(rows, []);
  const mon = list.find((r) => r.date === MON)!;
  assert.equal(mon.entry_time, '08:05');
  assert.equal(mon.exit_time, '16:05');
  assert.equal(mon.status, 'Live');
  assert.equal(mon.live, true);
  assert.equal(mon.live_label, 'Late 5 min');
  assert.equal(mon.period_name, '');
  assert.equal(mon.filed_gaf, true);
  assert.equal(mon.minutes_late, 5);
  assert.equal(mon.bucket, 'late_1to10');
  const wed = list.find((r) => r.date === WED)!;
  assert.equal(wed.entry_time, null);
  assert.equal(wed.live_label, 'No records yet');
  assert.equal(wed.filed_gaf, false);
  assert.equal(list.some((r) => r.date === '2026-09-25'), false);   // official payroll day
});

test('LL2: liveToAttendanceRows skips any email|date the official rows already have', () => {
  const rows = run({ tmRows: [tm(MON)] });
  const official: AttendanceRow[] = [{
    email: 'ANA@x.com', name: 'Ana', date: MON + 'T00:00:00.000Z', entry_time: '08:00', status: 'On Time',
    bucket: 'on_time', filed_gaf: false, minutes_late: 0, period_name: 'Q1-Oct-2026', time_off_kind: null,
  }];
  const list = liveToAttendanceRows([...rows, ...rows], official);
  assert.equal(list.some((r) => r.date === MON), false);
  const dates = list.map((r) => r.date);
  assert.equal(new Set(dates).size, dates.length, 'no duplicates');
});

// ── source guards ────────────────────────────────────────────────────────

for (const f of ['liveAttendance.ts', 'attendancePeriods.ts']) {
  test(`LG: ${f} has no runtime import, no new Date(, and stays under 15,000 bytes`, () => {
    const p = fileURLToPath(new URL(`../src/app/lib/${f}`, import.meta.url));
    const src = readFileSync(p, 'utf8');
    for (const line of src.split('\n')) {
      if (/^\s*import\s/.test(line)) assert.match(line, /^\s*import\s+type\s/, `runtime import: ${line}`);
      if (/^\s*export\s+\{[^}]*\}\s+from\s/.test(line) || /^\s*export\s+\*\s+from\s/.test(line)) {
        assert.fail(`runtime re-export: ${line}`);
      }
    }
    assert.equal(src.includes('new Date('), false);
    assert.ok(Buffer.byteLength(src) < 15000, `${f} is ${Buffer.byteLength(src)} bytes`);
  });
}

for (const f of ['attendanceReportTypes.ts', 'attendanceStats.ts']) {
  test(`LG: ${f} stays under 15,000 bytes and gains no runtime import`, () => {
    const src = readFileSync(fileURLToPath(new URL(`../src/app/lib/${f}`, import.meta.url)), 'utf8');
    assert.ok(Buffer.byteLength(src) < 15000);
    for (const line of src.split('\n')) {
      if (/^\s*import\s/.test(line)) assert.match(line, /^\s*import\s+type\s/, `runtime import: ${line}`);
    }
  });
}
