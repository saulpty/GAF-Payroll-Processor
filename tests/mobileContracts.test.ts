// 2026-10-13 — phone view M9: Contracts as rows
// (prompt 2026-10-13-mobile-rows/11-contracts-rows.md). Lives in tests/ once the prompt is sent.
//
// MC1-MC4: source guards (the computer's table is untouched; the rows only exist on a phone).
// MC5-MC10: the pure words the rows show (src/app/lib/contractChips.ts), checked against the
// table's own cells so the two cannot drift apart.
//
// WHEN THIS PROMPT IS SENT: tests/mobileDialogs.test.ts MD1 pins ContractsTable.tsx to its
// 2026-10-13 text and will fail, by design, because this prompt edits that file. In that test's
// BEFORE table replace the CONTRACTS_TABLE hash with
//   3353abc6fb0913f2e8c0006183e720efaf1685aca3a153e1031b88d18ce0ac77
// (the file after this prompt, phone: classes taken out). MC1 below keeps the stronger promise:
// take this prompt's additions back out and the file is the 2026-10-13 one, byte for byte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  MILESTONE_LABELS, milestoneLines, nextMilestoneLine, contractEndView, noMatchLine, inDaysLabel,
} from '../src/app/lib/contractChips.ts';
import type { EndRow } from '../src/app/lib/contractChips.ts';
import { milestones, nextMilestone, contractEndState, renewalState } from '../src/app/lib/tenure.ts';
import { fmtDay } from '../src/app/lib/fmtDay.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const count = (hay: string, re: RegExp) => (hay.match(re) ?? []).length;

const DIR = 'src/app/pages/contracts/';
const TABLE = DIR + 'ContractsTable.tsx';
const ROWS = DIR + 'ContractRows.tsx';
const CHIPS = DIR + 'ContractsChips.tsx';
const CELLS = DIR + 'ContractCells.tsx';
const ROW = DIR + 'ContractRow.tsx';
const LIB = 'src/app/lib/contractChips.ts';

// ContractsTable.tsx on 2026-10-13 with its phone: classes taken out (the hash MD1 used).
const TABLE_BEFORE = '6022d7a895f9f50f6267facf190de9492f5d5652e180414240875da8194bae36';
// ContractCells.tsx on 2026-10-13 with the word `export ` taken off the start of every line.
const CELLS_BEFORE = 'd6898a542b29db8b8ec757cd7330942a8271c36ca0fe099c78cbe086a59a0256';
const ROW_BEFORE = 'fc9a49684433b3b253c8818508fe070910ff15c02d9fb5d6dd4f0ab2a6bbfb4f';
// contractChips.ts on 2026-10-13: the new functions are appended after this text.
const LIB_BASE_CHARS = 2801;
const LIB_BASE = '9f5e38d2336158c5f03b78ae4fd9a06c7604789cd0d410bc064b98be21d9ddf8';

const withoutPhone = (src: string) =>
  src.replace(/className="([^"]*)"/g, (_m, classes: string) =>
    `className="${classes.split(/\s+/).filter(c => c && !c.startsWith('phone:')).join(' ')}"`);

/** Takes one addition back out; it must be there exactly once. */
function undo(src: string, added: RegExp, put: string, what: string): string {
  assert.equal(count(src, new RegExp(added.source, 'g')), 1, `ContractsTable: expected exactly one ${what}`);
  return src.replace(added, put);
}

test('MC1: the computer keeps its table — without this prompt\'s additions ContractsTable is the 2026-10-13 file', () => {
  let src = read(TABLE);
  src = undo(src, /import ContractRows, \{ ContractRowsLoading \} from '\.\/ContractRows';\n/, '', 'ContractRows import');
  src = undo(src, /import \{ useIsPhone \} from '@\/app\/lib\/useIsPhone';\n/, '', 'useIsPhone import');
  src = undo(src, /  const isPhone = useIsPhone\(\);\n/, '', 'useIsPhone() call');
  src = undo(src, /  if \(loading && isPhone\) return <ContractRowsLoading \/>;\n\n/, '', 'phone loading line');
  src = undo(src, /      \{isPhone \? \(\s*<ContractRows\b[^<>]*\/>\s*\) : \(\n(?=      <DataTable\n)/, '', 'phone branch opening');
  src = undo(src, /(      <\/DataTable>\n)\s*\)\}\n/, '$1', 'phone branch closing');
  assert.equal(sha(withoutPhone(src)), TABLE_BEFORE,
    'something other than the phone branch changed in ContractsTable.tsx (the DataTable block must stay byte for byte)');
});

