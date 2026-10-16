import { useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useViewer } from '@/app/context/ViewerContext';
import loadAttendanceDailyAction from '@/actions/loadAttendanceDaily';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import { AttendanceRow, EmpInfo, computeEmployeeStats, rowsInRange } from '@/app/lib/attendanceStats';
import type { EmpStats } from '@/app/lib/attendanceStats';
import type { ReportEmployee } from '@/app/lib/attendanceReportTypes';
import { useLiveListRows } from './useLiveListRows';
import { useFormReported } from './useFormReported';

type Params = {
  email?: string;
  employeeId?: number;
  dateFrom: string;
  dateTo: string;
};

type Result = {
  stats: EmpStats | null;
  loading: boolean;
};

/**
 * One employee's attendance numbers for the panel when the caller has none (Today, Activity).
 * Same days as Attendance → List: payroll rows inside [dateFrom, dateTo], plus the days payroll
 * has not processed yet (useLiveListRows, from Teramind), appended exactly as Attendance.tsx does.
 */
export function useEmployeeStats({ email, employeeId, dateFrom, dateTo }: Params): Result {
  const { viewAs } = useViewer();

  const [empList, loadingEmps] = useLoadAction(
    loadAttendanceEmployeesAction,
    [] as EmpInfo[],
    { viewAs },
  );

  const emps = (empList as EmpInfo[]) ?? [];

  // Resolve email from employeeId if not directly provided
  const resolvedEmail = email ||
    emps.find(e => Number((e as { id?: number }).id) === employeeId)?.email ||
    '';

  const [rawRows, loadingRows] = useLoadAction(
    loadAttendanceDailyAction,
    [] as AttendanceRow[],
    { dateFrom, dateTo, email: resolvedEmail, viewAs },
  );

  // A slower answer for an earlier, wider range can arrive late: keep only the days asked for.
  const rows = useMemo(
    () => rowsInRange((rawRows as AttendanceRow[]) ?? [], dateFrom, dateTo),
    [rawRows, dateFrom, dateTo],
  );

  // Days payroll has not processed yet, for this one person only.
  const oneEmp = useMemo(
    () => (resolvedEmail ? emps.filter(e => e.email === resolvedEmail) : []),
    [emps, resolvedEmail],
  );
  const live = useLiveListRows({
    dateFrom, dateTo, viewAs,
    employees: oneEmp as unknown as ReportEmployee[], official: rows,
  });

  // "Reported" = a form on file for that person and day, as on Reports (2026-10-16).
  const reported = useFormReported({ rows, employees: oneEmp, dateFrom, dateTo, viewAs });

  const loading = loadingEmps || loadingRows || live.loading || reported.loading;

  const stats = useMemo<EmpStats | null>(() => {
    // Don't compute until we have a resolved email — avoids whole-company numbers
    if (!resolvedEmail) return null;
    // Wait for the not-yet-processed days, so the numbers never show without them.
    if (live.loading || reported.loading) return null;

    const allRows = live.rows.length > 0 ? [...reported.rows, ...live.rows] : reported.rows;

    const empMap = new Map<string, EmpInfo>();
    emps.forEach(e => empMap.set(e.email, e));

    const matchEmails = new Set<string>([resolvedEmail]);

    const results = computeEmployeeStats(allRows, empMap, matchEmails);
    return results[0] ?? null;
  }, [reported.rows, reported.loading, live.rows, live.loading, emps, resolvedEmail]);

  return { stats, loading };
}
