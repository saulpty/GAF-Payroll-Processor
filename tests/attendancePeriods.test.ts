import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextPeriod } from '../src/app/lib/periodName.ts';
import { attendancePeriodOptions, type PeriodSourceRow } from '../src/app/lib/attendancePeriods.ts';

// The Periods picker on Attendance List / Reports (2026-10-06): every named period
// newest-first, plus placeholder periods Process Payroll has not run yet, up to the one
// that contains today. nextPeriod (periodName.ts) is injected.

const P = (period_name: string, start_date: string, end_date: string, processed_at: string | null): PeriodSourceRow =>
  ({ period_name, start_date, end_date, processed_at });

const ROWS: PeriodSourceRow[] = [
  P('Q1-Sep-2026', '2026-08-27', '2026-09-10', '2026-09-11T14:00:00Z'),
  P('Q2-Sep-2026', '2026-09-11', '2026-09-25', '2026-09-26T14:00:00Z'),
  P('Q2-Aug-2026', '2026-08-12', '2026-08-26', '2026-08-27T14:00:00Z'),
];

test('PO1: processed through Q2-Sep-2026, today Oct 6 → placeholder Q1-Oct-2026, newest first', () => {
  const { options } = attendancePeriodOptions(ROWS, '2026-10-06', nextPeriod);
  assert.deepEqual(options.map((o) => o.period_name), ['Q1-Oct-2026', 'Q2-Sep-2026', 'Q1-Sep-2026', 'Q2-Aug-2026']);
  assert.deepEqual(options[0], { period_name: 'Q1-Oct-2026', start_date: '2026-09-26', end_date: '2026-10-10', processed: false });
  assert.equal(options[1].processed, true);
});

test('PO2: default is the period containing today; rangeOf clamps to today', () => {
  const p = attendancePeriodOptions(ROWS, '2026-10-06', nextPeriod);
  assert.equal(p.defaultName, 'Q1-Oct-2026');
  assert.deepEqual(p.rangeOf(['Q1-Oct-2026']), { from: '2026-09-26', to: '2026-10-06' });
  assert.deepEqual(p.rangeOf(['Q2-Sep-2026', 'Q1-Oct-2026']), { from: '2026-09-11', to: '2026-10-06' });
  assert.deepEqual(p.rangeOf(['Q1-Sep-2026']), { from: '2026-08-27', to: '2026-09-10' });
  assert.equal(p.rangeOf([]), null);
  assert.equal(p.rangeOf(['nope']), null);
});

test('PO3: nothing is created past today', () => {
  const p = attendancePeriodOptions(ROWS, '2026-10-06', nextPeriod);
  assert.equal(p.options.some((o) => o.start_date > '2026-10-06'), false);
  // On the first day of the next period it appears, and not the one after.
  const q = attendancePeriodOptions(ROWS, '2026-10-11', nextPeriod);
  assert.deepEqual(q.options.slice(0, 2).map((o) => o.period_name), ['Q2-Oct-2026', 'Q1-Oct-2026']);
  assert.equal(q.defaultName, 'Q2-Oct-2026');
});

test('PO4: several missed periods are all offered', () => {
  const p = attendancePeriodOptions(ROWS, '2026-11-02', nextPeriod);
  assert.deepEqual(p.options.slice(0, 3).map((o) => o.period_name), ['Q1-Nov-2026', 'Q2-Oct-2026', 'Q1-Oct-2026']);
  assert.equal(p.options.filter((o) => !o.processed).length, 3);
});

test('PO5: an existing unprocessed period row is kept once, not duplicated by a placeholder', () => {
  const rows = [...ROWS, P('Q1-Oct-2026', '2026-09-26', '2026-10-10', null)];
  const p = attendancePeriodOptions(rows, '2026-10-06', nextPeriod);
  assert.equal(p.options.filter((o) => o.period_name === 'Q1-Oct-2026').length, 1);
  assert.equal(p.options[0].processed, false);
});

test('PO6: today inside a processed period → that period; today past every option → newest processed', () => {
  assert.equal(attendancePeriodOptions(ROWS, '2026-09-20', nextPeriod).defaultName, 'Q2-Sep-2026');
  const noNext = () => null;   // nextPeriod gives up (non-canonical name)
  assert.equal(attendancePeriodOptions(ROWS, '2026-10-06', noNext).defaultName, 'Q2-Sep-2026');
  assert.equal(attendancePeriodOptions([], '2026-10-06', nextPeriod).defaultName, null);
});

test('PO7: Postgres timestamps are sliced to dates', () => {
  const rows = [P('Q2-Sep-2026', '2026-09-11T00:00:00.000Z', '2026-09-25T00:00:00.000Z', '2026-09-26')];
  const p = attendancePeriodOptions(rows, '2026-10-06', nextPeriod);
  assert.equal(p.options[1].end_date, '2026-09-25');
  assert.equal(p.options[0].start_date, '2026-09-26');
});
