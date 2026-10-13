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
  // Settings parsing lives in its own file since 2026-10-13 (the hook was 13.9 KB of 15).
  const settings = read(DIR + 'activitySettings.ts');
  for (const k of KEYS) assert.match(settings, new RegExp(`'${k}'`), `${k} is not read`);
  assert.match(hook, /import \{ parseSettings, parseMinimums \} from '\.\/activitySettings';/);
  assert.doesNotMatch(hook, /function parseSettings|function parseMinimums/);
  assert.ok(Buffer.byteLength(hook, 'utf8') < 13 * 1024, 'useActivityData.ts should be back under 13 KB');
  // The start date reaches the day builder, so days before it get no row.
  assert.match(hook, /start_date: e\.start_date,/);
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
  assert.match(src, /\{ key: 'needsLook',\s+label: 'Low Activity Days', tip: lowTip \}/);
  assert.match(src, /\{ key: 'missed',\s+label: 'Days Missed' \}/);
  assert.match(src, /Compares \$\{p\.afterLabel\} with the \$\{p\.prevDayCount\} \$\{p\.prevDayCount === 1 \? 'day' : 'days'\} right before it, \$\{p\.beforeLabel\}\./);
  assert.match(src, /Days off, PTO, permissions, sick days and holidays are left out of both\./);
  assert.match(src, /`Hide All \$\{total\} Days` : `Show All \$\{total\} Days`/);
  assert.match(src, /<span aria-hidden="true">\{showDays \? '▲' : '▼'\}<\/span>/);
  assert.match(src, /<td colSpan=\{9\}/);
  assert.ok(Buffer.byteLength(src, 'utf8') < 15 * 1024, 'ActivityByEmployee.tsx is over 15 KB');
});

