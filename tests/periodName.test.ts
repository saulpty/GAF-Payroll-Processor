import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePeriodName, isCanonical, nearMatch, nextPeriod } from '../src/app/lib/periodName.ts';

const EXISTING = ['Q2-Aug-2026', 'Q1-Aug-2026', 'Q2-Jul-2026', 'Test Period May 25th - Jun 10th', 'Planilla 2 Junio 2026 11-19'];

test('P1: names are trimmed before anything else', () => {
  assert.equal(normalizePeriodName('  Q1-Sep-2026 '), 'Q1-Sep-2026');
  assert.equal(normalizePeriodName('\tQ1-Sep-2026\n'), 'Q1-Sep-2026');
});

test('P2: the canonical shape is Q1|Q2 - Mon - YYYY, exactly', () => {
  for (const ok of ['Q1-Sep-2026', 'Q2-Dec-2027', 'Q1-Jan-2026']) assert.equal(isCanonical(ok), true, ok);
  for (const bad of ['Q1-Aug-20260', 'q1-aug-2026', 'Q3-Jun-2026', 'Q1-Sept-2026', 'Q1-Aug-26', 'Q1 Aug 2026', '', 'Planilla 2 Junio 2026 11-19']) {
    assert.equal(isCanonical(bad), false, bad);
  }
});

test('P3: the real incident — Q1-Aug-20260 is a near match of Q1-Aug-2026', () => {
  assert.equal(nearMatch('Q1-Aug-20260', EXISTING), 'Q1-Aug-2026');
  assert.equal(nearMatch('q1-aug-2026', EXISTING), 'Q1-Aug-2026');   // case only
  assert.equal(nearMatch('Q1 Aug 2026', EXISTING), 'Q1-Aug-2026');   // punctuation only
  assert.equal(nearMatch('Q1-Aug-2O26', EXISTING), 'Q1-Aug-2026');   // one typo
});

test('P4: a genuinely new name is not near anything, and legacy free-text names never match', () => {
  assert.equal(nearMatch('Q1-Sep-2026', EXISTING), null);
  assert.equal(nearMatch('Q2-Sep-2026', EXISTING), null);
  assert.equal(nearMatch('Test Period', EXISTING), null);
});

test('P5: an exact existing name is not flagged — that is a re-run, not a typo', () => {
  assert.equal(nearMatch('Q1-Aug-2026', EXISTING), null);
  assert.equal(nearMatch(' Q1-Aug-2026 ', EXISTING), null);
});

test('P6: the period after Q1 is Q2 of the same month, starting the day after the latest end', () => {
  assert.deepEqual(nextPeriod({ period_name: 'Q1-Aug-2026', end_date: '2026-08-09' }),
    { name: 'Q2-Aug-2026', startDate: '2026-08-10', endDate: '2026-08-24' });
});

test('P7: the period after Q2 rolls to Q1 of the next month, and December rolls the year', () => {
  assert.deepEqual(nextPeriod({ period_name: 'Q2-Aug-2026', end_date: '2026-08-25' }),
    { name: 'Q1-Sep-2026', startDate: '2026-08-26', endDate: '2026-09-09' });
  assert.deepEqual(nextPeriod({ period_name: 'Q2-Dec-2026', end_date: '2026-12-25T00:00:00.000Z' }),
    { name: 'Q1-Jan-2027', startDate: '2026-12-26', endDate: '2027-01-09' });
});

test('P8: a legacy free-text period or a missing end date gives no suggestion', () => {
  assert.equal(nextPeriod({ period_name: 'Test Period May 25th - Jun 10th', end_date: '2026-06-10' }), null);
  assert.equal(nextPeriod({ period_name: 'Q1-Aug-2026', end_date: null }), null);
});

// ── 2026-09-23: two different canonical periods are never "typos" of each other ──
// The typo guard refused Q2-Sep-2026 because Q1-Sep-2026 existed (one character
// apart). It also refused Jul next to Jun, May next to Mar, and 2027 next to 2026.
// A name with the canonical shape is its own period; only malformed input can be a typo.

