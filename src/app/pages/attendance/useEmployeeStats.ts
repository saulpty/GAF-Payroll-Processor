import { useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useViewer } from '@/app/context/ViewerContext';
import loadAttendanceDailyAction from '@/actions/loadAttendanceDaily';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import { AttendanceRow, EmpInfo, computeEmployeeStats } from '@/app/lib/attendanceStats';
import type { EmpStats } from '@/app/lib/attendanceStats';

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

  const loading = loadingEmps || loadingRows;

  const stats = useMemo<EmpStats | null>(() => {
    // Don't compute until we have a resolved email — avoids whole-company numbers
    if (!resolvedEmail) return null;

    const rows = (rawRows as AttendanceRow[]) ?? [];

    const empMap = new Map<string, EmpInfo>();
    emps.forEach(e => empMap.set(e.email, e));

    const matchEmails = new Set<string>([resolvedEmail]);

    const results = computeEmployeeStats(rows, empMap, matchEmails);
    return results[0] ?? null;
  }, [rawRows, emps, resolvedEmail]);

  return { stats, loading };
}
