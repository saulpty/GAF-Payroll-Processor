// Compact date range (nav option A) + Attendance → Today Warm restyle (Saul, 2026-10-06).
// Prompts: docs/superpowers/prompts/2026-10-06-pto-columns/08, 09.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const A = 'src/app/pages/attendance/';

test('WR1: the five quick ranges are one Quick dropdown with the same handlers', () => {
  const r = read('src/app/components/AttendanceRangeControls.tsx');
  assert.doesNotMatch(r, /QuickPickButton/);
  assert.match(r, /<span className=\{IN_LABEL\}>Quick<\/span>/);
  assert.match(r, /quickPicks\.find\(q => q\.label === e\.target\.value\)\?\.handler\?\.\(\)/);
  for (const label of ['Today', 'This Week', 'Last 14 Days', 'Last 30 Days', 'Last 90 Days']) {
    assert.match(r, new RegExp(`label: '${label}'`), `quick range ${label} must survive`);
  }
});

test('WA1: Today page is back under 15 KB with its table in its own file', () => {
  const page = read(`${A}AttendanceToday.tsx`);
  assert.ok(Buffer.byteLength(page) < 15000, 'AttendanceToday.tsx must stay under 15 KB');
  assert.doesNotMatch(page, /function TodayTable\(/);
  assert.match(page, /import TodayTable from '\.\/TodayTable';/);
  const table = read(`${A}TodayTable.tsx`);
  assert.match(table, /export default function TodayTable\(/);
  assert.doesNotMatch(table, /uppercase/, 'Title Case headers, never ALL CAPS');
  assert.doesNotMatch(read(`${A}TodayTiles.tsx`), /uppercase/);
  assert.match(page, /Data as of \{dataAsOf\} · updates every 15 minutes · times in US Eastern/);
});

test('WA2: statuses use the Excel colours; times use the house format', () => {
  const row = read(`${A}TodayRow.tsx`);
  assert.match(row, /working:\s+\{ label: 'Working',\s+cls: 'bg-status-green-fill text-status-green-ink/);
  assert.match(row, /away:\s+\{ label: 'Away',\s+cls: 'bg-status-yellow-fill text-status-yellow-ink/);
  assert.match(row, /late_not_in: \{ label: 'No Records',\s+cls: 'bg-status-red-fill text-status-red-ink/);
  assert.match(row, /const clock = \(min: number\) => fmtTime\(fmtClock\(min\)\);/);
  assert.match(row, /const lateBy = \(m: number\) => \(m < 60 \? `\+\$\{m\} min` : `\+\$\{fmtDuration\(m\)\}`\);/);
  assert.doesNotMatch(row, /\+\{row\.minutesLate\}m/, 'never +167m');
});

test('WR2: filter dropdowns are capped so Activity fits one row on a wide screen', () => {
  const fb = read('src/app/FilterBar.tsx');
  assert.match(fb, /const bareSel  = 'h-full max-w-\[130px\]/);
  assert.match(fb, /className=\{inputCls \+ ' w-40'\}/);
});

test('WT1: page titles that repeat the navigation are screen-reader only', () => {
  const ph = read('src/app/components/PageHeader.tsx');
  assert.match(ph, /<h1 className="sr-only">\{title\}<\/h1>/);
  assert.match(ph, /\{subtitle && <p className="text-\[13px\] text-slate-500">\{subtitle\}<\/p>\}/);
  assert.match(read('src/app/pages/admin/AdminEmployeesHub.tsx'), /<h1 className="sr-only">Employees<\/h1>/);
  assert.match(read('src/app/pages/admin/AdminAccessHub.tsx'), /<h1 className="sr-only">Access<\/h1>/);
});
