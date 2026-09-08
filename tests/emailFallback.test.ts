// E — a Monday form filed from an unrecognised address must still reach its owner.
//
// `rowMatchesEmp` returns early whenever a board row carries an email: it compares
// that address to one employee's `teramind_email` and never reaches the alias or
// name branches below it. So a form filed as `nati16esquivel@gmail.com` instead of
// `nati.e@passiontocarehc.com` matches nobody, and the engine runs as though no
// form exists. 113 forms across 24 employees are in that state, one of them dated
// 2026-09-02, so it is live and recurring.
//
// The mirror's own resolver (`mondayResolve.ts`) *does* fall back through
// email -> alias -> normalized name, which is why these forms look correctly
// matched in `monday_attendance_forms` and are simultaneously invisible to every
// payroll run. The two paths disagreed silently.
//
// The rule these tests pin: an exact email match stays authoritative, and an
// address belonging to some OTHER employee on the roster is an authoritative
// non-match. Only an address belonging to nobody falls through to name/alias.
// Weakening that first rule would let two similarly-named people be confused,
// which is worse than the bug being fixed.
//
// `rowMatchesEmp` is not exported, so every case runs through
// `runClassificationEngine`. That is deliberate — it also proves the roster set
// reaches all four board lookups (absence, tardiness, adjustments, permissions),
// not just the one that happens to be tested first.
//
// Dates below are real 2026 weekdays: 2026-06-15 Mon, 2026-06-16 Tue.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runClassificationEngine,
  type EmployeeRecord,
  type EngineInput,
} from '../src/app/lib/classificationEngine.ts';

const MON = '2026-06-15';
const DST = [{ year: 2026, us_dst_start: '2026-03-08', us_dst_end: '2026-11-01' }];

const ROSTER_EMAIL = 'gabo.c@vitasyahc.com';
const OTHER_EMAIL = 'gabriela.c@vitasyahc.com';
const UNKNOWN_EMAIL = 'gaboc@vitasyahc.com'; // the real Gabriel Chu case: missing dot

