// 2026-10-13 — phone view, rows 2 (prompt 2026-10-13-mobile-rows/09-panel-sheet.md):
// the employee panel as a sheet. Source guards: which branch renders what, and that a phone never
// reaches a chart. Lives in tests/ once the prompt is sent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const A = 'src/app/pages/attendance/';
const PANEL = `${A}AttendancePanel.tsx`;
const BODY = `${A}AttendancePanelBody.tsx`;
const DAYS = `${A}AttendancePanelDays.tsx`;
const DAY_ROWS = `${A}AttendancePanelDayRows.tsx`;
const KPIS = `${A}AttendancePanelKpis.tsx`;
const DONUTS = `${A}AttendanceDonuts.tsx`;
const OPENERS = [`${A}AttendanceToday.tsx`, 'src/app/pages/Attendance.tsx', `${A}activity/ActivityByEmployee.tsx`];

// AttendanceDonuts.tsx as it stood on 2026-10-13: the prompt does not edit it.
const DONUTS_SHA256 = 'e063a752291b43a1266dd25e18045d11d8c0e6d56b0fe49883ad803118d16568';

/** Source of the block that starts at `open` (which must end with `{` or `(`), up to its matching close. */
function block(src: string, open: string): string {
  const at = src.indexOf(open);
  assert.ok(at >= 0, `not found: ${open}`);
  const o = open[open.length - 1];
  const c = o === '{' ? '}' : ')';
  let depth = 1;
  let i = at + open.length;
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === o) depth++;
    else if (src[i] === c) depth--;
  }
  assert.equal(depth, 0, `unbalanced after: ${open}`);
  return src.slice(at, i);
}

/** `original` is still there, token for token and in order; anything added is `phone:…`. */
function desktopClassesKept(src: string, original: string, where: string) {
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const extra = '(?: phone:[^\\s"`]+)*';
  const re = new RegExp('(?<=["`])' + original.split(' ').map(esc).join(extra + ' ') + extra + '(?=["` ])');
  const m = re.exec(src);
  assert.ok(m, `${where}: the computer's classes must stay, with only phone: classes added`);
  return m[0];
}

/** Names imported from 'recharts' in `src`. */
function rechartsNames(src: string): string[] {
  const m = /import\s*\{([^}]+)\}\s*from 'recharts';/.exec(src);
  assert.ok(m, 'the recharts import is still there (the computer draws the charts)');
  return m[1].split(',').map(s => s.trim()).filter(Boolean);
}

