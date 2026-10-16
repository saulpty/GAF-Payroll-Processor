// 2026-10-16 — Attendance → List cleanup: a punctuality scorecard that says each fact once
// (prompts 2026-10-16-punctuality/03a cards, 03b phone rows, 03c table).
//
// EXPECTED TO FAIL until all three prompts are exported from UIB and synced (03a → LC1, LC2;
// 03b → LC5, LC6; 03c → LC3, LC4). LC7–LC9 pass before and after: they pin that the cleanup is
// presentation only, i.e. no calculation and no number's meaning changes.
//
// If attendanceStats.ts or reportKpis.ts is changed ON PURPOSE by a later prompt, re-pin LC8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const url = (p: string) => new URL(`../${p}`, import.meta.url);
const read = (p: string) => readFileSync(url(p), 'utf8').replace(/\r\n/g, '\n');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

const A = 'src/app/pages/attendance/';
const PAGE = 'src/app/pages/Attendance.tsx';
const KPIS = `${A}AttendanceKpis.tsx`;
const TABLE = `${A}AttendanceTable.tsx`;
const ROWS = `${A}AttendanceListRows.tsx`;
const SORT = 'src/app/lib/attendanceSort.ts';
const STATS = 'src/app/lib/attendanceStats.ts';
const REPORT_KPIS = 'src/app/lib/reportKpis.ts';

const SENTENCE = 'How often each employee arrives on time for their schedule, and whether late or absent days were reported with a GAF Attendance form.';

test('LC1: the List says what it is: a plain sentence on top, the table headed "Punctuality by Employee"', () => {
  const src = read(PAGE);
  assert.ok(src.includes('<span className="text-base font-semibold">Punctuality by Employee</span>'), 'heading renamed');
  assert.ok(!src.includes('Employee Directory'), 'the List is not a directory');
  assert.equal(count(src, SENTENCE), 1, 'the one sentence saying what the page measures');
  assert.ok(src.indexOf(SENTENCE) < src.indexOf('<AttendanceKpis kpis={kpis} />'), 'the sentence comes before the cards');
  assert.equal(count(src, '<AttendanceKpis kpis={kpis} />'), 1);
});

