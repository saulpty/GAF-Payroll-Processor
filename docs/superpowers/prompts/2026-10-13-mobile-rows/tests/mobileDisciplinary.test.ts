// 2026-10-13 — phone view M10: Disciplinary list and case file as rows
// (prompt 2026-10-13-mobile-rows/12-disciplinary-rows.md). Source guards.
// Lives in tests/ once the prompt is sent.
//
// The prompt may add two files, one phone branch to DisciplinaryTable, the word `export` to five
// helpers, and phone classes to Disciplinary.tsx. Each "undo" test below takes exactly that back
// out and expects the file as it stood on 2026-10-13, byte for byte: a changed loader, a moved
// line or a touched computer class all fail it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const exists = (p: string) => existsSync(new URL(`../${p}`, import.meta.url));
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const DISC = 'src/app/pages/disciplinary/';
const PAGE = 'src/app/pages/Disciplinary.tsx';
const TABLE = DISC + 'DisciplinaryTable.tsx';
const ROW = DISC + 'DisciplinaryRow.tsx';
const CASE_FILE = DISC + 'CaseFile.tsx';
const ROWS = DISC + 'DisciplinaryRows.tsx';
const SHEET = DISC + 'CaseFileSheet.tsx';
const CLOSE = DISC + 'CloseCaseDialog.tsx';
const DELETE = DISC + 'DeleteActionDialog.tsx';

// sha256 of each file as it was on 2026-10-13, before this prompt (line endings as LF).
const BEFORE: Record<string, string> = {
  [TABLE]: '5d94aa44e917da7b4071462d58d381a10bd7db802acc6022d5adbfb3b69f703d',
  [ROW]: 'f82d15ac2064521f4344d2b50d0ca627f4ab0b8d97444af6eb988bac29a3ac04',
  [CASE_FILE]: 'e1ae9487fc6ae1ba24d175277b30f2c79b322881d1c8663765f5f9ca59f0b7a2',
  [PAGE]: '549f21e1e8bcf648a154f90e018d07a16fa5487ebc0ac28b16eeba0e259c2b5b',
  [CLOSE]: '89220fde1b6f8d6cd118df1f4dae5b2aacadfa70ac7f4c8cc355ed192c00011f',
  [DELETE]: 'd0ea87ace8025cafcf03d83a98df630da716137d2a5f05a21702f33327b50a4f',
};

