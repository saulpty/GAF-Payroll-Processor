// 2026-10-13 — phone view M13: Attendance → Activity as rows
// (prompt 2026-10-13-mobile-rows/15-activity-rows.md). Source guards.
// Lives in tests/ once the prompt is sent; it fails until the export lands.
//
// MA1 is the "a computer is untouched" proof: take the prompt's edits back out of each edited file
// and it must be, byte for byte, what it was on 2026-10-13. A moved line, a re-indented table or a
// touched scroll listener fails it. If one of these files is changed on purpose before this prompt
// is sent, re-pin its hash (and re-check the prompt's anchors) first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

const DIR = 'src/app/pages/attendance/activity/';
const ROWS = DIR + 'ActivityRows.tsx';
const BY_EMP = DIR + 'ActivityByEmployee.tsx';
const BY_DAY = DIR + 'ActivityByDay.tsx';
const LOOK = DIR + 'ActivityNeedsLook.tsx';
const PAGE = DIR + 'AttendanceActivity.tsx';
const THRESHOLDS = DIR + 'ActivityThresholds.tsx';

const HOOK_IMPORT = "import { useIsPhone } from '@/app/lib/useIsPhone';\n";
const HOOK_LINE = '  const isPhone = useIsPhone();\n';

// Each file: sha256 as it was on 2026-10-13 (LF), and the prompt's edits as [now, before].
const EDITS: Record<string, { before: string; undo: Array<[string, string]> }> = {
  [BY_EMP]: {
    before: '4a2620cc9c16ef26b5ef12e9160c96fb3e507dd818364a71cc55d205fc7eddaa',
    undo: [
      [HOOK_IMPORT, ''],
      ["import { EmployeeRows } from './ActivityRows';\n", ''],
      [HOOK_LINE, ''],
      ['{isPhone ? <EmployeeRows list={sorted} trends={p.trends} openId={effectiveExpandedId} onClosePicked={handleToggle} /> : <DataTable\n', '<DataTable\n'],
      ['</DataTable>}', '</DataTable>'],
    ],
  },
  [BY_DAY]: {
    before: 'ce2cbb8953d6da0d82e23811cd49bbe05cf848c42d8827cc6cfed9d84831d896',
    undo: [
      [HOOK_IMPORT, ''],
      ["import { DayRows } from './ActivityRows';\n", ''],
      [HOOK_LINE, ''],
      ['{isPhone ? <DayRows days={sorted} /> : <DataTable\n', '<DataTable\n'],
      ['</DataTable>}', '</DataTable>'],
    ],
  },
  [LOOK]: {
    before: 'ddff12df064b97c222f03d4fc8cef22f23b0238b53038b6df6c59ce4fe95ab69',
    undo: [
      [HOOK_IMPORT, ''],
      ["import { LookRows } from './ActivityRows';\n", ''],
      [HOOK_LINE, ''],
      ['      ) : isPhone ? (\n        <LookRows rows={windowRows} settings={settings} onPick={onPick} />\n', ''],
    ],
  },
  [PAGE]: {
    before: 'aaba73c0606633ea69e8691d5555ab47080f35905adb9e5e9484dc806c3f0742',
    undo: [
      [HOOK_IMPORT, ''],
      ["import { RowsLoading } from './ActivityRows';\n", ''],
      [HOOK_LINE, ''],
      ['        {loading && isPhone && <RowsLoading />}\n        {loading && !isPhone && (\n', '        {loading && (\n'],
      [' no-scrollbar', ''],
      // 2026-10-16 punctuality 04 (the range is kept across tabs), taken back out too.
      ['  const { dateFrom, dateTo, setAttendanceMode, setDateFrom, setDateTo } = useGlobalFilters();\n',
        '  const { dateFrom, dateTo, attendanceMode, setAttendanceMode, setDateFrom, setDateTo } = useGlobalFilters();\n'],
      ['  // On first mount, only when no range is chosen yet: Dates mode with the last 14 days.\n  // A range picked on another Attendance tab is kept (Saul, 2026-10-16).\n',
        '  // On first mount: ensure we are in Dates mode with last 14 days\n'],
      ['    if (!dateFrom || !dateTo) {\n', "    if (attendanceMode !== 'dates' || !dateFrom || !dateTo) {\n"],
    ],
  },
};

