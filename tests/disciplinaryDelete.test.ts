// Disciplinary soft delete (2026-09-16). Super users delete with a required reason and can
// restore. Deleted actions must never reach managers, the due badge, or the normal list.
// Structural guards in the lessonGuards style: they read the source, not the database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

test('DD1: the list loader only returns deleted rows when asked (super users)', () => {
  const q = src('actions/loadDisciplinaryActions.ts');
  assert.match(q, /deleted_at IS NULL/);
  assert.match(q, /params\.includeDeleted/);
  assert.match(src('app/pages/disciplinary/DisciplinaryTable.tsx'), /includeDeleted:\s*isDisciplinaryAdmin/);
});

test('DD2: the top-bar due badge ignores deleted actions', () => {
  assert.match(src('actions/loadDisciplinaryDueCount.ts'), /deleted_at IS NULL/);
});

test('DD3: delete is guarded against a second click; restore clears only the deletion columns', () => {
  const del = src('actions/updateDisciplinaryActionDeleted.ts');
  assert.match(del, /AND deleted_at IS NULL/);
  const res = src('actions/updateDisciplinaryActionRestored.ts');
  assert.match(res, /deleted_at\s*=\s*NULL/);
  assert.doesNotMatch(res, /closed_at/);
});

// Since 2026-09-24 Delete, Restore and the Deleted filter belong to disciplinary
// admins (Tim and Saul, the disciplinary_admins table), not every super user.
// The detailed gate checks are DE9/DE10 in disciplinaryEdit.test.ts.
test('DD4: the delete dialog requires a reason; Delete and Restore are disciplinary-admin only', () => {
  const dlg = src('app/pages/disciplinary/DeleteActionDialog.tsx');
  assert.match(dlg, /note\.trim\(\) !== ''/);
  assert.match(dlg, /disabled=\{saving \|\| !valid\}/);
  const detail = src('app/pages/disciplinary/ActionDetail.tsx');
  assert.match(detail, /useDisciplinaryAdmin\(/);
  const page = src('app/pages/Disciplinary.tsx');
  assert.match(page, /useDisciplinaryAdmin\(/);
  assert.doesNotMatch(page, /isSuper \? \[\{ value: 'deleted'/);
});
