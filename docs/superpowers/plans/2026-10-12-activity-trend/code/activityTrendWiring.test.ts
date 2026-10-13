import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Guards for the Activity trend wiring (spec docs/superpowers/specs/2026-10-12-activity-trend-design.md).
// Each group stays red until the UIB export named in its title lands.

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string) => readFileSync(root + rel, 'utf8');
const DIR = 'src/app/pages/attendance/activity/';
const KEYS = [
  'activity_trend_min_active_minutes', 'activity_trend_min_entry_minutes',
  'activity_trend_min_days', 'activity_trend_min_worked_days',
];
const NEW_FILES = ['TrendPill.tsx', 'ActivityCompare.tsx', 'ActivityDayChart.tsx', 'ActivityDaysSideBySide.tsx'];

test('TW1 (prompt 01): the migration seeds the four minimums and deletes nothing', () => {
  const file = readdirSync(root + 'src/migrations').find((f) => /_activity_trend_minimums\.sql$/.test(f));
  assert.ok(file, 'no *_activity_trend_minimums.sql migration');
  const sql = read('src/migrations/' + file);
  for (const k of KEYS) assert.match(sql, new RegExp(`'${k}'`), `${k} is not seeded`);
  assert.equal((sql.match(/ON CONFLICT \(key\) DO NOTHING/g) ?? []).length, 4);
  const live = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(live, /\b(DELETE|DROP|TRUNCATE|UPDATE)\b/i, 'the migration must only insert');
});

test('TW2 (prompt 02): the hook loads the earlier period too and builds each period on its own rows', () => {
  const hook = read(DIR + 'useActivityData.ts');
  // Only the Activity page asks for the comparison; the side panel keeps loading its own range only.
  assert.match(hook, /const cmp = compare \? comparisonRanges\(safeFrom, safeTo, toLocalYMD\(new Date\(\)\)\) : null;/);
  assert.match(hook, /const prev = cmp \? cmp\.before : NO_PREV;/);
  // The memo reads compare and the period ends: both must be dependencies.
  assert.match(hook, /safeFrom, safeTo, spanFrom, compare, compareTo, employee, manager, role\]\);/);
  assert.match(read('src/app/pages/attendance/AttendancePanel.tsx'), /useActivityData\(\{ dateFrom: safeFrom, dateTo: safeTo \}\)/);
  assert.match(hook, /const spanFrom = prev\.days > 0 \? prev\.from : safeFrom;/);
  // Every range loader reads the combined span.
  assert.equal((hook.match(/dateFrom: spanFrom, dateTo: safeTo/g) ?? []).length, 4);
  assert.doesNotMatch(hook, /useLoadAction\([^\n]*dateFrom: safeFrom/);
  // Payroll rows are cut back to each period, so the selected range is built exactly as before.
  assert.match(hook, /payrollRows: payrollRows\.filter\(\(r\) => inRange\(r\.work_date, from, to\)\)/);
  for (const k of KEYS) assert.match(hook, new RegExp(`'${k}'`), `${k} is not read`);
  assert.doesNotMatch(hook, /\{\s*params:/, 'params-wrapper: loader parameters go flat');
  assert.ok(Buffer.byteLength(hook, 'utf8') < 15 * 1024, 'useActivityData.ts is over 15 KB');
});

test('TW3 (prompt 03): the four new files exist, use tokens, and stay small', () => {
  for (const f of NEW_FILES) {
    assert.ok(existsSync(root + DIR + f), `${f} is missing`);
    const src = read(DIR + f);
    assert.ok(Buffer.byteLength(src, 'utf8') < 15 * 1024, `${f} is over 15 KB`);
    assert.doesNotMatch(src, /#[0-9a-fA-F]{6}\b/, `${f}: raw hex colour, use a token`);
    assert.doesNotMatch(src, /uppercase/, `${f}: never ALL CAPS`);
    assert.doesNotMatch(src, /new Date\s*\(|toISOString/, `${f}: no Date maths`);
  }
  assert.match(read(DIR + 'TrendPill.tsx'), /improved: 'bg-status-green-tint text-status-green-ink border-status-green-fill'/);
  assert.match(read(DIR + 'ActivityDayChart.tsx'), /Hours Active Each Day/);
  assert.match(read(DIR + 'ActivityCompare.tsx'), /Before and After/);
});

test('TW4 (prompt 03): the By Employee table has the Trend, low-day and missed-day columns', () => {
  const src = read(DIR + 'ActivityByEmployee.tsx');
  assert.match(src, /\{ key: 'trend',\s+label: 'Trend', tip \}/);
  assert.match(src, /\{ key: 'needsLook',\s+label: '⚠️ Days' \}/);
  assert.match(src, /\{ key: 'missed',\s+label: 'Days Missed' \}/);
  assert.match(src, /Compares \$\{p\.afterLabel\} with the \$\{p\.prevDayCount\} days right before it, \$\{p\.beforeLabel\}\./);
  assert.match(src, /`▼ Show All \$\{total\} Days`/);
  assert.match(src, /<td colSpan=\{9\}/);
  assert.ok(Buffer.byteLength(src, 'utf8') < 15 * 1024, 'ActivityByEmployee.tsx is over 15 KB');
});

test('TW5 (prompt 03): the four cards carry a comparison line; By Day and the side panel are untouched', () => {
  const page = read(DIR + 'AttendanceActivity.tsx');
  assert.equal((page.match(/note=\{/g) ?? []).length, 4, 'each of the four cards gets a note');
  assert.match(page, /<ActivityByDay days=\{days\} dateFrom=\{safeFrom\} dateTo=\{safeTo\} \/>/);
  assert.match(page, /<ActivityNeedsLook days=\{filteredNeedsLook\} dateTo=\{safeTo\} settings=\{settings\} onPick=\{handlePickEmployee\} \/>/);
  assert.match(page, /compare: true,/);
  // The tooltip and panels name the dates actually compared (up to yesterday), not the raw range.
  assert.match(page, /const afterLabel = rangeLabel\(safeFrom, compareTo\);/);
  assert.ok(Buffer.byteLength(page, 'utf8') < 15 * 1024, 'AttendanceActivity.tsx is over 15 KB');
});

test('TW6 (prompt 04): the Thresholds dialog saves the four minimums as typed', () => {
  const src = read(DIR + 'ActivityThresholds.tsx');
  for (const k of KEYS) assert.match(src, new RegExp(`key: '${k}'`), `${k} has no field`);
  assert.match(src, /Trend Minimums/);
  assert.match(src, /const stored = field\.unit === 'hours' \? Math\.round\(n \* 60\) : Math\.round\(n\);/);
  assert.match(read(DIR + 'AttendanceActivity.tsx'), /<ActivityThresholds settings=\{settings\} minimums=\{minimums\} onSaved=\{reloadConfig\} \/>/);
});
