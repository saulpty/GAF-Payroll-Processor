// Why tags, app-wide (prompt 2026-10-16-punctuality/01-why-tags-late-and-unreported.md).
//
// EXPECTED TO FAIL until that prompt is pasted into UI Bakery and the export is synced:
// minutesLateFor does not exist yet, whyFor still tags every Tardiness form, and there is no
// red "Not Reported" tag. Every other test file must keep passing before and after.
//
// What it pins (Saul, 2026-10-16, on Nichole Harris, 9:00 AM - 5:00 PM):
//  - a Tardiness form on a day the person came in on time shows NO tag (Mon Oct 12 8:57,
//    Thu Oct 15 8:56 used to read "Tardiness");
//  - late with no form on file shows a red "Not Reported" tag;
//  - late with a form shows the form's tag; sick forms and forms on no-punch days are unchanged;
//  - "late" means what it means everywhere else: payroll's late minutes on a day with a payroll
//    row, and on a live day the first Teramind record against the scheduled start, exactly the
//    late_minutes liveAttendance.livePayrollRows writes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as days from '../src/app/lib/activityDays.ts';
import { livePayrollRows } from '../src/app/lib/liveAttendance.ts';
import type { ReportRow, ReportRequest } from '../src/app/lib/attendanceReportTypes.ts';
import type { ActivityDayRow, ActivityEmployee, ActivitySettings } from '../src/app/lib/activityTypes.ts';

const { whyFor, buildActivityDays, parseClock } = days;
// Looked up by name so this file still loads (and fails one test at a time) before the export.
const minutesLateFor = (days as Record<string, unknown>).minutesLateFor as
  | ((rr: ReportRow | null, firstMin: number | null, scheduleStart?: string) => number)
  | undefined;

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

const MON = '2026-10-12', TUE = '2026-10-13', WED = '2026-10-14', THU = '2026-10-15';
const AM = (h: number, m: number) => h * 60 + m;

function mkForm(type: string, reason = ''): NonNullable<ReportRow['form']> {
  return { type, reason, details: '', eta: '', submittedAt: null, submittedMinutes: null, onTime: true, mondayItemId: '1' };
}

/** An official (payroll-processed) day for Nichole, 9:00 AM start. */
function official(date: string, o: Partial<ReportRow> = {}): ReportRow {
  return {
    employeeId: 7, employeeName: 'Nichole Harris', email: 'nichole@x.com', role: 'Agent', manager: 'M',
    date, scheduledStart: '9:00 AM', entryTime: '8:57 AM', exitTime: '5:02 PM',
    minutesLate: 0, earlyLeaveMinutes: 0,
    form: null, allForms: [], coveredBy: null, verdict: 'on_time', countsToScore: true,
    flags: {
      multipleForms: false, recordedUnexplainedButFormOnFile: false,
      formEmailUnrecognised: false, excusedInPayrollNoRequest: false,
    },
    ...o,
  };
}

/** A live day: payroll has not run, so no payroll row and no punches on the report row. */
function live(date: string, o: Partial<ReportRow> = {}): ReportRow {
  return official(date, { entryTime: null, exitTime: null, minutesLate: 0, verdict: 'not_processed', countsToScore: false, ...o });
}

const why = (rr: ReportRow | null, o: { firstMin?: number | null; hasActivity?: boolean; scheduled?: boolean; requests?: ReportRequest[] } = {}) =>
  whyFor({
    reportRow: rr, requests: o.requests ?? [], scheduled: o.scheduled ?? true, hasActivity: o.hasActivity ?? true,
    firstMin: o.firstMin ?? null,
  } as Parameters<typeof whyFor>[0]);

// ── Official days: payroll's late minutes decide ───────────────────────────────────────────────

test('WT1: on time with a Tardiness form on file shows no tag (Nichole, Mon Oct 12 and Thu Oct 15)', () => {
  const tardy = mkForm('Tardiness');
  for (const [date, entry] of [[MON, '8:57 AM'], [THU, '8:56 AM']] as const) {
    const rr = official(date, { entryTime: entry, form: tardy, allForms: [tardy] });
    assert.equal(why(rr, { firstMin: parseClock(entry) }), null, `${date}: on time, so no Tardiness tag`);
  }
});

test('WT2: late with no form on file shows a red Not Reported tag', () => {
  const rr = official(TUE, { entryTime: '9:14 AM', minutesLate: 14, verdict: 'late_no_form' });
  assert.deepEqual(why(rr, { firstMin: AM(9, 14) }), { kind: 'unreported', label: 'Not Reported', tone: 'red' });
});

