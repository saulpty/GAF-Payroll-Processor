import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePeriodName, isCanonical, nearMatch } from '../src/app/lib/periodName.ts';

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
