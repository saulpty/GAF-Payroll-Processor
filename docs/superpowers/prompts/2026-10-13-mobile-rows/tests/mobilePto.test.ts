// 2026-10-13 — phone view M8: PTO Tracker as rows (prompt 2026-10-13-mobile-rows/10-pto-rows.md).
// Source guards plus unit tests for the pure helpers in ptoPhone.ts. Lives in tests/ once the
// prompt is sent.
//
// WHEN THIS PROMPT IS SENT, tests/mobileDialogs.test.ts needs one line changed: MD1 pins
// PtoTable.tsx to its 2026-10-13 text, and this prompt edits that file. Its BEFORE[PTO_TABLE]
// becomes '9aaf7cf715c6b368f760f9662458bc81baeb9cb4251ef45f277c22e0b5fb9d13' (the file after this
// prompt, phone: classes taken out). MP2 below proves the stronger thing: undo this prompt's six
// edits and PtoTable.tsx is, byte for byte, the file MD1 pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

const PTO = 'src/app/pages/pto/';
const TABLE = PTO + 'PtoTable.tsx';
const BREAKDOWN = PTO + 'PtoBreakdown.tsx';
const COMING = PTO + 'PtoComingUp.tsx';
const ROWS = PTO + 'PtoRows.tsx';
const REQUESTS = PTO + 'PtoRequestRows.tsx';
const HELPERS = 'src/app/lib/ptoPhone.ts';
const NEW_FILES = [ROWS, REQUESTS, HELPERS];
const EDITED = [TABLE, BREAKDOWN, COMING];

// sha256 of files this prompt uses but must not edit, as they were on 2026-10-13 (LF line endings).
const UNTOUCHED: Record<string, string> = {
  [PTO + 'RecordApprovalDialog.tsx']: '13e8cd74931a173be0eb60f3b89dcc3964a0ff592153ece69cde08172a6cdddd',
  [PTO + 'PtoVerdictCell.tsx']: '9110ef12655c04ffa4e853c6531fb980ef0c53ca431aac4c81fb23f67285416e',
  [PTO + 'PtoPayrollCell.tsx']: 'df784765dc2af320a249eacde303d9e2f292aebd46730da3930dd0af01ce5b27',
  [PTO + 'PtoSubRow.tsx']: '5392ee1dcb6a92f04d71cb5644ffde055da186530602a6b8579e5e193ef89f1f',
  [PTO + 'PtoRow.tsx']: '081bcfbfba87019981cba6f632f19c5616fe02fd3940d4baaa4ee255b89b8463',
  'src/app/pages/PtoTracker.tsx': 'f859d0130870f9e6d7b86b0d650fae32324360f447609dfb7590a7de2fd22085',
};

// PtoTable.tsx on 2026-10-13 with its phone: classes taken out: the value MD1 pinned.
const TABLE_BEFORE = 'b0f3bfd3634c4772e1b9499933a5158ce635e7d8f4b6146080ff9b56e88d938a';
// The small requests table inside PtoBreakdown.tsx, `<table` to `</table>`, on 2026-10-13.
const BREAKDOWN_TABLE = '8aa9f00159d885ff6c7e240bb8a873b4fcc046b4d489c22eb267584e5e96f7a7';

// Same helper as MD1 in mobileDialogs.test.ts.
const withoutPhone = (src: string) =>
  src.replace(/className="([^"]*)"/g, (_m, classes: string) =>
    `className="${classes.split(/\s+/).filter(c => c && !c.startsWith('phone:')).join(' ')}"`);

/** Removes `text` from `src`; it must be there exactly once. */
function cut(src: string, text: string, put = ''): string {
  assert.equal(count(src, text), 1, `expected exactly once:\n${text}`);
  return src.replace(text, () => put);
}