test('TW5 (prompt 03): the four cards carry a comparison line; By Day and the side panel are untouched', () => {
  const page = read(DIR + 'AttendanceActivity.tsx');
  assert.equal((page.match(/note=\{/g) ?? []).length, 4, 'each of the four cards gets a note');
  assert.match(page, /<ActivityByDay days=\{days\} dateFrom=\{safeFrom\} dateTo=\{safeTo\} \/>/);
  assert.match(page, /<ActivityNeedsLook part="box" open=\{lookOpen\} onToggle=\{toggleLook\} days=\{filteredNeedsLook\} dateTo=\{safeTo\} settings=\{settings\} onPick=\{handlePickEmployee\} \/>/);
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

test('TW7 (prompt 07): long ranges thin the chart labels; minutes and days are whole numbers', () => {
  const chart = read(DIR + 'ActivityDayChart.tsx');
  assert.match(chart, /const show = bars\.length <= 26 \|\| dow === 'Mon' \|\| i === 0;/);
  // Narrow windows: the opened row sticks to the left edge at the visible width (both branches).
  const be = read(DIR + 'ActivityByEmployee.tsx');
  assert.equal((be.match(/className="sticky left-0 p-4 bg-slate-50 border-b-2 border-slate-300" style=\{OPENED_WIDTH\}/g) ?? []).length, 2);
  // 72px = page padding + borders + both scrollbars, measured on /dev (50px overflowed by 20px).
  assert.match(be, /const OPENED_WIDTH = \{ width: 'min\(100%, calc\(100vw - 72px\)\)' \};/);
  // Title Case labels and the Before and After panel's size (Saul's screenshot, 2026-10-13).
  assert.match(be, /xl:grid-cols-\[500px_minmax\(0,1fr\)\] gap-4 items-start/);
  assert.match(chart, /`Avg Active \$\{fmtMinutes\(avg\)\}`/);
  assert.match(chart, /Normal Day<\/span>/);
  assert.doesNotMatch(chart, /a day on average`\}|Normal day|no approved reason<|\} minimum</);
  assert.match(read(DIR + 'ActivityDaysSideBySide.tsx'), /\{sum\.worked\} Days With Work/);
  assert.match(read(DIR + 'ActivityCompare.tsx'), /const TD = 'px-3 py-2 text-right text-\[13px\] tabular-nums/);
  const dlg = read(DIR + 'ActivityThresholds.tsx');
  assert.match(dlg, /if \(field\.unit !== 'hours' && !Number\.isInteger\(n\)\) return null;/);
  assert.match(dlg, /The minimum active time is scaled for a shorter shift\./);
  assert.doesNotMatch(dlg, /A shorter shift is scaled proportionally\./);
});

test('TW8 (prompt 08): Needs a Look starts closed; the open row freezes; names are bold; no bare warning-sign labels', () => {
  const nl = read(DIR + 'ActivityNeedsLook.tsx');
  // The page owns open/closed (prompt 09); the component renders a chip or the box.
  assert.match(nl, /if \(part === 'chip'\) \{/);
  assert.match(nl, /if \(!open\) return null;/);
  assert.match(nl, /\{open \? 'Hide' : 'Show'\}/);
  assert.doesNotMatch(nl, /useState/);
  // Hooks stay above every early return.
  assert.ok(nl.indexOf('useMemo(') < nl.indexOf('if (totalFlagged === 0) return null;'));

  const be = read(DIR + 'ActivityByEmployee.tsx');
  assert.match(be, /<tr ref=\{rowRef\} onClick=\{onToggle\} className=\{expanded \? 'sticky z-\[5\] bg-white shadow-sm cursor-pointer' : 'hover:bg-slate-50 transition-colors cursor-pointer'\}>/);
  assert.match(be, /<tr ref=\{detailRef\}>/);
  assert.match(be, /row\.style\.top = `\$\{Math\.min\(headH, room\)\}px`;/);
  assert.match(be, /scroller\.removeEventListener\('scroll', place\);/);
  assert.match(be, /className="font-semibold text-slate-900 hover:text-warm-text/);
  assert.match(be, /Days with work but under the minimum active time/);
  for (const f of ['ActivityByEmployee.tsx', 'ActivityCompare.tsx', 'ActivityDaysSideBySide.tsx']) {
    assert.doesNotMatch(read(DIR + f), /label[:=]\s*["']⚠️ Days["']/, `${f}: "⚠️ Days" says nothing`);
  }
  assert.match(read(DIR + 'ActivityCompare.tsx'), /<Row label="Low Activity Days"/);
  assert.match(read(DIR + 'ActivityDaysSideBySide.tsx'), /<Figure label="Low Activity Days"/);
});

test('TW9 (prompt 09): one toolbar row; a click anywhere on a row opens it, the name still opens the panel', () => {
  const page = read(DIR + 'AttendanceActivity.tsx');
  assert.match(page, /const \[lookOpen, setLookOpen\] = useState\(false\);/);
  assert.match(page, /<ActivityNeedsLook part="chip" open=\{lookOpen\} onToggle=\{toggleLook\}/);
  // Chip, switch and Thresholds share the right-hand cluster of the tiles row.
  const row = page.slice(page.indexOf('<ActivityNeedsLook part="chip"'), page.indexOf('<ActivityNeedsLook part="box"'));
  assert.match(row, /By Employee/);
  assert.match(row, /By Day/);
  assert.match(row, /<ActivityThresholds settings=\{settings\} minimums=\{minimums\} onSaved=\{reloadConfig\} \/>/);
  assert.equal((page.match(/<SummaryTile /g) ?? []).length, 4);

  const be = read(DIR + 'ActivityByEmployee.tsx');
  // The arrow and the name sit inside the clickable row: each must stop the click from reaching it.
  assert.match(be, /<button onClick=\{e => \{ e\.stopPropagation\(\); onToggle\(\); \}\}/);
  assert.match(be, /onClick=\{e => \{ e\.stopPropagation\(\); onOpenPanel\(emp\); \}\}/);
  assert.ok(Buffer.byteLength(be, 'utf8') < 15 * 1024, 'ActivityByEmployee.tsx is over 15 KB');
});

test('TW10 (prompt 10): the row shows the comparison\'s own figures, so it always agrees with Before and After', () => {
  const be = read(DIR + 'ActivityByEmployee.tsx');
  assert.match(be, /<span className="font-medium">\{a\.worked\}<\/span>/);
  assert.match(be, /<ActiveBar activeMin=\{a\.avgActiveMin\} shiftMin=\{shift\} \/>/);
  assert.match(be, /\{a\.avgEntryMin !== null \? fmtClock\(a\.avgEntryMin\) : '—'\}/);
  assert.match(be, /\{a\.avgExitMin !== null \? fmtClock\(a\.avgExitMin\) : '—'\}/);
  // No row cell or sort key reads the all-days averages any more.
  // (\b: "trend.before.avgActiveMin" in the chart's props is not one of them.)
  assert.doesNotMatch(be, /emp\.avg(Active|First|Last)Min|emp\.daysWorked|emp\.scheduledDays|\be\.avg(Active|First|Last)Min|return e\.daysWorked/);
  assert.match(be, /if \(key === 'avgFirstMin'\) return t \? t\.after\.avgEntryMin \?\? -1 : -1;/);
  assert.ok(Buffer.byteLength(be, 'utf8') < 15 * 1024, 'ActivityByEmployee.tsx is over 15 KB');
});
