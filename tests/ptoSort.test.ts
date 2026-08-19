import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSortDir, compareValues, sortRows, matchesSearch } from '../src/app/lib/ptoSort.ts';

test('nextSortDir cycles null → asc → desc → null', () => {
  assert.equal(nextSortDir(null), 'asc');
  assert.equal(nextSortDir('asc'), 'desc');
  assert.equal(nextSortDir('desc'), null);
});

test('compareValues: numbers numerically, strings case-insensitively, empties last', () => {
  assert.ok(compareValues(2, 10) < 0);
  assert.ok(compareValues('b', 'A') > 0);
  assert.equal(compareValues('x', 'X'), 0);
  assert.ok(compareValues(null, 'a') > 0);
  assert.ok(compareValues('a', '') < 0);
  assert.ok(compareValues(undefined, 0) > 0);
});

test('sortRows: three-state, stable, empties last in both directions, input untouched', () => {
  const rows = [
    { display_name: 'Bea',  available: 3,    start: '2025-01-01' },
    { display_name: 'Al',   available: null, start: '2024-01-01' },
    { display_name: 'Cy',   available: 1,    start: '2026-01-01' },
    { display_name: 'Dee',  available: 3,    start: '2023-01-01' },
  ];
  const copy = JSON.stringify(rows);

  const asc = sortRows(rows, 'available', 'asc', 'display_name');
  assert.deepEqual(asc.map(r => r.display_name), ['Cy', 'Bea', 'Dee', 'Al']);

  const desc = sortRows(rows, 'available', 'desc', 'display_name');
  assert.deepEqual(desc.map(r => r.display_name), ['Bea', 'Dee', 'Cy', 'Al']);

  const none = sortRows(rows, 'available', null, 'display_name');
  assert.deepEqual(none.map(r => r.display_name), ['Al', 'Bea', 'Cy', 'Dee']);

  const byStart = sortRows(rows, 'start', 'asc', 'display_name');
  assert.deepEqual(byStart.map(r => r.display_name), ['Dee', 'Al', 'Bea', 'Cy']);

  assert.equal(JSON.stringify(rows), copy);
});

test('matchesSearch: name or role, case-insensitive, empty query matches', () => {
  const r = { display_name: 'Domingo Cruz', role: 'Care Coordinator' };
  assert.ok(matchesSearch(r, ''));
  assert.ok(matchesSearch(r, '  '));
  assert.ok(matchesSearch(r, 'cruz'));
  assert.ok(matchesSearch(r, 'COORD'));
  assert.ok(!matchesSearch(r, 'nurse'));
  assert.ok(matchesSearch({ display_name: 'X', role: null }, 'x'));
});
