// Attendance Reports: days payroll has not processed yet are counted (2026-10-07), no Live tag.
// Static source checks: the logic itself is unit-tested in liveAttendance.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const A = 'src/app/pages/attendance/';
const REPORT = `${A}AttendanceReport.tsx`;

test('LR1: one extra Teramind loader, flat params with viewAs, only for the live window', () => {
  const src = read(REPORT);
  assert.match(src, /import loadTeramindActivityDaysAction\s+from '@\/actions\/loadTeramindActivityDays';/);
  assert.match(src, /useLoadAction\(\s*loadTeramindActivityDaysAction, \[\] as ActivityDayRow\[\],\s*\{ dateFrom: win\?\.from \?\? NO_LIVE\.from, dateTo: win\?\.to \?\? NO_LIVE\.to, viewAs \},\s*\)/);
  assert.doesNotMatch(src, /\{\s*params:\s*\{/, 'params go flat, never wrapped');
  assert.match(src, /const NO_LIVE = \{ from: '9999-12-31', to: '1970-01-01' \};/, 'no window = a range that ends before it starts');
  assert.equal((src.match(/useLoadAction\(/g) ?? []).length, 8, 'seven official loaders + one Teramind loader');
});

test('LR2: liveWindow waits for periods, uses Eastern today; liveReport runs on the built report', () => {
  const src = read(REPORT);
  assert.match(src, /const tmToday\s+= easternDate\(Date\.now\(\)\);/);
  assert.match(src, /loadingPeriods \? null\s*: liveWindow\(\(rawPeriods as ReportPeriod\[\]\) \?\? \[\], safeFrom, safeTo, tmToday\)/);
  const build = src.indexOf('const main = buildAttendanceReport(input);');
  const live = src.indexOf('return liveReport({');
  assert.ok(build > 0 && live > build, 'liveReport takes the built report');
  assert.match(src, /if \(!win \|\| errTm\) return main;/, 'a Teramind error counts processed days only');
  assert.match(src, /tmRows: \(rawTm as ActivityDayRow\[\]\) \?\? \[\], build: buildAttendanceReport,/);
  // The page keeps loading until THIS window's Teramind rows have arrived: no flash of numbers
  // without the unprocessed days.
  assert.match(src, /\(win !== null && \(loadingTm \|\| \(!errTm && tmFor !== winKey\)\)\)/);
  assert.match(src, /else if \(tmWasLoading\.current\) \{ tmWasLoading\.current = false; setTmFor\(winKey\); \}/);
  assert.doesNotMatch(src, /applyLiveDays|liveSummary|whyFor/);
});

test('LR3: KPIs from every row; no live line', () => {
  const src = read(REPORT);
  assert.match(src, /const kpis = useMemo\(\(\) => reportRowsToKpis\(rows\), \[rows\]\);/);
  assert.doesNotMatch(src, /Live, not yet processed|no records yet|LiveBadge/);
  const table = read(`${A}AttendanceReportTable.tsx`);
  assert.match(table, /absent_reported_on_time: 'bg-blue-50 text-blue-700'/, 'reported ahead stays blue');
  assert.match(table, /absent_reported_late:    'bg-orange-100 text-orange-800'/, 'reported after shift stays orange');
});

test('LR4: table and cards show every day like a processed one — no Live tag, no dashed border', () => {
  for (const f of ['AttendanceReportTable.tsx', 'AttendanceReportStrips.tsx']) {
    const src = read(A + f);
    assert.doesNotMatch(src, /LiveBadge|LiveInfo|\b(r|row|rows)\.live\b|liveInOut|liveTone|border-dashed|Live ·|No Teramind records/, f);
  }
  const strips = read(`${A}AttendanceReportStrips.tsx`);
  assert.match(strips, /const t = TONE\[VERDICT_TONE\[row\.verdict\]\];/);
  assert.match(strips, /\{CARD_LABEL\[row\.verdict\]\}/);
  assert.match(strips, /bg-white border border-slate-200 border-t-\[3px\]/);
  const table = read(`${A}AttendanceReportTable.tsx`);
  assert.match(table, /\{VERDICT_LABEL\[r\.verdict\]\}/);
});

test('LR5: Reports use the Warm look and stay under 15 KB', () => {
  for (const f of ['AttendanceReport.tsx', 'AttendanceReportTable.tsx', 'AttendanceReportStrips.tsx']) {
    const src = read(A + f);
    assert.doesNotMatch(src, /uppercase/, `${f}: Title Case, never ALL CAPS`);
    assert.doesNotMatch(src, /#2AA876/i, `${f}: old Classic teal`);
    assert.doesNotMatch(src, /bg-(primary|warm|secondary)\/\d+/, `${f}: no opacity modifier on a CSS-variable colour`);
    assert.doesNotMatch(src, /rounded-xl/, `${f}: cards are rounded-lg`);
    assert.ok(Buffer.byteLength(src) < 15000, `${f} must stay under 15 KB`);
  }
  assert.match(read(REPORT), /on \? 'bg-warm text-warm-ink'/);
  const table = read(`${A}AttendanceReportTable.tsx`);
  assert.match(table, /on_time:\s+'bg-status-green-fill text-status-green-ink'/);
  assert.match(table, /late_no_form:\s+'bg-status-yellow-fill text-status-yellow-ink'/);
  assert.match(table, /unexplained_absence:\s+'bg-status-red-fill text-status-red-ink'/);
  assert.match(table, /import \{ fmtTime \} from '@\/app\/lib\/fmtTime';/);
  assert.match(table, /fmtDay\(r\.date, thisYear\)/);
  assert.doesNotMatch(table, /toLocaleDateString|new Date\(/, 'dates via fmtDay, no Date objects');
  for (const f of ['AttendanceReportTable.tsx', 'AttendanceReportStrips.tsx']) {
    assert.match(read(A + f), /const fmtMins = \(m: number\): string => \(m < 60 \? `\$\{m\} min` : fmtDuration\(m\)\);/, f);
  }
});
