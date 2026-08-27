// Weekend-schedule behaviour — pins `schedules.work_days` against regression.
//
// Written 2026-08-25, after four employees on genuine weekend shifts (Cemiriamiz
// Iglesias, Euclides Gonzalez, Michael A. Jones Roye, Edwin Broce) were found
// sitting on the Standard Mon-Fri schedule. The engine was building entries for
// their days OFF, finding no punches, and marking them Ausencia Injustificada,
// while their real Saturday and Sunday work was discarded as an off-day punch
// with no form. Euclides read as a chronic absentee; he is in fact 100% on time.
//
// `work_days` had no test coverage of any kind before this file. W7 is the
// regression test for the bug above.
//
// REWRITTEN 2026-08-27. W2 and W3 previously pinned the opposite rule: an
// off-day punch was dropped, and an off-day FORM created a row. That is
// backwards. It surfaced when Ulla Hees came out of a payroll run with rows on
// Sat 2026-08-22 and Sun 2026-08-23 carrying no punches at all, manufactured
// because a permission's date range spanned the weekend. The rule now keys on
// punches, not forms: no punches on a day off means no row; punches on a day
// off mean a YELLOW row showing them. W9 is the regression test for that.
//
// Dates below are verified real weekdays in 2026:
//   2026-06-13 Sat · 06-14 Sun · 06-15 Mon · 06-16 Tue · 06-17 Wed
//   2026-06-19 Fri · 06-20 Sat · 06-21 Sun · 06-22 Mon

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runClassificationEngine,
  type EmployeeRecord,
  type EngineInput,
} from '../src/app/lib/classificationEngine.ts';

const SAT = '2026-06-20';
const SUN = '2026-06-21';
const FRI = '2026-06-19';
const NEXT_MON = '2026-06-22';
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
    ...over,
  };
}

