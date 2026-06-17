import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runClassificationEngine,
  normalizeName,
  type EmployeeRecord,
  type EngineInput,
} from '../src/app/lib/classificationEngine.ts';

const DAY = '2026-06-15'; // Monday, DST in effect
const DST = [{ year: 2026, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }];

// A normal Eastern-synced employee, schedule stored in US Eastern: constant 9-5.
function emp(over: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: 1,
    display_name: 'Standard Employee',
    teramind_email: 'emp@gaf.com',
    is_grace_list: false,
    is_macbook_swap: false,
    schedule_name: 'Standard',
    dst_start: '9:00 AM',
    dst_end: '5:00 PM',
    standard_start: '9:00 AM',
    standard_end: '5:00 PM',
    grace_minutes: 10,
    ...over,
  };
}

function baseInput(over: Partial<EngineInput>): EngineInput {
  return {
    periodName: 'TEST',
    startDate: DAY,
    endDate: DAY,
    employees: [emp()],
    dstWindows: DST,
    holidays: [],
    teramindData: new Map(),
    mondayAttendance: [],
    mondayAdjustments: [],
    mondayPermissions: [],
    outageDates: [],
    midDayPull: false,
    excludedEmployeeIds: [],
    nameMap: new Map(),
    ...over,
  };
}

// H2: a mid-day pull should backfill the missing exit with the employee's
// SCHEDULED end, not a hardcoded 4:00 PM. Favian works 9–5, so an early
// Teramind exit (1:00 PM) must become 5:00 PM with zero early-leave.
test('H2: mid-day pull backfills exit to the scheduled end (9-5 employee)', () => {
  const tm = new Map([['emp@gaf.com', new Map([[DAY, {
    entry: new Date(2026, 5, 15, 9, 0),
    exit: new Date(2026, 5, 15, 13, 0), // 1:00 PM — pulled mid-day
  }]])]]);

  const result = runClassificationEngine(baseInput({ midDayPull: true, teramindData: tm }));

  assert.equal(result.length, 1);
  assert.equal(result[0].exit_time, '5:00 PM');
  assert.equal(result[0].early_leave_minutes, 0);
});

// H3: the full-day no-data absence discount defaults to 420 but is configurable.
test('H3: no-data absence defaults to 420-minute discount', () => {
  const result = runClassificationEngine(baseInput({}));
  assert.equal(result.length, 1);
  assert.equal(result[0].event_type_1, 'Ausencia Injustificada');
  assert.equal(result[0].discount_total_minutes, 420);
});

test('H3: full-day absence discount honors config override', () => {
  const result = runClassificationEngine(
    baseInput({ config: { full_day_absence_discount_minutes: 360 } as any }),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].discount_total_minutes, 360);
});
