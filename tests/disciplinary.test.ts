import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  levelRank, caseState, daysBetween, groupByEmployee, sortEmployeeCases, dueSoon,
} from '../src/app/lib/disciplinary.ts';
import type { DisciplinaryRow } from '../src/app/lib/disciplinary.ts';

// Disciplinary actions viewer. Spec:
//   docs/superpowers/specs/2026-09-07-disciplinary-viewer-design.md
//
// Every fixture below is a real row, read out of the form app's seed migrations
// (1751222000 and 1751400000) after its two cleanup migrations. Seven actions,
// five employees, two managers.
//
// The load-bearing fact: EVERY revaluation_date is in 2026-06 or 2026-07, so as
// of TODAY every open case is overdue. The page's acceptance criteria depend on
// that, and so do D3 and D8.
//
// The lib is pure — it reads only the fields named here. The narrative columns
// (q_expected, q_happened, expectations, consequences) are carried by the row
// type but never inspected, so they are left out of the fixtures.

const TODAY = '2026-09-07';

function row(p: Partial<DisciplinaryRow> & { ref: string; employee_name: string }): DisciplinaryRow {
  return {
    id: 0,
    manager_name: '',
    employee_role: '',
    employee_branch: '',
    document_date: null,
    revaluation_date: null,
    warning_level: 'Verbal Warning',
    final_outcome: '',
    scenario: '',
    closed_at: null,
    closed_by: null,
    closure_note: null,
    ...p,
  } as DisciplinaryRow;
}

// ── The seven live rows ───────────────────────────────────────────────────────

const EDUARDO = row({
  id: 20, ref: 'GAF-DA-2026-9345', employee_name: 'Eduardo Herrera',
  employee_role: 'EVV Specialist', employee_branch: 'GA West', manager_name: 'Arelis Acosta',
  document_date: '2026-06-30', revaluation_date: '2026-07-30',
  warning_level: 'Verbal Warning', scenario: 'Operational Instructions',
});

const OSVALDO = row({
  id: 13, ref: 'GAF-DA-2026-6384', employee_name: 'Osvaldo Medina',
  employee_role: 'EVV Specialist', employee_branch: 'PA', manager_name: 'Arelis Acosta',
  document_date: '2026-06-24', revaluation_date: '2026-07-08',
  warning_level: 'First Written Warning', scenario: 'Attendance / Tardiness',
});

const ALEKA = row({
  id: 14, ref: 'GAF-DA-2026-7873', employee_name: 'Aleka Papatsoris',
  employee_role: 'EVV Specialist', employee_branch: 'IN', manager_name: 'Arelis Acosta',
  document_date: '2026-06-24', revaluation_date: '2026-07-08',
  warning_level: 'Verbal Warning', scenario: 'Inappropriate Conduct',
});

// Juan Molina — three actions, and the only escalation in the data:
// two verbals on 06-16, then a First Written on 06-23 citing the 06-16 verbal.
const JUAN_WRITTEN = row({
  id: 8, ref: 'GAF-DA-2026-9827', employee_name: 'Juan Molina',
  employee_role: 'Intake 1', employee_branch: 'Vitasya', manager_name: 'Marcela Gordon',
  document_date: '2026-06-23', revaluation_date: '2026-07-07',
  warning_level: 'First Written Warning', scenario: 'Calls / Lead Follow-up',
});

const JUAN_CALLS = row({
  id: 9, ref: 'GAF-DA-2026-2645', employee_name: 'Juan Molina',
  employee_role: 'Intake 1', employee_branch: 'Vitasya', manager_name: 'Marcela Gordon',
  document_date: '2026-06-16', revaluation_date: '2026-06-19',
  warning_level: 'Verbal Warning', scenario: 'Calls / Lead Follow-up',
});

const JUAN_LATE = row({
  id: 10, ref: 'GAF-DA-2026-3947', employee_name: 'Juan Molina',
  employee_role: 'Intake 1', employee_branch: 'Vitasya', manager_name: 'Marcela Gordon',
  document_date: '2026-06-16', revaluation_date: '2026-06-23',
  warning_level: 'Verbal Warning', scenario: 'Attendance / Tardiness',
});

const NAVVAD = row({
  id: 18, ref: 'GAF-DA-2026-1674', employee_name: 'Navvad Owusu',
  employee_role: 'EVV Specialist', employee_branch: 'GA West', manager_name: 'Arelis Acosta',
  document_date: '2026-06-04', revaluation_date: '2026-07-10',
  warning_level: 'Verbal Warning', scenario: 'Operational Instructions',
});

const ALL: DisciplinaryRow[] = [EDUARDO, OSVALDO, ALEKA, JUAN_WRITTEN, JUAN_CALLS, JUAN_LATE, NAVVAD];

// ── Cases with no live instance, proved here rather than on screen ────────────

const ALEKA_CLOSED = row({
  ...ALEKA,
  closed_at: '2026-07-15T14:02:11.000Z', closed_by: 'Arelis Acosta',
  closure_note: 'Employee improved; follow-up sent by email.',
});

