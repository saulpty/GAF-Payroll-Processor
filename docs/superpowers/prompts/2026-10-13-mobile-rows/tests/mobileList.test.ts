// 2026-10-13 — phone view M12: Attendance → List as rows
// (prompt 2026-10-13-mobile-rows/14-list-rows.md). Unit tests for the shared ordering rule in
// attendanceSort.ts, plus source guards. Lives in tests/ once the prompt is sent; it fails until
// the export lands.
//
// ML1 is the "a computer shows the same order" proof: the table's old inline comparison is kept
// below, word for word, as the reference, and the shared rule must give the same order for every
// column and both directions over a list with ties, blanks and people with nothing to report.
// ML8–ML10 are the "a computer is untouched" proof: take the prompt's edits back out of each
// edited file and it must be, byte for byte, what it was on 2026-10-13. If one of these files is
// changed on purpose before this prompt is sent, re-pin its hash (and re-check the prompt's
// anchors) first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const url = (p: string) => new URL(`../${p}`, import.meta.url);
const read = (p: string) => readFileSync(url(p), 'utf8').replace(/\r\n/g, '\n');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

const A = 'src/app/pages/attendance/';
const LIB = 'src/app/lib/attendanceSort.ts';
const ROWS = `${A}AttendanceListRows.tsx`;
const TABLE = `${A}AttendanceTable.tsx`;
const PAGE = 'src/app/pages/Attendance.tsx';
const KPIS = `${A}AttendanceKpis.tsx`;

type Stat = Record<string, unknown> & {
  email: string; name: string; pctOnTime: number; unreported: number; absent: number; totalLate: number;
  filing: { filed: number; needed: number };
};
type Lib = {
  sortEmployeeStats: (list: Stat[], key: string, dir: 'asc' | 'desc') => Stat[];
  compareEmployeeStats: (a: Stat, b: Stat, key: string, dir: 'asc' | 'desc') => number;
  filterByName: (list: Stat[], search: string) => Stat[];
  PHONE_SORTS: ReadonlyArray<{ key: string; dir: 'asc' | 'desc'; label: string }>;
  phoneSort: (key: string) => { key: string; dir: 'asc' | 'desc'; label: string };
  listNothingFound: (f: { employee?: string; manager?: string; role?: string }) => string;
};
const lib = async (): Promise<Lib> => {
  assert.ok(existsSync(url(LIB)), `${LIB} is missing`);
  return (await import(url(LIB).href)) as unknown as Lib;
};

// ── the table's comparison as it stood on 2026-10-13, kept here as the reference ────────────
function reportingRatioOld(s: Stat): number {
  if (s.filing.needed === 0) return -1;
  return s.filing.filed / s.filing.needed;
}
function oldSorted(stats: Stat[], search: string, sortKey: string, sortDir: 'asc' | 'desc'): Stat[] {
  const filtered = stats.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  return [...filtered].sort((a, b) => {
    if (sortKey === 'reporting') {
      const ar = reportingRatioOld(a), br = reportingRatioOld(b);
      if (ar === -1 && br === -1) return 0;
      if (ar === -1) return 1;
      if (br === -1) return -1;
      return sortDir === 'asc' ? ar - br : br - ar;
    }
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'string' && typeof bv === 'string')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    if (typeof av === 'number' && typeof bv === 'number')
      return sortDir === 'asc' ? av - bv : bv - av;
    return 0;
  });
}

