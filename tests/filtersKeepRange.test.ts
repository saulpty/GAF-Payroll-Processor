// Prompt 2026-10-16-punctuality/04: the range picked on one Attendance tab stays on the others.
// These FAIL until that prompt is run in UIB and exported (as does MR3 in mobileFilters.test.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('FK1: FilterBar never forces Periods or Dates on a tab change', () => {
  const fb = read('src/app/FilterBar.tsx');
  assert.doesNotMatch(fb, /ATTENDANCE_SWITCH_ROUTES/);
  assert.doesNotMatch(fb, /setAttendanceMode\(/);
});

test('FK2: Activity picks Dates · last 14 days only when no range is chosen yet', () => {
  const act = read('src/app/pages/attendance/activity/AttendanceActivity.tsx');
  assert.match(act, /if \(initDone\.current\) return;\s*initDone\.current = true;\s*if \(!dateFrom \|\| !dateTo\) \{/);
  assert.doesNotMatch(act, /attendanceMode !== 'dates'/);
});
