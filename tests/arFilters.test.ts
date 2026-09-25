import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterByEvent, NEEDS_EVENT } from '../src/app/pages/action-required/arLogic.ts';

// AF1-AF3 (2026-09-25, AR-5/AR-6): "you can't sort or filter between events";
// Committed section in the same Warm look, Title Case, readable dates.
const rows = [
  { id: 1, e: ['Tardanza', ''] as [string, string] },
  { id: 2, e: ['', ''] as [string, string] },
  { id: 3, e: ['Salida Temprano', 'Tardanza'] as [string, string] },
  { id: 4, e: ['Incapacidad', ''] as [string, string] },
];
const ids = (f: string) => filterByEvent(rows, f, r => r.e).map(r => r.id);

test('AF1: event filter matches Event 1 or Event 2; blank shows all', () => {
  assert.deepEqual(ids(''), [1, 2, 3, 4]);
  assert.deepEqual(ids('Tardanza'), [1, 3]);
  assert.deepEqual(ids('Incapacidad'), [4]);
});

test('AF2: Needs an Event = rows with no Event 1', () => {
  assert.deepEqual(ids(NEEDS_EVENT), [2]);
});

test('AF3: page wiring and the Committed section look', () => {
  const page = readFileSync('src/app/pages/ActionRequired.tsx', 'utf8');
  const done = readFileSync('src/app/pages/action-required/ArCommitted.tsx', 'utf8');
  assert.match(page, /filterByEvent\(tabRows, eventFilter, eventsOf\)/);
  assert.match(page, /<ArToolbar /);
  assert.match(done, /Committed to Green/);
  assert.doesNotMatch(done, /Committed to GREEN|className=[^>]*uppercase/);
  assert.match(done, /fmtDay\(r\.work_date\.slice\(0, 10\), THIS_YEAR\)/);
});
