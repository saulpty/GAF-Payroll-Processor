// 2026-10-16 — the employee panel (prompt 2026-10-16-punctuality/02-employee-panel-trim-and-live-days.md).
// EXPECTED TO FAIL until that prompt is sent to UIB and exported: every EP test below reads src/ as
// it will be after the prompt. Source guards only:
//   - no ring charts: AttendanceDonuts.tsx is gone and nothing renders or imports it;
//   - no Status column in Day by Day (computer table) and no status word on the phone rows;
//   - useEmployeeStats (the panel's own numbers when opened from Today / Activity) adds the
//     days payroll has not processed yet, the same way Attendance.tsx does, so the panel shows
//     the same numbers wherever it is opened.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const exists = (p: string) => existsSync(join(root, p));

const A = 'src/app/pages/attendance/';
const PANEL = `${A}AttendancePanel.tsx`;
const BODY = `${A}AttendancePanelBody.tsx`;
const DAYS = `${A}AttendancePanelDays.tsx`;
const DAY_ROWS = `${A}AttendancePanelDayRows.tsx`;
const DONUTS = `${A}AttendanceDonuts.tsx`;
const HOOK = `${A}useEmployeeStats.ts`;

/** Every .ts / .tsx file under src/app. */
function appFiles(dir = 'src/app'): string[] {
  const out: string[] = [];
  for (const f of readdirSync(join(root, dir))) {
    const p = `${dir}/${f}`;
    if (statSync(join(root, p)).isDirectory()) out.push(...appFiles(p));
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

test('EP1: the two ring charts are gone: AttendanceDonuts.tsx deleted, imported and rendered nowhere', () => {
  assert.equal(exists(DONUTS), false, 'AttendanceDonuts.tsx is deleted');
  for (const f of appFiles()) {
    assert.doesNotMatch(read(f), /AttendanceDonuts/, `${f} still mentions AttendanceDonuts`);
  }
  const body = read(BODY);
  assert.doesNotMatch(body, /Donut|PieChart|<Pie\b|Arrival Breakdown|Reporting Breakdown/, 'no ring chart in the panel body');
  // What stays: the seven small numbers and the Arrival Trend chart.
  assert.deepEqual(
    [...body.matchAll(/<MiniKpi label="([^"]+)"/g)].map(m => m[1]),
    ['Expected', 'On Time', 'Reported', 'Unreported', 'Absent', 'Avg Min (worked)', '% On-Time'],
  );
  assert.match(body, /Arrival Trend \(Day-by-Day\)/);
  assert.match(body, /<ComposedChart data=\{scatterPoints\}/);
  assert.match(body, /computeArrivalScatter\(stats\.rows\)/);
  assert.match(body, /^\s*if \(isPhone\) return <PanelNumbers stats=\{stats\} \/>;$/m, 'a phone still gets only the seven numbers');
  assert.doesNotMatch(read(PANEL), /Donuts/, 'no stale "Donuts" comment in the panel');
});

test('EP2: Day by Day on a computer has no Status column; Late and Why stay', () => {
  const src = read(DAYS);
  assert.deepEqual(
    [...src.matchAll(/<th className=\{TH\}>([^<]+)<\/th>/g)].map(m => m[1]),
    ['Date', 'Entry', 'Exit', 'Active', 'Late', 'Why', 'Source'],
  );
  assert.doesNotMatch(src, /STATUS_COLORS|att\.status|\{att\.status\}/, 'the status word is not shown');
  assert.match(src, /att && att\.minutes_late > 0/, 'the Late cell is still there');
  assert.match(src, /<WhyChipBadge chip=\{d\.why\} \/>/, 'the Why tag is still there');
  assert.equal((src.match(/<td className=/g) ?? []).length, 7, 'seven cells per row, matching the seven headers');
});

test('EP3: Day by Day on a phone shows no status word; times, late minutes and Why stay', () => {
  const rows = read(DAY_ROWS);
  assert.doesNotMatch(rows, /STATUS_COLORS|att\.status|\bright=\{/, 'nothing pinned right, no status word');
  for (const fact of ['fmtClock(d.shownFirstMin)', 'fmtMins(att.minutes_late)', '<WhyChipBadge chip={d.why} />', 'fmtDuration(d.activeMin)', 'Needs a Look', 'Long Break']) {
    assert.ok(rows.includes(fact), `phone row lost: ${fact}`);
  }
});

test('EP4: STATUS_COLORS left with the Status column (nothing in the app imports it)', () => {
  assert.doesNotMatch(read(BODY), /STATUS_COLORS/);
  for (const f of appFiles()) {
    assert.doesNotMatch(read(f), /import\s*\{[^}]*STATUS_COLORS[^}]*\}\s*from/, `${f} imports STATUS_COLORS`);
  }
});

test('EP5: useEmployeeStats adds the not-yet-processed days, as Attendance.tsx does', () => {
  const src = read(HOOK);
  assert.match(src, /import \{ useLiveListRows \} from '\.\/useLiveListRows';/);
  assert.match(src, /import \{ AttendanceRow, EmpInfo, computeEmployeeStats, rowsInRange \} from '@\/app\/lib\/attendanceStats';/);
  // Payroll rows kept inside the range asked for (same as the List).
  assert.match(src, /rowsInRange\(\(rawRows as AttendanceRow\[\]\) \?\? \[\], dateFrom, dateTo\)/);
  // useLiveListRows gets the same five arguments the List gives it.
  const call = /const live = useLiveListRows\(\{([\s\S]*?)\}\);/.exec(src);
  assert.ok(call, 'useLiveListRows is called once, its result named live');
  for (const arg of ['dateFrom', 'dateTo', 'viewAs', 'employees:', 'official: rows']) {
    assert.ok(call[1].includes(arg), `useLiveListRows is missing ${arg}`);
  }
  assert.equal((src.match(/useLiveListRows\(/g) ?? []).length, 1);
  // Its rows are appended before the numbers are counted, and the numbers wait for them.
  assert.match(src, /\[\.\.\.rows, \.\.\.live\.rows\]/);
  assert.match(src, /computeEmployeeStats\(allRows, empMap, matchEmails\)/);
  assert.match(src, /if \(live\.loading\) return null;/);
  assert.match(src, /const loading = loadingEmps \|\| loadingRows \|\| live\.loading;/);
  // Both loaders unchanged: flat params, viewer-scoped.
  assert.match(src, /loadAttendanceEmployeesAction,\s*\[\] as EmpInfo\[\],\s*\{ viewAs \},/);
  assert.match(src, /loadAttendanceDailyAction,\s*\[\] as AttendanceRow\[\],\s*\{ dateFrom, dateTo, email: resolvedEmail, viewAs \},/);
  assert.doesNotMatch(src, /params:\s*\{/, 'useLoadAction params go flat');
  assert.doesNotMatch(src, /new Date\(/, 'no date math on strings');
  // Hooks are never conditional: every hook call sits before the stats memo, none inside an if.
  const statsAt = src.indexOf('const stats = useMemo');
  for (const h of ['useViewer()', 'useLoadAction(', 'useLiveListRows(']) {
    const at = src.lastIndexOf(h);
    assert.ok(at > 0 && at < statsAt, `${h} is called before the stats are computed`);
  }
  assert.doesNotMatch(src.slice(0, statsAt), /^\s*if \(/m, 'no early return before the hooks');
  // The panel still uses the hook (Today / Activity open it without stats).
  assert.match(read(PANEL), /useEmployeeStats\(\{/);
});

test('EP6: the panel files stay under 15 KB', () => {
  for (const f of [PANEL, BODY, DAYS, DAY_ROWS, HOOK]) {
    const size = Buffer.byteLength(read(f), 'utf8');
    assert.ok(size < 15000, `${f} is ${size} bytes`);
  }
});