/** The `if (isPhone) { … }` statement in DisciplinaryTable, with the comment lines directly above it. */
function phoneBranch(src: string): { start: number; end: number; body: string } {
  const at = src.indexOf('  if (isPhone) {\n');
  assert.ok(at >= 0, 'DisciplinaryTable has no `if (isPhone) {` branch');
  assert.equal(src.indexOf('if (isPhone)', at + 1), -1, 'exactly one phone branch');
  let depth = 0;
  let i = src.indexOf('{', at);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  assert.equal(depth, 0, 'the phone branch is not closed');
  let start = at;
  for (;;) {
    const prevStart = src.lastIndexOf('\n', start - 2) + 1;
    if (!/^\s*\/\//.test(src.slice(prevStart, start))) break;
    start = prevStart;
  }
  return { start, end: i + 1, body: src.slice(at, i + 1) };
}

/** Props of the first `<Name … />` in `src`, as { prop: expression }. */
function propsOf(src: string, name: string): Record<string, string> {
  const m = new RegExp(`<${name}\\b([\\s\\S]*?)/>`).exec(src);
  assert.ok(m, `<${name} … /> not found`);
  return Object.fromEntries([...m[1].matchAll(/(\w+)=\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)].map(p => [p[1], p[2].trim()]));
}

test('MR1: DisciplinaryTable is the 2026-10-13 file plus two imports, one hook line and one phone branch', () => {
  let src = read(TABLE);
  const b = phoneBranch(src);
  const after = src.slice(b.end);
  assert.ok(after.startsWith('\n\n'), 'one blank line after the phone branch');
  src = src.slice(0, b.start) + after.slice(2);
  for (const line of [
    "import DisciplinaryRows from './DisciplinaryRows';\n",
    "import { useIsPhone } from '@/app/lib/useIsPhone';\n",
    '  const isPhone = useIsPhone();\n',
  ]) {
    assert.equal(src.split(line).length, 2, `expected exactly one line: ${line.trim()}`);
    src = src.replace(line, '');
  }
  assert.equal(sha(src), BEFORE[TABLE],
    'DisciplinaryTable changed somewhere other than the phone branch: loaders, scoping, filters, sort and the table must be untouched');
});

test('MR2: the rows are rendered only under the phone flag, from the same list; the table branch is still there', () => {
  const src = read(TABLE);
  const b = phoneBranch(src);
  assert.match(b.body, /^\s*if \(isPhone\) \{\s*return \(\s*<DisciplinaryRows\b[\s\S]*\/>\s*\);\s*\}$/, 'the branch only returns <DisciplinaryRows … />');
  assert.equal(src.split('<DisciplinaryRows').length, 2, '<DisciplinaryRows> appears once, inside the phone branch');
  assert.ok(src.indexOf('<DisciplinaryRows') > b.start && src.indexOf('<DisciplinaryRows') < b.end);

  // Same data and handlers as the table: the sorted list, the one reload, and the state the
  // table already keeps for "which employee is open".
  const p = propsOf(b.body, 'DisciplinaryRows');
  assert.equal(p.rows, 'sorted');
  assert.equal(p.asOf, 'asOf');
  assert.equal(p.statusFilter, 'statusFilter');
  assert.equal(p.openName, 'expandedName');
  assert.equal(p.onOpen, 'setExpandedName');
  assert.equal(p.onChanged, 'reload');
  assert.equal(p.onRetry, 'reload');

  // Hooks first (a hook may not come after a return), then the phone branch, then the old returns.
  const hooks = [...src.matchAll(/\buse[A-Z]\w*\(/g)].map(m => m.index!);
  const componentStart = src.indexOf('export default function DisciplinaryTable');
  for (const h of hooks.filter(i => i > componentStart)) assert.ok(h < b.start, 'a hook is called after the phone branch');
  const loading = src.indexOf('  if (loading || !scopeReady) {');
  const table = src.indexOf('<DataTable');
  assert.ok(loading > b.end && table > loading, 'the loading, error and <DataTable> returns still follow the phone branch');
  assert.equal(src.split('<DataTable').length, 2, 'one <DataTable>');
  assert.equal((src.match(/useIsPhone\(\)/g) ?? []).length, 1, 'useIsPhone() is called once');
});

test('MR3: no loader and no new state were added for the phone', () => {
  const src = read(TABLE);
  assert.equal((src.match(/useLoadAction\(/g) ?? []).length, 5, 'DisciplinaryTable still has its five loads and no more');
  assert.equal((src.match(/useState[<(]/g) ?? []).length, 3, 'no new useState in DisciplinaryTable');
  for (const f of [ROWS, SHEET]) {
    const s = read(f);
    assert.doesNotMatch(s, /useLoadAction|useMutateAction|@\/actions\/|@uibakery\/data/, `${f} must not load or write anything itself`);
    assert.doesNotMatch(s, /useDisciplinaryAdmin|isSuper|useViewer/, `${f}: who may do what is decided inside ActionDetail, not here`);
  }
});

// The field is `scenario` (DisciplinaryRow.scenario in src/app/lib/disciplinary.ts): the table
// shows `latest.scenario` under the Latest date. The q_* answers, expectations and consequences
// are the rest of the narrative. None of it may be reachable from the list file.
test('MR4: the phone list cannot show what an action is about', () => {
  const src = read(ROWS);
  for (const field of ['scenario', 'q_expected', 'q_happened', 'q_when', 'q_impact', 'expectations', 'consequences',
    'evidence_description', 'prior_warnings', 'closure_note', 'deletion_note']) {
    assert.ok(!src.toLowerCase().includes(field), `DisciplinaryRows.tsx mentions ${field}`);
  }
  // From the latest action the list may read the warning level, nothing else.
  const fromLatest = [...src.matchAll(/\blatest\.(\w+)/g)].map(m => m[1]);
  assert.deepEqual([...new Set(fromLatest)], ['warning_level']);
  // And nothing reads a field off an action except the two the outcome chip needs.
  const fromAction = [...src.matchAll(/\ba\.(\w+)/g)].map(m => m[1]);
  assert.deepEqual([...new Set(fromAction)].sort(), ['closed_at', 'final_outcome']);
  assert.doesNotMatch(src, /<ActionDetail|<CaseFile\b/, 'the list itself renders no action detail');
});

test('MR5: the list reuses the table\'s chip rules instead of copying them', () => {
  const rows = read(ROWS);
  assert.match(rows, /import \{ levelInfo, stateChip \} from '\.\/DisciplinaryRow';/);
  assert.match(rows, /stateChip\(row, asOf\)/);
  assert.match(rows, /levelInfo\(row\.highestRank, row\.latest\.warning_level\)/);
  assert.doesNotMatch(rows, /Review Overdue|Re-Eval|All Closed|Final Written|Verbal/, 'chip wording is copied into DisciplinaryRows');
  const sheet = read(SHEET);
  assert.match(sheet, /import \{ levelInfo, stateLabel, stateTone \} from '\.\/CaseFile';/);
  assert.doesNotMatch(sheet, /'Overdue'|'Outcome'|Final Written|Verbal/, 'chip wording is copied into CaseFileSheet');

  // DisciplinaryRow.tsx and CaseFile.tsx: only the word `export` was added.
  const undo = (s: string, names: string[]) =>
    s.replace(new RegExp(`^export function (${names.join('|')})\\(`, 'gm'), 'function $1(');
  assert.equal(sha(undo(read(ROW), ['levelInfo', 'stateChip'])), BEFORE[ROW], 'DisciplinaryRow.tsx changed beyond two exports');
  assert.equal(sha(undo(read(CASE_FILE), ['levelInfo', 'stateTone', 'stateLabel'])), BEFORE[CASE_FILE], 'CaseFile.tsx changed beyond three exports');
  assert.notEqual(sha(read(ROW)), BEFORE[ROW]);
  assert.notEqual(sha(read(CASE_FILE)), BEFORE[CASE_FILE]);
});

test('MR6: the case file sheet opens actions in place and hands ActionDetail exactly what CaseFile hands it', () => {
  const sheet = read(SHEET);
  const desktop = propsOf(read(CASE_FILE), 'ActionDetail');
  assert.deepEqual(desktop, { action: 'a', asOf: 'asOf', onChanged: 'onChanged' }, 'CaseFile itself changed what it passes');
  assert.deepEqual(propsOf(sheet, 'ActionDetail'), desktop);
  assert.equal(sheet.split('<ActionDetail').length, 2, 'one <ActionDetail>');

  // Oldest first, as CaseFile; one action open at a time; a full-height sheet.
  assert.match(sheet, /\[\.\.\.row\.actions\]\.reverse\(\)/);
  assert.match(read(CASE_FILE), /\[\.\.\.actions\]\.reverse\(\)/);
  assert.equal((sheet.match(/useState[<(]/g) ?? []).length, 1, 'one piece of state: the open action');
  assert.match(sheet, /useState<number \| null>\(null\)/);
  assert.match(sheet, /<MobileSheet\b[^>]*\bsize="full"/);
  // Opening an action is not a third layer: one sheet, and the detail is the row's own child.
  assert.equal(sheet.split('<MobileSheet').length, 2);
  assert.doesNotMatch(sheet, /<Dialog\b/);
  assert.match(sheet, /<MobileRow\b[\s\S]*?>\s*\{isOpen && \([\s\S]*<ActionDetail[\s\S]*\)\}\s*<\/MobileRow>/);
  // The full situation type is written out above the detail, from the action itself.
  const scenario = sheet.indexOf('{a.scenario}');
  assert.ok(scenario > 0 && scenario < sheet.indexOf('<ActionDetail'), 'the situation type is shown above ActionDetail');
  assert.doesNotMatch(sheet, /scenario[^\n]*(?:slice|truncate|substring)|truncate/, 'never cut off');
});

test('MR7: the page header changed by class strings only', () => {
  const now = read(PAGE);
  const undone = now.replace(/ (?:phone:[^\s"'`]+|no-scrollbar)(?=[\s"'`])/g, '');
  assert.equal(sha(undone), BEFORE[PAGE], 'Disciplinary.tsx changed beyond added phone: classes');
  assert.notEqual(sha(now), BEFORE[PAGE], 'no phone: class has been added yet');
});

test('MR8: the two pop-ups are untouched', () => {
  assert.equal(sha(read(CLOSE)), BEFORE[CLOSE], 'CloseCaseDialog.tsx changed');
  assert.equal(sha(read(DELETE)), BEFORE[DELETE], 'DeleteActionDialog.tsx changed');
});

test('MR9: every new or edited file stays under 15,000 bytes and follows the standing rules', () => {
  for (const f of [ROWS, SHEET, TABLE, ROW, CASE_FILE, PAGE]) {
    assert.ok(exists(f), `${f} is missing`);
    const size = Buffer.byteLength(readFileSync(new URL(`../${f}`, import.meta.url)));
    assert.ok(size < 15000, `${f} is ${size} bytes`);
  }
  for (const f of [ROWS, SHEET, PAGE]) {
    const s = read(f);
    assert.doesNotMatch(s, /(?<![\w-])(?:sm|md|max-(?:sm|md|lg|xl|2xl|\[[^\]]+\])|min-\[[^\]]+\]):/, `${f}: use phone:, not a width breakpoint`);
    assert.doesNotMatch(s, /location\.reload|pushState|replaceState/, f);
  }
  for (const f of [ROWS, SHEET]) {
    assert.doesNotMatch(read(f), /new Date\(/, `${f}: dates are strings; use fmtDate`);
  }
});
