// 2026-10-13 — phone view, rows 1 (prompt 2026-10-13-mobile-rows/08-today-rows.md):
// MobileRow, and Attendance → Today as rows. Unit tests for the pure rules in todayRows.ts plus
// source guards. Lives in tests/ once the prompt is sent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = (p: string) => new URL(`../${p}`, import.meta.url);
const read = (p: string) => readFileSync(url(p), 'utf8').replace(/\r\n/g, '\n');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const A = 'src/app/pages/attendance/';
const ROW = 'src/app/components/mobile/MobileRow.tsx';
const LIB = 'src/app/lib/todayRows.ts';
const ROWS = `${A}TodayRows.tsx`;
const PAGE = `${A}AttendanceToday.tsx`;
const TILES = `${A}TodayTiles.tsx`;
const TABLE = `${A}TodayTable.tsx`;
const TABLE_ROW = `${A}TodayRow.tsx`;
const DESIGN = 'src/DESIGN.md';
const README = 'docs/superpowers/prompts/2026-10-13-mobile-rows/README.md';

// MobileRow.tsx exactly as the rows README gives it (LF line endings, one newline at the end).
const MOBILE_ROW_SHA256 = 'bb3abc7af74000a8dfdd4a01881311735ea965886e4e5c39296c691842fa5078';
// The computer's table as it stood on 2026-10-13, before this prompt.
const TABLE_SHA256 = '61a61c2dd10cbf59a21a261e6c108142bb06e0106473703448a2a48a31c06879';
// src/DESIGN.md as it stood on 2026-10-13: the Phone section may only be added after this text.
const DESIGN_BASE_CHARS = 4446;
const DESIGN_BASE_SHA256 = '76c59cf9c2b30781b4b52529463cf7e7739e2fadb13efa6fccb0a6c2da6896f8';

/** `original` is still there, token for token and in order; anything added is `phone:…` (or one of `also`). */
function desktopClassesKept(src: string, original: string, where: string, also: string[] = []) {
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const extra = `(?: (?:phone:[^\\s"\`]+${also.map(a => '|' + esc(a)).join('')}))*`;
  const re = new RegExp('(?<=["`])' + original.split(' ').map(esc).join(extra + ' ') + extra + '(?=["` ])');
  const m = re.exec(src);
  assert.ok(m, `${where}: the computer's classes must stay, with only phone: classes added`);
  return m[0];
}

/** The props written on the first `<Name …/>` in `src`, as { name: text of the value }. */
function jsxProps(src: string, name: string): Record<string, string> {
  const m = new RegExp(`<${name}((?:\\s+[A-Za-z]+(?:=\\{[^{}]*\\})?)+)\\s*/>`).exec(src);
  assert.ok(m, `<${name} …/> not found`);
  const out: Record<string, string> = {};
  for (const p of m[1].matchAll(/([A-Za-z]+)(?:=\{([^{}]*)\})?/g)) out[p[1]] = p[2] ?? 'true';
  return out;
}

test('MW1: MobileRow.tsx is the README\'s file, character for character', () => {
  assert.equal(sha(read(ROW)), MOBILE_ROW_SHA256, 'MobileRow.tsx differs from the file every later phone list relies on');
  if (existsSync(fileURLToPath(url(README)))) {
    const md = read(README);
    const at = md.indexOf('## `MobileRow`');
    const a = md.indexOf('```tsx\n', at) + 7;
    const b = md.indexOf('\n```', a);
    assert.ok(at > 0 && a > 6 && b > a, 'the README still carries the MobileRow file');
    assert.equal(sha(md.slice(a, b) + '\n'), MOBILE_ROW_SHA256, 'the README and this test disagree about MobileRow.tsx');
  }
});

