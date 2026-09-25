import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// UN1-UN2 (2026-09-25, code review #6): "Undo" after a commit only moved the row back
// to Action Required with the committed choices; punch times edited before the
// commit stayed edited. Undo now restores the row exactly as it was loaded.
const save = readFileSync('src/app/pages/action-required/useArSave.ts', 'utf8');
const hook = readFileSync('src/app/pages/action-required/useArCommit.ts', 'utf8');
const page = readFileSync('src/app/pages/ActionRequired.tsx', 'utf8');

test('UN1: restoreRow writes the original times, minutes and fields back', () => {
  const body = save.slice(save.indexOf('const restoreRow'), save.indexOf('return { saveRow'));
  assert.match(body, /await updateTimes\(\{[\s\S]*entry_time: o\.entry_time, exit_time: o\.exit_time,[\s\S]*late_minutes: o\.late_minutes/);
  assert.match(body, /payroll_ready: o\.payroll_ready, status_current: o\.status_current/);
});

test('UN2: the toast Undo uses restoreRow with the pre-commit rows', () => {
  assert.match(hook, /try \{ await restoreRow\(r\); moved\+\+; \}/);
  assert.match(hook, /green\.push\(row\);/);
  assert.match(page, /const \{ saveRow, revertRow, restoreRow \} = useArSave\(getEdit\);/);
  assert.match(page, /useArCommit\(\{ rows, getEdit, saveRow, revertRow, restoreRow,/);
});

// UN3 (code review #4): the entry is restored before the times, so a half-failed Undo
// leaves the row back in Action Required rather than green with old minutes.
test('UN3: restoreRow writes the entry first, then the times', () => {
  const body = save.slice(save.indexOf('const restoreRow'), save.indexOf('return { saveRow'));
  assert.ok(body.indexOf('await updateEntry(') < body.indexOf('await updateTimes('));
});
