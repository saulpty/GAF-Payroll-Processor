// Attendance top cards — List and Reports show the same ten cards (2026-09-14).
// Saul's rules: Absent = every absence; Avg Min Late over late days only;
// Work Days = every scheduled shift day, including time off and permission.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCompanyKpis, computeEmployeeStats, type AttendanceRow } from '../src/app/lib/attendanceStats.ts';
import { reportRowsToKpis } from '../src/app/lib/reportKpis.ts';
import type { ReportRow, Verdict } from '../src/app/lib/attendanceReportTypes.ts';

const listRow = (over: Partial<AttendanceRow>): AttendanceRow => ({
  email: 'a@x.com', name: 'A', date: '2026-06-01', entry_time: '9:00',
  status: 'On Time', bucket: 'on_time', filed_gaf: false, minutes_late: 0,
  period_name: 'P', time_off_kind: null, ...over,
});

const reportRow = (verdict: Verdict, minutesLate = 0): ReportRow => ({
  employeeId: 1, employeeName: 'A', email: 'a@x.com', role: '', manager: '',
  date: '2026-06-01', scheduledStart: '9:00 AM', entryTime: null, exitTime: null,
  minutesLate, earlyLeaveMinutes: 0, form: null, allForms: [], coveredBy: null,
  verdict, countsToScore: !['pto', 'permission', 'holiday', 'not_processed'].includes(verdict),
  flags: { multipleForms: false, recordedUnexplainedButFormOnFile: false, formEmailUnrecognised: false },
});

test('AC1: reportRowsToKpis counts every verdict into the right card', () => {
  const k = reportRowsToKpis([
    reportRow('on_time'), reportRow('on_time'),
    reportRow('late_reported_on_time', 10), reportRow('late_reported_late', 20), reportRow('late_no_form', 30),
    reportRow('absent_reported_on_time'), reportRow('absent_reported_late'), reportRow('unexplained_absence'),
    reportRow('pto'), reportRow('holiday'), reportRow('permission'),
  ]);
  assert.equal(k.onTime, 2);
  assert.equal(k.lateDays, 3);
  assert.equal(k.lateReported, 2);
  assert.equal(k.lateUnreported, 1);
  assert.equal(k.absent, 3);
  assert.equal(k.reported, 4);     // 2 late + 2 absent with a form
  assert.equal(k.unreported, 2);   // late_no_form + unexplained_absence
  assert.equal(k.excused, 2);      // pto + holiday
  assert.equal(k.permission, 1);
  assert.equal(k.daysTracked, 8);
  assert.equal(k.workDays, 11);
  assert.equal(k.onTime + k.lateDays + k.absent + k.excused + k.permission, k.workDays);
  assert.equal(k.avgMinLate, 20);  // (10+20+30)/3, late days only
  assert.equal(k.onTimeRate, 25);
  assert.equal(k.lateRate, 37.5);
});

test('AC2: not_processed rows count nowhere', () => {
  const k = reportRowsToKpis([reportRow('on_time'), reportRow('not_processed'), reportRow('not_processed')]);
  assert.equal(k.workDays, 1);
  assert.equal(k.daysTracked, 1);
  assert.equal(k.onTimeRate, 100);
  const empty = reportRowsToKpis([reportRow('not_processed')]);
  assert.equal(empty.workDays, 0);
  assert.equal(empty.onTimeRate, 0);
  assert.equal(empty.lateRate, 0);
  assert.equal(empty.avgMinLate, 0);
});

test('AC3: computeCompanyKpis — avg over late days, reported/unreported cover late+absent, work days = all rows', () => {
  const k = computeCompanyKpis([
    listRow({}),
    listRow({ date: '2026-06-02', status: 'Late - Reported', minutes_late: 10, filed_gaf: true }),
    listRow({ date: '2026-06-03', status: 'Late - Unreported', minutes_late: 30 }),
    listRow({ date: '2026-06-04', status: 'Absent - Unexplained', entry_time: null }),
    listRow({ date: '2026-06-05', status: 'Excused (PTO/FH/Perm)', entry_time: null }),
    listRow({ date: '2026-06-08', status: 'Permission', entry_time: null }),
  ]);
  assert.equal(k.avgMinLate, 20);
  assert.equal(k.lateDays, 2);
  assert.equal(k.reported, 1);
  assert.equal(k.unreported, 2);
  assert.equal(k.reported + k.unreported, k.lateDays + k.absent);
  assert.equal(k.workDays, 6);
  assert.equal(k.workDays, k.totalRows);
  assert.equal(k.onTime + k.lateDays + k.absent + k.excused + k.permission, k.workDays);
  assert.equal(k.onTimeRate, 25);
  assert.equal(k.lateRate, 50);
});

test('AC4: per-employee avgMinLate (table and panel) is still over days worked', () => {
  const rows = [listRow({}), listRow({ date: '2026-06-02', status: 'Late - Unreported', minutes_late: 20 })];
  const [s] = computeEmployeeStats(rows, new Map(), new Set(['a@x.com']));
  assert.equal(s.avgMinLate, 10);
});
