// 2026-10-13 — Attendance → List counted 30 days under a 3-day label when reached from another
// page (prompt 2026-10-13-list-range/01). The 30-day fallback's answer landed after the chosen
// period's and won. The page now keeps only the days inside the range it shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as stats from '../src/app/lib/attendanceStats.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const rowsInRange = (stats as Record<string, unknown>).rowsInRange as
  (<T extends { date: string }>(rows: T[], from: string, to: string) => T[]) | undefined;

const row = (date: string) => ({ date, email: 'a@x' });

test('LR1: a late answer for a wider range is cut down to the days asked for', () => {
  assert.equal(typeof rowsInRange, 'function', 'rowsInRange is missing from attendanceStats.ts');
  const thirtyDays = ['2026-09-13', '2026-09-30', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'].map(row);
  assert.deepEqual(
    rowsInRange!(thirtyDays, '2026-10-11', '2026-10-13').map(r => r.date),
    ['2026-10-11', '2026-10-12', '2026-10-13'],
  );
});

test('LR2: both ends are included, and a full timestamp counts as its day', () => {
  const rows = [row('2026-10-11T00:00:00.000Z'), row('2026-10-13T05:00:00.000Z'), row('2026-10-14T00:00:00.000Z')];
  assert.equal(rowsInRange!(rows, '2026-10-11', '2026-10-13').length, 2);
  assert.deepEqual(rowsInRange!([], '2026-10-11', '2026-10-13'), []);
  assert.equal(rowsInRange!([row('2026-10-12')], '2026-10-12', '2026-10-12').length, 1, 'a one-day range keeps its day');
});

test('LR3: the List page counts only the rows inside the range it shows', () => {
  const page = read('src/app/pages/Attendance.tsx');
  assert.match(page, /rowsInRange\(\(rawRows as AttendanceRow\[\]\) \?\? \[\], safeFrom, safeTo\)/);
  assert.doesNotMatch(page, /const rows = \(rawRows as AttendanceRow\[\]\) \?\? \[\];/, 'the unfiltered rows must not feed the cards');
  const lib = read('src/app/lib/attendanceStats.ts');
  assert.doesNotMatch(lib.slice(lib.indexOf('export function rowsInRange')).split('\n}')[0], /new Date\(/, 'dates are compared as strings');
});

test('LR4 (prompt 02): in Periods mode the chosen periods own the dates again', () => {
  const src = read('src/app/components/AttendanceRangeControls.tsx');
  const effect = src.slice(src.indexOf('useEffect(() => {'), src.indexOf('}, [attendanceMode, periods.length]);'));
  assert.ok(effect.length > 0, 'the effect keyed on the mode is missing');
  assert.match(effect, /if \(attendanceMode !== 'periods' \|\| attendancePeriods\.length === 0\) return;/, 'Dates mode is left alone');
  assert.match(effect, /range\.from !== dateFrom \|\| range\.to !== dateTo/, 'it only writes when the dates differ (no loop)');
  assert.match(effect, /setAttendancePeriods\(attendancePeriods, range\)/);
  assert.ok(Buffer.byteLength(src, 'utf8') < 15 * 1024);
});
