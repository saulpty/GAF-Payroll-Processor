import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTotalDays } from '../src/app/lib/ptoAccrual.ts';
import { matchPayroll, recordability } from '../src/app/lib/ptoPayrollMatch.ts';
import type { DayRow, PeriodRow } from '../src/app/lib/ptoPayrollMatch.ts';

// Fixtures. Two processed cycles; the one after 09-10 has not been run and
// therefore has NO periods row at all (rows are created by the run itself).
const PERIODS: PeriodRow[] = [
  { period_name: 'Q2-Aug-2026', start_date: '2026-08-11', end_date: '2026-08-25', processed_at: '2026-08-26 10:00' },
  { period_name: 'Q1-Sep-2026', start_date: '2026-08-26', end_date: '2026-09-10', processed_at: '2026-09-11 09:30' },
];
const TODAY = '2026-09-09';

const FH_PI = 'Floating Holiday / B-Day Off';
function pto(d: string, p = 'Q2-Aug-2026'): DayRow     { return { d, et: 'PTO', pi: 'Paid', p, in: false }; }
function fh(d: string, p = 'Q2-Aug-2026'): DayRow      { return { d, et: 'Permiso Remunerado', pi: FH_PI, p, in: false }; }
function work(d: string, p = 'Q2-Aug-2026'): DayRow    { return { d, et: '', pi: '', p, in: true }; }
function holiday(d: string, p = 'Q2-Aug-2026'): DayRow { return { d, et: 'Feriado', pi: 'Libre', p, in: false }; }
function absent(d: string, p = 'Q2-Aug-2026'): DayRow  { return { d, et: 'Ausencia Injustificada', pi: 'Unpaid', p, in: false }; }

function run(req: { leaveOn: string; returnOn: string; days: number }, rows: DayRow[],
  extra: Partial<{ leaveType: 'pto' | 'floating_holiday'; today: string; stopBefore: string | null }> = {}) {
  return matchPayroll(req, rows, PERIODS, {
    leaveType: extra.leaveType ?? 'pto',
    today: extra.today ?? TODAY,
    spanDays: defaultTotalDays,
    stopBefore: extra.stopBefore ?? null,
  });
}

const WEEK = [pto('2026-08-17'), pto('2026-08-18'), pto('2026-08-19'), pto('2026-08-20'), pto('2026-08-21'), work('2026-08-24')];

test('M1: a full week of PTO with the return punched matches the request exactly', () => {
  const m = run({ leaveOn: '2026-08-17', returnOn: '2026-08-24', days: 7 }, WEEK);
  assert.equal(m.state, 'matched');
  assert.equal(m.firstOff, '2026-08-17');
  assert.equal(m.lastOff, '2026-08-21');
  assert.equal(m.actualReturn, '2026-08-24');
  assert.equal(m.actualDays, 7);
  assert.equal(m.mismatch, false);
  assert.deepEqual(m.cycles, ['Q2-Aug-2026']);
  assert.deepEqual(m.byType, [{ label: 'PTO', count: 5, impact: 'Paid' }]);
});

test('M2: a Friday PTO returning Monday is 3 days — PTO counts the weekend', () => {
  const m = run({ leaveOn: '2026-08-21', returnOn: '2026-08-24', days: 3 }, [pto('2026-08-21'), work('2026-08-24')]);
  assert.equal(m.state, 'matched');
  assert.equal(m.actualDays, 3);
  assert.equal(m.mismatch, false);
});

test('M3: the same Friday recorded as "return Saturday, 1 day" is flagged — pins the calendar convention', () => {
  const m = run({ leaveOn: '2026-08-21', returnOn: '2026-08-22', days: 1 }, [pto('2026-08-21'), work('2026-08-24')]);
  assert.equal(m.state, 'matched');
  assert.equal(m.actualDays, 3);
  assert.equal(m.mismatch, true);
});

test('M4: a company holiday inside the leave counts as a day off and is listed by type', () => {
  const rows = [pto('2026-08-17'), pto('2026-08-18'), holiday('2026-08-19'), pto('2026-08-20'), pto('2026-08-21'), work('2026-08-24')];
  const m = run({ leaveOn: '2026-08-17', returnOn: '2026-08-24', days: 7 }, rows);
  assert.equal(m.actualDays, 7);
  assert.equal(m.mismatch, false);
  assert.deepEqual(m.byType, [{ label: 'PTO', count: 4, impact: 'Paid' }, { label: 'Feriado', count: 1, impact: 'Libre' }]);
});

test('M5: coming back later than requested moves the actual return and flags the row', () => {
  const m = run({ leaveOn: '2026-08-17', returnOn: '2026-08-21', days: 4 }, WEEK);
  assert.equal(m.actualReturn, '2026-08-24');
  assert.equal(m.actualDays, 7);
  assert.equal(m.mismatch, true);
});

