import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLocalYMD, formatWorkDate } from '../src/app/lib/classificationEngine.ts';

// H1: date-keying must use the same local calendar fields the rest of the engine
// uses (formatWorkDate, getDay, getHours). The old code keyed dates off
// toISOString() (UTC), which diverges from the displayed wall-clock date whenever
// the runtime is not UTC. toLocalYMD reads local fields, so it always agrees with
// formatWorkDate — in any runtime timezone.

test('toLocalYMD formats local calendar date as YYYY-MM-DD', () => {
  assert.equal(toLocalYMD(new Date(2026, 5, 15, 7, 0)), '2026-06-15'); // Jun = month 5
});

test('toLocalYMD agrees with formatWorkDate even late in the day', () => {
  // 23:30 local: toISOString() would roll to the next day in any negative-offset
  // zone (e.g. Panama UTC-5); toLocalYMD must stay on the local calendar day.
  const d = new Date(2026, 5, 15, 23, 30);
  assert.equal(toLocalYMD(d), '2026-06-15');
  assert.ok(formatWorkDate(d).startsWith(toLocalYMD(d)));
});
