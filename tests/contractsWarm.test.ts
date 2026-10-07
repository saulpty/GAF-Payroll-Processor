// Contracts page, Warm redesign (Saul approved the mockup 2026-10-07).
// CW1-CW6: static guards on the page source. CC1-CC6: the pure chip/label lib.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  matchesChip, chipCounts, applyChip, inDaysLabel, tenureDisplay, SOON_DAYS,
} from '../src/app/lib/contractChips.ts';
import type { ChipRow } from '../src/app/lib/contractChips.ts';
import { nextMilestone, contractEndState, renewalState, tenureLabel } from '../src/app/lib/tenure.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const PAGE = 'src/app/pages/Contracts.tsx';
const TABLE = 'src/app/pages/contracts/ContractsTable.tsx';
const ROW = 'src/app/pages/contracts/ContractRow.tsx';
const CELLS = 'src/app/pages/contracts/ContractCells.tsx';
const CHIPS = 'src/app/pages/contracts/ContractsChips.tsx';
const LIB = 'src/app/lib/contractChips.ts';
const FILES = [PAGE, TABLE, ROW, CELLS, CHIPS, LIB];

test('CW1: description copy, and the PTO subtitle lost "one row per employee"', () => {
  assert.match(read(PAGE), /subtitle="Tenure milestones and contract end dates\."/);
  assert.match(read('src/app/pages/PtoTracker.tsx'), /subtitle="Accrual, requests and floating holidays\."/);
  for (const f of [PAGE, 'src/app/pages/PtoTracker.tsx']) {
    assert.doesNotMatch(read(f), /one row per employee/, f);
  }
});

