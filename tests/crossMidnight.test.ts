// Cross-midnight sessions — pins prompt 08 (2026-09-11).
// processTeramindData keys a session by its start date and keeps the latest
// exit, so a session that runs past midnight leaves an exit Date on the next
// day. The engine read that as an exit at 00:35 and charged 985 early minutes
// (Luis Abad, 2026-06-01). Exit earlier than entry on the clock now means
// "ran past midnight": early leave 0, a note for the operator, truthful exit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runClassificationEngine, type EmployeeRecord, type EngineInput } from '../src/app/lib/classificationEngine.ts';

const MON = '2026-06-15';
const emp: EmployeeRecord = {
  id: 1, display_name: 'Test Employee', teramind_email: 'emp@gaf.com',
  is_grace_list: false, is_macbook_swap: false, schedule_name: 'Standard',
  dst_start: '9:00 AM', dst_end: '5:00 PM', standard_start: '9:00 AM', standard_end: '5:00 PM',
  grace_minutes: 10,
};
function input(entry: Date, exit: Date): EngineInput {
  return {
    periodName: 'TEST', startDate: MON, endDate: MON, employees: [emp],
    dstWindows: [{ year: 2026, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }],
    holidays: [], mondayAttendance: [], mondayAdjustments: [], mondayPermissions: [],
    outageDates: [], midDayPull: false, excludedEmployeeIds: [], nameMap: new Map(),
    teramindData: new Map([['emp@gaf.com', new Map([[MON, { entry, exit }]])]]),
  };
}

test('CM1: a session that crosses midnight is not an early leave', () => {
  const [row] = runClassificationEngine(input(new Date(2026, 5, 15, 4, 50), new Date(2026, 5, 16, 0, 35)));
  assert.ok(row, 'engine produced no row');
  assert.equal(row.early_leave_minutes, 0, 'the engine used to say 985 here');
  assert.equal(row.exit_time, '12:35 AM', 'the exit string stays truthful');
  assert.match(row.auto_notes, /past midnight/i);
  assert.notEqual(row.event_type_1, 'Salida Temprano');
  assert.notEqual(row.event_type_2, 'Salida Temprano');
  assert.equal(row.discount_total_minutes, 0);
});

test('CM2: a same-day early exit is still an early leave (regression)', () => {
  const [row] = runClassificationEngine(input(new Date(2026, 5, 15, 9, 0), new Date(2026, 5, 15, 16, 0)));
  assert.equal(row.early_leave_minutes, 60);
  assert.ok([row.event_type_1, row.event_type_2].includes('Salida Temprano'));
  assert.doesNotMatch(row.auto_notes, /past midnight/i);
});