test('MC2: one switch, read once: rows on a phone, the table otherwise, never both', () => {
  const src = read(TABLE);
  assert.equal(count(src, /useIsPhone\(\)/g), 1, 'useIsPhone() is called once');
  const hook = src.indexOf('const isPhone = useIsPhone();');
  assert.ok(hook > 0 && hook < src.indexOf('if (loading'), 'the hook comes before the early returns');
  assert.equal(count(src, /<ContractRows\b/g), 1, 'ContractRows is rendered in one place');
  assert.equal(count(src, /<DataTable\b/g), 1, 'the DataTable branch is still there, once');
  const branch = /\{isPhone \? \(\s*<ContractRows\b([^<>]*)\/>\s*\) : \(\s*<DataTable\b[\s\S]*<\/DataTable>\s*\)\}/.exec(src);
  assert.ok(branch, 'ContractRows is the phone side of `isPhone ? … : <DataTable …>`');
  // The same list the table maps over: sorted (soonest event first), filtered, chip applied.
  assert.match(branch[1], /\brows=\{shown\}/, 'the rows get `shown`, the list the table renders');
  assert.match(src, /shown\.map\(row => \(\s*<ContractRow key=/, 'the table still maps the same list');
  assert.match(branch[1], /\bchip=\{chip\}/);
  assert.match(branch[1], /\bthisYear=\{thisYear\}/);
  // The chips sit above both branches, not inside the switch.
  assert.ok(src.indexOf('<ContractsChips') < src.indexOf('{isPhone ? ('), 'chips stay outside the switch');
  // Placeholder rows only while loading on a phone; the computer keeps its spinner.
  assert.equal(count(src, /ContractRowsLoading \/>/g), 1);
  assert.match(src, /if \(loading && isPhone\) return <ContractRowsLoading \/>;\s*if \(loading\) \{/);
  assert.match(src, /<Loader2 className="w-5 h-5 animate-spin mr-2" \/>/);
});

test('MC3: no new data — one loader call, flat params, and the rows file loads nothing', () => {
  const table = read(TABLE);
  assert.equal(count(table, /useLoadAction\(/g), 1);
  assert.match(table, /\{ manager: manager \|\| null, employeeId: null, viewAs \}/, 'params stay flat');
  const rows = read(ROWS);
  assert.doesNotMatch(rows, /useLoadAction|useMutateAction|@\/actions\//, 'ContractRows draws what it is given');
  assert.doesNotMatch(rows, /lib\/useIsPhone'|useIsPhone\(\);/, 'the switch is read once, in ContractsTable');
  for (const f of [ROWS, LIB]) {
    assert.doesNotMatch(read(f), /new Date\(|Date\.now|toISOString/, `${f}: dates stay YYYY-MM-DD strings`);
  }
});

test('MC4: the table\'s cells are not edited; the rows reuse MobileRow and the shared words', () => {
  assert.equal(sha(read(CELLS).replace(/^export /gm, '')), CELLS_BEFORE,
    'ContractCells.tsx may gain an `export` keyword at most');
  assert.equal(sha(read(ROW)), ROW_BEFORE, 'ContractRow.tsx is not part of this prompt');
  const lib = read(LIB);
  assert.equal(sha(lib.slice(0, LIB_BASE_CHARS)), LIB_BASE, 'contractChips.ts: the existing text changed; the edit may only append');

  const rows = read(ROWS);
  assert.match(rows, /import MobileRow from '@\/app\/components\/mobile\/MobileRow';/);
  for (const fn of ['contractEndView(', 'nextMilestoneLine(', 'milestoneLines(', 'noMatchLine(', 'tenureDisplay(', 'fmtDay(']) {
    assert.ok(rows.includes(fn), `ContractRows uses ${fn}…) instead of deciding again`);
  }
  assert.doesNotMatch(rows, /days\s*<=?\s*\d/, 'day thresholds live in contractChips.ts, not in the rows');
  // A phone has no hover: nothing may sit in a title attribute, and it is rows, not a table.
  assert.doesNotMatch(rows, /\btitle=["{](?!row\.display_name)/, 'no hover titles on a phone (MobileRow\'s own title prop aside)');
  assert.doesNotMatch(rows, /<(?:table|thead|tbody|tr|td|th)\b/);
  // The row is one button (MobileRow). Nothing tappable may be nested in it.
  assert.doesNotMatch(rows, /<(?:button|a|Link)\b/, 'no button or link inside a row');
  assert.match(rows, /chevron=\{isOpen \? 'up' : 'down'\}/, 'opens in place: down / up chevron');
  assert.match(rows, /expanded=\{isOpen\}/);
  assert.match(rows, /\{isOpen && <Detail\b/, 'the detail is only rendered while the row is open');
  // Nothing below 12px on a phone.
  assert.doesNotMatch(rows, /text-\[(?:[0-9]|1[01])px\]/, 'type floor is 12px');
  // The chip names come from the chips themselves, so the empty line cannot misname one.
  assert.match(read(CHIPS), /^export const CHIPS: /m);
  assert.match(rows, /import \{ CHIPS \} from '\.\/ContractsChips';/);
});

// ── The words ────────────────────────────────────────────────────────────────────────────────

const TODAY = '2026-10-12';
const day = (d: string) => fmtDay(d, '2026');
const endRow = (end: string | null, status: string | null = null, onBoard = true): EndRow => ({
  has_board_row: onBoard,
  end,
  next: null,
  endState: contractEndState(end, TODAY),
  renewal: renewalState(status),
});
const view = (end: string | null, status: string | null = null, onBoard = true) =>
  contractEndView(endRow(end, status, onBoard), fmtDay(end, '2026'));

test('MC5: the next milestone in words — "6 Months · Mon Oct 19 · in 7 days"', () => {
  const next = nextMilestone('2026-04-19', TODAY);
  assert.deepEqual(next, { key: '6m', date: '2026-10-19', days: 7 });
  const line = nextMilestoneLine(next, day);
  assert.deepEqual(line, {
    lead: '6 Months · Mon Oct 19', when: 'in 7 days', soon: true, text: '6 Months · Mon Oct 19 · in 7 days',
  });
  // Day 14 is still "soon" (the table's yellow box); day 15 is not.
  assert.equal(nextMilestoneLine({ key: '1y', date: '2026-10-26', days: 14 }, day)?.soon, true);
  assert.equal(nextMilestoneLine({ key: '1y', date: '2026-10-27', days: 15 }, day)?.soon, false);
  // Today, tomorrow, and a date in another year (fmtDay adds the year).
  assert.equal(nextMilestoneLine({ key: '1m', date: TODAY, days: 0 }, day)?.text, '1 Month · Mon Oct 12 · Today');
  assert.equal(nextMilestoneLine({ key: '3m', date: '2026-10-13', days: 1 }, day)?.text, '3 Months · Tue Oct 13 · in 1 day');
  assert.equal(nextMilestoneLine(nextMilestone('2026-01-15', TODAY), day)?.text, '1 Year · Fri Jan 15, 2027 · in 95 days');
  // All five passed, or no start date: nothing to say.
  assert.equal(nextMilestoneLine(nextMilestone('2020-01-01', TODAY), day), null);
  assert.equal(nextMilestoneLine(null, day), null);
});

test('MC6: all five milestones with their state, as the table decides it', () => {
  const start = '2026-04-19';
  const lines = milestoneLines(milestones(start), nextMilestone(start, TODAY));
  assert.deepEqual(lines.map(l => [l.label, l.date, l.state, l.days, l.soon]), [
    ['1 Month', '2026-05-19', 'done', null, false],
    ['3 Months', '2026-07-19', 'done', null, false],
    ['6 Months', '2026-10-19', 'next', 7, true],
    ['1 Year', '2027-04-19', 'later', null, false],
    ['2 Years', '2028-04-19', 'later', null, false],
  ]);
  // A milestone that falls today is the next one, not a done one.
  const today = milestoneLines(milestones('2026-09-12'), nextMilestone('2026-09-12', TODAY));
  assert.deepEqual(today.map(l => l.state), ['next', 'later', 'later', 'later', 'later']);
  assert.equal(today[0].days, 0);
  // Long tenure: all five done. Far-off next one: not "soon".
  const old = milestoneLines(milestones('2020-01-01'), nextMilestone('2020-01-01', TODAY));
  assert.deepEqual(old.map(l => l.state), ['done', 'done', 'done', 'done', 'done']);
  const far = milestoneLines(milestones('2026-10-01'), nextMilestone('2026-10-01', TODAY));
  assert.deepEqual([far[0].state, far[0].days, far[0].soon], ['next', 20, false]);
  // No start date: no lines (the row says so in words).
  assert.deepEqual(milestoneLines(null, null), []);
  // Exactly one "next" whenever there is a next milestone, for a spread of start dates.
  for (const s of ['2024-10-13', '2025-10-12', '2026-04-12', '2026-07-12', '2026-09-30', '2026-10-12']) {
    const n = nextMilestone(s, TODAY);
    const ls = milestoneLines(milestones(s), n);
    assert.equal(ls.filter(l => l.state === 'next').length, n ? 1 : 0, s);
    assert.equal(ls.length, 5, s);
  }
});

test('MC7: Contract End on a contract still running — red to 30 days, yellow to 60, plain after', () => {
  assert.deepEqual(view('2026-10-22'), {
    pill: 'Thu Oct 22 · in 10 days', tone: 'red', second: null, note: '', explain: '', wash: 'red',
  });
  assert.equal(view(TODAY)?.pill, 'Mon Oct 12 · Today');
  assert.deepEqual([view('2026-11-11')?.tone, view('2026-11-11')?.wash], ['red', 'red'], 'day 30');
  assert.deepEqual([view('2026-11-12')?.tone, view('2026-11-12')?.wash], ['yellow', 'yellow'], 'day 31');
  assert.deepEqual([view('2026-12-11')?.tone, view('2026-12-11')?.wash], ['yellow', 'yellow'], 'day 60');
  // Day 61 on: a plain date, no pill, no wash, and no "in N days".
  assert.deepEqual(view('2026-12-12'), {
    pill: 'Sat Dec 12', tone: 'none', second: null, note: '', explain: '', wash: 'none',
  });
  assert.equal(view('2027-03-01')?.pill, 'Mon Mar 1, 2027');
  // The board's decision on a contract that has not ended yet is a second pill.
  assert.deepEqual(view('2026-10-22', 'Passed')?.second, { text: 'Renewed', tone: 'green' });
  assert.deepEqual(view('2026-10-22', 'Failed')?.second, { text: 'Not Renewed', tone: 'red' });
  assert.equal(view('2027-03-01', 'Passed')?.tone, 'none');
  // Postgres timestamps are sliced by tenure.ts and fmtDay; the words are the same.
  assert.equal(contractEndView(endRow('2026-10-22T00:00:00.000Z'), fmtDay('2026-10-22T00:00:00.000Z', '2026'))?.pill,
    'Thu Oct 22 · in 10 days');
});

test('MC8: Contract End on a term that has ended — renewed, not renewed, pending review', () => {
  assert.deepEqual(view('2026-10-05', 'Passed'), {
    pill: 'Renewed · was Mon Oct 5', tone: 'green', second: null, note: '',
    explain: 'Board status Passed. Fixed term ended on Mon Oct 5.', wash: 'none',
  });
  assert.deepEqual(view('2026-10-05', 'Failed'), {
    pill: 'Not Renewed', tone: 'red', second: null, note: 'ended Mon Oct 5',
    explain: 'Board status Failed — still on the active roster.', wash: 'none',
  });
  assert.deepEqual(view('2026-10-05'), {
    pill: 'Pending Review', tone: 'yellow', second: null, note: 'ended Mon Oct 5',
    explain: 'Fixed term ended and the board has no renewal decision yet.', wash: 'yellow',
  });
  assert.equal(view('2025-10-06', 'passed')?.pill, 'Renewed · was Mon Oct 6, 2025', 'another year is written out');
  // The table's dash: no end date, or not on the Onboarding board at all.
  assert.equal(view(null), null);
  assert.equal(view(''), null);
  assert.equal(view('2026-10-22', null, false), null);
});

test('MC9: the rows\' words are the table\'s words (ContractCells.tsx and the column headers)', () => {
  const cells = read(CELLS);
  // Thresholds.
  assert.match(cells, /if \(days <= 30\) main = /);
  assert.match(cells, /else if \(days <= 60\) main = /);
  const lib = read(LIB).slice(LIB_BASE_CHARS);
  assert.match(lib, /days <= 30 \? 'red' : days <= 60 \? 'yellow' : 'none'/);
  // Pill words and the three hover sentences, compared as text with the table's cell.
  const ended = (status: string | null) => view('2026-10-05', status)!;
  assert.ok(cells.includes('>Renewed · was {day}<'));
  assert.ok(cells.includes('title={`Board status Passed. Fixed term ended on ${day}.`}'));
  assert.ok(cells.includes(`title="${ended('Failed').explain}"`), 'Not Renewed sentence');
  assert.ok(cells.includes(`title="${ended(null).explain}"`), 'Pending Review sentence');
  assert.ok(cells.includes(`>${ended('Failed').pill}<`));
  assert.ok(cells.includes(`>${ended(null).pill}<`));
  assert.equal(count(cells, />ended \{day\}</g), 2, 'the "ended …" line under Not Renewed and Pending Review');
  assert.ok(cells.includes('const label = `${day} · ${inDaysLabel(days)}`;'));
  assert.equal(view('2026-10-22')!.pill, `${day('2026-10-22')} · ${inDaysLabel(10)}`);
  // Milestone names are the table's column headers; the keys are tenure.ts's.
  const table = read(TABLE);
  assert.deepEqual(Object.keys(MILESTONE_LABELS), milestones('2026-01-01').map(m => m.key));
  for (const label of Object.values(MILESTONE_LABELS)) {
    assert.match(table, new RegExp(`label: '${label}'`), `column header ${label}`);
  }
  assert.match(cells, /const isPast = next \? m\.date < next\.date : true;/);
  assert.match(cells, /const isNext = next\?\.key === m\.key;/);
});

test('MC10: an empty list names what is narrowing it', () => {
  const none = { employee: '', role: '', manager: '' };
  assert.equal(noMatchLine(null, none), 'No employees to show.');
  assert.equal(noMatchLine('Milestone in 14 Days', none), 'No employees match Milestone in 14 Days');
  assert.equal(noMatchLine(null, { ...none, role: 'Intake 1' }), 'No employees match Title: Intake 1');
  assert.equal(noMatchLine(null, { ...none, employee: 'ana' }), 'No employees match Employee: ana');
  assert.equal(
    noMatchLine('Renewed', { employee: 'ana', role: 'Intake 1', manager: 'Maria Lopez' }),
    'No employees match Renewed · Employee: ana · Manager: Maria Lopez · Title: Intake 1',
  );
  assert.equal(noMatchLine(null, {}), 'No employees to show.');
  // Every chip the page has can be named.
  const labels = [...read(CHIPS).matchAll(/key: '(\w+)',\s+label: '([^']+)'/g)].map(m => m[2]);
  assert.deepEqual(labels, ['Milestone in 14 Days', 'Milestone in 30 Days', 'Contract Ends in 30 Days', 'Renewed']);
});

test('MC11: the chips keep every class the computer had; only phone: classes (and no-scrollbar) are added', () => {
  const src = read(CHIPS);
  const kept = (original: string, where: string) => {
    const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    const extra = "(?: (?:phone:[^\\s\"`]+|no-scrollbar))*";
    const re = new RegExp(original.split(' ').map(esc).join(extra + ' ') + extra + '(?=["` ])');
    const m = re.exec(src);
    assert.ok(m, `${where}: the computer's classes must stay, in order`);
    return m[0].split(' ');
  };
  const line = kept('flex flex-wrap items-center gap-2 px-6 pb-3', 'chip line');
  kept('inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-primary', 'employee count');
  const chip = kept('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring', 'chip');
  // The taller hit area is drawn outside the pill, so the line needs at least that much room
  // above it or the line's own scrolling would clip it. Both numbers are Tailwind steps (x 4px).
  const step = (classes: string[], re: RegExp, what: string) => {
    const hit = classes.map(c => re.exec(c)).find(Boolean);
    assert.ok(hit, what);
    return Number(hit[1]);
  };
  const reach = step(chip, /^phone:before:-inset-y-([\d.]+)$/, 'chip: a hit area that reaches past the pill');
  const room = step(line, /^phone:pt-([\d.]+)$/, 'chip line: room above the chips');
  // The pill is 24px tall with a 1px border; the hit area is measured from inside the border.
  assert.ok(22 + reach * 4 * 2 >= 44, `22px inside the pill's border plus ${reach * 4}px each side is under 44px`);
  assert.ok(room >= reach, 'the room above the chips must cover the hit area');
  assert.ok(3 >= reach, 'pb-3 below the chips must cover the hit area');
  // Still toggles.
  assert.match(src, /aria-pressed=\{active === c\.key\}/);
  assert.match(src, /onClick=\{\(\) => onToggle\(c\.key\)\}/);
  assert.doesNotMatch(src, /\b(?:sm|md|max-md|max-sm|min-\[[^\]]+\]|max-\[[^\]]+\]):/, 'use phone:, never a width breakpoint');
});

test('MC12: every file this prompt writes stays under 15 KB; the lib still imports types only', () => {
  for (const f of [ROWS, TABLE, CHIPS, LIB]) {
    const size = Buffer.byteLength(readFileSync(new URL(`../${f}`, import.meta.url)));
    assert.ok(size < 15000, `${f} is ${size} bytes`);
  }
  for (const i of read(LIB).match(/^import .*$/gm) ?? []) assert.match(i, /^import type /, `lib import must be type-only: ${i}`);
  for (const f of [ROWS, TABLE, CHIPS]) {
    assert.doesNotMatch(read(f), /window\.location\.reload|history\.(?:pushState|replaceState)/, f);
    assert.doesNotMatch(read(f), /className="[^"]*\b(?:sm|md|max-md|max-sm):/, `${f}: use phone:, not a width breakpoint`);
  }
});