test('M6: starting a day later than requested flags the row even when the day count is right', () => {
  const rows = [work('2026-08-17'), pto('2026-08-18'), pto('2026-08-19'), pto('2026-08-20'), work('2026-08-21')];
  const m = run({ leaveOn: '2026-08-17', returnOn: '2026-08-20', days: 3 }, rows);
  assert.equal(m.state, 'matched');
  assert.equal(m.firstOff, '2026-08-18');
  assert.equal(m.actualReturn, '2026-08-21');
  assert.equal(m.actualDays, 3);
  assert.equal(m.mismatch, true);
});

test('M7: a return that falls in a cycle not yet processed is partial, never a mismatch', () => {
  const rows = [pto('2026-09-07', 'Q1-Sep-2026'), pto('2026-09-08', 'Q1-Sep-2026'), pto('2026-09-09', 'Q1-Sep-2026'), pto('2026-09-10', 'Q1-Sep-2026')];
  const m = run({ leaveOn: '2026-09-07', returnOn: '2026-09-14', days: 7 }, rows);
  assert.equal(m.state, 'partial');
  assert.equal(m.actualReturn, null);
  assert.equal(m.actualDays, null);
  assert.equal(m.mismatch, false);
  assert.deepEqual(m.cycles, ['Q1-Sep-2026']);
  assert.equal(m.dataThrough, '2026-09-10');
});

test('M8: the return cycle was processed but no punched day follows — matched, return unknown, flagged', () => {
  const m = run({ leaveOn: '2026-08-17', returnOn: '2026-08-24', days: 7 }, WEEK.slice(0, 5));
  assert.equal(m.state, 'matched');
  assert.equal(m.actualReturn, null);
  assert.equal(m.actualDays, null);
  assert.equal(m.mismatch, true);
});

test('M9: a leave spanning two cycles lists both, in date order', () => {
  const rows = [pto('2026-08-24'), pto('2026-08-25'), pto('2026-08-26', 'Q1-Sep-2026'), pto('2026-08-27', 'Q1-Sep-2026'), pto('2026-08-28', 'Q1-Sep-2026'), work('2026-08-31', 'Q1-Sep-2026')];
  const m = run({ leaveOn: '2026-08-24', returnOn: '2026-08-31', days: 7 }, rows);
  assert.deepEqual(m.cycles, ['Q2-Aug-2026', 'Q1-Sep-2026']);
  assert.equal(m.mismatch, false);
});

test('M10: a Friday floating holiday is 1 day — FH never counts the weekend', () => {
  const m = run({ leaveOn: '2026-08-21', returnOn: '2026-08-22', days: 1 }, [fh('2026-08-21'), work('2026-08-24')], { leaveType: 'floating_holiday' });
  assert.equal(m.state, 'matched');
  assert.equal(m.actualReturn, '2026-08-24');
  assert.equal(m.actualDays, 1);
  assert.equal(m.mismatch, false);
  assert.deepEqual(m.byType, [{ label: 'Permiso Remunerado', count: 1, impact: FH_PI }]);
});

test('M11: a floating-holiday request whose payroll day says PTO has 0 FH days and is flagged', () => {
  const m = run({ leaveOn: '2026-08-21', returnOn: '2026-08-22', days: 1 }, [pto('2026-08-21'), work('2026-08-24')], { leaveType: 'floating_holiday' });
  assert.equal(m.state, 'matched');
  assert.equal(m.firstOff, null);
  assert.equal(m.actualDays, 0);
  assert.equal(m.mismatch, true);
  assert.deepEqual(m.byType, [{ label: 'PTO', count: 1, impact: 'Paid' }]);
});

test('M12: an unexplained absence right after the PTO is not a return — the leave grows and is flagged', () => {
  const rows = [pto('2026-08-17'), pto('2026-08-18'), pto('2026-08-19'), absent('2026-08-20'), work('2026-08-21')];
  const m = run({ leaveOn: '2026-08-17', returnOn: '2026-08-20', days: 3 }, rows);
  assert.equal(m.actualReturn, '2026-08-21');
  assert.equal(m.actualDays, 4);
  assert.equal(m.mismatch, true);
  assert.ok(m.byType.some(t => t.label === 'Ausencia Injustificada' && t.count === 1));
});

