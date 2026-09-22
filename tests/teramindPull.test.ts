import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pullChunks, isTruncated, keepFreshRange, coversRange } from '../src/app/lib/teramindPull.ts';

const SRC_PATH = fileURLToPath(new URL('../src/app/lib/teramindPull.ts', import.meta.url));

function nextDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + 86400000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

test('source has no toISOString and only import-type imports', () => {
  const src = readFileSync(SRC_PATH, 'utf8');
  assert.equal(/toISOString/.test(src), false);
  const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
  assert.ok(importLines.length > 0);
  for (const line of importLines) assert.match(line, /^\s*import type\b/);
});

test('pullChunks splits a 15-day period into 3 chunks with no gap or overlap, last ending on to+1', () => {
  const chunks = pullChunks('2026-01-01', '2026-01-15', 7);
  assert.deepEqual(chunks, [
    { from: '2026-01-01', to: '2026-01-07' },
    { from: '2026-01-08', to: '2026-01-14' },
    { from: '2026-01-15', to: '2026-01-16' },
  ]);
  for (let i = 1; i < chunks.length; i++) {
    assert.equal(chunks[i].from, nextDay(chunks[i - 1].to));
  }
  assert.equal(chunks[chunks.length - 1].to, nextDay('2026-01-15'));
});

test('pullChunks: a single day produces one chunk spanning to+1', () => {
  assert.deepEqual(pullChunks('2026-03-10', '2026-03-10', 7), [{ from: '2026-03-10', to: '2026-03-11' }]);
});

test('pullChunks: from > to returns an empty array', () => {
  assert.deepEqual(pullChunks('2026-03-10', '2026-03-01'), []);
});

test('pullChunks: month boundary', () => {
  assert.deepEqual(pullChunks('2026-01-28', '2026-02-02', 7), [{ from: '2026-01-28', to: '2026-02-03' }]);
});

test('pullChunks: year boundary', () => {
  assert.deepEqual(pullChunks('2026-12-30', '2027-01-02', 7), [{ from: '2026-12-30', to: '2027-01-03' }]);
});

test('pullChunks: leap day (2028 is a leap year)', () => {
  assert.deepEqual(pullChunks('2028-02-27', '2028-03-01', 7), [{ from: '2028-02-27', to: '2028-03-02' }]);
});

test('isTruncated is true only once rowCount reaches the limit', () => {
  assert.equal(isTruncated(99, 100), false);
  assert.equal(isTruncated(100, 100), true);
  assert.equal(isTruncated(101, 100), true);
});

test('keepFreshRange covers the last week, ending today', () => {
  assert.deepEqual(keepFreshRange('2026-03-01'), { from: '2026-02-23', to: '2026-03-01' });
});

test('keepFreshRange crosses a year boundary correctly', () => {
  assert.deepEqual(keepFreshRange('2026-01-01'), { from: '2025-12-26', to: '2026-01-01' });
});

// 2026-09-22: Sat Sep 19 had zero rows in teramind_sessions. The sync only ran while a super user
// had the Hub open and only asked for yesterday+today, so Monday's pull fetched Sunday and Monday
// and Saturday was never in any range again. A week-wide window heals a weekend by itself.
test('keepFreshRange on the Monday after a quiet weekend reaches back past Saturday', () => {
  const range = keepFreshRange('2026-09-21');
  assert.equal(range.from <= '2026-09-19', true, 'Monday must re-pull the Saturday nobody was online for');
  assert.equal(range.to, '2026-09-21');
});

test('keepFreshRange takes an explicit span and refuses a nonsense one', () => {
  assert.deepEqual(keepFreshRange('2026-03-01', 2), { from: '2026-02-28', to: '2026-03-01' });
  assert.deepEqual(keepFreshRange('2026-03-01', 1), { from: '2026-03-01', to: '2026-03-01' });
  assert.deepEqual(keepFreshRange('2026-03-01', 0), { from: '2026-02-23', to: '2026-03-01' });
});

test('coversRange: overlapping successful logs cover the range', () => {
  const log = [
    { date_from: '2026-01-01', date_to: '2026-01-05', error: null, truncated: false },
    { date_from: '2026-01-03', date_to: '2026-01-10', error: null, truncated: false },
  ];
  assert.equal(coversRange(log, '2026-01-01', '2026-01-10'), true);
});

test('coversRange: adjacent successful logs cover the range', () => {
  const log = [
    { date_from: '2026-01-01', date_to: '2026-01-05', error: null, truncated: false },
    { date_from: '2026-01-06', date_to: '2026-01-10', error: null, truncated: false },
  ];
  assert.equal(coversRange(log, '2026-01-01', '2026-01-10'), true);
});

test('coversRange: a gap between logs means not covered', () => {
  const log = [
    { date_from: '2026-01-01', date_to: '2026-01-04', error: null, truncated: false },
    { date_from: '2026-01-06', date_to: '2026-01-10', error: null, truncated: false },
  ];
  assert.equal(coversRange(log, '2026-01-01', '2026-01-10'), false);
});

test('coversRange: failed or truncated logs do not count as coverage', () => {
  const log = [
    { date_from: '2026-01-01', date_to: '2026-01-10', error: 'boom', truncated: false },
    { date_from: '2026-01-01', date_to: '2026-01-10', error: null, truncated: true },
  ];
  assert.equal(coversRange(log, '2026-01-01', '2026-01-10'), false);
});

// 2026-09-22: the log held a capture entered on Sep 17 for 2026-09-11 → 2026-09-25. Eight of those
// days had not happened yet, but coversRange counted them, so Process Payroll would have offered
// Tim a "saved copy" of Q2-Sep that was missing Saturday Sep 19 entirely — a worked day would have
// reached the engine as an absence. A pull only ever saw days up to the day it ran.
test('coversRange: a pull cannot cover days that had not happened when it ran', () => {
  const log = [
    { date_from: '2026-09-11', date_to: '2026-09-25', error: null, truncated: false, pulled_ymd: '2026-09-17' },
  ];
  assert.equal(coversRange(log, '2026-09-11', '2026-09-17'), true,  'the days it did see are covered');
  assert.equal(coversRange(log, '2026-09-11', '2026-09-25'), false, 'the future days it claimed are not');
  assert.equal(coversRange(log, '2026-09-19', '2026-09-19'), false, 'the Saturday that was actually missing');
});

test('coversRange: falls back to pulled_at when pulled_ymd is absent, and to the range when neither is', () => {
  const withTimestamp = [
    { date_from: '2026-09-11', date_to: '2026-09-25', error: null, truncated: false, pulled_at: '2026-09-17T20:09:00.000Z' },
  ];
  assert.equal(coversRange(withTimestamp, '2026-09-19', '2026-09-19'), false);

  const bare = [
    { date_from: '2026-09-11', date_to: '2026-09-25', error: null, truncated: false },
  ];
  assert.equal(coversRange(bare, '2026-09-19', '2026-09-19'), true, 'older callers keep working unchanged');
});