// ── a sample list: ties in every column, blanks, accents, mixed case, nothing-to-report ─────
let n = 0;
function emp(name: string, o: Partial<Stat> = {}): Stat {
  n += 1;
  const base: Stat = {
    email: `e${n}@x`, name, role: 'Intake 1', manager: 'Ana Ruiz', schedule: '08:00 – 17:00',
    days: 10, onTime: 8, totalLate: 2, reported: 1, unreported: 1, excused: 0, permission: 0, absent: 0,
    daysWorked: 10, avgMinLate: 2.5, pctOnTime: 80, b1to10: 1, b11to30: 1, b31plus: 0,
    filing: { filed: 1, needed: 2 }, rows: [],
  };
  return { ...base, ...o };
}
const SAMPLE: Stat[] = [
  emp('Zoe Abad', { pctOnTime: 100, onTime: 10, totalLate: 0, reported: 0, unreported: 0, filing: { filed: 0, needed: 0 }, b1to10: 0, b11to30: 0, avgMinLate: 0 }),
  emp('ana castillo', { role: '', manager: '', pctOnTime: 62.5, unreported: 3, totalLate: 3, reported: 0, absent: 2, filing: { filed: 0, needed: 5 } }),
  emp('Álvaro Díaz', { role: 'Supervisor', pctOnTime: 80, absent: 1, filing: { filed: 3, needed: 3 }, schedule: '09:00 – 18:00' }),
  emp('Bruno Vega', { role: 'Intake 2', manager: 'Luis Mora', pctOnTime: 80, unreported: 1, absent: 1, filing: { filed: 1, needed: 3 }, avgMinLate: 11.2, b31plus: 2 }),
  emp('Bruno Vega', { role: 'Intake 2', manager: 'Luis Mora', pctOnTime: 90, unreported: 0, totalLate: 1, filing: { filed: 2, needed: 3 }, daysWorked: 9 }),
  emp('Carla Núñez', { days: 0, onTime: 0, totalLate: 0, reported: 0, unreported: 0, pctOnTime: 0, daysWorked: 0, avgMinLate: 0, excused: 5, permission: 1, filing: { filed: 0, needed: 0 }, schedule: '—' }),
  emp('Diego Ana', { pctOnTime: 74.9, unreported: 3, totalLate: 4, reported: 1, absent: 2, filing: { filed: 1, needed: 6 } }),
  emp('Elena Paz', { role: null as unknown as string, manager: undefined as unknown as string, pctOnTime: 90, unreported: 0, totalLate: 0, absent: 0, filing: { filed: 0, needed: 0 } }),
  emp('Fabio Ana', { role: 'intake 1', pctOnTime: 62.5, unreported: 1, totalLate: 4, reported: 3, absent: 0, filing: { filed: 3, needed: 4 } }),
];
const KEYS = [...Object.keys(SAMPLE[0]), 'reporting'];
const emails = (list: Stat[]) => list.map(s => s.email);

test('ML1: for every column and both directions the shared rule gives the table\'s old order', async () => {
  const { sortEmployeeStats, filterByName } = await lib();
  assert.equal(KEYS.length, 22, 'every field of an employee\'s numbers, plus reporting');
  let compared = 0;
  for (const key of KEYS) {
    for (const dir of ['asc', 'desc'] as const) {
      for (const search of ['', 'ANA', 'bruno', 'nobody']) {
        // The same list in three starting orders, so a tie cannot pass by luck.
        for (const start of [SAMPLE, [...SAMPLE].reverse(), [...SAMPLE.slice(4), ...SAMPLE.slice(0, 4)]]) {
          assert.deepEqual(
            emails(sortEmployeeStats(filterByName(start, search), key, dir)),
            emails(oldSorted(start, search, key, dir)),
            `column ${key}, ${dir}, search "${search}"`,
          );
          compared += 1;
        }
      }
    }
  }
  assert.equal(compared, 22 * 2 * 4 * 3);
});

