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

test('keepFreshRange returns yesterday..today', () => {
  assert.deepEqual(keepFreshRange('2026-03-01'), { from: '2026-02-28', to: '2026-03-01' });
});

test('keepFreshRange crosses a year boundary correctly', () => {
  assert.deepEqual(keepFreshRange('2026-01-01'), { from: '2025-12-31', to: '2026-01-01' });
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
