import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyRow, summarize, clockDiff, fmtMinutes, type CompareRow } from '../src/app/lib/teramindCompare.ts';

const row = (o: Partial<CompareRow>): CompareRow => ({
  employee_id: 1, name: 'A', day: '2026-08-11', period_name: 'Q2-Aug-2026',
  pay_entry: null, pay_exit: null, pay_entry_min: null, pay_exit_min: null,
  tm_entry_min: null, tm_exit_min: null, tm_exit_next_day: false, sessions: null, longest_s: null, has_manual: false,
  event_type_1: '', initial_status: 'GREEN', touched_after_run: false, ...o,
});

test('the probe day: 8:56 AM to 5:01 PM on both sides is a match', () => {
  const v = classifyRow(row({ pay_entry_min: 536, pay_exit_min: 1021, tm_entry_min: 536, tm_exit_min: 1021 }));
  assert.equal(v.kind, 'match'); assert.equal(v.worst, 0);
});

test('close vs different uses the threshold, and diffs are Teramind minus payroll', () => {
  const close = classifyRow(row({ pay_entry_min: 540, pay_exit_min: 1020, tm_entry_min: 543, tm_exit_min: 1020 }));
  assert.equal(close.kind, 'close'); assert.equal(close.entryDiff, 3);
  const diff = classifyRow(row({ pay_entry_min: 540, pay_exit_min: 1020, tm_entry_min: 520, tm_exit_min: 1020 }));
  assert.equal(diff.kind, 'different'); assert.equal(diff.entryDiff, -20); assert.equal(diff.worst, 20);
});

test('cross-midnight exit: 00:35 next day vs payroll "12:35 AM" is a match, not 1440 minutes', () => {
  assert.equal(clockDiff(35, 35), 0);
  assert.equal(clockDiff(5, 1435), 10);     // 00:05 vs 23:55
  assert.equal(clockDiff(1435, 5), -10);
  const v = classifyRow(row({ pay_entry_min: 290, pay_exit_min: 35, tm_entry_min: 290, tm_exit_min: 35, tm_exit_next_day: true }));
  assert.equal(v.kind, 'match');
});

test('one-sided and empty days', () => {
  assert.equal(classifyRow(row({ pay_entry_min: 540, pay_exit_min: 1020 })).kind, 'payroll_only');
  assert.equal(classifyRow(row({ tm_entry_min: 540, tm_exit_min: 1020 })).kind, 'teramind_only');
  assert.equal(classifyRow(row({})).kind, 'both_empty');
  const noRow = classifyRow(row({ period_name: null, tm_entry_min: 540, tm_exit_min: 1020 }));
  assert.equal(noRow.kind, 'teramind_only'); assert.equal(noRow.hasPayrollRow, false);
});

test('payroll has an entry but no exit while Teramind has both: different, never match', () => {
  const v = classifyRow(row({ pay_entry_min: 540, pay_exit_min: null, tm_entry_min: 540, tm_exit_min: 1020 }));
  assert.equal(v.kind, 'different');
});

test('a session over 16 hours is flagged whatever the verdict', () => {
  assert.equal(classifyRow(row({ pay_entry_min: 540, pay_exit_min: 1020, tm_entry_min: 540, tm_exit_min: 1020, longest_s: 691200 })).longSession, true);
  assert.equal(classifyRow(row({ longest_s: 30000 })).longSession, false);
});

test('summarize counts every kind once; touched counts only disagreeing rows', () => {
  const s = summarize([
    row({ pay_entry_min: 540, pay_exit_min: 1020, tm_entry_min: 540, tm_exit_min: 1020, touched_after_run: true }),
    row({ pay_entry_min: 540, pay_exit_min: 1020, tm_entry_min: 500, tm_exit_min: 1020, touched_after_run: true }),
    row({ tm_entry_min: 540, tm_exit_min: 1020 }),
    row({}),
  ]);
  assert.deepEqual([s.total, s.match, s.different, s.teramind_only, s.both_empty, s.touched], [4, 1, 1, 1, 1, 1]);
});

test('fmtMinutes', () => {
  assert.equal(fmtMinutes(536), '8:56 AM'); assert.equal(fmtMinutes(1021), '5:01 PM');
  assert.equal(fmtMinutes(0), '12:00 AM'); assert.equal(fmtMinutes(720), '12:00 PM');
  assert.equal(fmtMinutes(35), '12:35 AM'); assert.equal(fmtMinutes(null), '—');
});

test('source is pure: no imports at all, no toISOString, no Date', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/app/lib/teramindCompare.ts', import.meta.url)), 'utf8');
  assert.doesNotMatch(src, /^\s*import\b/m); assert.doesNotMatch(src, /toISOString|new Date/);
});
