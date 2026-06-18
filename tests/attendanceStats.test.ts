import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEmployeeStats, type AttendanceRow, type EmpInfo } from '../src/app/lib/attendanceStats.ts';

const row = (over: Partial<AttendanceRow>): AttendanceRow => ({
  email: 'a@x.com', name: 'A', date: '2026-06-01', entry_time: '9:00',
  status: 'On Time', bucket: 'on_time', filed_gaf: false, minutes_late: 0,
  period_name: 'P', ...over,
});

test('computeEmployeeStats carries role and manager from EmpInfo', () => {
  const rows = [row({}), row({ date: '2026-06-02', status: 'Late - Unreported', bucket: 'late_1to10', minutes_late: 5 })];
  const empMap = new Map<string, EmpInfo>([
    ['a@x.com', {
      email: 'a@x.com', name: 'Ana', role: 'EVV Specialist', manager: 'Marcela Gordon',
      schedule_name: 'Standard', standard_start: '9:00 AM', standard_end: '5:00 PM',
    }],
  ]);
  const stats = computeEmployeeStats(rows, empMap, new Set(['a@x.com']));
  assert.equal(stats.length, 1);
  assert.equal(stats[0].role, 'EVV Specialist');
  assert.equal(stats[0].manager, 'Marcela Gordon');
  // existing fields still computed
  assert.equal(stats[0].days, 2);
  assert.equal(stats[0].onTime, 1);
});

test('computeEmployeeStats defaults role/manager to empty when EmpInfo missing', () => {
  const stats = computeEmployeeStats([row({})], new Map(), new Set(['a@x.com']));
  assert.equal(stats[0].role, '');
  assert.equal(stats[0].manager, '');
});
