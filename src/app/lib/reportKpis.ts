// Type-only imports on purpose: node --test cannot resolve extension-less runtime imports.
import type { ReportRow } from './attendanceReportTypes';
import type { CompanyKpis } from './attendanceStats';

/**
 * Attendance Reports → the same ten top cards the List tab shows.
 * Absent = every absence verdict. Reported / Unreported cover late AND absent days.
 * Time off = pto + holiday. Work days = scored days + time off + permission.
 * not_processed rows are counted nowhere.
 */
export function reportRowsToKpis(rows: ReportRow[]): CompanyKpis {
  const count = (...verdicts: string[]) => rows.filter(r => verdicts.includes(r.verdict)).length;

  const onTime         = count('on_time');
  const lateReported   = count('late_reported_on_time', 'late_reported_late');
  const lateUnreported = count('late_no_form');
  const absentReported = count('absent_reported_on_time', 'absent_reported_late');
  const unexplained    = count('unexplained_absence');
  const excused        = count('pto', 'holiday');
  const permission     = count('permission');

  const lateDays    = lateReported + lateUnreported;
  const absent      = absentReported + unexplained;
  const daysTracked = onTime + lateDays + absent;
  const workDays    = daysTracked + excused + permission;

  const lateRows   = rows.filter(r => r.verdict.startsWith('late'));
  const sumLate    = lateRows.reduce((s, r) => s + (r.minutesLate ?? 0), 0);
  const avgMinLate = lateRows.length > 0 ? sumLate / lateRows.length : 0;
  const onTimeRate = daysTracked > 0 ? (onTime / daysTracked) * 100 : 0;
  const lateRate   = daysTracked > 0 ? (lateDays / daysTracked) * 100 : 0;

  return {
    daysTracked, onTime, lateReported, lateUnreported, lateDays,
    excused, permission, absent,
    reported: lateReported + absentReported,
    unreported: lateUnreported + unexplained,
    totalRows: workDays, workDays,
    avgMinLate, onTimeRate, lateRate,
  };
}