// A termination that has since been closed out. Tests that closed beats outcome.
const TERMINATED_AND_CLOSED = row({
  id: 90, ref: 'GAF-DA-2026-0001', employee_name: 'Test Terminated',
  document_date: '2026-05-01', revaluation_date: '2026-05-15',
  warning_level: 'Final Written Warning', final_outcome: 'Termination',
  closed_at: '2026-05-20T09:00:00.000Z', closed_by: 'Arelis Acosta', closure_note: '',
});

const NO_REVAL = row({
  id: 91, ref: 'GAF-DA-2026-0002', employee_name: 'Test NoReval',
  document_date: '2026-05-01', revaluation_date: null,
  warning_level: 'Verbal Warning',
});

// ── D1: the escalation ladder has a fixed order ───────────────────────────────
// The four levels come from the form's disciplinaryFormData.ts. Nothing in the
// database constrains the column, so an unrecognised string must be inert
// rather than throwing or sorting to the top.

test('D1: levelRank orders the four warning levels', () => {
  assert.equal(levelRank('Verbal Warning'), 0);
  assert.equal(levelRank('First Written Warning'), 1);
  assert.equal(levelRank('Second Written Warning'), 2);
  assert.equal(levelRank('Final Written Warning'), 3);
});

test('D1b: levelRank is -1 for anything it does not recognise, and never throws', () => {
  assert.equal(levelRank('Written Warning'), -1);
  assert.equal(levelRank(''), -1);
  assert.equal(levelRank(null), -1);
  assert.equal(levelRank(undefined), -1);
});

// ── D2: closed wins over every other state ────────────────────────────────────
// A termination that has been closed out is finished business. If outcome won,
// it would sit at the top of the page for ever.

test('D2: caseState returns closed even for an overdue termination', () => {
  assert.equal(caseState(TERMINATED_AND_CLOSED, TODAY), 'closed');
  assert.equal(caseState(ALEKA_CLOSED, TODAY), 'closed');
});

test('D2b: an open Suspension or Termination is outcome, not overdue', () => {
  const openTermination = row({ ...TERMINATED_AND_CLOSED, closed_at: null, closed_by: null });
  assert.equal(caseState(openTermination, TODAY), 'outcome');
  assert.equal(caseState(row({ ...openTermination, final_outcome: 'Suspension' }), TODAY), 'outcome');
});

// ── D3: overdue is a plain string comparison against asOf ─────────────────────

test('D3: Juan 2026-06-19 re-evaluation is overdue today and open before it', () => {
  assert.equal(caseState(JUAN_CALLS, TODAY), 'overdue');
  assert.equal(caseState(JUAN_CALLS, '2026-06-18'), 'open');
  assert.equal(caseState(JUAN_CALLS, '2026-06-19'), 'open'); // the day itself is not late
  assert.equal(caseState(JUAN_CALLS, '2026-06-20'), 'overdue');
});

test('D3b: every live row is overdue as of 2026-09-07', () => {
  assert.deepEqual(ALL.map(r => caseState(r, TODAY)), Array(7).fill('overdue'));
});

// ── D4: a missing re-evaluation date is open, never overdue ───────────────────
// The form does not require one. Treating a blank as "infinitely late" would
// flood the page red on data that says nothing.

test('D4: a null revaluation_date is open, not overdue', () => {
  assert.equal(caseState(NO_REVAL, TODAY), 'open');
  assert.equal(caseState(NO_REVAL, '2099-01-01'), 'open');
});

// ── D5: day arithmetic (the timezone invariant) ───────────────────────────────
// Date.UTC / 86400000. US Eastern DST started 2026-03-08; a local-time
// subtraction would return 1.958… days across it and floor to 1.

test('D5: daysBetween is exact across month, year and DST boundaries', () => {
  assert.equal(daysBetween('2026-07-07', TODAY), 62);   // Juan's written warning
  assert.equal(daysBetween('2026-06-19', TODAY), 80);   // Juan's first verbal
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);  // spring forward
  assert.equal(daysBetween('2026-10-31', '2026-11-02'), 2);  // fall back
  assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1);  // year rollover
  assert.equal(daysBetween(TODAY, TODAY), 0);
  assert.equal(daysBetween(TODAY, '2026-09-01'), -6);        // negative when past
});

// ── D6: grouping ──────────────────────────────────────────────────────────────

test('D6: groupByEmployee collects Juan Molina into one group, newest first', () => {
  const groups = groupByEmployee(ALL, TODAY);
  assert.equal(groups.length, 5, 'seven actions across five employees');

  const juan = groups.find(g => g.employeeName === 'Juan Molina');
  assert.ok(juan, 'Juan Molina must be one group, not three rows');
  assert.equal(juan.actions.length, 3);
  // Two of his three share a document_date. The 2026-09-07 probe confirmed
  // their submitted_at is identical to the second as well, so id DESC is the
  // only thing that orders them deterministically. Ids 8/9/10 are the real ones.
  assert.deepEqual(juan.actions.map(a => a.ref), [
    'GAF-DA-2026-9827', // 06-23 First Written  (id 8)
    'GAF-DA-2026-3947', // 06-16 Verbal, attendance (id 10)
    'GAF-DA-2026-2645', // 06-16 Verbal, calls      (id 9)
  ]);
  assert.equal(juan.highestRank, 1, 'his ladder reaches First Written, not Final');
  assert.equal(juan.openCount, 3);
  assert.equal(juan.latest.ref, 'GAF-DA-2026-9827');
  assert.equal(juan.worstState, 'overdue');
});

