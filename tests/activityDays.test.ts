import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildActivityDays, whyFor, fmtDayShort, payrollLabelToEnglish,
  thresholdFor, shiftMinutesOf, parseClock, addDays, toYmd, titleCase,
  type ActivityDayRow, type ActivityEmployee, type ActivitySettings, type ActivityDay,
} from '../src/app/lib/activityDays.ts';
import type { ReportRow, ReportRequest } from '../src/app/lib/attendanceReportTypes.ts';

const SRC_PATH = fileURLToPath(
  new URL('../src/app/lib/activityDays.ts', import.meta.url),
);

// ── Fake schedule helper (the page injects classificationEngine's) ──────────────────────────

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dowOf(date: string): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10));
  const yy = m < 3 ? y - 1 : y;
  return (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1]! + d) % 7;
}

function isScheduledWorkDay(emp: unknown, date: string): boolean {
  const name = DOW[dowOf(date)]!;
  const wd = String((emp as { work_days?: string } | null)?.work_days ?? '').trim();
  if (wd !== '') return wd.split(',').map((s) => s.trim()).includes(name);
  return name !== 'Sat' && name !== 'Sun';
}

// ── Fixtures ───────────────────────────────────────────────────────────────────────────────

const MON = '2026-09-14', TUE = '2026-09-15', WED = '2026-09-16', THU = '2026-09-17';
const FRI = '2026-09-18';   // "today" in most tests
const SAT = '2026-09-19';

const SETTINGS: ActivitySettings = { minActiveMinutes: 390, breakMinutes: 60, breakOverMinutes: 30 };

function ymdInt(date: string): number {
  return Number(date.replace(/-/g, ''));
}

function mkEmp(o: Partial<ActivityEmployee> = {}): ActivityEmployee {
  return {
    id: 1, name: 'Alice', role: 'Agent', manager: 'Bob',
    work_days: '', schedule_start: '08:00', schedule_end: '16:00',
    ...o,
  };
}

// 8:00 AM -> 4:40 PM, 460 active minutes: a clean, unflagged day.
function mkRow(date: string, o: Partial<ActivityDayRow> = {}): ActivityDayRow {
  return {
    employee_id: 1, work_date: ymdInt(date),
    first_min: 480, last_ymd: ymdInt(date), last_min: 1000,
    active_s: 460 * 60, records: 20, largest_gap_min: 0, gap_start_min: 0,
    has_manual: false, accounts: 1, synced_at: '2026-09-18T12:00:00Z',
    ...o,
  };
}

function mkReport(date: string, o: Partial<ReportRow> = {}): ReportRow {
  return {
    employeeId: 1, employeeName: 'Alice', email: 'alice@x.com', role: 'Agent', manager: 'Bob',
    date, scheduledStart: '08:00', entryTime: '08:00', exitTime: '16:40',
    minutesLate: 0, earlyLeaveMinutes: 0,
    form: null, allForms: [], coveredBy: null, verdict: 'on_time', countsToScore: true,
    flags: {
      multipleForms: false, recordedUnexplainedButFormOnFile: false,
      formEmailUnrecognised: false, excusedInPayrollNoRequest: false,
    },
    ...o,
  };
}

function mkForm(type: string, reason = ''): NonNullable<ReportRow['form']> {
  return { type, reason, details: '', eta: '', submittedAt: null, submittedMinutes: null, onTime: true, mondayItemId: '1' };
}

function mkRequest(o: Partial<ReportRequest> = {}): ReportRequest {
  return {
    employee_id: 1, request_type: 'Work From Home', permission_type: '',
    start_date: null, end_date: null, return_date: null,
    ...o,
  };
}

type RunArgs = Parameters<typeof buildActivityDays>[0];

function run(o: Partial<RunArgs> = {}): ReturnType<typeof buildActivityDays> {
  return buildActivityDays({
    dateFrom: MON, dateTo: FRI, today: FRI,
    employees: [mkEmp()], rows: [], reportRows: [], requests: [],
    settings: SETTINGS, isScheduledWorkDay,
    ...o,
  });
}

