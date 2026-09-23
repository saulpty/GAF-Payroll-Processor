// Unpaid permissions and Floating Holiday / Birthday days must reach Action Required.
//
// Written 2026-09-23. On 2026-08-27 Saul asked that the two permission kinds that
// can cost (or spend) a day's pay go to the operator for review: any unpaid
// permission ('Permiso No remunerado') and Floating Holiday / Birthday Day Off.
// The engine's full-day-permission branch marks them initial_status 'YELLOW' —
// but it ALSO pre-fills event_type_1 and pay_impact_1, and computeDerivedFields
// treats a YELLOW row with both slots filled as already resolved. So the rows
// were written payroll_ready 'YES' / status_current 'GREEN', and Action Required
// (which loads only payroll_ready = 'NO') never showed them. Nobody reviewed
// them; the 480-minute unpaid discount went straight to payroll.
//
// U1/U2 are the regression tests. U3 is the control: ordinary PTO still
// auto-resolves GREEN. U5 proves the operator's save path — Action Required's
// saveRow calls computeDerivedFields with the row's own values — still turns
// the pre-filled row GREEN when it is saved unchanged.
//
// Dates below are verified real weekdays in 2026:
//   2026-06-15 Mon · 06-16 Tue

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runClassificationEngine,
  computeDerivedFields,
  type EmployeeRecord,
  type EngineInput,
  type PayrollEntry,
} from '../src/app/lib/classificationEngine.ts';

const MON = '2026-06-15';
const DST = [{ year: 2026, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }];

function emp(over: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: 1,
    display_name: 'Test Employee',
    teramind_email: 'emp@gaf.com',
    is_grace_list: false,
    is_macbook_swap: false,
    schedule_name: 'Standard',
    dst_start: '9:00 AM',
    dst_end: '5:00 PM',
    standard_start: '9:00 AM',
    standard_end: '5:00 PM',
    grace_minutes: 10,
    work_days: 'Mon,Tue,Wed,Thu,Fri',
    ...over,
  };
}

/** One scheduled Monday, no punches, one permission of the given type covering it. */
function runWithPermission(requestType: string): PayrollEntry[] {
  const input: EngineInput = {
    periodName: 'TEST',
    startDate: MON,
    endDate: MON,
    employees: [emp()],
    dstWindows: DST,
    holidays: [],
    teramindData: new Map(),
    mondayAttendance: [],
    mondayAdjustments: [],
    mondayPermissions: [{
      employeeName: 'Test Employee',
      employeeEmail: 'emp@gaf.com',
      startDate: MON,
      endDate: MON,
      requestType,
      status: 'Approved',
    }],
    outageDates: [],
    midDayPull: false,
    excludedEmployeeIds: [],
    nameMap: new Map(),
  };
  return runClassificationEngine(input);
}

function onlyRow(rows: PayrollEntry[]): PayrollEntry {
  assert.equal(rows.length, 1, 'a scheduled Monday covered by a permission produces exactly one row');
  return rows[0];
}

// ── U1: unpaid permission goes to review ────────────────────────────────────
for (const requestType of ['Permiso No remunerado', 'Unpaid Leave']) {
  test(`U1: "${requestType}" lands in Action Required (NO / YELLOW), event and impact pre-filled`, () => {
    const row = onlyRow(runWithPermission(requestType));

    // The suggestion stays pre-filled so the operator can accept it in one click.
    assert.equal(row.event_type_1, 'Permiso No remunerado');
    assert.equal(row.pay_impact_1, 'Unpaid');
    assert.equal(row.discount_total_minutes, 480, 'a full unpaid day is 480 minutes');
    assert.equal(row.initial_status, 'YELLOW');

    // THE BUG: these were 'YES' / 'GREEN', so the row skipped Action Required.
    assert.equal(row.payroll_ready, 'NO', 'unpaid permission must wait for the operator');
    assert.equal(row.status_current, 'YELLOW', 'unpaid permission must show as YELLOW until saved');
  });
}

// ── U2: Floating Holiday / Birthday goes to review ──────────────────────────
for (const requestType of ['Floating Holiday', 'Birthday Day Off']) {
  test(`U2: "${requestType}" lands in Action Required (NO / YELLOW), event and impact pre-filled`, () => {
    const row = onlyRow(runWithPermission(requestType));

    assert.equal(row.event_type_1, 'Permiso Remunerado');
    assert.equal(row.pay_impact_1, 'Floating Holiday / B-Day Off');
    assert.equal(row.discount_total_minutes, 0, 'a floating holiday is paid — no discount');
    assert.equal(row.initial_status, 'YELLOW');

    assert.equal(row.payroll_ready, 'NO', 'floating holiday / birthday must wait for the operator');
    assert.equal(row.status_current, 'YELLOW', 'floating holiday / birthday must show as YELLOW until saved');
  });
}

// ── U3: control — ordinary paid permissions still auto-resolve ──────────────
for (const [requestType, et1] of [
  ['PTO', 'PTO'],
  ['Vacation', 'PTO'],
  ['Compensatory Day', 'Permiso Remunerado'],
] as const) {
  test(`U3 (control): "${requestType}" still auto-resolves GREEN / YES`, () => {
    const row = onlyRow(runWithPermission(requestType));

    assert.equal(row.event_type_1, et1);
    assert.equal(row.pay_impact_1, 'Paid');
    assert.equal(row.discount_total_minutes, 0);
    assert.equal(row.initial_status, 'GREEN');
    assert.equal(row.payroll_ready, 'YES');
    assert.equal(row.status_current, 'GREEN');
  });
}

// ── U4: control — Time for Time was already reaching review, unchanged ──────
test('U4 (control): "Time for Time (Days)" stays NO / YELLOW with a blank pay impact', () => {
  const row = onlyRow(runWithPermission('Time for Time (Days)'));

  assert.equal(row.event_type_1, 'Permiso Remunerado');
  assert.equal(row.pay_impact_1, '');
  assert.equal(row.initial_status, 'YELLOW');
  assert.equal(row.payroll_ready, 'NO');
  assert.equal(row.status_current, 'YELLOW');
});

// ── U5: the operator's save still resolves the row ──────────────────────────
// Mirrors ActionRequired.tsx saveRow: computeDerivedFields is called with the
// row's (unchanged) event/impact values, its minutes, and its initial_status.
// Saving the pre-filled suggestion as-is must turn the row GREEN / YES and keep
// the discount — the fix must not make these rows impossible to clear.
for (const requestType of ['Permiso No remunerado', 'Floating Holiday']) {
  test(`U5: saving a "${requestType}" row unchanged in Action Required makes it GREEN`, () => {
    const row = onlyRow(runWithPermission(requestType));
    const saved = computeDerivedFields({
      event_type_1: row.event_type_1, pay_impact_1: row.pay_impact_1,
      event_type_2: row.event_type_2, pay_impact_2: row.pay_impact_2,
      late_minutes: 0, late_after_grace: 0, early_leave_minutes: 0,
      initial_status: row.initial_status,
    });

    assert.equal(saved.payroll_ready, 'YES');
    assert.equal(saved.status_current, 'GREEN');
    assert.equal(saved.discount_total_minutes, row.discount_total_minutes,
      'saving unchanged must not change the discount');
  });
}