test('M13: a punched PTO day mid-leave is "worked", not a return', () => {
  const rows = [pto('2026-08-17'), pto('2026-08-18'), { ...pto('2026-08-19'), in: true }, pto('2026-08-20'), pto('2026-08-21'), work('2026-08-24')];
  const m = run({ leaveOn: '2026-08-17', returnOn: '2026-08-24', days: 7 }, rows);
  assert.equal(m.actualReturn, '2026-08-24');
  assert.equal(m.actualDays, 7);
  assert.equal(m.mismatch, false);
  assert.deepEqual(m.byType, [{ label: 'PTO', count: 4, impact: 'Paid' }, { label: 'PTO (worked)', count: 1, impact: 'Paid' }]);
});

test('M14: no payroll rows inside a processed cycle is "no_rows", neutral', () => {
  const m = run({ leaveOn: '2026-08-17', returnOn: '2026-08-21', days: 4 }, []);
  assert.equal(m.state, 'no_rows');
  assert.equal(m.mismatch, false);
  assert.deepEqual(m.byType, []);
});

test('M15: a past leave whose cycle has not been run is "not_processed" and says how far payroll goes', () => {
  const m = run({ leaveOn: '2026-09-14', returnOn: '2026-09-18', days: 4 }, [], { today: '2026-09-20' });
  assert.equal(m.state, 'not_processed');
  assert.equal(m.dataThrough, '2026-09-10');
  assert.equal(m.mismatch, false);
});

test('M16: a leave that has not started yet is "future"', () => {
  const m = run({ leaveOn: '2026-09-21', returnOn: '2026-09-25', days: 4 }, []);
  assert.equal(m.state, 'future');
  assert.equal(m.mismatch, false);
});

test('M17: stopBefore keeps a back-to-back request from swallowing the next one', () => {
  const rows = [pto('2026-08-17'), pto('2026-08-18'), pto('2026-08-19'), pto('2026-08-20'),
    pto('2026-08-24'), pto('2026-08-25'), work('2026-08-26', 'Q1-Sep-2026')];
  const req = { leaveOn: '2026-08-17', returnOn: '2026-08-21', days: 4 };
  const open = run(req, rows);
  assert.equal(open.actualReturn, '2026-08-26');
  const bounded = run(req, rows, { stopBefore: '2026-08-24' });
  assert.equal(bounded.actualReturn, null);
  assert.equal(bounded.lastOff, '2026-08-20');
  assert.deepEqual(bounded.cycles, ['Q2-Aug-2026']);
});

test('M18: every day in the span punched means the person worked', () => {
  const rows = [work('2026-08-17'), work('2026-08-18'), work('2026-08-19'), work('2026-08-20')];
  const m = run({ leaveOn: '2026-08-17', returnOn: '2026-08-21', days: 4 }, rows);
  assert.equal(m.state, 'worked');
  assert.equal(m.firstOff, null);
});

test('M19: ISO timestamps, string day counts and string booleans are normalised at the boundary', () => {
  const rows = [
    { d: '2026-08-21T00:00:00.000Z', et: 'PTO', pi: 'Paid', p: 'Q2-Aug-2026', in: 'false' as unknown as boolean },
    { d: '2026-08-24T00:00:00.000Z', et: '', pi: '', p: 'Q2-Aug-2026', in: 'true' as unknown as boolean },
  ];
  const m = run({ leaveOn: '2026-08-21T05:00:00.000Z', returnOn: '2026-08-24T05:00:00.000Z', days: '3' as unknown as number }, rows);
  assert.equal(m.state, 'matched');
  assert.equal(m.firstOff, '2026-08-21');
  assert.equal(m.actualReturn, '2026-08-24');
  assert.equal(m.mismatch, false);
});

test('M20: dataThrough ignores unprocessed periods and periods without an end date', () => {
  const periods: PeriodRow[] = [
    ...PERIODS,
    { period_name: 'Q2-Sep-2026', start_date: '2026-09-11', end_date: '2026-09-25', processed_at: null },
    { period_name: 'Broken', start_date: null, end_date: null, processed_at: '2026-01-01' },
  ];
  const m = matchPayroll({ leaveOn: '2026-09-14', returnOn: '2026-09-18', days: 4 }, [], periods,
    { leaveType: 'pto', today: '2026-09-20', spanDays: defaultTotalDays });
  assert.equal(m.state, 'not_processed');
  assert.equal(m.dataThrough, '2026-09-10');
});

test('M21: the pay impact rides along with the event, and different impacts stay separate lines', () => {
  const rows = [
    pto('2026-08-17'),
    { d: '2026-08-18', et: 'Ausencia Justificada.', pi: 'Incapacidad', p: 'Q2-Aug-2026', in: false },
    { d: '2026-08-19', et: 'Ausencia Justificada.', pi: 'Constancia Medica', p: 'Q2-Aug-2026', in: false },
    work('2026-08-20'),
  ];
  const m = run({ leaveOn: '2026-08-17', returnOn: '2026-08-20', days: 3 }, rows);
  assert.deepEqual(m.byType, [
    { label: 'PTO', count: 1, impact: 'Paid' },
    { label: 'Ausencia Justificada.', count: 1, impact: 'Incapacidad' },
    { label: 'Ausencia Justificada.', count: 1, impact: 'Constancia Medica' },
  ]);
  assert.equal(m.actualDays, 3);
});