test('ML2: numbers, words, ties and blanks each sort as the table always has', async () => {
  const { sortEmployeeStats, compareEmployeeStats } = await lib();
  const by = (key: string, dir: 'asc' | 'desc') => sortEmployeeStats(SAMPLE, key, dir);

  // Numbers: plain ascending / descending.
  assert.deepEqual(by('pctOnTime', 'asc').map(s => s.pctOnTime), [0, 62.5, 62.5, 74.9, 80, 80, 90, 90, 100]);
  assert.deepEqual(by('pctOnTime', 'desc').map(s => s.pctOnTime), [100, 90, 90, 80, 80, 74.9, 62.5, 62.5, 0]);
  assert.deepEqual(by('absent', 'desc').map(s => s.absent), [2, 2, 1, 1, 0, 0, 0, 0, 0]);

  // Ties keep the order they arrived in, in both directions (the list is never reversed).
  const tied = (list: Stat[]) => list.filter(s => s.pctOnTime === 62.5).map(s => s.name);
  assert.deepEqual(tied(by('pctOnTime', 'asc')), ['ana castillo', 'Fabio Ana']);
  assert.deepEqual(tied(by('pctOnTime', 'desc')), ['ana castillo', 'Fabio Ana']);

  // Words: by the language's own ordering (case and accents do not send a name to the end).
  const names = by('name', 'asc').map(s => s.name);
  assert.deepEqual(names, [...SAMPLE.map(s => s.name)].sort((a, b) => a.localeCompare(b)));
  assert.ok(names.indexOf('Álvaro Díaz') < names.indexOf('Bruno Vega'));
  assert.deepEqual(by('name', 'desc').map(s => s.name), [...names].reverse());

  // A blank that is not text (null / undefined) compares as equal to anything: 0, never a throw.
  const elena = SAMPLE.find(s => s.name === 'Elena Paz')!;
  for (const other of SAMPLE) {
    assert.equal(compareEmployeeStats(elena, other, 'role', 'asc'), 0);
    assert.equal(compareEmployeeStats(other, elena, 'manager', 'desc'), 0);
  }
  // Fields that are neither text nor a number never reorder anything.
  assert.deepEqual(emails(by('filing', 'desc')), emails(SAMPLE));
  assert.deepEqual(emails(by('rows', 'asc')), emails(SAMPLE));
});

test('ML3: Reporting — nothing to report is last in both directions; the list handed in is not changed', async () => {
  const { sortEmployeeStats } = await lib();
  const ratio = (s: Stat) => (s.filing.needed === 0 ? null : s.filing.filed / s.filing.needed);
  const before = emails(SAMPLE);
  for (const dir of ['asc', 'desc'] as const) {
    const out = sortEmployeeStats(SAMPLE, 'reporting', dir);
    const ratios = out.map(ratio);
    assert.deepEqual(ratios.slice(-3), [null, null, null], `${dir}: the three with nothing to report are last`);
    assert.deepEqual(out.slice(-3).map(s => s.name), ['Zoe Abad', 'Carla Núñez', 'Elena Paz'], 'and in the order they arrived');
    const real = ratios.slice(0, -3) as number[];
    assert.deepEqual(real, [...real].sort((a, b) => (dir === 'asc' ? a - b : b - a)));
    assert.notEqual(out, SAMPLE, 'a new list is returned');
  }
  assert.deepEqual(emails(SAMPLE), before, 'the input keeps its order');
  assert.deepEqual(sortEmployeeStats([], 'name', 'asc'), []);
});

test('ML4: the search box keeps names that contain the text, upper or lower case', async () => {
  const { filterByName } = await lib();
  assert.deepEqual(filterByName(SAMPLE, 'ANA').map(s => s.name), ['ana castillo', 'Diego Ana', 'Fabio Ana']);
  assert.equal(filterByName(SAMPLE, '').length, SAMPLE.length, 'an empty box keeps everyone');
  assert.deepEqual(filterByName(SAMPLE, 'e1@x'), [], 'the table has always matched the name only');
});

