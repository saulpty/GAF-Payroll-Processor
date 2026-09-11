// punchMinutes — the edit-path twin of the engine's three minute formulas.
// Written 2026-09-11 after Payroll Master saved corrected punches without
// recomputing late/early minutes (Carlos Aloma 6/3, Luis Abad 6/1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePunchMinutes, isStoredTime } from '../src/app/lib/punchMinutes.ts';
import { runClassificationEngine, type EmployeeRecord, type EngineInput } from '../src/app/lib/classificationEngine.ts';

const SCHED = { scheduled_start: '9:00 AM', scheduled_end: '5:00 PM', grace_until: '9:10 AM' };

test('PM1: late and early arithmetic matches the engine formulas', () => {
  assert.deepEqual(computePunchMinutes({ ...SCHED, entry_time: '9:25 AM', exit_time: '4:30 PM' }),
    { late_minutes: 25, late_after_grace: 15, early_leave_minutes: 30, crossed_midnight: false });
  assert.deepEqual(computePunchMinutes({ ...SCHED, entry_time: '9:05 AM', exit_time: '5:08 PM' }),
    { late_minutes: 5, late_after_grace: 0, early_leave_minutes: 0, crossed_midnight: false });
  assert.deepEqual(computePunchMinutes({ ...SCHED, entry_time: '8:52 AM', exit_time: '5:00 PM' }),
    { late_minutes: 0, late_after_grace: 0, early_leave_minutes: 0, crossed_midnight: false });
});

test('PM2: blank punches measure nothing — 0, not the old number (decision 2026-09-11)', () => {
  assert.deepEqual(computePunchMinutes({ ...SCHED, entry_time: '', exit_time: '' }),
    { late_minutes: 0, late_after_grace: 0, early_leave_minutes: 0, crossed_midnight: false });
  const noEntry = computePunchMinutes({ ...SCHED, entry_time: null, exit_time: '4:00 PM' })!;
  assert.equal(noEntry.late_minutes, 0);
  assert.equal(noEntry.early_leave_minutes, 60);
  const noExit = computePunchMinutes({ ...SCHED, entry_time: '9:30 AM', exit_time: null })!;
  assert.equal(noExit.early_leave_minutes, 0);
  assert.equal(noExit.late_minutes, 30);
});

test('PM3: exit before entry is a session past midnight — early leave 0, flagged (Luis Abad 6/1)', () => {
  const r = computePunchMinutes({ ...SCHED, entry_time: '4:50 AM', exit_time: '12:35 AM' })!;
  assert.equal(r.early_leave_minutes, 0, 'the engine said 985 here; that was the bug');
  assert.equal(r.crossed_midnight, true);
  assert.equal(r.late_minutes, 0);
});

test('PM4: a non-blank value that is not "H:MM AM" is refused, never treated as 00:00', () => {
  assert.equal(computePunchMinutes({ ...SCHED, entry_time: '9:00 AM', exit_time: '12:35am' }), null);
  assert.equal(computePunchMinutes({ ...SCHED, entry_time: 'Form Submitted', exit_time: '5:00 PM' }), null);
  assert.equal(computePunchMinutes({ ...SCHED, entry_time: '9', exit_time: '5:00 PM' }), null);
  assert.equal(isStoredTime(''), true);
  assert.equal(isStoredTime('12:35 AM'), true);
  assert.equal(isStoredTime('12:35am'), false);
});

test('PM5: missing grace_until means no grace, not a 900-minute grace', () => {
  const r = computePunchMinutes({ scheduled_start: '9:00 AM', scheduled_end: '5:00 PM', grace_until: '', entry_time: '9:25 AM', exit_time: '5:00 PM' })!;
  assert.equal(r.late_after_grace, 25);
});

// PM6: agreement guard. Run the real engine on a late-and-early day, then feed the
// row it produced back through the helper; the three numbers must be identical.
// If anyone changes the engine's formulas (classificationEngine.ts ~695-697)
// without changing this helper, this fails.
test('PM6: helper reproduces the engine minutes from the row the engine wrote', () => {
  const MON = '2026-06-15';
  const emp: EmployeeRecord = {
    id: 1, display_name: 'Test Employee', teramind_email: 'emp@gaf.com',
    is_grace_list: false, is_macbook_swap: false, schedule_name: 'Standard',
    dst_start: '9:00 AM', dst_end: '5:00 PM', standard_start: '9:00 AM', standard_end: '5:00 PM',
    grace_minutes: 10,
  };
  const input: EngineInput = {
    periodName: 'TEST', startDate: MON, endDate: MON, employees: [emp],
    dstWindows: [{ year: 2026, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }],
    holidays: [], mondayAttendance: [], mondayAdjustments: [], mondayPermissions: [],
    outageDates: [], midDayPull: false, excludedEmployeeIds: [], nameMap: new Map(),
    teramindData: new Map([['emp@gaf.com', new Map([[MON, {
      entry: new Date(2026, 5, 15, 9, 25), exit: new Date(2026, 5, 15, 16, 30),
    }]])]]),
  };
  const [row] = runClassificationEngine(input);
  assert.ok(row, 'engine produced no row');
  assert.equal(row.late_minutes, 25);
  const mine = computePunchMinutes({
    entry_time: row.entry_time, exit_time: row.exit_time,
    scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
  })!;
  assert.equal(mine.late_minutes, row.late_minutes);
  assert.equal(mine.late_after_grace, row.late_after_grace);
  assert.equal(mine.early_leave_minutes, row.early_leave_minutes);
});