test('WT3: late with a form on file shows the form tag, not Not Reported', () => {
  const tardy = mkForm('Tardiness');
  const rr = official(WED, { entryTime: '9:20 AM', minutesLate: 20, verdict: 'late_reported_on_time', form: tardy, allForms: [tardy] });
  assert.deepEqual(why(rr, { firstMin: AM(9, 20) }), { kind: 'form', label: 'Tardiness', tone: 'blue' });
});

test('WT4: payroll wins over Teramind on an official day', () => {
  // Teramind saw 9:10, but payroll (after the operator fixed the punch) says on time.
  const rr = official(TUE, { entryTime: '8:59 AM', minutesLate: 0 });
  assert.equal(why(rr, { firstMin: AM(9, 10) }), null);
  // And the other way round: payroll says 3 minutes late although Teramind shows 8:58.
  const rr2 = official(TUE, { entryTime: '9:03 AM', minutesLate: 3, verdict: 'late_no_form' });
  assert.equal(why(rr2, { firstMin: AM(8, 58) })?.label, 'Not Reported');
});

test('WT5: sick forms, other forms and forms on days with no punches behave as before', () => {
  // Absence with reason Sick on a worked day: Sick.
  const sick = mkForm('Absence', 'Sick');
  assert.equal(why(official(TUE, { form: sick, allForms: [sick] }), { firstMin: AM(8, 55) })?.label, 'Sick');
  // An Absence form on a worked, on-time day still shows (only Tardiness forms are hidden).
  const absence = mkForm('Absence', 'Family');
  assert.equal(why(official(TUE, { form: absence, allForms: [absence] }), { firstMin: AM(8, 55) })?.label, 'Absence');
  // A Tardiness form on a day with no punches at all still shows: it is the only explanation.
  const tardy = mkForm('Tardiness');
  const noPunch = official(WED, { entryTime: null, exitTime: null, verdict: 'absent_reported_on_time', form: tardy, allForms: [tardy] });
  assert.equal(why(noPunch, { hasActivity: false })?.label, 'Tardiness');
});

test('WT6: covered days, day off and no-reports keep their tags; a non-scheduled day is never Not Reported', () => {
  const pto = official(TUE, { coveredBy: { kind: 'pto', label: 'PTO' }, verdict: 'pto', entryTime: null, minutesLate: 0 });
  assert.equal(why(pto, { hasActivity: false })?.label, 'PTO');
  assert.equal(why(null, { scheduled: false, firstMin: AM(11, 0) })?.label, 'Day Off');
  assert.equal(why(live(TUE), { hasActivity: false })?.label, 'No Reports Yet');
});

// ── Live days: the livePayrollRows rule ───────────────────────────────────────────────────────

test('WT7: a live day uses the first Teramind record against the scheduled start, no grace', () => {
  assert.equal(why(live(THU), { firstMin: AM(8, 56) }), null, '8:56 for 9:00 is on time');
  assert.equal(why(live(THU), { firstMin: AM(9, 0) }), null, '9:00 sharp is on time');
  assert.equal(why(live(THU), { firstMin: AM(9, 1) })?.label, 'Not Reported', 'one minute late is late, as payroll counts it');
  const tardy = mkForm('Tardiness');
  assert.equal(why(live(THU, { form: tardy, allForms: [tardy] }), { firstMin: AM(8, 56) }), null);
  assert.equal(why(live(THU, { form: tardy, allForms: [tardy] }), { firstMin: AM(9, 25) })?.label, 'Tardiness');
});

test('WT8: minutesLateFor exists and gives the same minutes livePayrollRows writes', () => {
  assert.equal(typeof minutesLateFor, 'function', 'activityDays.ts must export minutesLateFor');
  const f = minutesLateFor!;
  // Official: payroll's number.
  assert.equal(f(official(TUE, { minutesLate: 14, verdict: 'late_no_form' }), AM(9, 2)), 14);
  // A payroll row inside a not-yet-processed period still wins (liveAttendance: "payroll always wins").
  assert.equal(f(live(TUE, { entryTime: '9:00 AM', minutesLate: 0 }), AM(9, 30)), 0);
  // No report row: the employee's own start is the fallback.
  assert.equal(f(null, AM(9, 7), '09:00'), 7);
  assert.equal(f(null, null, '09:00'), 0);

  // Cross-check against livePayrollRows itself, the rule Attendance List / Reports use on live days.
  const parseTimeToMinutes = (t: string) => parseClock(t) ?? 0;
  for (const first of [AM(8, 40), AM(9, 0), AM(9, 1), AM(9, 47), AM(10, 30)]) {
    const rr = live(WED);
    const tm: ActivityDayRow = {
      employee_id: 7, work_date: 20261014, first_min: first, last_ymd: 20261014, last_min: AM(17, 0),
      active_s: 0, records: 10, largest_gap_min: 0, gap_start_min: 0, has_manual: false, accounts: 1,
      synced_at: '', ghost_min: -1,
    };
    const [stand] = livePayrollRows({
      rows: [rr], payrollRows: [], tmRows: [tm], window: { from: WED, to: WED }, today: THU, parseTimeToMinutes,
    });
    assert.equal(f(rr, first), stand!.late_minutes, `first record ${first}: same minutes as livePayrollRows`);
  }
});

