import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEmployeeStats, computeCompanyKpis, type AttendanceRow, type EmpInfo } from '../src/app/lib/attendanceStats.ts';

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

// ── Live days (2026-10-06): shown in the List, never counted ─────────────────

test('AS-L1: computeEmployeeStats excludes live rows from every count but keeps them in rows', () => {
  const official = [row({}), row({ date: '2026-06-02', status: 'Late - Unreported', bucket: 'late_1to10', minutes_late: 5 })];
  const live = [
    row({ date: '2026-06-03', status: 'Live', bucket: 'late_11to30', minutes_late: 20, live: true, live_label: 'Late 20 min', filed_gaf: true }),
    row({ date: '2026-06-04', status: 'Live', bucket: null, entry_time: null, live: true, live_label: 'No records yet' }),
  ];
  const before = computeEmployeeStats(official, new Map(), new Set(['a@x.com']))[0];
  const after = computeEmployeeStats([...official, ...live], new Map(), new Set(['a@x.com']))[0];
  for (const k of ['days', 'onTime', 'totalLate', 'reported', 'unreported', 'excused', 'permission',
    'absent', 'daysWorked', 'avgMinLate', 'pctOnTime', 'b1to10', 'b11to30', 'b31plus'] as const) {
    assert.equal(after[k], before[k], k);
  }
  assert.deepEqual(after.filing, before.filing);
  assert.equal(after.rows.length, 4);
  assert.equal(after.liveDays, 2);
  assert.equal(after.liveLate, 1);
  assert.equal(before.liveDays, 0);
});

test('AS-L2: computeCompanyKpis ignores live rows, reports them separately', () => {
  const official = [row({}), row({ date: '2026-06-02', status: 'Absent - Unexplained', bucket: 'absent', entry_time: null })];
  const live = [row({ date: '2026-06-03', status: 'Live', minutes_late: 7, live: true })];
  const before = computeCompanyKpis(official);
  const after = computeCompanyKpis([...official, ...live]);
  assert.deepEqual({ ...after, liveDays: undefined, liveLate: undefined }, { ...before, liveDays: undefined, liveLate: undefined });
  assert.equal(after.totalRows, 2);
  assert.equal(after.liveDays, 1);
  assert.equal(after.liveLate, 1);
});
