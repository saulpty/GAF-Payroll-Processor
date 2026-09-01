import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addMonths, milestones, tenureLabel, daysUntil, nextMilestone, contractEndState,
} from '../src/app/lib/tenure.ts';

// Sub-project D. Every fixture below is real data, read from the live database
// on 2026-09-01 and recorded in
// docs/superpowers/prompts/2026-09-01-contracts/01-probe.md.
//
// Two employees carry most of the weight:
//   Carlos Aloma  start 2026-03-02, contract end 2026-09-02 — the live case
//   Ulla Hees     start 2025-11-19, contract end 2026-05-19 — the ended case
// Every GAF contract is exactly start + 6 months; there were no exceptions in
// 44 rows. That is why the 6-month milestone and the contract end coincide.

const TODAY = '2026-09-01';

// ── T1: month-end clamping ────────────────────────────────────────────────────
// Jan 31 + 1 month has no 31st to land on. It clamps to the last day of the
// target month, and must respect leap years.

test('T1: addMonths clamps to the last day of the target month', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29'); // 2028 is a leap year
  assert.equal(addMonths('2026-03-31', 1), '2026-04-30');
  assert.equal(addMonths('2026-08-31', 6), '2027-02-28');
});

test('T1b: addMonths leaves a day that exists untouched', () => {
  assert.equal(addMonths('2026-03-02', 6), '2026-09-02'); // Carlos Aloma
  assert.equal(addMonths('2025-11-19', 6), '2026-05-19'); // Ulla Hees
  assert.equal(addMonths('2026-01-15', 1), '2026-02-15');
});

// ── T2: long spans and year rollover ─────────────────────────────────────────

test('T2: addMonths rolls the year over correctly', () => {
  assert.equal(addMonths('2026-03-02', 24), '2028-03-02');
  assert.equal(addMonths('2025-11-19', 12), '2026-11-19');
  assert.equal(addMonths('2025-11-19', 24), '2027-11-19');
  assert.equal(addMonths('2026-08-03', 6), '2027-02-03'); // Johann Morante
});

// ── T3: the five milestones ──────────────────────────────────────────────────

test('T3: milestones are start + 1/3/6/12/24 months, in order', () => {
  assert.deepEqual(milestones('2026-03-02'), [
    { key: '1m', date: '2026-04-02' },
    { key: '3m', date: '2026-06-02' },
    { key: '6m', date: '2026-09-02' },
    { key: '1y', date: '2027-03-02' },
    { key: '2y', date: '2028-03-02' },
  ]);
});

test('T3b: Ulla Hees, whose 6-month milestone is also her contract end', () => {
  const m = milestones('2025-11-19');
  assert.equal(m.length, 5);
  assert.equal(m[2].date, '2026-05-19'); // 6m == her contract_end_date
  assert.equal(m[3].date, '2026-11-19'); // 1y
});

// ── T4: tenure ───────────────────────────────────────────────────────────────

test('T4: tenureLabel is whole years and months', () => {
  assert.equal(tenureLabel('2025-11-19', TODAY), '9m');  // Ulla Hees
  assert.equal(tenureLabel('2026-03-02', TODAY), '5m');  // Carlos Aloma
  assert.equal(tenureLabel('2025-03-12', TODAY), '1y 5m');
});

test('T4b: exactly 12 months reads 1y, not 1y 0m', () => {
  assert.equal(tenureLabel('2025-09-01', TODAY), '1y');
  assert.equal(tenureLabel('2024-09-01', TODAY), '2y');
});

test('T4c: under a month reads new, and the day before an anniversary has not counted it', () => {
  assert.equal(tenureLabel('2026-08-20', TODAY), 'new');
  assert.equal(tenureLabel(TODAY, TODAY), 'new');
  // Carlos hits 6 months tomorrow, so today he is still 5m.
  assert.equal(tenureLabel('2026-03-02', '2026-09-01'), '5m');
  assert.equal(tenureLabel('2026-03-02', '2026-09-02'), '6m');
});

// ── T5: day counts ───────────────────────────────────────────────────────────
// These are the numbers the probe returned as days_until. They must come out
// exact — a local-time subtraction across the 2026-11-01 US DST change would
// land on 140.958… and floor to the wrong day.