/** The body of `function name(...) { … }`: from its opening brace to the matching closing one. */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function ${name} not found`);
  let i = src.indexOf('(', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) break;
  }
  const open = src.indexOf('{', i);
  depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(open, j + 1);
  }
  assert.fail(`function ${name}: no closing brace`);
}

test('MP1: on a phone PtoTable draws the rows, everywhere else the table; one of the two, decided once', () => {
  const t = noComments(read(TABLE));
  assert.equal(count(t, 'useIsPhone()'), 1, 'PtoTable asks "is this a phone?" exactly once');
  for (const f of [ROWS, REQUESTS, BREAKDOWN]) {
    assert.doesNotMatch(read(f), /useIsPhone/, `${f}: the page decides, once; nothing below asks again`);
  }
  assert.equal(count(t, '<PtoRows'), 1);
  assert.equal(count(t, '<DataTable'), 1, 'the table branch is still there');
  // <PtoRows is the "yes" arm of a condition that needs isPhone; <DataTable is the final "no" arm.
  assert.match(t, /\{isPhone && !error \? \(\s*<PtoRows\b[^]*?\/>\s*\) : loading && [^?]+\? \(/);
  assert.match(t, /\) : \(\s*<DataTable\b/);
  assert.ok(t.indexOf('<PtoRows') < t.indexOf('<DataTable'));
  // Both are fed the one list that was filtered and sorted above.
  const rowsTag = t.slice(t.indexOf('<PtoRows'), t.indexOf('/>', t.indexOf('<PtoRows')));
  assert.match(rowsTag, /\brows=\{sorted\}/);
  assert.match(t, /sorted\.map\(row => \(\s*<PtoRow\b/);
  // The same callbacks the table hands to PtoBreakdown, nothing new.
  for (const p of ['onOpenDialog={onOpenDialog}', 'onChanged={handleChanged}', 'refreshToken={detailKey}', 'expanded={expanded}', 'onToggle={handleToggle}']) {
    assert.ok(rowsTag.includes(p), `PtoRows is missing ${p}`);
  }
});

test('MP2: undo this prompt\'s six edits and PtoTable.tsx is byte for byte what it was', () => {
  let t = read(TABLE);
  t = cut(t, "import PtoRows from './PtoRows';\n");
  t = cut(t, "import { nothingFoundText } from '@/app/lib/ptoPhone';\nimport { useIsPhone } from '@/app/lib/useIsPhone';\n");
  t = cut(t, '  const isPhone = useIsPhone();\n');
  t = cut(t, ' font-medium transition-colors phone:min-h-11 phone:px-3.5 ${on ?', ' font-medium transition-colors ${on ?');
  const a = t.indexOf('      {/* Rows on a phone, the table everywhere else');
  const marker = '      ) : loading && (rawRows as RawRow[]).length === 0 ? (\n';
  const b = t.indexOf(marker);
  assert.ok(a > 0 && b > a, 'the phone branch sits directly above the loading branch');
  t = t.slice(0, a) + '      {/* Table */}\n      {loading && (rawRows as RawRow[]).length === 0 ? (\n' + t.slice(b + marker.length);
  assert.equal(sha(withoutPhone(t)), TABLE_BEFORE, 'PtoTable.tsx changed somewhere this prompt did not ask for');
});

test('MP3: the files this prompt only uses are byte for byte what they were', () => {
  for (const [path, before] of Object.entries(UNTOUCHED)) {
    assert.equal(sha(read(path)), before, `${path} must not be edited by this prompt`);
  }
});

test('MP4: PtoBreakdown keeps its table and its one loader; the phone gets the same list and handlers', () => {
  const b = read(BREAKDOWN);
  const table = b.slice(b.indexOf('        <table'), b.indexOf('</table>') + '</table>'.length);
  assert.equal(sha(table), BREAKDOWN_TABLE, 'the small requests table changed');
  assert.equal(count(b, 'useLoadAction('), 1, 'no second loader');
  assert.equal(count(b, 'useMutateAction('), 1, 'no second write action');
  assert.match(b, /window\.confirm\(\s*`Withdraw this record\? Days will drop by \$\{itemDays\}\.`/, 'Withdraw still asks first');
  const phone = /if \(phone\) \{\s*return \(\s*<PtoRequestRows\b([^]*?)\/>\s*\);\s*\}/.exec(b);
  assert.ok(phone, 'a phone branch that returns <PtoRequestRows … />');
  for (const p of ['items={items}', 'today={today}', 'onOpenDialog={onOpenDialog}', 'onWithdraw={handleWithdraw}', 'onRestore={handleRestore}']) {
    assert.ok(phone[1].includes(p), `PtoRequestRows is missing ${p}`);
  }
  // The branch comes after the list is built and the handlers exist, and before the table.
  assert.ok(b.indexOf('const handleRestore') < phone.index && phone.index < b.indexOf('<table'));
  assert.match(b, /refreshToken, phone = false \}: Props\)/, 'off unless PtoRows asks for it');
});

test('MP5: the new files load nothing and save nothing themselves', () => {
  for (const f of NEW_FILES) {
    const src = read(f);
    assert.doesNotMatch(src, /useLoadAction|useMutateAction|@\/actions\/|@uibakery\/data/, `${f}: data comes from PtoTable and PtoBreakdown`);
  }
  assert.doesNotMatch(read(HELPERS), /^import /m, 'ptoPhone.ts is imported by plain node tests: no imports');
});

test('MP6: a manager gets no Record, Edit, Withdraw or Restore: every write sits behind isSuper', () => {
  const src = noComments(read(REQUESTS));
  assert.match(src, /const \{ isSuper \} = useViewer\(\);/, 'isSuper comes from the viewer, not from a prop a caller could get wrong');
  assert.doesNotMatch(src, /isSuper\s*[:=]\s*(?:true|boolean)/, 'isSuper is never a prop or a default');

  const actions = fnBody(src, 'RequestActions');
  const detail = fnBody(src, 'SuperDetail');
  const outside = src.replace(actions, '').replace(detail, '');

  // The three callbacks are only ever CALLED inside RequestActions, and the buttons live there.
  for (const call of ['onOpenDialog(', 'onWithdraw(', 'onRestore(']) {
    assert.ok(actions.includes(call), `RequestActions calls ${call}…)`);
    assert.equal(count(src, call), count(actions, call), `${call}…) is called outside RequestActions`);
  }
  assert.equal(count(src, '<Button'), count(actions, '<Button'), 'a button outside RequestActions');
  for (const word of ['Record', 'Edit', 'Withdraw', 'Restore']) {
    assert.match(actions, new RegExp(`>\\s*${word}\\s*</Button>`), `the ${word} button`);
    assert.doesNotMatch(outside, new RegExp(`>\\s*${word}\\s*<`), `${word} is drawn outside RequestActions`);
  }
  // RequestActions is drawn only by SuperDetail; SuperDetail only behind isSuper. Payroll's verdict
  // and evidence are super-only on the computer and stay so here.
  assert.equal(count(src, '<RequestActions'), 1);
  assert.equal(count(detail, '<RequestActions'), 1);
  assert.equal(count(src, '<SuperDetail'), 1);
  assert.match(outside, /\{isSuper && \(\s*<SuperDetail\b/);
  for (const cell of ['<PtoVerdictCell', '<PtoPayrollCell']) {
    assert.equal(count(src, cell), 1);
    assert.equal(count(detail, cell), 1, `${cell} belongs in SuperDetail`);
  }

  // PtoRows: a manager's row opens in place, the sheet is for super users, and it calls no write itself.
  const rows = noComments(read(ROWS));
  assert.match(rows, /const \{ isSuper \} = useViewer\(\);/);
  assert.match(rows, /<MobileSheet\s+open=\{isSuper && sheetRow !== null\}/);
  assert.match(rows, /const open = !isSuper && expanded\.has\(row\.employee_id\);/);
  assert.match(rows, /chevron=\{isSuper \? 'right' : open \? 'up' : 'down'\}/);
  assert.doesNotMatch(rows, /onOpenDialog\(|onWithdraw|onRestore|<Button|<button/);
});

test('MP7: Record follows the table\'s rule and its reason is written out, not left in a mouse-over', () => {
  const src = noComments(read(REQUESTS));
  const actions = fnBody(src, 'RequestActions');
  assert.match(actions, /const rec = recordability\(item\.match, item\.return_on, today, defaultTotalDays\);/);
  assert.match(actions, /disabled=\{!rec\.ok\}/);
  assert.match(actions, /const blocked = recordBlockedText\(rec\.reason\);/);
  assert.match(actions, /\{blocked && \(\s*<p [^>]*>\{blocked\}<\/p>\s*\)\}/);
  assert.doesNotMatch(actions, /\btitle=/, 'nothing an action needs may sit in a mouse-over');
  // Same dialog modes as the table's sub-row.
  const sub = read(PTO + 'PtoSubRow.tsx');
  for (const mode of ["onOpenDialog({ kind: 'record', request: item.request, match: item.match })", "onOpenDialog({ kind: 'edit', row: item.request, match: item.match })", 'onRestore(item.id!)', 'onWithdraw(item.id!, item.days)']) {
    assert.ok(sub.includes(mode) && actions.includes(mode), `same call as the table: ${mode}`);
  }
  assert.match(actions, /\{item\.status === 'recorded' && \(\s*<Button[^]{0,120}?onWithdraw\(/, 'Withdraw only on a recorded row, as on the table');
});

test('MP8: ptoPhone says the same words as the table\'s mouse-overs', async () => {
  const { fhBreakdownText, recordBlockedText, daysLabel } = await import('../src/app/lib/ptoPhone.ts');
  const day = (d: string) => `<${d}>`;
  const base = { fh_left: 1, fh_eligible_from: null, fh_used: 1, fh_allocated: 2, fh_sheet_used: 1 };
  assert.equal(fhBreakdownText(base, day), 'Used 1 of 2 this year · August sheet said 1');
  assert.equal(fhBreakdownText({ ...base, fh_left: 0, fh_used: '2', fh_sheet_used: '0' }, day), 'Used 2 of 2 this year · August sheet said 0');
  // Not eligible yet: the date, through the formatter it was given.
  assert.equal(fhBreakdownText({ ...base, fh_left: 0, fh_eligible_from: '2026-12-14' }, day), 'Eligible <2026-12-14> — 90 days after hire');
  // An eligibility date only matters while nothing is left (the table's rule).
  assert.equal(fhBreakdownText({ ...base, fh_left: 2, fh_used: 0, fh_eligible_from: '2026-12-14' }, day), 'Used 0 of 2 this year · August sheet said 1');
  // Blank numbers fall back the way PtoRow does: used 0, allocated 2, sheet 0.
  assert.equal(fhBreakdownText({ fh_left: 0, fh_eligible_from: null, fh_used: '', fh_allocated: '', fh_sheet_used: '' }, day), 'Used 0 of 2 this year · August sheet said 0');

  assert.equal(recordBlockedText(null), null);
  const sub = read(PTO + 'PtoSubRow.tsx');
  for (const reason of ['future', 'not_processed', 'invalid'] as const) {
    const text = recordBlockedText(reason);
    assert.ok(text && sub.includes(text), `${reason}: must be the sentence PtoSubRow shows on hover, got ${text}`);
  }
  assert.notEqual(recordBlockedText('future'), recordBlockedText('not_processed'));
  const row = read(PTO + 'PtoRow.tsx');
  assert.ok(row.includes('— 90 days after hire') && row.includes('this year · August sheet said'), 'PtoRow still uses these words');

  assert.equal(daysLabel(1), '1 day');
  assert.equal(daysLabel(3), '3 days');
  assert.equal(daysLabel(0.5), '0.5 days');
  assert.equal(daysLabel(0), '0 days');
});

test('MP9: the nothing-found line names every filter that is on', async () => {
  const { nothingFoundText } = await import('../src/app/lib/ptoPhone.ts');
  assert.equal(nothingFoundText({}), 'No employees to show');
  assert.equal(nothingFoundText({ employee: '', role: '', manager: '', chip: null }), 'No employees to show');
  assert.equal(nothingFoundText({ role: 'Intake 1' }), 'No employees match Title: Intake 1');
  assert.equal(nothingFoundText({ employee: ' mar ' }), 'No employees match "mar"');
  // The employee filter can hold an id: never show a bare number.
  assert.equal(nothingFoundText({ employee: '412' }), 'No employees match the chosen employee');
  assert.equal(nothingFoundText({ chip: 'review' }), 'No employees match To Review');
  assert.equal(nothingFoundText({ chip: 'waiting' }), 'No employees match Not Yet');
  assert.equal(
    nothingFoundText({ employee: 'ana', role: 'EVV Specialist', manager: 'Arelis Acosta', chip: 'review' }),
    'No employees match "ana" · Title: EVV Specialist · Manager: Arelis Acosta · To Review',
  );
  // PtoTable passes the chip only for a super user, who is the only one who has chips.
  assert.match(read(TABLE), /emptyText=\{nothingFoundText\(\{ employee, role, manager, chip: isSuper \? chip : null \}\)\}/);
});

test('MP10: dates stay strings, no banned variants, and every file stays under 15 KB', () => {
  for (const f of [...NEW_FILES, ...EDITED]) {
    const src = read(f);
    const size = Buffer.byteLength(readFileSync(new URL(`../${f}`, import.meta.url)));
    assert.ok(size < 15000, `${f} is ${size} bytes`);
    assert.doesNotMatch(src, /window\.location\.reload|history\.(?:pushState|replaceState)/, f);
    assert.doesNotMatch(src, /[\s"'`](?:max|min)-(?:sm|md|lg|xl|2xl|\[[^\]]*\]):/, `${f}: max-*: and min-*: variants do not work in this app`);
    assert.doesNotMatch(src, /[\s"'`](?:sm|md):[a-z[-]/, `${f}: use phone:, not a width breakpoint`);
  }
  for (const f of NEW_FILES) {
    assert.doesNotMatch(read(f), /new Date\(|toISOString|Date\.parse/, `${f}: dates are YYYY-MM-DD strings, formatted with fmtDay`);
  }
  // Coming Up: only its loading line changed, and only for a phone.
  const c = read(COMING);
  assert.equal(count(c, 'phone:'), 1);
  assert.equal(
    cut(c, '<div className="flex gap-2 phone:overflow-hidden" aria-hidden="true">', '<div className="flex gap-2" aria-hidden="true">').length,
    c.length - ' phone:overflow-hidden'.length,
  );
});