test('MW2: the computer\'s table is untouched, byte for byte, and its row still exports what the phone rows import', () => {
  assert.equal(sha(read(TABLE)), TABLE_SHA256, 'TodayTable.tsx changed (its click-by-position logic must stay)');
  const row = read(TABLE_ROW);
  assert.match(row, /export const STATUS_CHIP: Record<TodayStatus, \{ label: string; cls: string \}> = \{/);
  assert.match(row, /export function isOnLeave\(status: TodayStatus, why: WhyChip \| null \| undefined\): boolean \{/);
  assert.match(row, /export function TodayTableRow\(/);
});

test('MW3: Today renders the rows OR the table, from one useIsPhone() call, with the same data', () => {
  const page = read(PAGE);
  assert.equal((page.match(/useIsPhone\(\)/g) ?? []).length, 1, 'the page asks "is this a phone?" exactly once');
  for (const f of [ROWS, TILES, LIB, ROW]) {
    assert.doesNotMatch(read(f), /useIsPhone|matchMedia/, `${f} must not decide phone-or-not by itself`);
  }
  assert.equal((page.match(/<TodayTable\b/g) ?? []).length, 1, 'one table');
  assert.equal((page.match(/<TodayRows\b/g) ?? []).length, 1, 'one list of rows');
  assert.match(
    page,
    /\{isPhone\s*\?\s*<TodayRows\s[^<>]*\/>\s*:\s*<TodayTable\s[^<>]*\/>\}/,
    'the rows show only under isPhone; the table is the other branch of the same choice',
  );
  const table = jsxProps(page, 'TodayTable');
  const rows = jsxProps(page, 'TodayRows');
  assert.deepEqual(
    table,
    { rows: 'rows', isToday: 'isToday', whyById: 'whyById', whyLoading: 'whyLoading', ghostByEmployee: 'ghostByEmployee', onRowClick: 'setPanelRow' },
    'the table is called exactly as before',
  );
  for (const [k, v] of Object.entries(rows)) assert.equal(table[k], v, `TodayRows.${k} must be what the table gets`);
  for (const k of ['rows', 'whyById', 'whyLoading', 'ghostByEmployee', 'onRowClick']) assert.ok(k in rows, `TodayRows needs ${k}`);
  // One panel, opened from the row object either way.
  assert.equal((page.match(/<AttendancePanel\b/g) ?? []).length, 1);
  assert.match(page, /employeeId=\{panelRow\.employeeId\}\s+displayName=\{panelRow\.name\}\s+displayRole=\{panelRow\.role\}/);
});

test('MW4: the rows reuse the table\'s status colours, On Leave rule and formats', () => {
  const rows = read(ROWS);
  assert.match(rows, /import \{ STATUS_CHIP, isOnLeave \} from '\.\/TodayRow';/, 'imported, not copied');
  assert.doesNotMatch(rows, /STATUS_CHIP\s*[:=]\s*\{|function isOnLeave/, 'no second copy of the status table or the leave rule');
  assert.match(rows, /import MobileRow from '@\/app\/components\/mobile\/MobileRow';/);
  assert.match(rows, /import WhyChipBadge from '\.\/activity\/WhyChipBadge';/);
  // The few lines that could not be imported must read exactly as they do in TodayRow.tsx.
  const tableRow = read(TABLE_ROW);
  for (const line of [
    'const clock = (min: number) => fmtTime(fmtClock(min));',
    'const lateBy = (m: number) => (m < 60 ? `+${m} min` : `+${fmtDuration(m)}`);',
    "!onLeave && row.status === 'holiday' && row.holidayName ? row.holidayName : chip.label;",
    "{ label: 'On Leave', cls: 'bg-blue-50 text-blue-700 border-blue-200' }",
  ]) {
    assert.ok(tableRow.includes(line), `TodayRow.tsx no longer has: ${line}`);
    assert.ok(rows.includes(line), `TodayRows.tsx must format this exactly as the table does: ${line}`);
  }
  assert.match(rows, /whyLoading \? undefined : \(whyById\.get\(row\.employeeId\) \?\? null\)/, 'the Why chip is looked up as the table looks it up');
  assert.match(rows, /rows\.map\(row => \{/, 'same rows, same order: no sort or filter of its own');
  assert.doesNotMatch(rows, /\.sort\(|\.filter\(|new Date\(|useLoadAction|useEffect|useState/, 'no sorting, filtering, dates, loaders or state in the rows');
  assert.match(rows, /chevron="right"/, 'a right arrow: the row opens a sheet');
  assert.match(rows, /onClick=\{onRowClick \? \(\) => onRowClick\(row\) : undefined\}/, 'a tap hands over the row object itself');
});

test('MW5: todayTone — red for unexplained No Records, yellow for Away, nothing else', async () => {
  const { todayTone } = await import('../src/app/lib/todayRows.ts');
  assert.equal(todayTone('late_not_in', false), 'red');
  assert.equal(todayTone('late_not_in', true), 'none', 'on leave is not flagged');
  assert.equal(todayTone('away', false), 'yellow');
  for (const s of ['working', 'not_in_yet', 'finished', 'day_off', 'holiday', 'not_started'] as const) {
    assert.equal(todayTone(s, false), 'none', s);
    assert.equal(todayTone(s, true), 'none', s);
  }
});

test('MW6: todayLate and isOffToday follow the table', async () => {
  const { todayLate, isOffToday } = await import('../src/app/lib/todayRows.ts');
  assert.equal(todayLate({ entryMin: null, minutesLate: 0, lateAfterGrace: false }), null, 'not in yet: nothing to say');
  assert.deepEqual(todayLate({ entryMin: 538, minutesLate: 0, lateAfterGrace: false }), { minutes: 0, level: 'on_time' });
  assert.deepEqual(todayLate({ entryMin: 545, minutesLate: 5, lateAfterGrace: false }), { minutes: 5, level: 'grace' });
  assert.deepEqual(todayLate({ entryMin: 615, minutesLate: 75, lateAfterGrace: true }), { minutes: 75, level: 'late' });
  // Midnight is minute 0: an entry at 0 is an entry.
  assert.deepEqual(todayLate({ entryMin: 0, minutesLate: 0, lateAfterGrace: false }), { minutes: 0, level: 'on_time' });

  assert.equal(isOffToday({ status: 'day_off', records: 0 }), true);
  assert.equal(isOffToday({ status: 'day_off', records: 4 }), false, 'worked on a day off: not greyed');
  assert.equal(isOffToday({ status: 'holiday', records: 0 }), false);
  assert.equal(isOffToday({ status: 'late_not_in', records: 0 }), false);
  // The table's own rule, so the two cannot drift apart unnoticed.
  assert.ok(read(TABLE_ROW).includes("const offToday = row.status === 'day_off' && row.records === 0;"));
});

test('MW7: the nothing-found line names every active filter', async () => {
  const { todayNothingFound } = await import('../src/app/lib/todayRows.ts');
  assert.equal(todayNothingFound({ role: 'Intake 1' }), 'No employees match Title: Intake 1');
  assert.equal(todayNothingFound({ employee: ' ana ', manager: 'Marcela', role: 'Intake 1' }), 'No employees match Employee: ana · Manager: Marcela · Title: Intake 1');
  assert.equal(todayNothingFound({ employee: '', manager: '', role: '' }), 'No employees to show.');
  assert.equal(todayNothingFound({}), 'No employees to show.');
  const page = read(PAGE);
  assert.match(page, /isPhone \? todayNothingFound\(\{ employee: globalEmployee, manager, role \}\) : 'No employees match these filters\.'/);
  // The words match the filter bar's labels.
  const bar = read('src/app/FilterBar.tsx');
  for (const label of ['Manager', 'Title']) assert.ok(bar.includes(`<span className={inLabel}>${label}</span>`), `filter bar label ${label}`);
});

test('MW8: todayRows.ts stays a pure module', () => {
  const src = read(LIB);
  const imports = src.split('\n').filter(l => /^import /.test(l));
  for (const l of imports) assert.match(l, /^import type /, `only type imports (plain node loads this file): ${l}`);
  assert.doesNotMatch(src, /new Date\(|Date\.now\(/, 'no clock');
});

test('MW9: on a computer the page and the tiles keep every class; the header scrolls away on a phone only', () => {
  const page = read(PAGE);
  desktopClassesKept(page, 'flex flex-col h-full bg-background', 'page');
  desktopClassesKept(page, 'shrink-0 px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center gap-3', 'header');
  desktopClassesKept(page, 'shrink-0 px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800', 'old-data notice');
  const area = desktopClassesKept(page, 'flex-1 overflow-auto px-5 py-4', 'page area').split(' ');
  // The header is a sibling above the page area. It scrolls with the page only when the page
  // area stops being the thing that scrolls.
  assert.ok(area.includes('phone:overflow-visible') && area.includes('phone:flex-none'), 'on a phone the page area must not scroll by itself');
  assert.doesNotMatch(page, /phone:(sticky|fixed)/, 'nothing pinned on a phone');

  const tiles = read(TILES);
  desktopClassesKept(tiles, 'flex flex-wrap gap-2 mb-4', 'tiles', ['no-scrollbar']);
  desktopClassesKept(tiles, 'bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-col gap-0.5 min-w-[104px] shadow-card', 'tile');
  desktopClassesKept(tiles, 'text-[22px] leading-7 font-bold tabular-nums', 'tile number');
  desktopClassesKept(tiles, 'text-[12px] text-slate-600 font-medium flex items-center gap-1.5 whitespace-nowrap', 'tile label');
  // Same nine counts, same order, each with its tip.
  const labels = [...tiles.matchAll(/<SummaryTile\s+label="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(labels, ['Scheduled', 'Working', 'Away', 'Not In Yet', 'On Leave', 'Off Today', 'No Records', 'Finished', 'Late Arrivals']);
  assert.equal((tiles.match(/\btip="/g) ?? []).length, 9, 'every count keeps its explanation');
  assert.match(tiles, /\{tip && <InfoTip text=\{tip\} \/>\}/);
});

test('MW10: the long header sentence is in the ⓘ on a phone and on the page on a computer', () => {
  const page = read(PAGE);
  const tip = /<InfoTip text=\{isPhone\s*\?\s*'([^']+)'\s*:\s*'([^']+)'\} \/>/.exec(page);
  assert.ok(tip, 'the ⓘ text depends on isPhone');
  assert.equal(tip[2], 'Teramind data syncs every 5 minutes. The time shown is the latest sync received.', 'the computer\'s ⓘ text is the old one');
  assert.match(tip[1], /every 5 minutes/);
  assert.match(tip[1], /US Eastern/);
  assert.match(page, /\{isPhone \? <>Data as of \{dataAsOf\}<\/> : <>Data as of \{dataAsOf\} · updates every 5 minutes · times in US Eastern<\/>\}/);
  // Loading: placeholders on a phone, the old line on a computer.
  assert.match(page, /\{loading && rows\.length === 0 && isPhone && <TodayRowsLoading \/>\}/);
  assert.match(page, /\{loading && rows\.length === 0 && !isPhone && \(/);
  assert.match(page, /Loading attendance data…/);
  // The error boxes are still there, unconditioned.
  assert.match(page, /\{punchError && rows\.length > 0 && \(/);
  assert.match(page, /\{punchError && rows\.length === 0 && \(/);
});

test('MW11: src/DESIGN.md gains the Phone section at the end and loses nothing', () => {
  const md = read(DESIGN);
  assert.equal(sha(md.slice(0, DESIGN_BASE_CHARS)), DESIGN_BASE_SHA256, 'the existing part of src/DESIGN.md changed: the edit may only append');
  const tail = md.slice(DESIGN_BASE_CHARS);
  assert.match(tail, /^\n## Phone\n/, 'one blank line, then the Phone section');
  assert.equal((md.match(/^## Phone$/gm) ?? []).length, 1);
  assert.equal((tail.match(/^## /gm) ?? []).length, 1, 'nothing else is added');
  assert.doesNotMatch(tail, /Stage 1|superpowers\/specs/, 'no status line and no path into docs/');
  for (const rule of ['**Rows, not cards (`MobileRow`).**', '**Touch.**', '**Type on a phone.**', '**Sheets (`MobileSheet`).**', '**States.**', 'Nothing below 12 px']) {
    assert.ok(tail.includes(rule), `Phone section is missing: ${rule}`);
  }
});

test('MW12: house rules for the new files, and every file under 15 KB', () => {
  for (const f of [ROW, LIB, ROWS, PAGE, TILES, DESIGN]) {
    const size = Buffer.byteLength(read(f), 'utf8');
    assert.ok(size < 15000, `${f} is ${size} bytes`);
  }
  for (const f of [ROW, ROWS, PAGE, TILES]) {
    const src = read(f);
    assert.doesNotMatch(src, /(?<![\w-])(max|min)-(sm|md|lg|xl|2xl|phone|\[)[^\s"'`:]*:/, `${f}: max-*: and min-*: variants do not work in this app`);
    assert.doesNotMatch(src, /window\.location\.reload|history\.(pushState|replaceState)/, f);
  }
  const rows = read(ROWS);
  assert.doesNotMatch(rows, /(?<![\w-])(sm|md|lg):/, 'TodayRows.tsx: no breakpoint classes; the page already chose');
  assert.doesNotMatch(rows, /text-\[(\d|1[01])px\]|opacity-/, 'nothing under 12 px, nothing see-through');
});