function emp(over: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: 1,
    display_name: 'Gabriel Chu',
    teramind_email: ROSTER_EMAIL,
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

/** A second, real employee whose address must never be borrowed by the fallback. */
const gabriela = emp({ id: 2, display_name: 'Gabriela Chu', teramind_email: OTHER_EMAIL });

function baseInput(over: Partial<EngineInput>): EngineInput {
  return {
    periodName: 'TEST',
    startDate: MON,
    endDate: MON,
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

function punch(email: string, dateStr: string, hour: number, minute: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Map([[email, new Map([[dateStr, {
    entry: new Date(y, m - 1, d, hour, minute),
    exit: new Date(y, m - 1, d, 17, 0),
  }]])]]);
}

const absenceForm = (email: string | undefined, name = 'Gabriel Chu') =>
  ({ employeeName: name, employeeEmail: email, date: MON, type: 'Absence' as const, reason: 'Sick', notes: '' });

const tardinessForm = (email: string | undefined, name = 'Gabriel Chu') =>
  ({ employeeName: name, employeeEmail: email, date: MON, type: 'Tardiness' as const, reason: '', notes: '' });

/** The row the engine produced for a given employee id. */
const rowFor = (rows: ReturnType<typeof runClassificationEngine>, id: number) =>
  rows.find(r => r.employee_id === id);

// ── the authoritative cases, which must not change ────────────────────────

test('E1: a form filed from the employee own address still matches', () => {
  const rows = runClassificationEngine(baseInput({
    mondayAttendance: [absenceForm(ROSTER_EMAIL)],
  }));
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].event_type_1, 'Ausencia Injustificada');
  assert.equal(rows[0].discount_total_minutes, 0);
});

test('E2: casing and surrounding whitespace do not break an exact match', () => {
  const rows = runClassificationEngine(baseInput({
    mondayAttendance: [absenceForm('  GABO.C@VitasyaHC.com  ')],
  }));
  assert.notEqual(rows[0].event_type_1, 'Ausencia Injustificada');
});

test('E3: an address belonging to ANOTHER employee never falls back to the name', () => {
  // The decisive case. Gabriela's address on a row named "Gabriel Chu" must
  // attach to Gabriela and to nobody else — asserting only that it misses
  // Gabriel would also pass for a function that matches no one at all.
  const rows = runClassificationEngine(baseInput({
    employees: [emp(), gabriela],
    mondayAttendance: [absenceForm(OTHER_EMAIL, 'Gabriel Chu')],
  }));

  assert.equal(rowFor(rows, 1)?.event_type_1, 'Ausencia Injustificada',
    'Gabriel must NOT borrow a form filed under Gabriela address');
  assert.notEqual(rowFor(rows, 2)?.event_type_1, 'Ausencia Injustificada',
    'Gabriela must still receive her own form');
});

// ── the fallback ──────────────────────────────────────────────────────────

test('E4: an address belonging to nobody falls back to the display name', () => {
  const rows = runClassificationEngine(baseInput({
    mondayAttendance: [absenceForm(UNKNOWN_EMAIL, 'Gabriel Chu')],
  }));
  assert.notEqual(rows[0].event_type_1, 'Ausencia Injustificada',
    'a form under an unknown address, naming a real employee, must reach them');
});

test('E5: an unknown address falls back through name_aliases too', () => {
  const rows = runClassificationEngine(baseInput({
    mondayAttendance: [absenceForm('jose_navarro80@yahoo.com', 'Gabo Chu')],
    nameMap: new Map([['gabo chu', 1]]),
  }));
  assert.notEqual(rows[0].event_type_1, 'Ausencia Injustificada');
});

test('E6: an unknown address AND an unmatched name matches nobody', () => {
  const rows = runClassificationEngine(baseInput({
    mondayAttendance: [absenceForm('stranger@example.com', 'Someone Else Entirely')],
  }));
  assert.equal(rows[0].event_type_1, 'Ausencia Injustificada',
    'nothing identifies this row — it must not attach to an arbitrary employee');
});

test('E7: a blank email still matches on the name, as it always did', () => {
  const rows = runClassificationEngine(baseInput({
    mondayAttendance: [absenceForm(undefined, 'Gabriel Chu')],
  }));
  assert.notEqual(rows[0].event_type_1, 'Ausencia Injustificada');
});

test('E8: a whitespace-only email is treated as absent, not as a failed match', () => {
  const rows = runClassificationEngine(baseInput({
    mondayAttendance: [absenceForm('   ', 'Gabriel Chu')],
  }));
  assert.notEqual(rows[0].event_type_1, 'Ausencia Injustificada');
});

test('E8b: a blank email and a blank name matches nobody', () => {
  const rows = runClassificationEngine(baseInput({
    mondayAttendance: [absenceForm(undefined, '')],
  }));
  assert.equal(rows[0].event_type_1, 'Ausencia Injustificada');
});

// ── what it costs when the fallback is missing ────────────────────────────
// These run the whole engine and assert on money, because that is the part
// that was silently wrong. They also prove the roster set reaches each board.

test('E9: the grace pardon — the quiet one, worth grace_minutes per incident', () => {
  // A grace-list employee 9 minutes late with a form should be pardoned. With
  // the form invisible the row is still GREEN and payroll_ready, so it never
  // reaches Action Required and no human ever sees the deduction.
  const rows = runClassificationEngine(baseInput({
    employees: [emp({ is_grace_list: true })],
    teramindData: punch(ROSTER_EMAIL, MON, 9, 9),
    mondayAttendance: [tardinessForm(UNKNOWN_EMAIL, 'Gabriel Chu')],
  }));
  assert.equal(rows[0].discount_total_minutes, 0,
    'a pardoned grace day must dock nothing');
});

test('E10: an absence form under an unknown address stops a full-day discount', () => {
  const rows = runClassificationEngine(baseInput({
    mondayAttendance: [absenceForm(UNKNOWN_EMAIL, 'Gabriel Chu')],
  }));
  assert.equal(rows[0].discount_total_minutes, 0,
    'a filed absence must not be docked as an unjustified one');
  assert.notEqual(rows[0].initial_status, 'RED');
});

test('E11: a permission under an unknown address is still honoured', () => {
  // Exercises the permissions board specifically — a fix applied only to the
  // attendance lookups would pass every test above and still fail here.
  const rows = runClassificationEngine(baseInput({
    mondayPermissions: [{
      employeeName: 'Gabriel Chu', employeeEmail: UNKNOWN_EMAIL,
      startDate: MON, endDate: MON, requestType: 'PTO / Vacation', status: 'Approved',
    }],
  }));
  assert.notEqual(rows[0].event_type_1, 'Ausencia Injustificada',
    'approved leave filed under an unknown address must not read as a no-show');
  assert.equal(rows[0].discount_total_minutes, 0);
});

test('E12: two people sharing a normalized name — the known limitation, pinned', () => {
  // KNOWN LIMITATION, pre-existing and deliberately out of scope. With no email
  // to separate them, a row naming "Gabriel Chu" reaches every employee whose
  // normalized display_name matches. Recorded so a future change that fixes it
  // fails here loudly rather than passing unnoticed.
  const twin = emp({ id: 3, display_name: 'Gabriel Chu', teramind_email: 'other.gc@vitasyahc.com' });
  const rows = runClassificationEngine(baseInput({
    employees: [emp(), twin],
    mondayAttendance: [absenceForm(UNKNOWN_EMAIL, 'Gabriel Chu')],
  }));
  assert.notEqual(rowFor(rows, 1)?.event_type_1, 'Ausencia Injustificada');
  assert.notEqual(rowFor(rows, 3)?.event_type_1, 'Ausencia Injustificada');
});