test('MP1: on a phone the panel is a MobileSheet; the computer\'s panel is the old code', () => {
  const src = read(PANEL);
  assert.equal((src.match(/useIsPhone\(\)/g) ?? []).length, 1, 'one phone-or-not question for the whole panel');
  assert.match(src, /import MobileSheet from '@\/app\/components\/mobile\/MobileSheet';/);

  const early = src.indexOf('if (!stats && resolvedId === null) return null;');
  const phoneAt = src.indexOf('if (isPhone) {');
  const desktopAt = src.indexOf('  return (\n    <>\n      {/* Overlay */}');
  assert.ok(early > 0 && phoneAt > early, 'the phone branch comes after every hook and after the early return');
  assert.ok(desktopAt > phoneAt, 'the phone branch returns before the computer\'s panel is reached');
  for (const hook of ['useGlobalFilters()', 'useIsPhone()', 'useActivityData(', 'useEmployeeStats(']) {
    const at = src.indexOf(hook);
    assert.ok(at > 0 && at < early, `${hook} must be called before any return`);
  }

  const phone = block(src, 'if (isPhone) {');
  assert.match(phone, /<MobileSheet\s[^>]*\bsize="full"/, 'a full-height sheet');
  assert.match(phone, /<MobileSheet\s[^>]*\bopen\b/);
  assert.match(phone, /<MobileSheet\s[^>]*\bonClose=\{onClose\}/, 'closing the sheet closes the panel');
  assert.match(phone, /title=\{name \|\| '[^']+'\}/, 'the person\'s name is the title (never an empty title)');
  assert.match(phone, /subtitle=\{\[subtitle, dateRangeLine\]\.filter\(Boolean\)\.join\(' · '\)\}/, 'role, shift, manager and the date range');
  assert.doesNotMatch(phone, /\bfixed\b|z-\d|slideInRight|fadeIn/, 'no overlay and no fixed box of its own: the sheet is the only layer');

  // Order on a phone: four headline numbers, Day by Day, seven small numbers.
  const k = phone.indexOf('<AttendancePanelKpis');
  const d = phone.indexOf('<AttendancePanelDays');
  const b = phone.indexOf('<AttendancePanelBody');
  assert.ok(k > 0 && d > k && b > d, 'phone order: Kpis, Days, Body');
  assert.match(phone, /<AttendancePanelDays days=\{panelDays\} attendanceRows=\{stats\?\.rows \?\? \[\]\} isPhone \/>/);
  assert.match(phone, /\{stats && <AttendancePanelBody stats=\{stats\} isPhone \/>\}/);
  assert.match(phone, /\{activityError \? \(/, 'the activity error message shows on a phone too');

  // The computer's branch, exactly as it was.
  const desk = src.slice(desktopAt);
  const order = ['<AttendancePanelKpis days={panelDays} stats={stats} />', '{stats && <AttendancePanelBody stats={stats} />}', '<AttendancePanelDays days={panelDays} attendanceRows={stats?.rows ?? []} />'].map(s => desk.indexOf(s));
  assert.ok(order.every(i => i > 0) && order[0] < order[1] && order[1] < order[2], 'computer order: Kpis, Body, Days, none of them told it is a phone');
  assert.doesNotMatch(desk, /MobileSheet/);
  for (const piece of ['className="fixed inset-0 bg-black/30 z-40"', "animation: 'slideInRight 280ms cubic-bezier(0.22, 0.68, 0, 1.1) both',", '{name && <Initials name={name} />}', 'aria-label="Close employee panel"']) {
    assert.ok(desk.includes(piece), `the computer's panel lost: ${piece}`);
  }
});

test('MP2: on a phone the panel body returns before any chart can be rendered', () => {
  const src = read(BODY);
  const charts = [...rechartsNames(src), 'AttendanceDonuts'];
  const fn = src.slice(src.indexOf('export default function AttendancePanelBody('));
  assert.match(fn, /^export default function AttendancePanelBody\(\{ stats, isPhone = false \}: Props\) \{/);
  const exit = /^\s*if \(isPhone\) return (<[^;]+);$/m.exec(fn);
  assert.ok(exit, 'a phone leaves through one early return');
  const firstChart = Math.min(...charts.map(n => fn.indexOf(`<${n}`)).filter(i => i >= 0));
  assert.ok(Number.isFinite(firstChart), 'the computer still draws the charts');
  assert.ok(exit.index < firstChart, 'the phone\'s return comes before the first chart element');
  assert.ok(exit.index < fn.indexOf('computeArrivalScatter('), 'a phone does not even prepare the chart\'s points');
  assert.equal(exit[1], '<PanelNumbers stats={stats} />', 'a phone gets the seven numbers and nothing else');

  // What the phone renders (PanelNumbers, and MiniKpi inside it) holds no chart.
  for (const name of ['PanelNumbers', 'MiniKpi']) {
    const body = block(src, src.slice(src.indexOf(`function ${name}(`), src.indexOf('{\n', src.indexOf(`function ${name}(`)) + 1));
    for (const n of charts) assert.ok(!new RegExp(`<${n}\\b`).test(body), `${name} must not render <${n}>`);
  }
  // Same seven numbers, same order, for both.
  const numbers = block(src, 'function PanelNumbers({ stats }: { stats: EmpStats }) {');
  assert.deepEqual(
    [...numbers.matchAll(/<MiniKpi label="([^"]+)"/g)].map(m => m[1]),
    ['Expected', 'On Time', 'Reported', 'Unreported', 'Absent', 'Avg Min (worked)', '% On-Time'],
  );
  assert.equal((src.match(/<MiniKpi\s/g) ?? []).length, 7, 'the seven numbers are written once');
  assert.equal((fn.match(/<PanelNumbers stats=\{stats\} \/>/g) ?? []).length, 2, 'used by the phone return and by the computer layout');
  desktopClassesKept(src, 'grid grid-cols-3 sm:grid-cols-7 gap-2', 'seven numbers');
  // The computer layout still holds the chart and the donuts.
  assert.match(fn, /<ResponsiveContainer width="100%" height="100%">/);
  assert.match(fn, /<AttendanceDonuts stats=\{stats\} \/>/);
  assert.equal(sha(read(DONUTS)), DONUTS_SHA256, 'AttendanceDonuts.tsx is not edited: a phone simply never renders it');
});

test('MP3: Day by Day is rows on a phone and the same table on a computer', () => {
  const src = read(DAYS);
  assert.match(src, /export default function AttendancePanelDays\(\{ days, attendanceRows = \[\], isPhone = false \}: Props\) \{/);
  assert.match(
    src,
    /\) : isPhone \? \(\s*<AttendancePanelDayRows days=\{sorted\} attByDate=\{attByDate\} fmtMins=\{fmtMins\} \/>\s*\) : \(\s*<div className="bg-white border border-border rounded-lg shadow-card overflow-hidden">/,
    'rows OR the table, from the same sorted days and the same payroll rows',
  );
  assert.equal((src.match(/<table\b/g) ?? []).length, 1, 'the table is still there, once');
  assert.equal((src.match(/<th className=\{TH\}>/g) ?? []).length, 8, 'eight columns, as before');
  assert.doesNotMatch(src, /useIsPhone/, 'the panel decides; this file is told');

  const rows = read(DAY_ROWS);
  assert.doesNotMatch(rows, /<table|<tr|<td|useIsPhone|useState|useEffect|useLoadAction/, 'plain rows: no table, no state, no loader');
  assert.match(rows, /import MobileRow from '@\/app\/components\/mobile\/MobileRow';/);
  assert.match(rows, /days\.map\(d => \{/, 'the days arrive sorted; no second sort');
  assert.doesNotMatch(rows, /\.sort\(|\.filter\(|new Date\(/);
  assert.match(rows, /tone=\{d\.needsLook \? 'yellow' : 'none'\}/, 'a day that needs a look gets the yellow wash, as in the table');
  assert.match(rows, /attByDate\.get\(d\.date\)/, 'payroll status is looked up by the same YYYY-MM-DD key');
  assert.match(rows, /title=\{fmtDayShort\(d\.date\)\}/);
  // Reading only: a day row opens nothing.
  assert.doesNotMatch(rows, /onClick|chevron=/);
  // The table's facts are all there.
  // The table's facts are all there, written the way the table writes them.
  for (const fact of ['fmtClock(d.shownFirstMin)', "fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')", 'fmtMins(att.minutes_late)', 'fmtDuration(d.activeMin)', '<WhyChipBadge chip={d.why} />', 'Needs a Look', 'Long Break', 'STATUS_COLORS[att.status]', "d.flag === 'long_break'", 'att.minutes_late > 0']) {
    assert.ok(src.includes(fact), `the table no longer has: ${fact}`);
    assert.ok(rows.includes(fact), `day row is missing: ${fact}`);
  }
});

test('MP4: the three places that open the panel pass only props it still takes', () => {
  const panel = read(PANEL);
  const props = [...block(panel, 'type Props = {').matchAll(/^\s+([A-Za-z]+)\??:/gm)].map(m => m[1]);
  assert.deepEqual(props, ['stats', 'onClose', 'employeeId', 'days', 'displayName', 'displayRole', 'displayManager'], 'the panel\'s props are unchanged');
  for (const f of OPENERS) {
    const src = read(f);
    const at = src.indexOf('<AttendancePanel');
    assert.ok(at > 0, `${f} opens the panel`);
    const tag = src.slice(at, src.indexOf('/>', at));
    const used = [...tag.matchAll(/\s([A-Za-z]+)=\{/g)].map(m => m[1]);
    assert.ok(used.includes('onClose'), `${f}: the panel can be closed`);
    for (const p of used) assert.ok(props.includes(p), `${f} passes ${p}, which the panel does not take`);
    assert.doesNotMatch(src, /AttendancePanelDayRows|AttendancePanelBody/, `${f} reaches the panel only through AttendancePanel`);
  }
});

test('MP5: house rules for the panel files, and every file under 15 KB', () => {
  for (const f of [PANEL, BODY, DAYS, DAY_ROWS, KPIS, DONUTS]) {
    const src = read(f);
    const size = Buffer.byteLength(src, 'utf8');
    assert.ok(size < 15000, `${f} is ${size} bytes`);
    assert.doesNotMatch(src, /(?<![\w-])(max|min)-(sm|md|lg|xl|2xl|phone|\[)[^\s"'`:]*:/, `${f}: max-*: and min-*: variants do not work in this app`);
    assert.doesNotMatch(src, /window\.location\.reload|history\.(pushState|replaceState)/, f);
  }
  const rows = read(DAY_ROWS);
  assert.doesNotMatch(rows, /#[0-9a-fA-F]{3,8}\b/, 'tokens, not hex');
  assert.doesNotMatch(rows, /(?<![\w-])(sm|md|lg):/, 'no breakpoint classes: the panel already chose');
  assert.doesNotMatch(rows, /text-\[(\d|1[01])px\]|uppercase|opacity-/, 'nothing under 12 px, no ALL CAPS, nothing see-through');
  // The two tile rows keep their computer classes; only phone: classes were added.
  const kpis = read(KPIS);
  desktopClassesKept(kpis, 'flex flex-wrap gap-2', 'headline tiles');
  desktopClassesKept(kpis, 'text-[10px] font-semibold uppercase tracking-wide text-muted-foreground', 'headline tile label');
  desktopClassesKept(read(BODY), 'text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5', 'small number label');
  assert.deepEqual([...kpis.matchAll(/label="([^"]+)"/g)].map(m => m[1]), ['Avg Active', 'Avg Entry', 'On Time', 'Needs A Look']);
});