/** Takes the prompt's edits back out: the listed pieces, then every added `phone:` class. */
function undone(path: string): string {
  let src = read(path);
  for (const [now, before] of EDITS[path].undo) {
    assert.equal(count(src, now), 1, `${path}: expected exactly one ${JSON.stringify(now.trim().slice(0, 60))}`);
    src = src.replace(now, () => before);
  }
  return src.replace(/ phone:[^\s"'`]+/g, '');
}

test('MA1: on a computer nothing moved — without the prompt\'s edits each file is exactly what it was', () => {
  for (const [path, { before }] of Object.entries(EDITS)) {
    assert.equal(sha(undone(path)), before, `${path}: something other than the prompt's edits changed`);
  }
  // The frozen open row (scroll listener) and the table rows are the computer branch, still there.
  const be = read(BY_EMP);
  assert.match(be, /scroller\.addEventListener\('scroll', place, \{ passive: true \}\);/);
  assert.match(be, /: <DataTable\n\s+columns=\{columns\(tip, lowTip\)\}/);
  assert.match(be, /<EmployeeRow\n\s+key=\{emp\.employeeId\}/);
  assert.match(read(BY_DAY), /: <DataTable\n\s+columns=\{COLUMNS\}/);
  assert.match(read(LOOK), /\) : \(\n\s+<div className="overflow-x-auto">\n\s+<table className="w-full">/);
});

test('MA2: each list is switched in one place, and the hook sits above every early return', () => {
  const be = read(BY_EMP), bd = read(BY_DAY), nl = read(LOOK);
  for (const [name, src] of [['By Employee', be], ['By Day', bd], ['Needs a Look', nl]] as const) {
    assert.equal(count(src, 'useIsPhone()'), 1, `${name}: the hook is read once`);
    assert.equal(count(src, 'isPhone ?'), 1, `${name}: rows or table is decided in exactly one place`);
  }
  assert.ok(be.indexOf('useIsPhone()') < be.indexOf('if (byEmployee.length === 0) {'));
  assert.ok(bd.indexOf('useIsPhone()') < bd.indexOf('if (days.length === 0) {'));
  assert.ok(nl.indexOf('useIsPhone()') < nl.indexOf('useMemo('));
  assert.ok(nl.indexOf('useIsPhone()') < nl.indexOf('if (totalFlagged === 0) return null;'));
  // The page passes the lists nothing new: the three elements other tests pin are unchanged.
  const page = read(PAGE);
  assert.match(page, /<ActivityByDay days=\{days\} dateFrom=\{safeFrom\} dateTo=\{safeTo\} \/>/);
  assert.doesNotMatch(page, /<Activity(ByEmployee|ByDay|NeedsLook|Thresholds)\b[^>]*\b(phone|isPhone)\b/);
  // Loading on a phone is placeholder rows; on a computer the line it always was.
  assert.match(page, /\{loading && isPhone && <RowsLoading \/>\}\n\s+\{loading && !isPhone && \(/);
});

test('MA3: the phone lists are handed the table\'s own sorted list — there is no second sort', () => {
  const be = read(BY_EMP), bd = read(BY_DAY), nl = read(LOOK), rows = read(ROWS);
  // One sorted list per table, made once, feeding both branches.
  assert.equal(count(be, 'sortEmployees('), 2, 'sortEmployees: its definition and one call');
  assert.match(be, /const sorted = sortEmployees\(byEmployee, sortKey, sortDir, p\.trends\);/);
  assert.match(be, /<EmployeeRows list=\{sorted\} /);
  assert.match(be, /\{sorted\.map\(emp => \{/);
  assert.equal(count(bd, 'sortDays('), 2, 'sortDays: its definition and one call');
  assert.match(bd, /<DayRows days=\{sorted\} \/>/);
  assert.match(bd, /\{sorted\.map\(d => \{/);
  // Needs a Look: the worst ten are chosen once, by the box.
  assert.equal(count(nl, '.slice(0, 10)'), 1);
  assert.match(nl, /<LookRows rows=\{windowRows\} settings=\{settings\} onPick=\{onPick\} \/>/);
  assert.match(nl, /\{windowRows\.map\(d => \{/);
  // The rows file orders, filters and loads nothing.
  assert.doesNotMatch(rows, /\.sort\(|\.filter\(|localeCompare|sortEmployees|sortDays|VERDICT_ORDER|\.slice\(/);
  assert.doesNotMatch(rows, /useLoadAction|@\/actions\/|useActivityData|useEffect|useMemo/);
  assert.match(rows, /\{list\.map\(emp => \{/);
  assert.match(rows, /\{days\.map\(d => \(/);
  assert.match(rows, /\{rows\.map\(d => \{/);
});

test('MA4: a phone row shows the figures the table row shows (the comparison\'s own days)', () => {
  const be = read(BY_EMP), rows = read(ROWS);
  assert.match(rows, /const trend = trends\[emp\.employeeId\];\n\s+if \(!trend\) return null;/, 'no trend, no row — as in the table');
  assert.match(rows, /const a = trend\.after;/);
  // The same pairs, written the same way, in the table row and in the phone row.
  for (const pair of [
    /<OutOf n=\{a\.lowDays\} of=\{a\.worked\} \/>/,
    /<OutOf n=\{a\.missedDays\} of=\{a\.scheduled\} \/>/,
    /<ChangeArrow measure="active" change=\{trend\.active\} \/>/,
    /<ChangeArrow measure="low" change=\{trend\.low\} \/>/,
    /<ChangeArrow measure="missed" change=\{trend\.missed\} \/>/,
    /<TrendPill verdict=\{trend\.verdict\} \/>/,
  ]) {
    assert.match(be, pair, `table row lost ${pair}`);
    assert.match(rows, pair, `phone row does not show ${pair}`);
  }
  assert.match(rows, /a\.avgActiveMin !== null \? fmtDuration\(a\.avgActiveMin\) : '—'/);
  // Never the all-days averages on the employee summary (the table stopped using them on 2026-10-13).
  assert.doesNotMatch(rows, /emp\.(avg(Active|First|Last)Min|daysWorked|scheduledDays|needsLook)\b/);
  // Trend pill, arrows and reason chips are the table's own components, imported, not redrawn.
  assert.match(rows, /import \{ TrendPill, ChangeArrow \} from '\.\/TrendPill';/);
  assert.match(rows, /import WhyChipBadge from '\.\/WhyChipBadge';/);
  assert.doesNotMatch(rows, /VERDICT_LABEL|changeText\(/);
  // By Day and Needs a Look: the same fields and the same shared helpers as their tables.
  const bd = read(BY_DAY), nl = read(LOOK);
  for (const piece of [
    "d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'",
    "fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')",
    "{d.records <= 1 ? '—' : fmtDuration(d.breaksMin)}",
    "d.flag === 'long_break'",
  ]) {
    assert.ok(bd.includes(piece), `By Day table lost ${piece}`);
    assert.ok(rows.includes(piece), `By Day rows do not show ${piece}`);
  }
  assert.match(rows, /tone=\{d\.needsLook \? 'yellow' : 'none'\}/, 'a day that needs a look is washed, as in the table');
  for (const piece of ["{d.records === 0 ? 'No records' : fmtDuration(d.activeMin)}", "shortBy > 0 ? fmtDuration(shortBy) : '—'"]) {
    assert.ok(nl.includes(piece), `Needs a Look table lost ${piece}`);
    assert.ok(rows.includes(piece), `Needs a Look rows do not show ${piece}`);
  }
  assert.match(rows, /Math\.max\(0, thresholdFor\(d\.shiftMinutes, settings\) - d\.activeMin\)/);
});

test('MA5: a tap opens the employee panel with the arguments the table\'s name button uses', () => {
  const props = (src: string) => {
    const m = /<AttendancePanel\n([\s\S]*?)\/>/.exec(src);
    assert.ok(m, 'no <AttendancePanel … /> block');
    return [...m[1].matchAll(/^\s+(\w+)=\{([^}]*)\}/gm)].map(x => [x[1], x[2]] as const);
  };
  const table = props(read(BY_EMP)), phone = props(read(ROWS));
  assert.deepEqual(phone.map(p => p[0]), table.map(p => p[0]), 'same properties, same order');
  assert.deepEqual(phone.map(p => p[0]), ['stats', 'employeeId', 'days', 'displayName', 'displayRole', 'displayManager', 'onClose']);
  for (let i = 0; i < 6; i++) assert.equal(phone[i][1], table[i][1], `${phone[i][0]} is passed the same value`);
  const rows = read(ROWS);
  assert.match(rows, /onClick=\{\(\) => setTapped\(emp\)\}/);
  // Needs a Look on a phone: the same call as the table row; the picked employee's panel opens,
  // and closing it clears the pick so the same row can be tapped again.
  assert.match(rows, /onClick=\{onPick \? \(\) => onPick\(d\.employeeId\) : undefined\}/);
  assert.match(rows, /const picked = openId == null \? null : list\.find\(e => e\.employeeId === openId\) \?\? null;/);
  assert.match(rows, /if \(picked\) onClosePicked\?\.\(picked\.employeeId\);/);
  assert.match(read(BY_EMP), /openId=\{effectiveExpandedId\} onClosePicked=\{handleToggle\}/);
  // By Day opens nothing, as in the table.
  const dayRows = rows.slice(rows.indexOf('export function DayRows'), rows.indexOf('type LookRowsProps'));
  assert.doesNotMatch(dayRows, /onClick|chevron/);
});

test('MA6: nothing the phone cannot show is rendered there; no forbidden pieces', () => {
  const rows = read(ROWS);
  assert.doesNotMatch(rows, /ActivityCompare|ActivityDayChart|ActivityDaysSideBySide|DataTable|<table|<tr|<td/);
  assert.match(rows, /import MobileRow from '@\/app\/components\/mobile\/MobileRow';/);
  assert.doesNotMatch(rows, /new Date\s*\(|toISOString|window\.location|pushState|replaceState|uppercase/);
  // A row with onClick is a <button>: nothing passed into it may be a button or a link.
  assert.doesNotMatch(rows, /<button|<a\s/);
  for (const f of [ROWS, BY_EMP, BY_DAY, LOOK, PAGE, THRESHOLDS]) {
    const src = read(f);
    assert.doesNotMatch(src, /(^|[\s"'`])(max|min)-(sm|md|lg|xl|2xl|phone|\[[^\]\s]*\]):/, `${f}: max-*: / min-*: variants do not work in this app`);
  }
  assert.doesNotMatch(rows, /(^|[\s"'`])(sm|md|lg|xl):/, 'the phone switch is the hook or phone:, never sm:/md:');
});

test('MA7: every new or edited file stays under 15,000 bytes', () => {
  for (const f of [ROWS, BY_EMP, BY_DAY, LOOK, PAGE, THRESHOLDS]) {
    const size = Buffer.byteLength(readFileSync(new URL(`../${f}`, import.meta.url)));
    assert.ok(size < 15000, `${f} is ${size} bytes`);
  }
  // The one closest to the limit, by name: 13,675 before, five small edits after.
  const be = Buffer.byteLength(readFileSync(new URL(`../${BY_EMP}`, import.meta.url)));
  assert.ok(be < 14200, `ActivityByEmployee.tsx is ${be} bytes: the edit was meant to add about 250`);
});