function dayOn(days: ActivityDay[], date: string): ActivityDay | undefined {
  return days.find((d) => d.date === date);
}

// ── Source hygiene ─────────────────────────────────────────────────────────────────────────

test('source has no runtime imports, no Date maths, and stays under the 15 KB cap', () => {
  const src = readFileSync(SRC_PATH, 'utf8');
  const runtimeImports = src.split('\n').filter((l) => /^\s*import\b/.test(l) && !/^\s*import\s+type\b/.test(l));
  assert.deepEqual(runtimeImports, []);
  assert.equal(/new Date\s*\(/.test(src), false);
  assert.equal(/Date\.now/.test(src), false);
  assert.equal(/toISOString/.test(src), false);
  assert.ok(Buffer.byteLength(src, 'utf8') < 15 * 1024, `lib is ${Buffer.byteLength(src, 'utf8')} bytes`);
});

// ── Small helpers ──────────────────────────────────────────────────────────────────────────

test('fmtDayShort formats as "Wed Sep 16"', () => {
  assert.equal(fmtDayShort('2026-09-16'), 'Wed Sep 16');
  // 2026-09-11 really is a Friday (the contract's "Wed Sep 11" is a shape example, not a date).
  assert.equal(fmtDayShort('2026-09-11'), 'Fri Sep 11');
  assert.equal(fmtDayShort('2026-01-01'), 'Thu Jan 1');
  assert.equal(fmtDayShort('2026-09-16T00:00:00'), 'Wed Sep 16');
});

test('addDays rolls month and year without Date', () => {
  assert.equal(addDays('2026-09-16', 1), '2026-09-17');
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
});

test('toYmd and parseClock', () => {
  assert.equal(toYmd(20260911), '2026-09-11');
  assert.equal(parseClock('08:02'), 482);
  assert.equal(parseClock('8:02 AM'), 482);
  assert.equal(parseClock('4:40 PM'), 1000);
  assert.equal(parseClock('12:30 AM'), 30);
  assert.equal(parseClock(''), null);
  assert.equal(parseClock(null), null);
});

test('payrollLabelToEnglish translates the payroll labels', () => {
  assert.equal(payrollLabelToEnglish('Incapacidad'), 'Sick');
  assert.equal(payrollLabelToEnglish('Permiso Remunerado'), 'Permission');
  assert.equal(payrollLabelToEnglish('Permiso No remunerado'), 'Permission');
  assert.equal(payrollLabelToEnglish('Feriado'), 'Holiday');
  assert.equal(payrollLabelToEnglish('compensatory day'), 'Compensatory Day');
  assert.equal(payrollLabelToEnglish('PTO'), 'PTO');
  assert.equal(titleCase('sick leave'), 'Sick Leave');
});

// ── Threshold scales with the shift ────────────────────────────────────────────────────────

test('threshold scales by shift length', () => {
  assert.equal(shiftMinutesOf('08:00', '16:00'), 480);
  assert.equal(shiftMinutesOf('08:00', '12:00'), 240);
  assert.equal(shiftMinutesOf('22:00', '06:00'), 480);      // crosses midnight
  assert.equal(shiftMinutesOf('', ''), 480);                // default
  assert.equal(thresholdFor(480, SETTINGS), 390);
  assert.equal(thresholdFor(240, SETTINGS), 195);
});

test('a half-shift employee is not flagged at a full-shift threshold', () => {
  const short = mkEmp({ id: 2, name: 'Zoe', schedule_start: '08:00', schedule_end: '12:00' });
  const row = mkRow(THU, { employee_id: 2, first_min: 480, last_min: 720, last_ymd: ymdInt(THU), active_s: 200 * 60 });
  const half = run({ employees: [short], rows: [row] });
  assert.equal(dayOn(half.days, THU)!.shiftMinutes, 240);
  assert.equal(dayOn(half.days, THU)!.flag, null);
  assert.equal(dayOn(half.days, THU)!.needsLook, false);

  const full = run({
    employees: [mkEmp()],
    rows: [mkRow(THU, { first_min: 480, last_min: 720, active_s: 200 * 60 })],
  });
  assert.equal(dayOn(full.days, THU)!.flag, 'low_activity');
  assert.equal(dayOn(full.days, THU)!.needsLook, true);
});

// ── Cross-midnight ─────────────────────────────────────────────────────────────────────────

test('a cross-midnight day spans into the next date', () => {
  const row = mkRow(THU, {
    first_min: 1320, last_ymd: ymdInt(FRI), last_min: 360, active_s: 420 * 60,
  });
  const { days } = run({ rows: [row] });
  const d = dayOn(days, THU)!;
  assert.equal(d.crossesMidnight, true);
  assert.equal(d.firstMin, 1320);
  assert.equal(d.lastMin, 360);
  assert.equal(d.activeMin, 420);
  assert.equal(d.breaksMin, 60);          // (360 + 1440 - 1320) - 420
  assert.equal(d.flag, null);
});

// ── Why chips ──────────────────────────────────────────────────────────────────────────────

test('holiday, PTO, permission and a sick form give a chip and are never flagged', () => {
  const cases: { row: ReportRow; requests?: ReportRequest[]; kind: string; label: string }[] = [
    { row: mkReport(THU, { coveredBy: { kind: 'holiday', label: 'Independence Day' }, verdict: 'holiday', entryTime: null, exitTime: null }), kind: 'holiday', label: 'Holiday · Independence Day' },
    { row: mkReport(THU, { coveredBy: { kind: 'pto', label: 'PTO' }, verdict: 'pto', entryTime: null, exitTime: null }), kind: 'pto', label: 'PTO' },
    { row: mkReport(THU, { coveredBy: { kind: 'permission', label: 'Permiso Remunerado' }, verdict: 'permission', entryTime: null, exitTime: null }), kind: 'permission', label: 'Permission' },
    { row: mkReport(THU, { form: mkForm('Sick Leave'), verdict: 'absent_reported_on_time', entryTime: null, exitTime: null }), kind: 'sick', label: 'Sick' },
    { row: mkReport(THU, { form: mkForm('Attendance Report'), verdict: 'absent_reported_on_time', entryTime: null, exitTime: null }), kind: 'sick', label: 'Sick' },
    { row: mkReport(THU, { form: mkForm('late arrival'), verdict: 'late_reported_on_time', entryTime: null, exitTime: null }), kind: 'form', label: 'Late Arrival' },
    // The Monday board files sick days as type Absence with reason Sick (seen 2026-09-18)
    { row: mkReport(THU, { form: mkForm('Absence', 'Sick'), verdict: 'absent_reported_on_time', entryTime: null, exitTime: null }), kind: 'sick', label: 'Sick' },
    { row: mkReport(THU, { form: mkForm('Tardiness', ''), verdict: 'late_reported_on_time', entryTime: null, exitTime: null }), kind: 'form', label: 'Tardiness' },
  ];
  for (const c of cases) {
    const { days } = run({ reportRows: [c.row], requests: c.requests ?? [] });
    const d = dayOn(days, THU)!;
    assert.equal(d.why?.kind, c.kind);
    assert.equal(d.why?.label, c.label);
    assert.equal(d.flag, null, `${c.kind} must never be flagged`);
    assert.equal(d.needsLook, false, `${c.kind} must never need a look`);
  }
});

test('a captured payroll label of Incapacidad reads as Sick', () => {
  const rr = mkReport(THU, { coveredBy: { kind: 'pto', label: 'Incapacidad' }, verdict: 'pto', entryTime: null, exitTime: null });
  const { days } = run({ reportRows: [rr] });
  assert.equal(dayOn(days, THU)!.why?.kind, 'sick');
  assert.equal(dayOn(days, THU)!.why?.label, 'Sick');
  assert.equal(dayOn(days, THU)!.needsLook, false);
});

test('permission shows its hours when the request carries a time range', () => {
  const rr = mkReport(THU, { coveredBy: { kind: 'permission', label: 'Permiso Remunerado' }, verdict: 'permission', entryTime: null, exitTime: null });
  const req = mkRequest({ request_type: 'Permission', permission_type: '8:00 AM - 12:00 PM', start_date: THU, end_date: THU });
  const { days } = run({ reportRows: [rr], requests: [req] });
  assert.equal(dayOn(days, THU)!.why?.label, 'Permission 8:00 AM - 12:00 PM');

  const plain = mkRequest({ request_type: 'Permission', permission_type: 'Full Day', start_date: THU, end_date: THU });
  const { days: d2 } = run({ reportRows: [rr], requests: [plain] });
  assert.equal(dayOn(d2, THU)!.why?.label, 'Permission');
});

test('WFH is context only — it does not excuse a low-activity day', () => {
  const rr = mkReport(THU);
  const wfh = mkRequest({ request_type: 'Work From Home', start_date: THU, end_date: THU });
  const good = run({ rows: [mkRow(THU)], reportRows: [rr], requests: [wfh] });
  assert.equal(dayOn(good.days, THU)!.why?.kind, 'wfh');
  assert.equal(dayOn(good.days, THU)!.why?.label, 'WFH');
  assert.equal(dayOn(good.days, THU)!.flag, null);

  const thin = run({
    rows: [mkRow(THU, { active_s: 100 * 60 })], reportRows: [rr], requests: [wfh],
  });
  assert.equal(dayOn(thin.days, THU)!.why?.kind, 'wfh');
  assert.equal(dayOn(thin.days, THU)!.flag, 'low_activity');
  assert.equal(dayOn(thin.days, THU)!.needsLook, true);
});

test('whyFor on its own: not scheduled with no activity has nothing to say', () => {
  assert.equal(whyFor({ reportRow: null, requests: [], scheduled: false, hasActivity: false }), null);
  assert.equal(whyFor({ reportRow: null, requests: [], scheduled: true, hasActivity: true }), null);
  assert.equal(whyFor({ reportRow: null, requests: [], scheduled: false, hasActivity: true })?.kind, 'day_off');
  assert.equal(whyFor({ reportRow: null, requests: [], scheduled: true, hasActivity: false })?.kind, 'none');
});

// ── Rows that exist and rows that do not ───────────────────────────────────────────────────

test('not scheduled and no activity produces no row at all', () => {
  const { days } = run({ dateFrom: MON, dateTo: SAT, today: '2026-09-21' });
  assert.equal(dayOn(days, SAT), undefined);
  assert.equal(days.length, 5);   // Mon-Fri only
});

test('not scheduled but active gives a Day Off chip and no flag', () => {
  const { days } = run({ dateFrom: MON, dateTo: SAT, today: '2026-09-21', rows: [mkRow(SAT, { active_s: 90 * 60 })] });
  const d = dayOn(days, SAT)!;
  assert.equal(d.scheduled, false);
  assert.equal(d.why?.kind, 'day_off');
  assert.equal(d.why?.label, 'Day Off');
  assert.equal(d.flag, null);
  assert.equal(d.needsLook, false);
  assert.equal(d.activeMin, 90);
});

test('a bare empty scheduled day reads No Reports Yet, and today is never in needs-a-look', () => {
  const { days, totals } = run({});
  const past = dayOn(days, THU)!;
  assert.equal(past.why?.kind, 'none');
  assert.equal(past.why?.label, 'No Reports Yet');
  assert.equal(past.why?.tone, 'amber');
  assert.equal(past.records, 0);
  assert.equal(past.needsLook, true);

  const today = dayOn(days, FRI)!;
  assert.equal(today.isToday, true);
  assert.equal(today.why?.label, 'No Reports Yet');
  assert.equal(today.flag, null);
  assert.equal(today.needsLook, false);
  assert.equal(totals.needsLook, 4);   // Mon-Thu, not today
});

// ── Averages, caps, punches ────────────────────────────────────────────────────────────────

test('average active divides by days worked only', () => {
  const rows = [
    mkRow(MON, { first_min: 480, last_min: 1000, active_s: 400 * 60 }),
    mkRow(TUE, { first_min: 480, last_min: 1020, active_s: 500 * 60 }),
  ];
  const { byEmployee, totals } = run({ rows });
  const e = byEmployee[0]!;
  assert.equal(e.scheduledDays, 5);
  assert.equal(e.daysWorked, 2);
  assert.equal(e.avgActiveMin, 450);          // (400 + 500) / 2, not / 5
  assert.equal(e.avgFirstMin, 480);
  assert.equal(e.avgLastMin, 1010);
  assert.equal(totals.daysWorked, 2);
  assert.equal(totals.avgActiveMin, 450);
});

test('multi-account active is capped at (last - first)', () => {
  const row = mkRow(THU, { first_min: 480, last_min: 900, active_s: 600 * 60, accounts: 2 });
  const { days } = run({ rows: [row] });
  const d = dayOn(days, THU)!;
  assert.equal(d.accounts, 2);
  assert.equal(d.activeMin, 420);   // capped at 900 - 480, not 600
  assert.equal(d.breaksMin, 0);
});

test('official and edited come from the payroll entry vs Teramind', () => {
  const clean = run({ rows: [mkRow(THU)], reportRows: [mkReport(THU)] });
  const c = dayOn(clean.days, THU)!;
  assert.equal(c.official, true);
  assert.equal(c.officialEntryMin, 480);
  assert.equal(c.officialExitMin, 1000);
  assert.equal(c.edited, false);

  const edited = run({ rows: [mkRow(THU)], reportRows: [mkReport(THU, { entryTime: '08:05' })] });
  assert.equal(dayOn(edited.days, THU)!.edited, true);

  const raw = run({ rows: [mkRow(THU)], reportRows: [mkReport(THU, { verdict: 'not_processed' })] });
  assert.equal(dayOn(raw.days, THU)!.official, false);
  assert.equal(dayOn(raw.days, THU)!.edited, false);

  const noReport = run({ rows: [mkRow(THU)] });
  assert.equal(dayOn(noReport.days, THU)!.official, false);
  assert.equal(dayOn(noReport.days, THU)!.officialEntryMin, null);
});

test('a long break is flagged when the gap runs past the allowance', () => {
  const row = mkRow(THU, { first_min: 480, last_min: 1080, active_s: 460 * 60, largest_gap_min: 140, gap_start_min: 720 });
  const { days } = run({ rows: [row] });
  const d = dayOn(days, THU)!;
  assert.equal(d.breaksMin, 140);         // 600 span - 460 active, over 60 + 30
  assert.equal(d.largestGapMin, 140);
  assert.equal(d.gapStartMin, 720);
  assert.equal(d.flag, 'long_break');
  assert.equal(d.needsLook, false);       // needs-a-look is the low-activity list only
});

// ── Shape and totals ───────────────────────────────────────────────────────────────────────

test('byEmployee lists days newest first', () => {
  const { byEmployee } = run({ rows: [mkRow(MON), mkRow(WED)] });
  const dates = byEmployee[0]!.days.map((d) => d.date);
  assert.deepEqual(dates, [FRI, THU, WED, TUE, MON]);
});

test('away days are counted and labelled', () => {
  const reportRows = [
    mkReport(MON, { coveredBy: { kind: 'pto', label: 'PTO' }, verdict: 'pto', entryTime: null, exitTime: null }),
    mkReport(TUE, { form: mkForm('Sick Leave'), verdict: 'absent_reported_on_time', entryTime: null, exitTime: null }),
  ];
  const { byEmployee } = run({ reportRows });
  const e = byEmployee[0]!;
  assert.equal(e.awayDays, 2);
  assert.equal(e.awayLabel, '2 · PTO, Sick');
});

test('a Tardiness form on a worked day is context: not away, and it does not excuse low activity', () => {
  // Worked THU with a Tardiness form but only 3 h active (threshold 6.5 h) -> still flagged.
  const rr = mkReport(THU, { form: mkForm('Tardiness'), verdict: 'late_reported_on_time', entryTime: null, exitTime: null });
  const { days, byEmployee } = run({ reportRows: [rr], rows: [mkRow(THU, { active_s: 180 * 60 })] });
  const d = dayOn(days, THU)!;
  assert.equal(d.why?.label, 'Tardiness');
  assert.equal(d.flag, 'low_activity');
  assert.equal(d.needsLook, true);
  assert.equal(byEmployee[0]!.awayDays, 0);
  // The same form on a day with NO activity is an away day and is not flagged.
  const { days: days2, byEmployee: by2 } = run({ reportRows: [rr], rows: [] });
  assert.equal(dayOn(days2, THU)!.flag, null);
  assert.equal(by2[0]!.awayDays, 1);
  assert.equal(by2[0]!.awayLabel, '1 · Tardiness');
});
test('a captured day with hand-typed punches and no Teramind record still counts as worked', () => {
  const rr = mkReport(THU, { verdict: 'on_time', entryTime: '08:00', exitTime: '11:30' });
  const { days } = run({ reportRows: [rr], rows: [] });
  const d = dayOn(days, THU)!;
  assert.equal(d.why, null, 'not No Reports Yet');
  assert.equal(d.official, true);
  assert.equal(d.shownFirstMin, 8 * 60);
  assert.equal(d.shownLastMin, 11 * 60 + 30);
  assert.equal(d.firstMin, null, 'Teramind side stays empty');
});

test('shown First / Last prefer the official punch once captured, else Teramind', () => {
  const rr = mkReport(THU, { verdict: 'on_time', entryTime: '08:05', exitTime: '17:00' });
  const { days } = run({ reportRows: [rr], rows: [mkRow(THU, { first_min: 490, last_min: 1030 })] });
  const d = dayOn(days, THU)!;
  assert.equal(d.shownFirstMin, 8 * 60 + 5);
  assert.equal(d.shownLastMin, 17 * 60);
  const { days: live } = run({ rows: [mkRow(THU, { first_min: 490, last_min: 1030 })] });
  assert.equal(dayOn(live, THU)!.shownFirstMin, 490);
  assert.equal(dayOn(live, THU)!.shownLastMin, 1030);
});
test('totals.lateArrivals counts days that started after the scheduled start', () => {
  const rows = [
    mkRow(MON, { first_min: 500 }),                        // 20 min late, report row says 08:00
    mkRow(TUE, { first_min: 480 }),                        // on time
    mkRow(WED, { first_min: 495 }),                        // late, no report row -> employee schedule_start
  ];
  const { totals } = run({ rows, reportRows: [mkReport(MON), mkReport(TUE)] });
  assert.equal(totals.lateArrivals, 2);

  // A later scheduled start on the payroll row wins over the employee default.
  const shifted = run({ rows: [mkRow(MON, { first_min: 500 })], reportRows: [mkReport(MON, { scheduledStart: '09:00' })] });
  assert.equal(shifted.totals.lateArrivals, 0);
});

test('two employees keep their own days and summaries', () => {
  const emps = [mkEmp(), mkEmp({ id: 2, name: 'Zoe' })];
  const rows = [mkRow(THU), mkRow(THU, { employee_id: 2, work_date: ymdInt(THU), active_s: 100 * 60 })];
  const { days, byEmployee, totals } = run({ employees: emps, rows });
  assert.equal(byEmployee.length, 2);
  assert.deepEqual(byEmployee.map((e) => e.employeeName), ['Alice', 'Zoe']);
  assert.equal(byEmployee[0]!.needsLook, 3);   // Mon, Tue, Wed empty; Thu is fine; Fri is today
  assert.equal(byEmployee[1]!.needsLook, 4);   // same three, plus a thin Thu
  assert.equal(days.length, 10);
  assert.equal(totals.daysWorked, 2);
});