test('D6b: nextReval is the soonest re-evaluation still ahead, else null', () => {
  const groups = groupByEmployee(ALL, TODAY);
  assert.deepEqual(groups.map(g => g.nextReval), Array(5).fill(null),
    'every re-evaluation in the live data has already passed');

  const asOfJune = groupByEmployee(ALL, '2026-06-17');
  const juan = asOfJune.find(g => g.employeeName === 'Juan Molina');
  assert.equal(juan.nextReval, '2026-06-19', 'the soonest of his three, not the latest');
});

test('D6c: a closed action does not count as open', () => {
  const groups = groupByEmployee([ALEKA_CLOSED], TODAY);
  assert.equal(groups[0].openCount, 0);
  assert.equal(groups[0].worstState, 'closed');
  assert.equal(groups[0].actions.length, 1, 'closed actions stay in the file');
});

// ── D7: ordering ──────────────────────────────────────────────────────────────
// Severity first, so the person who needs attention is at the top; anyone
// entirely closed sinks to the bottom regardless of how bad their history was.

test('D7: overdue outranks closed, and a higher level outranks a lower one', () => {
  const sorted = sortEmployeeCases(groupByEmployee([...ALL, TERMINATED_AND_CLOSED], TODAY));
  const names = sorted.map(g => g.employeeName);

  assert.equal(names[names.length - 1], 'Test Terminated',
    'an all-closed employee sorts last even after a termination');

  assert.ok(names.indexOf('Osvaldo Medina') < names.indexOf('Aleka Papatsoris'),
    'First Written outranks Verbal when both are overdue');
  assert.ok(names.indexOf('Juan Molina') < names.indexOf('Aleka Papatsoris'),
    'Juan reaches First Written too');
});

test('D7b: sorting is stable and total — no row is lost or duplicated', () => {
  const groups = groupByEmployee(ALL, TODAY);
  const sorted = sortEmployeeCases(groups);
  assert.equal(sorted.length, groups.length);
  assert.deepEqual(
    sorted.map(g => g.employeeName).sort(),
    groups.map(g => g.employeeName).sort(),
  );
});

// ── D8: the nav badge ─────────────────────────────────────────────────────────
// dueSoon counts OPEN actions whose re-evaluation is inside the window, and
// deliberately keeps counting ones already past it — a forgotten case must not
// age out of the badge and disappear.

test('D8: dueSoon counts all seven today, and six once one is closed', () => {
  assert.equal(dueSoon(ALL, TODAY), 7);

  const withOneClosed = ALL.map(r => (r.ref === ALEKA.ref ? ALEKA_CLOSED : r));
  assert.equal(dueSoon(withOneClosed, TODAY), 6);
});

test('D8b: dueSoon respects the window and ignores rows with no re-evaluation', () => {
  // On 2026-06-01 nothing has come due yet: the soonest is 06-19, 18 days out.
  assert.equal(dueSoon(ALL, '2026-06-01', 10), 0);
  assert.equal(dueSoon(ALL, '2026-06-01', 30), 2, 'only Juan 06-19 and 06-23 fall on or before 07-01');
  assert.equal(dueSoon([NO_REVAL], TODAY), 0, 'nothing to be due');
  assert.equal(dueSoon([], TODAY), 0);
});

// ── D9: the timezone invariant, asserted against the source ───────────────────
// Same guard as tenure.ts T7. The only Date construction allowed is the
// day-number idiom from ptoAccrual.ts, which takes a number.

test('D9: disciplinary.ts never constructs a Date from a date string', () => {
  const src = readFileSync(new URL('../src/app/lib/disciplinary.ts', import.meta.url), 'utf8');
  const constructions = src.match(/new Date\([^)]*\)/g) ?? [];
  const allowed = /^new Date\(\s*[A-Za-z0-9_$]+\s*\*\s*86400000\s*\)$/;
  const offenders = constructions.filter(c => !allowed.test(c));
  assert.deepEqual(offenders, [], `disallowed Date construction: ${offenders.join(', ')}`);
});

test('D9b: disciplinary.ts does not reach for the clock itself', () => {
  const src = readFileSync(new URL('../src/app/lib/disciplinary.ts', import.meta.url), 'utf8');
  assert.ok(!/Date\.now\(\)/.test(src), 'asOf is a parameter, never the clock');
  assert.ok(!/new Date\(\)/.test(src), 'today comes from toLocalYMD at the call site');
});