function baseInput(over: Partial<EngineInput>): EngineInput {
  return {
    periodName: 'TEST',
    startDate: SAT,
    endDate: SAT,
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

/** Teramind punch helper: `9:00 AM`-in, `5:00 PM`-out on the given date. */
function punch(dateStr: string, hour = 9, minute = 0) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Map([['emp@gaf.com', new Map([[dateStr, {
    entry: new Date(y, m - 1, d, hour, minute),
    exit: new Date(y, m - 1, d, 17, 0),
  }]])]]);
}

// W1: a Saturday is a normal workday for someone whose schedule includes Sat.
test('W1: Sat worker punching on a Saturday is classified normally, not skipped', () => {
  const result = runClassificationEngine(baseInput({
    employees: [emp({ work_days: 'Wed,Thu,Fri,Sat,Sun' })],
    teramindData: punch(SAT, 9, 0),
  }));

  assert.equal(result.length, 1, 'a scheduled Saturday must produce an entry');
  assert.equal(result[0].entry_time, '9:00 AM');
  assert.equal(result[0].late_minutes, 0);
  assert.notEqual(result[0].event_type_1, 'Ausencia Injustificada');
});

// W1b: lateness on a weekend workday is measured against the schedule, same as
// any other day — a weekend shift is not an exemption from the grace rules.
test('W1b: Sat worker arriving late on a Saturday accrues late_minutes', () => {
  const result = runClassificationEngine(baseInput({
    employees: [emp({ work_days: 'Wed,Thu,Fri,Sat,Sun' })],
    teramindData: punch(SAT, 9, 25),
  }));

  assert.equal(result.length, 1);
  assert.equal(result[0].late_minutes, 25);
  assert.equal(result[0].late_after_grace, 15, '25 late minus 10 grace');
});

// W2: work on a day off is real and must be visible. Someone who punched on a
// day they are not scheduled for gets a row carrying their actual times, YELLOW
// so an operator decides what it is worth. Nothing is auto-paid and nothing is
// auto-discounted — unscheduled work is a human call.
test('W2: Mon-Fri worker punching on a Saturday gets a YELLOW row with their punches', () => {
  const result = runClassificationEngine(baseInput({
    employees: [emp({ work_days: 'Mon,Tue,Wed,Thu,Fri' })],
    teramindData: punch(SAT, 9, 0),
  }));

  assert.equal(result.length, 1, 'work on a day off must be visible, not discarded');
  assert.equal(result[0].initial_status, 'YELLOW');
  assert.equal(result[0].entry_time, '9:00 AM', 'the real punch, not the schedule');
  assert.equal(result[0].exit_time, '5:00 PM');
  assert.equal(result[0].event_type_1, '', 'nothing is classified for the operator');
  assert.equal(result[0].pay_impact_1, '', 'nothing is auto-paid');
  assert.equal(result[0].discount_total_minutes, 0, 'nothing is auto-discounted');
  assert.match(result[0].auto_notes, /Sat/, 'auto_notes should name the day of week');
  assert.match(result[0].auto_notes, /not a scheduled workday/i);
});

// W3: the inverse, and the heart of the 2026-08-27 bug. A form covering a day
// the employee does not work explains nothing about payroll — they were not due
// to be there. No punches means no row, form or not.
test('W3: Mon-Fri worker with a Saturday form but no punches produces no entry', () => {
  const result = runClassificationEngine(baseInput({
    employees: [emp({ work_days: 'Mon,Tue,Wed,Thu,Fri' })],
    mondayAttendance: [{
      employeeName: 'Test Employee',
      employeeEmail: 'emp@gaf.com',
      date: SAT,
      type: 'Absence',
    }],
  }));

  assert.equal(result.length, 0, 'a form cannot manufacture a row on a day off');
});

// W4 / W5: backwards compatibility. Every schedule predating migration 1781402000
// must keep behaving as Mon-Fri, whether work_days is absent or blank.
test('W4: work_days absent falls back to Mon-Fri', () => {
  const sat = runClassificationEngine(baseInput({
    employees: [emp({})],
    teramindData: punch(SAT, 9, 0),
  }));
  assert.equal(sat.length, 0, 'Saturday must be an off-day when work_days is absent');

  const mon = runClassificationEngine(baseInput({
    employees: [emp({})],
    startDate: MON, endDate: MON,
    teramindData: punch(MON, 9, 0),
  }));
  assert.equal(mon.length, 1, 'Monday must still be a workday');
});

test('W5: work_days empty or whitespace falls back to Mon-Fri', () => {
  for (const blank of ['', '   ', ',']) {
    const result = runClassificationEngine(baseInput({
      employees: [emp({ work_days: blank })],
      teramindData: punch(SAT, 9, 0),
    }));
    assert.equal(result.length, 0, `work_days ${JSON.stringify(blank)} must mean Mon-Fri`);
  }
});

// W6: decision-order guard. The work-day check runs BEFORE the holiday check, so
// a holiday landing on a weekend worker's shift must still classify as Feriado
// rather than being swallowed as an off-day.
test('W6: a holiday on a Sat worker\'s Saturday is still Feriado', () => {
  const result = runClassificationEngine(baseInput({
    employees: [emp({ work_days: 'Wed,Thu,Fri,Sat,Sun' })],
    holidays: [{ date: SAT, name: 'Test Holiday' }],
  }));

  assert.equal(result.length, 1, 'a holiday on a scheduled day must produce an entry');
  assert.equal(result[0].event_type_1, 'Feriado');
  assert.equal(result[0].initial_status, 'GREEN');
});

// W7: THE REGRESSION TEST. This is the shape of the real 2026-08 bug. A Wed-Sun
// employee has no Teramind data on a Monday because Monday is their weekend.
// That must not be an unjustified absence — which is exactly what happened while
// they were mis-assigned to the Mon-Fri Standard schedule.
test('W7: Wed-Sun worker with no data on a Monday is NOT an unjustified absence', () => {
  const weekend = runClassificationEngine(baseInput({
    employees: [emp({ work_days: 'Wed,Thu,Fri,Sat,Sun' })],
    startDate: MON, endDate: MON,
  }));

  assert.equal(weekend.length, 0, 'Monday is this employee\'s weekend — no entry, no discount');

  // Control: the identical input on a Mon-Fri schedule DOES produce the absence,
  // proving W7 passes because of work_days and not because the case is inert.
  const standard = runClassificationEngine(baseInput({
    employees: [emp({ work_days: 'Mon,Tue,Wed,Thu,Fri' })],
    startDate: MON, endDate: MON,
  }));

  assert.equal(standard.length, 1);
  assert.equal(standard[0].event_type_1, 'Ausencia Injustificada');
  assert.equal(standard[0].initial_status, 'RED');
});

// W9: THE 2026-08-27 REGRESSION TEST. Ulla Hees's exact shape. A permission on
// the Permissions & Requests board runs Friday to Monday. `permissionCoversDate`
// is a plain inclusive string range with no work-day filter, so it also matches
// the Saturday and Sunday in between — and the old rule turned each match into a
// YELLOW row with empty Entry and Exit. She does not work weekends; there is
// nothing to review and nothing to pay.
test('W9: a permission spanning Fri-Mon does not manufacture Sat/Sun rows', () => {
  const result = runClassificationEngine(baseInput({
    employees: [emp({ work_days: 'Mon,Tue,Wed,Thu,Fri' })],
    startDate: SAT, endDate: SUN,
    mondayPermissions: [{
      employeeName: 'Test Employee',
      employeeEmail: 'emp@gaf.com',
      startDate: FRI,
      endDate: NEXT_MON,
      requestType: 'Time Off / Permission',
      status: 'Approved',
    }],
  }));

  assert.equal(result.length, 0, 'the weekend inside a permission range is still a weekend');

  // Control: the same permission on a Monday, which this employee DOES work,
  // must still produce its row — proving W9 passes on work_days, not because
  // the permission was ignored outright.
  const worked = runClassificationEngine(baseInput({
    employees: [emp({ work_days: 'Mon,Tue,Wed,Thu,Fri' })],
    startDate: NEXT_MON, endDate: NEXT_MON,
    mondayPermissions: [{
      employeeName: 'Test Employee',
      employeeEmail: 'emp@gaf.com',
      startDate: FRI,
      endDate: NEXT_MON,
      requestType: 'Time Off / Permission',
      status: 'Approved',
    }],
  }));

  assert.equal(worked.length, 1, 'the permission still applies on a scheduled day');
  assert.equal(worked[0].event_type_1, 'Permiso Remunerado');
});

// W10: the two signals must not double up. A punch on a day off AND a form
// covering it is still one row, and the punch is what it carries.
test('W10: an off-day punch with a form produces exactly one row, with the punches', () => {
  const result = runClassificationEngine(baseInput({
    employees: [emp({ work_days: 'Mon,Tue,Wed,Thu,Fri' })],
    teramindData: punch(SAT, 9, 0),
    mondayAttendance: [{
      employeeName: 'Test Employee',
      employeeEmail: 'emp@gaf.com',
      date: SAT,
      type: 'Absence',
    }],
  }));

  assert.equal(result.length, 1, 'one day, one row');
  assert.equal(result[0].initial_status, 'YELLOW');
  assert.equal(result[0].entry_time, '9:00 AM');
  assert.equal(result[0].exit_time, '5:00 PM');
});

// W11: decision-order guard, the mirror of W6. The Teramind-outage branch runs
// BEFORE the work-day check, so an outage landing on someone's day off used to
// stamp a GREEN full-day row with the schedule's own times as if they had
// worked it — a second source of phantom off-day rows, and one nothing covered.
test('W11: a Teramind outage on an employee\'s day off produces no entry', () => {
  const result = runClassificationEngine(baseInput({
    employees: [emp({ work_days: 'Mon,Tue,Wed,Thu,Fri' })],
    outageDates: [SAT],
  }));

  assert.equal(result.length, 0, 'an outage cannot invent a workday');

  // Control: the same outage on a Monday still produces its GREEN row.
  const worked = runClassificationEngine(baseInput({
    employees: [emp({ work_days: 'Mon,Tue,Wed,Thu,Fri' })],
    startDate: MON, endDate: MON,
    outageDates: [MON],
  }));

  assert.equal(worked.length, 1, 'an outage on a scheduled day is still covered');
  assert.equal(worked[0].initial_status, 'GREEN');
  assert.equal(worked[0].entry_time, '9:00 AM', 'default schedule applied');
});

// W8: day order inside work_days is irrelevant — it is parsed into a Set. The
// Admin picker always writes Mon-first order, but a hand-edited row may not.
test('W8: work_days order does not matter', () => {
  for (const order of ['Sat,Sun,Wed,Thu,Fri', 'Wed,Thu,Fri,Sat,Sun', ' Sat , Wed,Thu,Fri,Sun ']) {
    const result = runClassificationEngine(baseInput({
      employees: [emp({ work_days: order })],
      teramindData: punch(SAT, 9, 0),
    }));
    assert.equal(result.length, 1, `Saturday must be a workday for ${JSON.stringify(order)}`);
  }
});
