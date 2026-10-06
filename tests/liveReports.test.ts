// Attendance Reports live days + Warm look (prompt 3 of 2026-10-06 live attendance).
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

test('LR2: liveWindow waits for periods, uses Eastern today; applyLiveDays runs after the report', () => {
  const src = read(REPORT);
  assert.match(src, /const tmToday\s+= easternDate\(Date\.now\(\)\);/);
  assert.match(src, /loadingPeriods \? null\s*: liveWindow\(\(rawPeriods as ReportPeriod\[\]\) \?\? \[\], safeFrom, safeTo, tmToday\)/);
  const build = src.indexOf('buildAttendanceReport({');
  const apply = src.indexOf('applyLiveDays({');
  assert.ok(build > 0 && apply > build, 'applyLiveDays decorates the built report');
  assert.match(src, /helpers: \{ parseTimeToMinutes, whyFor \}/);
  // A Teramind error shows official days only, and so does the moment before THIS window's
  // Teramind rows have arrived (no flash of "No records yet").
  assert.match(src, /if \(!win \|\| errTm \|\| tmFor !== winKey\) return officialRows;/);
  assert.match(src, /else if \(tmWasLoading\.current\) \{ tmWasLoading\.current = false; setTmFor\(winKey\); \}/);
});

test('LR3: KPIs unchanged from before live days; live line from liveSummary when there are live days', () => {
  const src = read(REPORT);
  // Live rows keep their verdict: not_processed is never counted, PTO / permission / holiday
  // still are (as before) — so the KPIs take all rows, not a live-filtered list (Saul's call).
  assert.match(src, /const kpis = useMemo\(\(\) => reportRowsToKpis\(rows\), \[rows\]\);/);
  const table = read(`${A}AttendanceReportTable.tsx`);
  assert.match(table, /absent_reported_on_time: 'bg-blue-50 text-blue-700'/, 'reported ahead stays blue');
  assert.match(table, /absent_reported_late:    'bg-orange-100 text-orange-800'/, 'reported after shift stays orange');
  assert.match(src, /const live = useMemo\(\(\) => liveSummary\(rows\), \[rows\]\);/);
  assert.match(src, /\{live\.days > 0 && \(/);
  assert.match(src, /Live, not yet processed: \{live\.days\} day\{live\.days === 1 \? '' : 's'\}/);
  assert.match(src, /\{live\.late\} late\{' · '\}\{live\.noRecords\} no records yet/);
});

test('LR4: table and cards show the Live tag and the live label for r.live', () => {
  const table = read(`${A}AttendanceReportTable.tsx`);
  assert.match(table, /\{r\.live \? \(/);
  assert.match(table, /<LiveBadge \/>\s*<span className=\{`text-\[11px\] font-semibold \$\{liveLabelCls\(r\.live\)\}`\}>\{r\.live\.label\}<\/span>/);
  assert.match(table, /r\.live\.kind === 'worked' && r\.live\.why && <WhyChipBadge chip=\{r\.live\.why\} \/>/);
  const strips = read(`${A}AttendanceReportStrips.tsx`);
  assert.match(strips, /const frame = live \? 'border-dashed border-slate-400' : 'border-slate-200';/);
  assert.match(strips, /\{live \? live\.label : CARD_LABEL\[row\.verdict\]\}/);
  const badge = read(`${A}LiveBadge.tsx`);
  assert.match(badge, /export default function LiveBadge/);
  assert.match(badge, /\$\{exit\} so far/);
  assert.match(badge, /\$\{exit\} \+1d/);
});

test('LR5: Reports use the Warm look and stay under 15 KB', () => {
  for (const f of ['AttendanceReport.tsx', 'AttendanceReportTable.tsx', 'AttendanceReportStrips.tsx', 'LiveBadge.tsx']) {
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
  assert.match(read(`${A}LiveBadge.tsx`), /\(m < 60 \? `\$\{m\} min` : fmtDuration\(m\)\)/);
});