// ── Through buildActivityDays (Activity, Needs a Look, the panel's Day by Day) ────────────────

test('WT9: Nichole\'s week reads right in buildActivityDays', () => {
  const settings: ActivitySettings = { minActiveMinutes: 390, breakMinutes: 60, breakOverMinutes: 30 };
  const emp: ActivityEmployee = {
    id: 7, name: 'Nichole Harris', role: 'Agent', manager: 'M',
    work_days: '', schedule_start: '9:00 AM', schedule_end: '5:00 PM',
  };
  const ymdInt = (d: string) => Number(d.replace(/-/g, ''));
  const tm = (date: string, first: number): ActivityDayRow => ({
    employee_id: 7, work_date: ymdInt(date), first_min: first, last_ymd: ymdInt(date), last_min: AM(17, 0),
    active_s: 460 * 60, records: 20, largest_gap_min: 0, gap_start_min: 0, has_manual: false, accounts: 1,
    synced_at: '', ghost_min: -1,
  });
  const tardy = mkForm('Tardiness');
  const reportRows = [
    official(MON, { entryTime: '8:57 AM', form: tardy, allForms: [tardy] }),                      // on time + form
    official(TUE, { entryTime: '9:14 AM', minutesLate: 14, verdict: 'late_no_form' }),             // late, no form
    official(WED, { entryTime: '9:20 AM', minutesLate: 20, verdict: 'late_reported_on_time', form: tardy, allForms: [tardy] }),
    live(THU, { form: tardy, allForms: [tardy] }),                                                  // live, on time + form
  ];
  const { days: out } = buildActivityDays({
    dateFrom: MON, dateTo: THU, today: '2026-10-16',
    employees: [emp], rows: [tm(MON, AM(8, 57)), tm(TUE, AM(9, 14)), tm(WED, AM(9, 20)), tm(THU, AM(8, 56))],
    reportRows, requests: [], settings,
    isScheduledWorkDay: () => true,
  });
  const on = (d: string) => out.find((x) => x.date === d)!;
  assert.equal(on(MON).why, null, 'Mon Oct 12, 8:57: no Tardiness tag');
  assert.equal(on(TUE).why?.label, 'Not Reported');
  assert.equal(on(TUE).why?.tone, 'red');
  assert.equal(on(WED).why?.label, 'Tardiness');
  assert.equal(on(THU).why, null, 'Thu Oct 15, 8:56 (live): no Tardiness tag');
  // A red tag is information, not a Needs a Look flag on its own.
  assert.equal(on(TUE).needsLook, false);
});

// ── Every place that paints a Why tag knows the red tone ──────────────────────────────────────

test('WT10: the red tone is drawn by both Why chip renderers, and Today passes the first record', () => {
  const types = read('src/app/lib/activityTypes.ts');
  assert.match(types, /'unreported'/, "WhyKind has 'unreported'");
  assert.match(types, /tone: 'blue' \| 'amber' \| 'gray' \| 'red'/);
  assert.match(read('src/app/pages/attendance/activity/WhyChipBadge.tsx'), /red:\s+'bg-status-red-fill text-status-red-ink border-transparent'/);
  assert.match(read('src/app/pages/attendance/TodayRow.tsx'), /red:\s+'bg-status-red-fill text-status-red-ink border-transparent'/);
  const hook = read('src/app/pages/attendance/useTodayWhy.ts');
  assert.match(hook, /firstMin: entryMinById\?\.get\(eid\) \?\? null/);
  assert.match(read('src/app/pages/attendance/AttendanceToday.tsx'), /^\s+entryMinById,$/m);
  // One lateness rule: whyFor reads it from minutesLateFor, never from its own arithmetic.
  assert.match(read('src/app/lib/activityDays.ts'), /minutesLateFor\(rr, args\.firstMin \?\? null, args\.scheduleStart \?\? ''\)/);
});
