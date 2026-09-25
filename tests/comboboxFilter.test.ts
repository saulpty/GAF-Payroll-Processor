import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterOptions, nextIndex } from '../src/app/components/ds/comboboxFilter.ts';

test('filterOptions: empty query returns all options, unchanged order', () => {
  const options = ['Salida', 'Tardanza', 'Ausencia'];
  assert.deepEqual(filterOptions(options, ''), options);
  assert.deepEqual(filterOptions(options, '   '), options);
});

test('filterOptions: accent-insensitive match — "tardanza" matches "Tardanza"', () => {
  const options = ['Salida', 'Tardanza', 'Ausencia'];
  assert.deepEqual(filterOptions(options, 'tardanza'), ['Tardanza']);
});

test('filterOptions: accent-insensitive match — "salida" matches "Salída"', () => {
  const options = ['Salída', 'Tardanza', 'Ausencia'];
  assert.deepEqual(filterOptions(options, 'salida'), ['Salída']);
});

test('filterOptions: prefix matches sort before other substring matches', () => {
  const options = ['Permiso Médico', 'Día de Permiso', 'Sin Permiso'];
  // Query "permiso" is a prefix of "Permiso Médico" only; the others contain
  // it mid-string and should follow, in their original relative order.
  assert.deepEqual(filterOptions(options, 'permiso'), ['Permiso Médico', 'Día de Permiso', 'Sin Permiso']);
});

test('filterOptions: case-insensitive, no match returns empty array', () => {
  const options = ['Salida', 'Tardanza', 'Ausencia'];
  assert.deepEqual(filterOptions(options, 'ZZZZZ'), []);
});

test('filterOptions: case-insensitive match works regardless of casing', () => {
  const options = ['Salida', 'Tardanza', 'Ausencia'];
  assert.deepEqual(filterOptions(options, 'AUSENCIA'), ['Ausencia']);
});

test('nextIndex: wraps forward past the end of the list', () => {
  assert.equal(nextIndex(2, 1, 3), 0);
});

test('nextIndex: wraps backward past the start of the list', () => {
  assert.equal(nextIndex(0, -1, 3), 2);
});

test('nextIndex: simple forward and backward moves stay in range', () => {
  assert.equal(nextIndex(0, 1, 3), 1);
  assert.equal(nextIndex(1, -1, 3), 0);
});

test('nextIndex: returns -1 when the list is empty', () => {
  assert.equal(nextIndex(0, 1, 0), -1);
  assert.equal(nextIndex(-1, -1, 0), -1);
});