test('ML5: Sort By has five choices; names A to Z, every number worst first', async () => {
  const { PHONE_SORTS, phoneSort, sortEmployeeStats } = await lib();
  assert.deepEqual(
    PHONE_SORTS.map(o => [o.key, o.dir]),
    [['name', 'asc'], ['pctOnTime', 'asc'], ['unreported', 'desc'], ['absent', 'desc'], ['totalLate', 'desc']],
  );
  for (const o of PHONE_SORTS) assert.ok(o.label.length > 0 && o.label !== o.label.toUpperCase(), 'Title Case label');
  assert.ok(PHONE_SORTS[0].label.startsWith('Name'));
  assert.ok(PHONE_SORTS[1].label.startsWith('% On-Time'));
  assert.ok(PHONE_SORTS[4].label.startsWith('Total Late'));

  // The phone starts on Name ascending: the order the computer's table starts in.
  const table = read(TABLE);
  assert.match(table, /useState<SortKey>\('name'\)/);
  assert.match(table, /useState<'asc' \| 'desc'>\('asc'\)/);

  const first = (key: string) => { const o = phoneSort(key); return sortEmployeeStats(SAMPLE, o.key, o.dir); };
  const withDays = (list: Stat[]) => list.filter(s => (s.days as number) > 0);
  assert.equal(withDays(first('pctOnTime'))[0].pctOnTime, 62.5, 'lowest on-time rate first');
  assert.equal(first('pctOnTime').at(-1)!.pctOnTime, 100);
  assert.equal(first('unreported')[0].unreported, 3, 'most unreported first');
  assert.equal(first('absent')[0].absent, 2, 'most absences first');
  assert.equal(first('totalLate')[0].totalLate, 4, 'most late days first');
  assert.equal(first('name')[0].name, 'Álvaro Díaz');
  assert.equal(phoneSort('no-such-column').key, 'name', 'anything unknown falls back to Name');
});

test('ML6: the nothing-found line names every active filter', async () => {
  const { listNothingFound } = await lib();
  assert.equal(listNothingFound({ role: 'Intake 1' }), 'No employees match Title: Intake 1');
  assert.equal(
    listNothingFound({ employee: ' zz ', manager: 'Ana Ruiz', role: 'Intake 1' }),
    'No employees match Employee: zz · Manager: Ana Ruiz · Title: Intake 1',
  );
  assert.equal(listNothingFound({ employee: '  ', manager: '', role: '' }), 'No employees to show.');
});