test('M22: payrollCovers is true only when payroll is processed through the return date', () => {
  const covered = run({ leaveOn: '2026-08-17', returnOn: '2026-08-24', days: 7 }, WEEK);
  assert.equal(covered.payrollCovers, true);
  const uncovered = run({ leaveOn: '2026-09-07', returnOn: '2026-09-14', days: 7 }, []);
  assert.equal(uncovered.payrollCovers, false);
  const edge = run({ leaveOn: '2026-09-07', returnOn: '2026-09-10', days: 3 }, [], { today: '2026-09-20' });
  assert.equal(edge.payrollCovers, true); // dataThrough is exactly 09-10
  // Payroll ran past the date but no processed cycle contains the leave day (a gap) — not covered.
  const gappy: PeriodRow[] = [PERIODS[0], { ...PERIODS[1], start_date: '2026-09-01' }];
  const gap = matchPayroll({ leaveOn: '2026-08-27', returnOn: '2026-08-28', days: 1 }, [], gappy,
    { leaveType: 'pto', today: '2026-09-20', spanDays: defaultTotalDays });
  assert.equal(gap.payrollCovers, false);
  assert.equal(gap.state, 'not_processed');
});

test('M23: a return before the leave is invalid and computes nothing else', () => {
  const m = run({ leaveOn: '2026-02-16', returnOn: '2026-02-11', days: 1 }, WEEK, { leaveType: 'floating_holiday' });
  assert.equal(m.state, 'invalid');
  assert.equal(m.invalidDates, true);
  assert.equal(m.mismatch, false);
  assert.equal(m.firstOff, null);
  assert.deepEqual(m.byType, []);
  assert.deepEqual(m.cycles, []);
  const ok = run({ leaveOn: '2026-08-17', returnOn: '2026-08-24', days: 7 }, WEEK);
  assert.equal(ok.invalidDates, false);
});

test('M24: recordability — invalid wins, then future, then not processed, then ok', () => {
  const inv = run({ leaveOn: '2026-02-16', returnOn: '2026-02-11', days: 1 }, []);
  assert.deepEqual(recordability(inv, '2026-02-11', TODAY, defaultTotalDays), { ok: false, reason: 'invalid', daysUntil: null });
  const fut = run({ leaveOn: '2026-09-21', returnOn: '2026-09-25', days: 4 }, []);
  assert.deepEqual(recordability(fut, '2026-09-25', TODAY, defaultTotalDays), { ok: false, reason: 'future', daysUntil: 16 });
  const unproc = run({ leaveOn: '2026-09-01', returnOn: '2026-09-14', days: 9 }, [], { today: '2026-09-20' });
  assert.deepEqual(recordability(unproc, '2026-09-14', '2026-09-20', defaultTotalDays), { ok: false, reason: 'not_processed', daysUntil: null });
  const good = run({ leaveOn: '2026-08-17', returnOn: '2026-08-24', days: 7 }, WEEK);
  assert.deepEqual(recordability(good, '2026-08-24', TODAY, defaultTotalDays), { ok: true, reason: null, daysUntil: null });
  // a return exactly today is not in the future; with payroll only through 09-10 it is 'not_processed'
  const sameDay = run({ leaveOn: '2026-09-07', returnOn: '2026-09-12', days: 5 }, [], { today: '2026-09-12' });
  assert.equal(recordability(sameDay, '2026-09-12', '2026-09-12', defaultTotalDays).reason, 'not_processed');
});

test('M25: a request from before payroll history began is recordable on the Monday request alone', () => {
  const m = run({ leaveOn: '2026-02-16', returnOn: '2026-02-17', days: 1 }, [], { leaveType: 'floating_holiday' });
  assert.equal(m.state, 'before_history');
  assert.equal(m.historyFrom, '2026-08-11');
  assert.equal(m.payrollCovers, true);
  assert.equal(m.mismatch, false);
  assert.deepEqual(recordability(m, '2026-02-17', TODAY, defaultTotalDays), { ok: true, reason: null, daysUntil: null });
  // straddling the first day of history is not "before"
  const straddle = run({ leaveOn: '2026-08-10', returnOn: '2026-08-12', days: 2 }, []);
  assert.notEqual(straddle.state, 'before_history');
  assert.equal(straddle.payrollCovers, false);
});
