import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { missingEvent, refusalReason, showBulkBar } from '../src/app/pages/action-required/arLogic.ts';
import { isValidTimeInput } from '../src/app/lib/parseTimeInput.ts';

// AG1-AG4 (2026-09-25, AR-3): Saul's notes — "55:00 PM" could be committed, an
// impact picked before its event gave no feedback, and the bulk bar showed for
// one-offs. Editing a row also silently selected it, so the next dropdown change
// broadcast to rows touched earlier.
const blank = { entry_time: '9:00 AM', exit_time: '5:00 PM', event_type_1: '', pay_impact_1: '', event_type_2: '', pay_impact_2: '' };

test('AG1: an impact without its event is caught, slot by slot', () => {
  assert.equal(missingEvent(blank), null);
  assert.equal(missingEvent({ ...blank, pay_impact_1: 'Paid' }), 1);
  assert.equal(missingEvent({ ...blank, event_type_1: 'Tardanza', pay_impact_1: 'Paid', pay_impact_2: 'Paid' }), 2);
  assert.equal(missingEvent({ ...blank, event_type_1: 'Tardanza' }), null);
});

test('AG2: impossible times and event-less impacts refuse the commit, with a reason', () => {
  assert.equal(refusalReason(blank, isValidTimeInput), null);
  assert.equal(refusalReason({ ...blank, entry_time: '55:00 PM' }, isValidTimeInput), 'Entry or Exit is not a real time');
  assert.equal(refusalReason({ ...blank, exit_time: '9:75' }, isValidTimeInput), 'Entry or Exit is not a real time');
  assert.equal(refusalReason({ ...blank, entry_time: '', exit_time: '' }, isValidTimeInput), null);
  assert.equal(refusalReason({ ...blank, pay_impact_1: 'Paid – Exception' }, isValidTimeInput), 'Pick an event first');
});

test('AG3: the bulk bar is for 2 or more rows', () => {
  assert.equal(showBulkBar(0), false);
  assert.equal(showBulkBar(1), false);
  assert.equal(showBulkBar(2), true);
});

test('AG4: editing no longer selects the row; the page wires the one-row Commit', () => {
  const page = readFileSync('src/app/pages/ActionRequired.tsx', 'utf8');
  const edit = page.slice(page.indexOf('const setEditField'), page.indexOf('const allRows'));
  assert.doesNotMatch(edit, /setSelected/);
  assert.match(page, /canCommitOne=/);
  assert.match(page, /showBulkBar\(selectedCount\)/);
  const hook = readFileSync('src/app/pages/action-required/useArCommit.ts', 'utf8');
  assert.match(hook, /refusalReason\(getEdit\(row\), isValidTimeInput\)/);
});

// AG5 (2026-09-25, code review, pre-existing bug): with rows A and B selected and B
// hidden by the search or the tab, an Event change on A built B's draft from A's
// row — copying A's punch times and notes into B, which a commit then saved.
test('AG5: bulk edits reach only visible selected rows, each from its own data', () => {
  const page = readFileSync('src/app/pages/ActionRequired.tsx', 'utf8');
  assert.match(page, /Array\.from\(selected\)\.filter\(t => t === id \|\| visibleIds\.has\(t\)\)/);
  assert.match(page, /const rowMap = new Map\(\(rows as EntryRow\[\]\)\.map\(r => \[r\.id, r\]\)\);/);
  assert.match(page, /const trow = tid === id \? row : rowMap\.get\(tid\);\s*if \(!trow\) continue;/);
});

// AG6 (code review): while data refreshes, stale rows are dimmed and unclickable.
test('AG6: Action Required and Payroll Master block clicks while refreshing', () => {
  const page = readFileSync('src/app/pages/ActionRequired.tsx', 'utf8');
  const pm = readFileSync('src/app/pages/PayrollMaster.tsx', 'utf8');
  assert.match(page, /loading \? 'opacity-60 pointer-events-none' : ''/);
  assert.match(pm, /loading \? 'opacity-60 pointer-events-none' : ''/);
});

// AG7 (code review): one failed row must not stop or silence the rest.
test('AG7: each row is saved in its own try, failures reach the toast', () => {
  const hook = readFileSync('src/app/pages/action-required/useArCommit.ts', 'utf8');
  assert.match(hook, /try \{\s*const res = await saveRow\(row\);/);
  assert.match(hook, /Save failed, please try again:/);
  assert.match(hook, /setHiddenIds\(prev => \(prev\.size \? new Set\(\) : prev\)\)/);
});
