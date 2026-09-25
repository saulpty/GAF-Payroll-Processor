import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ── RS1-RS3: Roster Save must edit by id, never insert by email ────────────────
// 2026-09-25: changing Jeanine Puyol's email on the Roster inserted a second
// employee, because Save always ran upsertEmployee (ON CONFLICT teramind_email).
// Cleaned up by migration 1782014000; fixed by prompt 03.

const roster = readFileSync('src/app/pages/admin/employees/RosterTab.tsx', 'utf8');
const update = readFileSync('src/actions/updateEmployee.ts', 'utf8');

test('RS1: updateEmployee updates by id and never inserts', () => {
  assert.match(update, /UPDATE employees SET/);
  assert.match(update, /WHERE id = \{\{params\.id\}\}::bigint/);
  assert.doesNotMatch(update, /INSERT/i);
  assert.match(update, /assert_super/);
});

test('RS2: Roster edits call updateEmployee when the row has an id', () => {
  assert.match(roster, /import updateEmployeeAction from '@\/actions\/updateEmployee'/);
  assert.match(roster, /typeof editing\.id === 'number'[\s\S]{0,80}updateEmp\(/);
});

test('RS3: Roster refuses an email that belongs to someone else', () => {
  assert.match(roster, /already belongs to/);
  assert.match(roster, /e\.id !== editing\.id/);
});
