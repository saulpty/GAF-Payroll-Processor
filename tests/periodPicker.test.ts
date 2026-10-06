// Live attendance step 2 (2026-10-06): the Attendance Periods picker offers not-yet-processed
// periods too (tagged), defaults to the period containing today, and every place that turns
// period names into dates uses the same clamped rangeOf from attendancePeriods.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('PP1: FilterBar builds the picker from attendancePeriodOptions, not processed-only', () => {
  const fb = read('src/app/FilterBar.tsx');
  assert.match(fb, /attendancePeriodOptions\(periodsRaw as PeriodRow\[\], toLocalYMD\(new Date\(\)\), nextPeriod\)/);
  assert.doesNotMatch(fb, /processedPeriods/, 'the processed-only list is gone');
  assert.match(fb, /const rangeOf = periodPick\.rangeOf;/);
  assert.match(fb, /const def = periodPick\.defaultName;/);
  assert.match(fb, /defaultPeriod: periodPick\.defaultName,/, 'Clear Filters ignores the auto-picked default');
  assert.ok(Buffer.byteLength(fb) < 15000);
});

test('PP2: the range controls use the shared rangeOf; the dropdown tags unprocessed periods', () => {
  const rc = read('src/app/components/AttendanceRangeControls.tsx');
  assert.doesNotMatch(rc, /const rangeOf = /, 'no second, unclamped rangeOf');
  assert.match(rc, /rangeOf: \(names: string\[\]\) =>/);
  const ms = read('src/app/components/PeriodMultiSelect.tsx');
  assert.match(ms, /\{p\.processed === false && \(/);
  assert.match(ms, />\s*Not processed\s*</);
  assert.doesNotMatch(ms, /No processed periods/);
});
