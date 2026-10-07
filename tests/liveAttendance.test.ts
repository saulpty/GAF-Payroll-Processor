import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildAttendanceReport,
  type ReportEmployee, type ReportPayrollRow, type ReportForm, type ReportInput, type ReportOutput,
  type ReportRequest, type ReportPeriod, type ReportHoliday, type ReportRow,
} from '../src/app/lib/attendanceReport.ts';
import {
  isScheduledWorkDay, getSchedule, parseTimeToMinutes,
} from '../src/app/lib/classificationEngine.ts';
import type { ActivityDayRow } from '../src/app/lib/activityDays.ts';
import { reportRowsToKpis } from '../src/app/lib/reportKpis.ts';
import {
  liveWindow, livePeriod, livePayrollRows, liveReport, summarizeRows,
} from '../src/app/lib/liveAttendance.ts';

// Days payroll has not processed yet (decision 2026-10-07): they COUNT exactly as payroll
// would count them, with no Live tag. liveReport gives each such day a stand-in payroll row
// from Teramind and lets the real buildAttendanceReport (real engine helpers) decide.

const helpers = { isScheduledWorkDay, getSchedule, parseTimeToMinutes };

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

const form = (date: string, type: string, submitted: string, id = 1): ReportForm => ({
  employee_id: id, form_date: date, form_type: type, reason: 'Car trouble', details: '', eta: '',
  submitted_at: submitted, employee_email_raw: 'ana@x.com', monday_item_id: '9',
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
  noBasePay?: boolean;
};

// The processed Sep 25 payroll row is there unless noBasePay, so Ana "has payroll" like a real employee.
function both(s: Scn = {}): { input: ReportInput; main: ReportOutput; out: ReportOutput } {
  const dateFrom = s.dateFrom ?? MON, dateTo = s.dateTo ?? '2026-10-09', today = s.today ?? TODAY;
  const input: ReportInput = {
    dateFrom, dateTo, employees: s.employees ?? [emp()],
    payrollRows: [...(s.noBasePay ? [] : [pay()]), ...(s.payrollRows ?? [])],
    forms: s.forms ?? [], requests: s.requests ?? [], holidays: s.holidays ?? [],
    periods: PERIODS, dstWindows: DST, helpers,
  };
  const main = buildAttendanceReport(input);
  const out = liveReport({
    input, main, window: liveWindow(PERIODS, dateFrom, dateTo, today), today,
    tmRows: s.tmRows ?? [], build: buildAttendanceReport,
  });
  return { input, main, out };
}
const run = (s: Scn = {}): ReportRow[] => both(s).out.rows;
const day = (rows: ReportRow[], date: string, id = 1) =>
  rows.find((r) => r.date === date && r.employeeId === id);
const one = (date: string, s: Scn = {}) => run({ dateFrom: date, dateTo: date, ...s });

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

test('LW4: livePeriod makes the window a processed period', () => {
  assert.deepEqual(livePeriod({ from: '2026-09-26', to: TODAY }),
    { period_name: '', start_date: '2026-09-26', end_date: TODAY, processed_at: 'live' });
});

// ── worked days: late / on time by payroll's rule (entry − scheduled start, no grace) ──

test('LC1: worked 8:05 vs 8:00 start, no form → late_no_form, counted in the KPIs', () => {
  const rows = one(MON, { tmRows: [tm(MON, { first_min: 485, last_min: 965 })] });
  const r = day(rows, MON)!;
  assert.equal(r.verdict, 'late_no_form');
  assert.equal(r.countsToScore, true);
  assert.equal(r.minutesLate, 5);
  assert.equal(r.entryTime, '8:05 AM');
  assert.equal(r.exitTime, '4:05 PM');
  assert.equal(r.scheduledStart, '8:00 AM');
  assert.equal('live' in r, false, 'no live tag on the row');
  const k = reportRowsToKpis(rows);
  assert.equal(k.lateDays, 1);
  assert.equal(k.lateUnreported, 1);
  assert.equal(k.daysTracked, 1);
  assert.equal(k.avgMinLate, 5);
});

test('LC2: late with a Tardiness form sent before the shift → late_reported_on_time', () => {
  const rows = one(MON, { tmRows: [tm(MON)], forms: [form(MON, 'Tardiness', '2026-09-28 07:30')] });
  assert.equal(day(rows, MON)!.verdict, 'late_reported_on_time');
  assert.equal(reportRowsToKpis(rows).lateReported, 1);
  const after = one(MON, { tmRows: [tm(MON)], forms: [form(MON, 'Tardiness', '2026-09-28 09:30')] });
  assert.equal(day(after, MON)!.verdict, 'late_reported_late');
});

test('LC3: worked 7:55 → on time; 8:00 sharp → on time (no grace needed)', () => {
  assert.equal(day(one(MON, { tmRows: [tm(MON, { first_min: 475 })] }), MON)!.verdict, 'on_time');
  const r = day(one(MON, { tmRows: [tm(MON, { first_min: 480 })] }), MON)!;
  assert.equal(r.verdict, 'on_time');
  assert.equal(r.minutesLate, 0);
});

test('LC4: lateness uses the DST-aware schedule (summer pair before Nov 1, winter after)', () => {
  const az = emp({ dst_start: '9:00 AM', dst_end: '5:00 PM' });   // summer 9, winter 8
  const sep = day(one(MON, { employees: [az], tmRows: [tm(MON, { first_min: 545 })] }), MON)!;
  assert.equal(sep.scheduledStart, '9:00 AM');
  assert.equal(sep.minutesLate, 5);
  const nov = day(run({
    dateFrom: '2026-11-02', dateTo: '2026-11-02', today: '2026-11-03', employees: [az],
    tmRows: [tm('2026-11-02', { first_min: 545 })],
  }), '2026-11-02')!;
  assert.equal(nov.scheduledStart, '8:00 AM');
  assert.equal(nov.minutesLate, 65);
});

test('LC5: midnight-crossing shift (10 PM start) → on time, exit shown 2:00 AM', () => {
  const night = emp({ id: 2, name: 'Nico', email: 'nico@x.com',
    standard_start: '10:00 PM', standard_end: '6:00 AM', dst_start: '10:00 PM', dst_end: '6:00 AM' });
  const r = day(one(THU, {
    employees: [night],
    tmRows: [tm(THU, { employee_id: 2, first_min: 1320, last_ymd: ymdInt(FRI), last_min: 120 })],
  }), THU, 2)!;
  assert.equal(r.verdict, 'on_time');
  assert.equal(r.entryTime, '10:00 PM');
  assert.equal(r.exitTime, '2:00 AM');
  assert.equal(r.minutesLate, 0);
});

// ── past scheduled days with no punches: as payroll would classify them ──

test('LC6: no punches, nothing on file → unexplained absence, counted', () => {
  const rows = one(WED);
  const r = day(rows, WED)!;
  assert.equal(r.verdict, 'unexplained_absence');
  assert.equal(r.countsToScore, true);
  assert.equal(r.entryTime, null);
  const k = reportRowsToKpis(rows);
  assert.equal(k.absent, 1);
  assert.equal(k.unreported, 1);
  assert.equal(k.onTimeRate, 0);
});

test('LC7: PTO request → pto (time off), not scored', () => {
  const rows = one(WED, {
    requests: [{ employee_id: 1, request_type: 'PTO / Vacation', permission_type: '',
      start_date: WED, end_date: WED, return_date: THU }],
  });
  const r = day(rows, WED)!;
  assert.equal(r.verdict, 'pto');
  assert.equal(r.coveredBy!.label, 'PTO / Vacation');
  const k = reportRowsToKpis(rows);
  assert.equal(k.excused, 1);
  assert.equal(k.daysTracked, 0);
  assert.equal(k.workDays, 1);
});

test('LC8: Time Off / Permission request → permission', () => {
  const r = day(one(WED, {
    requests: [{ employee_id: 1, request_type: 'Time Off / Permission', permission_type: '',
      start_date: WED, end_date: WED, return_date: null }],
  }), WED)!;
  assert.equal(r.verdict, 'permission');
});

test('LC9: holiday → holiday, even with punches', () => {
  assert.equal(day(one(MON2, { holidays: [{ date: MON2, name: 'Feriado' }] }), MON2)!.verdict, 'holiday');
  const worked = day(one(MON2, { holidays: [{ date: MON2, name: 'Feriado' }], tmRows: [tm(MON2)] }), MON2)!;
  assert.equal(worked.verdict, 'holiday');
  assert.equal(worked.entryTime, '8:05 AM');
});

test('LC10: Absence form, no punches → Ausencia Justificada. → time off, as payroll writes it', () => {
  const rows = one(FRI, { forms: [form(FRI, 'Absence', '2026-10-02 07:30')] });
  const r = day(rows, FRI)!;
  assert.equal(r.verdict, 'pto');
  assert.equal(r.coveredBy!.label, 'Ausencia Justificada.');
  assert.equal(reportRowsToKpis(rows).absent, 0);
});

test('LC11: Tardiness form but no punches → absence reported (payroll: Ausencia Injustificada + form)', () => {
  const r = day(one(FRI, { forms: [form(FRI, 'Tardiness', '2026-10-02 07:30')] }), FRI)!;
  assert.equal(r.verdict, 'absent_reported_on_time');
  assert.equal(r.flags.recordedUnexplainedButFormOnFile, true);
});

// ── today ────────────────────────────────────────────────────────────────

test('LC12: TODAY with no punches yet → not counted (day not over), even with an Absence form', () => {
  for (const forms of [[], [form(TODAY, 'Absence', '2026-10-06 07:00')]]) {
    const rows = one(TODAY, { forms });
    const r = day(rows, TODAY)!;
    assert.equal(r.verdict, 'not_processed');
    assert.equal(r.countsToScore, false);
    assert.equal(reportRowsToKpis(rows).workDays, 0);
  }
});

test('LC13: TODAY with punches → counted by its entry; no exit yet', () => {
  const rows = one(TODAY, { tmRows: [tm(TODAY, { first_min: 490, last_min: 600 })] });
  const r = day(rows, TODAY)!;
  assert.equal(r.verdict, 'late_no_form');
  assert.equal(r.minutesLate, 10);
  assert.equal(r.entryTime, '8:10 AM');
  assert.equal(r.exitTime, null);
  assert.equal(reportRowsToKpis(rows).lateDays, 1);
  assert.equal(day(one(TODAY, { tmRows: [tm(TODAY, { first_min: 470 })] }), TODAY)!.verdict, 'on_time');
});

test('LC14: TODAY covered by PTO stays PTO (as before)', () => {
  const r = day(one(TODAY, {
    requests: [{ employee_id: 1, request_type: 'PTO / Vacation', permission_type: '',
      start_date: TODAY, end_date: TODAY, return_date: null }],
  }), TODAY)!;
  assert.equal(r.verdict, 'pto');
});

// ── payroll wins, window edges ──────────────────────────────────────────

test('LC15: a payroll row in the window wins over Teramind and nothing is duplicated', () => {
  const rows = run({
    payrollRows: [pay({ work_date: TUE, entry_time: '8:30 AM', late_minutes: 30, period_name: 'Q1-Oct-2026' })],
    tmRows: [tm(TUE, { first_min: 470 })],
  });
  const tue = rows.filter((r) => r.date === TUE);
  assert.equal(tue.length, 1);
  assert.equal(tue[0].entryTime, '8:30 AM');
  assert.equal(tue[0].minutesLate, 30);
  assert.equal(tue[0].verdict, 'late_no_form');
  const keys = rows.map((r) => `${r.employeeId}|${r.date}`);
  assert.equal(new Set(keys).size, keys.length, 'one row per employee and day');
});

test('LC16: days before the window are exactly the processed report; future days stay uncounted', () => {
  const { main, out } = both({ dateFrom: '2026-09-21', tmRows: [tm('2026-09-24'), tm('2026-10-07')] });
  const before = (rows: ReportRow[]) => rows.filter((r) => r.date < '2026-09-26');
  assert.deepEqual(before(out.rows), before(main.rows));
  assert.equal(day(out.rows, '2026-09-24')!.verdict, 'unexplained_absence');   // processed, no payroll row
  assert.equal(day(out.rows, '2026-09-25')!.verdict, 'on_time');
  for (const d of ['2026-10-07', '2026-10-08', '2026-10-09']) {
    const r = day(out.rows, d)!;
    assert.equal(r.verdict, 'not_processed');
    assert.equal(r.entryTime, null);
  }
  assert.equal(day(out.rows, SAT), undefined, 'a day off never becomes a row');
});

test('LC17: an employee payroll never ran for keeps processed days uncounted; live days count', () => {
  const { out } = both({ dateFrom: '2026-09-21', noBasePay: true, tmRows: [tm(MON)] });
  assert.equal(day(out.rows, '2026-09-22')!.verdict, 'not_processed');
  assert.equal(day(out.rows, MON)!.verdict, 'late_no_form');
  assert.equal(day(out.rows, WED)!.verdict, 'unexplained_absence');
});

test('LC18: start date respected — no rows before it', () => {
  const rows = run({ employees: [emp({ start_date: THU })], tmRows: [tm(MON), tm(THU)] });
  assert.equal(day(rows, MON), undefined);
  assert.equal(day(rows, THU)!.verdict, 'late_no_form');
});

test('LC19: no window → main report returned unchanged', () => {
  const { main, out } = both({ dateFrom: '2026-09-01', dateTo: '2026-09-25', tmRows: [tm('2026-09-24')] });
  assert.equal(out, main);
});

// ── summaries ────────────────────────────────────────────────────────────

test('LS1: summarizeRows reproduces buildAttendanceReport perEmployee', () => {
  const { input, main } = both({
    dateFrom: '2026-09-01',
    payrollRows: [pay({ work_date: '2026-09-24', entry_time: '8:20 AM', late_minutes: 20 })],
    forms: [form('2026-09-24', 'Tardiness', '2026-09-24 07:00')],
    holidays: [{ date: '2026-09-15', name: 'Feriado' }],
  });
  assert.deepEqual(summarizeRows(main.rows, input.employees), main.perEmployee);
});

test('LS2: perEmployee after liveReport counts the unprocessed days', () => {
  const { out } = both({ tmRows: [tm(MON), tm(TUE, { first_min: 470 })] });
  const [s] = out.perEmployee;
  // MON late, TUE on time, WED THU FRI MON2 absent, TODAY not counted, Oct 7-9 future
  assert.equal(s.expectedDays, 6);
  assert.equal(s.onTime, 1);
  assert.equal(s.lateDays, 1);
  assert.equal(s.unexplainedAbsences, 4);
});

test('LP0: livePayrollRows — Teramind text times, engine events, no row for payroll / today without punches', () => {
  const { main } = both({
    payrollRows: [pay({ work_date: TUE, period_name: 'Q1-Oct-2026' })],
    forms: [form(THU, 'Absence', '2026-10-01 07:00')],
  });
  const rows = livePayrollRows({
    rows: main.rows, payrollRows: [pay(), pay({ work_date: TUE })], tmRows: [tm(MON)],
    window: { from: '2026-09-26', to: TODAY }, today: TODAY, parseTimeToMinutes,
  });
  const at = (d: string) => rows.find((r) => r.work_date === d);
  assert.equal(at(TUE), undefined, 'payroll wins');
  assert.equal(at(TODAY), undefined, 'today without punches');
  assert.equal(at(MON)!.entry_time, '8:05 AM');
  assert.equal(at(MON)!.late_minutes, 5);
  assert.equal(at(WED)!.event_type_1, 'Ausencia Injustificada');
  assert.equal(at(THU)!.event_type_1, 'Ausencia Justificada.');
  assert.equal(at(THU)!.documentation, 'Attendance Form');
});

// ── source guards ────────────────────────────────────────────────────────

for (const f of ['liveAttendance.ts', 'liveListRows.ts', 'attendancePeriods.ts']) {
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
  test(`LG: ${f} stays under 15,000 bytes, gains no runtime import, carries no live fields`, () => {
    const src = readFileSync(fileURLToPath(new URL(`../src/app/lib/${f}`, import.meta.url)), 'utf8');
    assert.ok(Buffer.byteLength(src) < 15000);
    for (const line of src.split('\n')) {
      if (/^\s*import\s/.test(line)) assert.match(line, /^\s*import\s+type\s/, `runtime import: ${line}`);
    }
    assert.doesNotMatch(src, /LiveInfo|live\?:|live_label|liveDays|liveLate/);
  });
}
