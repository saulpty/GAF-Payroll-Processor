import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runClassificationEngine,
  normalizeName,
  type EmployeeRecord,
  type EngineInput,
} from '../src/app/lib/classificationEngine.ts';

// 2026-06-15 is a Monday (a normal weekday, no Panama holiday).
const DAY = '2026-06-15';

const EMP: EmployeeRecord = {
  id: 1,
  display_name: 'Ozzy Medina',
  teramind_email: 'ozzy@gaf.com',
  is_grace_list: false,
  is_macbook_swap: false,
  schedule_name: 'Standard',
  dst_start: '8:00 AM',
  dst_end: '4:00 PM',
  standard_start: '8:00 AM',
  standard_end: '4:00 PM',
  grace_minutes: 0,
};

function baseInput(overrides: Partial<EngineInput>): EngineInput {
  return {
    periodName: 'TEST',
    startDate: DAY,
    endDate: DAY,
    employees: [EMP],
    dstWindows: [{ year: 2026, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }],
    holidays: [],
    teramindData: new Map(),
    mondayAttendance: [],
    mondayAdjustments: [],
    mondayPermissions: [],
    outageDates: [],
    midDayPull: false,
    excludedEmployeeIds: [],
    nameMap: new Map(),
    ...overrides,
  };
}

// C1: A Monday board row that uses an ALIAS for the employee's name (and has no
// email) must still attach to that employee via nameMap. Here a PTO permission
// is filed under "Oswaldo Medina" (alias) for "Ozzy Medina" (display_name).
// Before the fix the name doesn't match, the day falls through to
// "No data + no form" → Ausencia Injustificada / RED / 420-min discount.
test('C1: Monday permission filed under an alias name attaches to the employee', () => {
  const nameMap = new Map<string, number>([
    [normalizeName('Ozzy Medina'), 1],
    [normalizeName('Oswaldo Medina'), 1], // alias → same employee
  ]);

  const result = runClassificationEngine(
    baseInput({
      nameMap,
      mondayPermissions: [
        {
          employeeName: 'Oswaldo Medina', // alias, not the display_name
          // no employeeEmail on purpose — forces name-based matching
          startDate: DAY,
          endDate: DAY,
          requestType: 'PTO',
          status: 'Approved',
        },
      ],
    }),
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].event_type_1, 'PTO');
  assert.equal(result[0].initial_status, 'GREEN');
});

// Guard: an unrelated name that resolves to nobody must NOT attach — that day is
// genuinely a no-data absence (RED). Protects against over-matching.
test('C1 guard: an unresolved Monday name does not attach', () => {
  const result = runClassificationEngine(
    baseInput({
      nameMap: new Map<string, number>([[normalizeName('Ozzy Medina'), 1]]),
      mondayPermissions: [
        {
          employeeName: 'Someone Else',
          startDate: DAY,
          endDate: DAY,
          requestType: 'PTO',
          status: 'Approved',
        },
      ],
    }),
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].event_type_1, 'Ausencia Injustificada');
  assert.equal(result[0].initial_status, 'RED');
});

// Guard: email-based matching must keep working after the signature change.
test('C1 guard: Monday row with matching email attaches regardless of name', () => {
  const result = runClassificationEngine(
    baseInput({
      nameMap: new Map(),
      mondayPermissions: [
        {
          employeeName: 'Totally Different Name',
          employeeEmail: 'ozzy@gaf.com', // email wins
          startDate: DAY,
          endDate: DAY,
          requestType: 'PTO',
          status: 'Approved',
        },
      ],
    }),
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].event_type_1, 'PTO');
});
