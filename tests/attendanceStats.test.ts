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

// ── 2026-10-07: days payroll has not processed yet are ordinary rows and count like any other ──

test("AS-C1: computeEmployeeStats counts every row (no live exclusion)", () => {
  const rows = [
    row({}),
    row({ date: "2026-06-02", status: "Late - Unreported", bucket: "late_11to30", minutes_late: 20, period_name: "" }),
    row({ date: "2026-06-03", status: "Absent - Unexplained", bucket: "absent", entry_time: null, period_name: "" }),
  ];
  const [s] = computeEmployeeStats(rows, new Map(), new Set(["a@x.com"]));
  assert.equal(s.days, 3);
  assert.equal(s.onTime, 1);
  assert.equal(s.unreported, 1);
  assert.equal(s.absent, 1);
  assert.equal(s.b11to30, 1);
  assert.equal(s.rows.length, 3);
  assert.equal("liveDays" in s, false);
});

test("AS-C2: computeCompanyKpis counts every row and has no live fields", () => {
  const k = computeCompanyKpis([
    row({}),
    row({ date: "2026-06-02", status: "Absent - Unexplained", bucket: "absent", entry_time: null }),
    row({ date: "2026-06-03", status: "Late - Unreported", bucket: "late_1to10", minutes_late: 7, period_name: "" }),
  ]);
  assert.equal(k.totalRows, 3);
  assert.equal(k.lateDays, 1);
  assert.equal(k.absent, 1);
  assert.equal(k.daysTracked, 3);
  assert.equal("liveDays" in k, false);
});