test('P9: Q2 of a month is not a typo of Q1 of the same month', () => {
  assert.equal(nearMatch('Q2-Sep-2026', ['Q1-Sep-2026']), null);
  assert.equal(nearMatch('Q1-Sep-2026', ['Q2-Sep-2026']), null);
});

test('P10: neighbouring months and years are distinct periods, not typos', () => {
  assert.equal(nearMatch('Q1-Jul-2026', ['Q1-Jun-2026']), null);
  assert.equal(nearMatch('Q1-May-2026', ['Q1-Mar-2026']), null);
  assert.equal(nearMatch('Q1-Jan-2027', ['Q1-Jan-2026']), null);
});

test('P11: malformed input is still caught as a typo of the canonical period', () => {
  assert.equal(nearMatch('Q1-Aug-20260', ['Q1-Aug-2026', 'Q2-Aug-2026']), 'Q1-Aug-2026');
  assert.equal(nearMatch('q2-sep-2026', ['Q1-Sep-2026', 'Q2-Sep-2026']), 'Q2-Sep-2026');
});

// ── 2026-09-23: the period name comes from the end date ──
// Every period on record ends by the 15th (Q1) or after it (Q2) of the month it is
// named for; the start date can fall in the previous month (Q1-Apr ran Mar 26 → Apr 10).

test('P12: the name is derived from the end date — day 1-15 is Q1, 16+ is Q2', async () => {
  const { periodNameFromEndDate } = await import('../src/app/lib/periodName.ts');
  const history: [string, string][] = [
    ['2026-03-25', 'Q2-Mar-2026'], ['2026-04-10', 'Q1-Apr-2026'], ['2026-04-23', 'Q2-Apr-2026'],
    ['2026-05-10', 'Q1-May-2026'], ['2026-05-24', 'Q2-May-2026'], ['2026-08-09', 'Q1-Aug-2026'],
    ['2026-08-24', 'Q2-Aug-2026'], ['2026-09-08', 'Q1-Sep-2026'], ['2026-09-25', 'Q2-Sep-2026'],
  ];
  for (const [end, name] of history) assert.equal(periodNameFromEndDate(end), name, end);
  assert.equal(periodNameFromEndDate('2026-09-15'), 'Q1-Sep-2026');
  assert.equal(periodNameFromEndDate('2026-09-16'), 'Q2-Sep-2026');
  assert.equal(periodNameFromEndDate('2027-01-09'), 'Q1-Jan-2027');
  assert.equal(periodNameFromEndDate('2026-12-25T00:00:00.000Z'), 'Q2-Dec-2026');
});

test('P13: no end date, or a malformed one, gives no name', async () => {
  const { periodNameFromEndDate } = await import('../src/app/lib/periodName.ts');
  for (const bad of ['', null, undefined, '2026-13-01', '2026-09-32', '09/25/2026', 'soon']) {
    assert.equal(periodNameFromEndDate(bad as string), null, String(bad));
  }
});

// ── 2026-09-23: Process Payroll takes the name from the end date; Tim only picks dates ──
test('P14: Process Payroll derives the period name from the end date and cannot be typed into', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/app/pages/ProcessPayroll.tsx', import.meta.url), 'utf8');
  assert.match(src, /import \{[^}]*\bperiodNameFromEndDate\b[^}]*\} from '@\/app\/lib\/periodName'/);
  assert.doesNotMatch(src, /setPeriodName\(e\.target\.value\)/, 'the name box must not accept typing');
  assert.match(src, /setEndDate\(e\.target\.value\);\s*setPeriodName\(periodNameFromEndDate\(e\.target\.value\)/,
    'changing the end date must set the name');
  const nameInput = src.slice(src.indexOf('Period Name (from the end date)'), src.indexOf('Period Name (from the end date)') + 600);
  assert.match(nameInput, /\breadOnly\b/, 'the name box is read-only');
  assert.doesNotMatch(src, /are left in place/, 'the re-run warning must not say stale rows are left in place');
});