test('CW2: Title Case headers, never ALL CAPS, no opacity modifiers on token colours', () => {
  const t = read(TABLE);
  assert.match(t, /stickyHeader\s+titleCase/);
  for (const l of ['Employee', 'State', 'Start Date', 'Tenure', 'Contract End', '1 Month', '3 Months', '6 Months', '1 Year', '2 Years']) {
    assert.match(t, new RegExp(`label: '${l}'`), l);
  }
  assert.doesNotMatch(t, /key: 'position'/, 'the position sits under the name, not in its own column');
  assert.equal((t.match(/tip: ['"]/g) ?? []).length, 10, 'every header keeps its InfoTip');
  for (const f of FILES) {
    const s = read(f);
    assert.doesNotMatch(s, /uppercase/, f);
    assert.doesNotMatch(s, /\b(?:bg|text|ring|border)-(?:primary|warm|secondary)(?:-[a-z]+)?\/\d+/, `${f}: opacity modifier on a CSS-variable colour`);
  }
});

test('CW3: dates go through fmtDay with the current year; no new Date(str)', () => {
  assert.match(read(ROW), /fmtDay\(start, thisYear\)/);
  assert.match(read(CELLS), /fmtDay\(m\.date, thisYear\)/);
  assert.match(read(CELLS), /fmtDay\(end, thisYear\)/);
  assert.match(read(TABLE), /const thisYear = asOf\.slice\(0, 4\);/);
  for (const f of FILES) {
    assert.doesNotMatch(read(f), /fmtDate\(/, `${f} uses fmtDay now`);
    assert.doesNotMatch(read(f), /new Date\(\s*[a-zA-Z]/, `${f}: no new Date(str)`);
  }
  assert.match(read(PAGE), /toLocalYMD\(new Date\(\)\)/, 'today still comes from toLocalYMD');
});

test('CW4: summary chips are toggles with aria-pressed, counted from the filtered rows', () => {
  const c = read(CHIPS);
  for (const l of ['Milestone in 14 Days', 'Milestone in 30 Days', 'Contract Ends in 30 Days', 'Renewed']) {
    assert.match(c, new RegExp(`label: '${l}'`), l);
  }
  assert.match(c, /aria-pressed=\{active === c\.key\}/);
  assert.match(c, /\{employees === 1 \? 'Employee' : 'Employees'\}/);
  assert.match(c, /bg-slate-100[^"]*text-primary/, 'employee count: navy on slate-100');
  assert.match(c, /border-warm bg-warm-tint text-warm-text/, 'pressed chip uses the safe orange text');
  const t = read(TABLE);
  assert.match(t, /chipCounts\(sorted\)/, 'counts follow the global filters, not the active chip');
  assert.match(t, /applyChip\(sorted, chip\)/);
  assert.match(t, /setChip\(prev => \(prev === c \? null : c\)\)/, 'clicking again clears');
  assert.match(t, /\{ manager: manager \|\| null, employeeId: null, viewAs \}/, 'params stay flat');
});

test('CW5: milestone and contract-end cells use the Warm / Excel colours', () => {
  const s = read(CELLS);
  assert.match(s, /bg-status-yellow-fill border-status-yellow-fill/, 'soon box is Excel yellow');
  assert.match(s, /bg-warm-tint border-warm-ring/, 'next box is warm');
  assert.match(s, /text-status-yellow-ink' : 'text-warm-text'/);
  assert.match(s, /<Check [^>]*\/>\s*Done/);
  assert.match(s, /bg-status-green-fill text-status-green-ink`\}>Renewed · was \{day\}/);
  assert.match(s, /inDaysLabel\(next\.days\)/);
  assert.match(read(ROW), /tenureDisplay\(tenure\)/);
  assert.match(read(PAGE), /variant="outline"[\s\S]{0,120}Export/, 'Export stays an outline button');
});

test('CW6: every Contracts file stays under 15 KB; the lib imports types only', () => {
  for (const f of FILES) assert.ok(Buffer.byteLength(read(f)) < 15000, `${f} must stay under 15 KB`);
  const lib = read(LIB);
  const imports = lib.match(/^import .*$/gm) ?? [];
  for (const i of imports) assert.match(i, /^import type /, `lib import must be type-only: ${i}`);
});

// ── The pure lib ─────────────────────────────────────────────────────────────

const TODAY = '2026-10-07';
const row = (o: Partial<ChipRow>): ChipRow => ({
  next: null, endState: { kind: 'none', days: null }, renewal: 'pending', ...o,
});
const ms = (d: number) => row({ next: { days: d } });
const end = (e: string | null) => row({ endState: contractEndState(e, TODAY) });

test('CC1: Milestone in 14 Days includes today and day 14, not day 15', () => {
  assert.equal(SOON_DAYS, 14);
  assert.equal(matchesChip(ms(0), 'ms14'), true);
  assert.equal(matchesChip(ms(14), 'ms14'), true);
  assert.equal(matchesChip(ms(15), 'ms14'), false);
  assert.equal(matchesChip(row({}), 'ms14'), false, 'all milestones passed');
});

test('CC2: Milestone in 30 Days includes the 14-day ones and day 30, not day 31', () => {
  assert.equal(matchesChip(ms(6), 'ms30'), true);
  assert.equal(matchesChip(ms(30), 'ms30'), true);
  assert.equal(matchesChip(ms(31), 'ms30'), false);
  // Real shape from tenure.ts: Alberto Cornejo starts 2026-10-06 → 1-month milestone Fri Nov 6, 30 days out.
  const n = nextMilestone('2026-10-06', TODAY);
  assert.deepEqual(n, { key: '1m', date: '2026-11-06', days: 30 });
  assert.equal(matchesChip(row({ next: n }), 'ms30'), true);
  assert.equal(matchesChip(row({ next: n }), 'ms14'), false);
});

test('CC3: Contract Ends in 30 Days: today..30 days ahead; ended or missing never counts', () => {
  assert.equal(matchesChip(end('2026-10-07'), 'end30'), true, 'ends today');
  assert.equal(matchesChip(end('2026-11-06'), 'end30'), true, 'day 30');
  assert.equal(matchesChip(end('2026-11-07'), 'end30'), false, 'day 31');
  assert.equal(matchesChip(end('2026-10-06'), 'end30'), false, 'already ended');
  assert.equal(matchesChip(end(null), 'end30'), false);
  assert.equal(matchesChip(end('2026-10-20T00:00:00.000Z'), 'end30'), true, 'timestamps are sliced');
});

test('CC4: Renewed = board status Passed, whether the old term ended or not', () => {
  assert.equal(matchesChip(row({ renewal: renewalState('Passed') }), 'renewed'), true);
  assert.equal(matchesChip(row({ renewal: renewalState('Failed') }), 'renewed'), false);
  assert.equal(matchesChip(row({ renewal: renewalState(null) }), 'renewed'), false);
});

test('CC5: chipCounts and applyChip agree; null chip shows every row', () => {
  const rows = [ms(3), ms(20), ms(45), end('2026-10-20'), row({ renewal: 'renewed' })];
  assert.deepEqual(chipCounts(rows), { ms14: 1, ms30: 2, end30: 1, renewed: 1 });
  assert.equal(applyChip(rows, null).length, rows.length);
  for (const c of ['ms14', 'ms30', 'end30', 'renewed'] as const) {
    assert.equal(applyChip(rows, c).length, chipCounts(rows)[c], c);
  }
  assert.deepEqual(chipCounts([]), { ms14: 0, ms30: 0, end30: 0, renewed: 0 });
});

test('CC6: labels — "in N days" and tenure "11 mo" / "New"', () => {
  assert.equal(inDaysLabel(0), 'Today');
  assert.equal(inDaysLabel(1), 'in 1 day');
  assert.equal(inDaysLabel(6), 'in 6 days');
  assert.equal(tenureDisplay(tenureLabel('2025-10-13', TODAY)), '11 mo');
  assert.equal(tenureDisplay(tenureLabel('2026-07-20', TODAY)), '2 mo');
  assert.equal(tenureDisplay(tenureLabel('2026-10-06', TODAY)), 'New');
  assert.equal(tenureDisplay('1y'), '1 yr');
  assert.equal(tenureDisplay('2y 5m'), '2 yr 5 mo');
  assert.equal(tenureDisplay(null), '');
});
