import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterRows, nextSort, rangeIds } from '../src/app/pages/action-required/arLogic.ts';

// AR1-AR3 (2026-09-25): the Action Required split (AR-1) moved these out of the
// 39 KB page unchanged. They pin the old inline behaviour so later prompts
// (AR-2..AR-6) cannot drift it by accident.
const rows = [
  { id: 1, employee_name: 'Ana Castillo', work_date: '2026-09-16', initial_status: 'YELLOW', late_minutes: 24 },
  { id: 2, employee_name: 'Luis Herrera', work_date: '2026-09-17', initial_status: 'RED', late_minutes: 0 },
  { id: 3, employee_name: 'Sofía Vega', work_date: '2026-09-23', initial_status: 'YELLOW', late_minutes: 9 },
  { id: 4, employee_name: 'Ana Pérez', work_date: '2026-09-11', initial_status: 'YELLOW', late_minutes: 130 },
];

test('AR1: filterRows keeps the tab, then searches name or date, then sorts', () => {
  assert.deepEqual(filterRows(rows, 'RED', '', null, null).map(r => r.id), [2]);
  assert.deepEqual(filterRows(rows, 'YELLOW', '', null, null).map(r => r.id), [1, 3, 4]);
  assert.deepEqual(filterRows(rows, 'YELLOW', '  ana ', null, null).map(r => r.id), [1, 4]);
  assert.deepEqual(filterRows(rows, 'YELLOW', '09-23', null, null).map(r => r.id), [3]);
  // numeric-aware sort: 9 < 24 < 130
  assert.deepEqual(filterRows(rows, 'YELLOW', '', 'late_minutes', 'asc').map(r => r.id), [3, 1, 4]);
  assert.deepEqual(filterRows(rows, 'YELLOW', '', 'late_minutes', 'desc').map(r => r.id), [4, 1, 3]);
  assert.deepEqual(filterRows(rows, 'YELLOW', '', 'work_date', 'asc').map(r => r.id), [4, 1, 3]);
});

test('AR2: nextSort cycles asc → desc → off, and a new column starts at asc', () => {
  assert.deepEqual(nextSort(null, null, 'work_date'), ['work_date', 'asc']);
  assert.deepEqual(nextSort('work_date', 'asc', 'work_date'), ['work_date', 'desc']);
  assert.deepEqual(nextSort('work_date', 'desc', 'work_date'), [null, null]);
  assert.deepEqual(nextSort('work_date', 'desc', 'employee_name'), ['employee_name', 'asc']);
});

test('AR3: rangeIds is inclusive and order-independent', () => {
  assert.deepEqual(rangeIds(rows, 1, 3), [2, 3, 4]);
  assert.deepEqual(rangeIds(rows, 3, 1), [2, 3, 4]);
  assert.deepEqual(rangeIds(rows, 2, 2), [3]);
});