test('ML7: attendanceSort.ts stays a pure module', () => {
  const src = read(LIB);
  const imports = src.split('\n').filter(l => /^import\b/.test(l));
  assert.deepEqual(imports, ["import type { EmpStats } from '@/app/lib/attendanceStats';"], 'one import, and it is import type');
  assert.doesNotMatch(src, /\breact\b|useState|useMemo|window\.|document\./);
  assert.doesNotMatch(src, /new Date\(/);
});

/** Take the prompt's edits back out: [now, before] pairs, each of which must be there exactly once. */
function undone(file: string, undo: Array<[string, string]>): string {
  let src = read(file);
  for (const [now, before] of undo) {
    assert.equal(count(src, now), 1, `${file}: expected exactly once:\n${now}`);
    src = src.replace(now, () => before);
  }
  return src;
}

const OLD_SORT = `  const filtered = stats.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'reporting') {
      const ar = reportingRatio(a), br = reportingRatio(b);
      // needed=0 rows always last (ratio=-1) regardless of direction
      if (ar === -1 && br === -1) return 0;
      if (ar === -1) return 1;
      if (br === -1) return -1;
      return sortDir === 'asc' ? ar - br : br - ar;
    }
    const av = a[sortKey as keyof EmpStats], bv = b[sortKey as keyof EmpStats];
    if (typeof av === 'string' && typeof bv === 'string')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    if (typeof av === 'number' && typeof bv === 'number')
      return sortDir === 'asc' ? av - bv : bv - av;
    return 0;
  });
`;
const OLD_RATIO = `/** Ratio for sorting: -1 means needed=0 (always last in both directions) */
function reportingRatio(s: EmpStats): number {
  if (s.filing.needed === 0) return -1;
  return s.filing.filed / s.filing.needed;
}

`;

test('ML8: the table orders its rows with the shared rule and is otherwise untouched', () => {
  const src = read(TABLE);
  assert.match(src, /import \{ filterByName, sortEmployeeStats \} from '@\/app\/lib\/attendanceSort';/);
  assert.match(src, /const sorted = sortEmployeeStats\(filterByName\(stats, search\), sortKey, sortDir\);/);
  assert.doesNotMatch(src, /\.sort\(|localeCompare|reportingRatio/, 'the table no longer carries its own comparison');
  assert.doesNotMatch(src, /useIsPhone|phone:/, 'the table is the computer layout; the page chooses');
  assert.match(src, /style=\{\{ maxHeight: 'calc\(100vh - 220px\)' \}\}/, 'the table keeps its own scrolling box');

  const before = undone(TABLE, [
    ["import { filterByName, sortEmployeeStats } from '@/app/lib/attendanceSort';\nimport type { SortKey } from '@/app/lib/attendanceSort';\n",
      "\ntype SortKey = keyof EmpStats | 'reporting';\n"],
    ['export const STATUS_TOOLTIP = ', 'const STATUS_TOOLTIP = '],
    ['export function StatusBadge(', 'function StatusBadge('],
    ['export const REPORTING_TOOLTIP = ', 'const REPORTING_TOOLTIP = '],
    ['export function ReportingBadge(', `${OLD_RATIO}function ReportingBadge(`],
    ['  const sorted = sortEmployeeStats(filterByName(stats, search), sortKey, sortDir);\n', OLD_SORT],
  ]);
  assert.equal(sha(before), '6b47bac7efbcf2b893a8f6b8c9b67c5afdfd418b68d7aebf5cc2511333e79d35',
    'with the edits taken out, AttendanceTable.tsx is byte for byte what it was');
});

test('ML9: the page calls useIsPhone() once and renders the rows OR the table, with the same data', () => {
  const src = read(PAGE);
  assert.equal(count(src, 'useIsPhone()'), 1, 'one call for the page');
  for (const f of [ROWS, TABLE, KPIS, LIB]) assert.equal(count(read(f), 'useIsPhone'), 0, `${f} must not ask again`);
  assert.match(
    src,
    /\{isPhone\s+\? <AttendanceListRows stats=\{empStats\} onRowClick=\{setPanelEmail\} search=\{globalEmployee\} manager=\{manager\} role=\{role\} \/>\s+: <AttendanceTable stats=\{empStats\} onRowClick=\{setPanelEmail\} search=\{globalEmployee\} \/>\}/,
    'same list, same click, same search for both layouts',
  );
  assert.equal(count(src, '<AttendanceTable '), 1);
  assert.equal(count(src, '<AttendanceListRows '), 1);
  assert.ok(src.indexOf('const isPhone = useIsPhone();') < src.indexOf('useLoadAction('), 'the hook sits with the other hooks, before any return');
  assert.doesNotMatch(src, /\{\s*params:\s*\{/, 'params stay flat');

  const before = undone(PAGE, [
    ["import AttendanceListRows, { AttendanceListLoading } from '@/app/pages/attendance/AttendanceListRows';\nimport { useIsPhone } from '@/app/lib/useIsPhone';\n", ''],
    ['  const isPhone = useIsPhone();\n', ''],
    [' phone:h-auto phone:min-h-full"', '"'],
    [' phone:flex-none phone:overflow-visible"', '"'],
    ['          {loading && isPhone && <AttendanceListLoading />}\n          {loading && !isPhone && (\n', '          {loading && (\n'],
    ['                {isPhone\n                  ? <AttendanceListRows stats={empStats} onRowClick={setPanelEmail} search={globalEmployee} manager={manager} role={role} />\n                  : <AttendanceTable stats={empStats} onRowClick={setPanelEmail} search={globalEmployee} />}\n',
      '                <AttendanceTable stats={empStats} onRowClick={setPanelEmail} search={globalEmployee} />\n'],
  ]);
  assert.equal(sha(before), '7fefce77009fc44ba8e4d731f19f5e98b168f0b4f71916e4f9862e795cb3cc02',
    'with the edits taken out, Attendance.tsx is byte for byte what it was');
});

test('ML10: the cards change by phone-only classes on one line and nothing else', () => {
  const before = undone(KPIS, [[' truncate phone:whitespace-normal phone:text-xs">{sub}', ' truncate">{sub}']]);
  assert.equal(sha(before), 'ce37fbebc825b6c0974c0fb9799ce15fc215cc6a1c60b69d8de761cf2f70bfa8',
    'with the edit taken out, AttendanceKpis.tsx is byte for byte what it was');
  assert.equal(count(read(KPIS), 'phone:'), 2);
});

test('ML11: the phone rows use the same rule and the same pills (imported, not copied)', () => {
  const src = read(ROWS);
  assert.match(src, /import \{\s*PHONE_SORTS, filterByName, listNothingFound, phoneSort, sortEmployeeStats,\s*\} from '@\/app\/lib\/attendanceSort';/);
  assert.match(src, /import \{ REPORTING_TOOLTIP, ReportingBadge, STATUS_TOOLTIP, StatusBadge \} from '\.\/AttendanceTable';/);
  assert.match(src, /import MobileRow from '@\/app\/components\/mobile\/MobileRow';/);
  assert.match(src, /const sorted = sortEmployeeStats\(filterByName\(stats, search\), sort\.key, sort\.dir\);/);
  assert.match(src, /<StatusBadge pct=\{s\.pctOnTime\} days=\{s\.days\} \/>/, 'the pill is decided from the same two numbers as the table');
  assert.match(src, /<ReportingBadge s=\{s\} \/>/);
  assert.match(src, /onClick=\{\(\) => onRowClick\(s\.email\)\}/, 'a tap opens the panel as a table click does');

  // No second copy of an ordering rule or of a threshold.
  assert.doesNotMatch(src, /\.sort\(|localeCompare/);
  assert.doesNotMatch(src, />=\s*\d|<=\s*\d|[<>]\s*(90|75)\b|needed\s*\/\s*2/, 'Good / Fair / At Risk and Gaps / Rarely are decided in AttendanceTable.tsx only');

  // One native box for the order, fed by the shared list of choices.
  assert.equal(count(src, '<select'), 1);
  assert.match(src, /PHONE_SORTS\.map\(o => <option key=\{o\.key\} value=\{o\.key\}>\{o\.label\}<\/option>\)/);
  assert.match(src, /listNothingFound\(\{ employee: search, manager, role \}\)/);
  assert.match(src, /export function AttendanceListLoading\(\)/);

  // The row is a button: nothing block-level is handed to it.
  const row = src.slice(src.indexOf('<MobileRow'), src.indexOf('/>\n          ))}'));
  assert.ok(row.length > 0);
  assert.doesNotMatch(row, /<div|<p\b|<button|<a\b|PctBar/);
});

test('ML12: house rules for the new files, and every file under 15 KB', () => {
  for (const f of [LIB, ROWS, TABLE, PAGE, KPIS]) {
    assert.ok(Buffer.byteLength(read(f), 'utf8') < 15000, `${f} must stay under 15,000 bytes`);
  }
  for (const f of [LIB, ROWS]) {
    const src = read(f);
    assert.doesNotMatch(src, /(^|[\s"'`])(max|min)-(sm|md|lg|xl|2xl|\[)[^\s"'`]*:/, `${f}: max-*: and min-*: variants do not work in this app`);
    assert.doesNotMatch(src, /(^|[\s"'`])(sm|md|lg):/, `${f}: the phone switch is the hook, never sm: or md:`);
    assert.doesNotMatch(src, /window\.location\.reload|pushState|replaceState/, f);
    assert.doesNotMatch(src, /useLoadAction|useMutateAction|@\/actions\//, `${f}: no loader, no action`);
    assert.doesNotMatch(src, /new Date\(/, f);
    assert.doesNotMatch(src, /uppercase/, `${f}: Title Case, never ALL CAPS`);
    assert.doesNotMatch(src, /text-\[(\d|1[01])px\]/, `${f}: nothing below 12 px is written here`);
  }
});