test('T5: daysUntil matches the live days_until values exactly', () => {
  assert.equal(daysUntil(TODAY, '2026-09-02'), 1);    // Carlos Aloma
  assert.equal(daysUntil(TODAY, '2026-12-08'), 98);   // Winston Carrillo
  assert.equal(daysUntil(TODAY, '2026-12-15'), 105);  // Eder Quintero
  assert.equal(daysUntil(TODAY, '2027-01-06'), 127);  // Isaac Chung
  assert.equal(daysUntil(TODAY, '2027-01-20'), 141);  // crosses DST and New Year
  assert.equal(daysUntil(TODAY, '2027-02-03'), 155);  // Johann Morante
});

test('T5b: daysUntil is negative for dates that have passed, and zero on the day', () => {
  assert.equal(daysUntil(TODAY, '2026-05-19'), -105); // Ulla Hees
  assert.equal(daysUntil(TODAY, '2026-08-24'), -8);   // Charles Bush
  assert.equal(daysUntil(TODAY, '2026-08-02'), -30);  // Alanis Chena
  assert.equal(daysUntil(TODAY, TODAY), 0);
});

// ── T6: contract end state ───────────────────────────────────────────────────
// 31 of 44 contract ends are in the past. That is the normal state — people
// finish a 6-month contract and move to an indefinite one without the board
// being updated — so it must NOT be reported as a warning.

test('T6: contractEndState separates none / ended / future', () => {
  assert.deepEqual(contractEndState(null, TODAY), { kind: 'none', days: null });
  assert.deepEqual(contractEndState('', TODAY), { kind: 'none', days: null });
  assert.deepEqual(contractEndState('2026-05-19', TODAY), { kind: 'ended', days: -105 });
  assert.deepEqual(contractEndState('2026-09-02', TODAY), { kind: 'future', days: 1 });
});

test('T6b: the end date itself counts as future, not ended', () => {
  assert.deepEqual(contractEndState(TODAY, TODAY), { kind: 'future', days: 0 });
});

test('T6c: a full timestamp from Postgres is sliced, not parsed', () => {
  assert.deepEqual(
    contractEndState('2026-09-02T00:00:00.000Z', TODAY),
    { kind: 'future', days: 1 },
  );
});

// ── nextMilestone ────────────────────────────────────────────────────────────

test('nextMilestone is the first one not yet reached', () => {
  assert.deepEqual(nextMilestone('2026-03-02', TODAY), { key: '6m', date: '2026-09-02', days: 1 });
  assert.deepEqual(nextMilestone('2025-11-19', TODAY), { key: '1y', date: '2026-11-19', days: 79 });
});

test('nextMilestone is null once two years have passed', () => {
  assert.equal(nextMilestone('2020-01-01', TODAY), null);
});

// ── T7: the timezone invariant, asserted against the source ──────────────────
// AGENTS.md: dates are YYYY-MM-DD strings, compared as strings. Constructing a
// Date from one reintroduces the bug this repo has ~10 migrations for. The only
// Date construction allowed here is the day-number idiom ptoAccrual.ts already
// uses, which takes a number.

test('T7: tenure.ts never constructs a Date from a date string', () => {
  const src = readFileSync(new URL('../src/app/lib/tenure.ts', import.meta.url), 'utf8');
  const constructions = src.match(/new Date\([^)]*\)/g) ?? [];
  const allowed = /^new Date\(\s*[A-Za-z0-9_$]+\s*\*\s*86400000\s*\)$/;
  const offenders = constructions.filter(c => !allowed.test(c));
  assert.deepEqual(offenders, [], `disallowed Date construction: ${offenders.join(', ')}`);
});

test('T7b: tenure.ts does not reach for the clock itself', () => {
  const src = readFileSync(new URL('../src/app/lib/tenure.ts', import.meta.url), 'utf8');
  assert.ok(!/Date\.now\(\)/.test(src), 'tenure.ts must take asOf as a parameter, not read the clock');
  assert.ok(!/new Date\(\)/.test(src), 'today comes from toLocalYMD at the call site, not from tenure.ts');
});