test('LC2: five cards, in order, and no arithmetic line', () => {
  const src = read(KPIS);
  const labels = [...src.matchAll(/<Kpi\s+label="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(labels, ['On-Time Rate', 'Late Days', 'Absent Days', 'Avg Min Late', 'Time Off & Permission']);
  assert.equal(count(src, '          tooltip="'), 5, 'every card keeps a plain-English explanation');
  assert.doesNotMatch(src, /totalCheck|Work Days|workDays|Late Rate|lateRate|label="Reported"|label="Unreported"/);
  assert.match(src, /<div className="grid grid-cols-2 sm:grid-cols-5 gap-2">/);
  assert.doesNotMatch(src, /xl:grid-cols-10/);
  assert.ok(src.includes('sub={`${kpis.onTime} of ${kpis.daysTracked} Expected Days`}'));
  assert.ok(src.includes('sub={`${kpis.lateReported} Reported · ${kpis.lateUnreported} Not`}'));
  assert.ok(src.includes('const absentReported = kpis.reported - kpis.lateReported;'));
  assert.ok(src.includes('const absentNot = kpis.unreported - kpis.lateUnreported;'));
  assert.ok(src.includes('sub={`${absentReported} Reported · ${absentNot} Not`}'));
  assert.ok(src.includes('value={`${kpis.excused + kpis.permission}`}'));
  assert.ok(src.includes('sub={`${kpis.excused} Time Off · ${kpis.permission} Permission`}'));
  // Same fields as before: nothing new is computed for the cards.
  assert.ok(src.includes('value={`${kpis.onTimeRate.toFixed(1)}%`}'));
  assert.ok(src.includes('value={`${kpis.avgMinLate.toFixed(1)}m`}'));
  assert.match(src, /^import \{ CompanyKpis \} from '@\/app\/lib\/attendanceStats';$/m, 'same input type');
});

const COLUMNS: Array<[string, string]> = [
  ['Employee', 'name'], ['Manager', 'manager'], ['Schedule', 'schedule'], ['On-Time', 'pctOnTime'],
  ['Late', 'totalLate'], ['Absent', 'absent'], ['Avg Min (Worked)', 'avgMinLate'], ['Reporting', 'reporting'],
];

test('LC3: the table has eight columns, in order, each one sortable', () => {
  const t = read(TABLE);
  const heads = [...t.matchAll(/<Th label="([^"]+)"\s+col="([^"]+)"/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(heads, COLUMNS);
  assert.equal((t.match(/<th[\s>]/g) ?? []).length, 1, 'only the sortable Th helper draws a heading cell');
  assert.ok(t.includes('<td colSpan={8} '), 'the empty-list row spans the eight columns');
  assert.doesNotMatch(t, /StatusBadge|STATUS_TOOLTIP|PctBar|Status<InfoTip/, 'Good / Fair / At Risk is gone');
  assert.doesNotMatch(t, /\bs\.role\b|\bs\.b1to10\b|\bs\.b11to30\b|\bs\.b31plus\b|\bs\.reported\b|\bs\.onTime\b|>\{s\.days\}</,
    'Role, Expected, On Time, Reported and the 1–10 / 11–30 / 31+ columns are gone');
  assert.ok(t.includes('<OnTimeBar pct={s.pctOnTime} days={s.days} />'));
  assert.match(t, /\{s\.unreported > 0 && \(\s*<div className="text-\[11px\] text-status-red-ink whitespace-nowrap">\{s\.unreported\} Not Reported<\/div>/);
  assert.ok(t.includes('<ReportingBadge s={s} />'));
  assert.ok(t.includes('tooltip={ON_TIME_TOOLTIP}'));
  // Every column sorts on a real field (or the Reporting ratio).
  const stats = read(STATS);
  const empStats = stats.slice(stats.indexOf('export type EmpStats = {'), stats.indexOf('};', stats.indexOf('export type EmpStats = {')));
  for (const [, col] of COLUMNS) {
    assert.ok(col === 'reporting' || new RegExp(`\\n  ${col}: `).test(empStats), `${col} is a field of EmpStats`);
  }
  assert.match(t, /import \{ filterByName, sortEmployeeStats \} from '@\/app\/lib\/attendanceSort';/, 'still the shared ordering rule');
});

test('LC4: the 90% / 75% limits are written once, and decide both the bar and the phone pill', () => {
  const t = read(TABLE);
  assert.equal(count(t, '>= 90'), 1);
  assert.equal(count(t, '>= 75'), 1);
  assert.match(t, /function onTimeTone\(pct: number\): Tone \{/);
  assert.ok(t.includes('${BAR[onTimeTone(pct)]}'));
  assert.ok(t.includes('${PILL[onTimeTone(pct)]}'));
  assert.doesNotMatch(t, /bg-status-\$\{|text-status-\$\{/, 'Tailwind classes are written out whole');
  assert.match(t, /export const ON_TIME_TOOLTIP = '[^']*90% or above[^']*75–89%[^']*below 75%/);
  assert.match(t, /export function OnTimePill\(\{ pct, days \}: \{ pct: number; days: number \}\)/);
  // A person with no expected day shows a dash, never "0%".
  assert.equal(count(t, "if (days === 0) return <span className=\"text-muted-foreground text-xs\">—</span>;"), 2);
});

test('LC5: the phone rows show the same facts in the same words', () => {
  const src = read(ROWS);
  assert.match(src, /import \{ ON_TIME_TOOLTIP, OnTimePill, REPORTING_TOOLTIP, ReportingBadge \} from '\.\/AttendanceTable';/);
  assert.ok(src.includes('right={<OnTimePill pct={s.pctOnTime} days={s.days} />}'));
  assert.ok(src.includes('What On-Time and Reporting Mean'));
  assert.ok(src.includes('<span className="font-medium text-slate-700">On-Time.</span> {ON_TIME_TOOLTIP}'));
  assert.ok(src.includes('{s.unreported > 0 && <span className="text-status-red-ink"> ({s.unreported} Not Reported)</span>}'));
  assert.ok(src.includes('<span>Absent {s.absent}</span>'));
  assert.ok(src.includes('Reporting <ReportingBadge s={s} />'));
  assert.doesNotMatch(src, /StatusBadge|STATUS_TOOLTIP|Unreported \{|on time<\/span>/);
  const row = src.slice(src.indexOf('<MobileRow'), src.indexOf('/>\n          ))}'));
  assert.equal(count(row, '\n                  <span'), 3, 'three facts on the second line (MobileRow takes up to three)');
});

test('LC6: the phone Sort By box uses the table\'s words, same keys and directions', async () => {
  const { PHONE_SORTS } = (await import(url(SORT).href)) as {
    PHONE_SORTS: ReadonlyArray<{ key: string; dir: string; label: string }>;
  };
  assert.deepEqual(PHONE_SORTS.map(o => [o.key, o.dir, o.label]), [
    ['name', 'asc', 'Name (A to Z)'],
    ['pctOnTime', 'asc', 'On-Time (Lowest First)'],
    ['unreported', 'desc', 'Late, Not Reported (Most First)'],
    ['absent', 'desc', 'Absent (Most First)'],
    ['totalLate', 'desc', 'Late (Most First)'],
  ]);
});

test('LC7: house rules for the List files', () => {
  for (const f of [PAGE, KPIS, TABLE, ROWS, SORT]) {
    const src = read(f);
    assert.ok(Buffer.byteLength(src, 'utf8') < 15000, `${f} must stay under 15,000 bytes`);
    assert.doesNotMatch(src, /\{\s*params:\s*\{/, `${f}: params stay flat`);
    assert.doesNotMatch(src, /window\.location\.reload|pushState|replaceState/, f);
  }
  for (const f of [KPIS, TABLE, ROWS]) {
    const src = read(f);
    assert.doesNotMatch(src, /useLoadAction|useMutateAction|@\/actions\//, `${f}: no loader, no action`);
    assert.doesNotMatch(src, /uppercase/, `${f}: Title Case, never ALL CAPS`);
  }
});

test('LC8: presentation only — the calculations are byte for byte what they were on 2026-10-16', () => {
  assert.equal(sha(read(STATS)), '426809074516a05d3d6dff0e367e2617e4a24f04697994c23e737b76311ac386', `${STATS} changed`);
  assert.equal(sha(read(REPORT_KPIS)), 'b865c46cabcd6c1ad2166d753da95d1fea58c371a3f81d9fe82a0d691acc448d', `${REPORT_KPIS} changed`);
});

type Kpis = { reported: number; lateReported: number; unreported: number; lateUnreported: number; absent: number };

test('LC9: the Absent card\'s "x Reported · y Not" is exact arithmetic on fields that already exist', async () => {
  const { reportRowsToKpis } = (await import(url(REPORT_KPIS).href)) as { reportRowsToKpis: (rows: unknown[]) => Kpis };
  const v = (verdict: string) => ({ verdict, minutesLate: verdict.startsWith('late') ? 10 : 0 });
  const r = reportRowsToKpis([
    v('on_time'), v('late_reported_on_time'), v('late_no_form'),
    v('absent_reported_on_time'), v('absent_reported_late'), v('unexplained_absence'),
  ]);
  assert.equal(r.reported - r.lateReported, 2, 'Reports: absences with a form');
  assert.equal(r.unreported - r.lateUnreported, 1, 'Reports: absences without one');
  assert.equal((r.reported - r.lateReported) + (r.unreported - r.lateUnreported), r.absent);

  const { computeCompanyKpis } = (await import(url(STATS).href)) as { computeCompanyKpis: (rows: unknown[]) => Kpis };
  const row = (status: string) => ({
    email: 'a@x', name: 'A', date: '2026-10-01', entry_time: null, status, bucket: null,
    filed_gaf: false, minutes_late: 0, period_name: '', time_off_kind: null,
  });
  const l = computeCompanyKpis([row('On Time'), row('Late - Reported'), row('Absent - Unexplained'), row('Absent - Unexplained')]);
  assert.equal(l.reported - l.lateReported, 0, 'List: the view only knows unexplained absences (open question Q2)');
  assert.equal(l.unreported - l.lateUnreported, l.absent);
});
