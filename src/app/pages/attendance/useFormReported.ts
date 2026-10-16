import { useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import loadMondayAttendanceFormsRangeAction from '@/actions/loadMondayAttendanceFormsRange';
import type { AttendanceRow } from '@/app/lib/attendanceStats';
import type { ReportForm } from '@/app/lib/attendanceReportTypes';
import { reportedFromForms, idsByEmail } from '@/app/lib/formReporting';

/**
 * Payroll rows with "reported" taken from the attendance forms for [dateFrom, dateTo], so the List,
 * the employee panel, Reports and the Why tags agree (2026-10-16). If the forms cannot be loaded the
 * rows keep payroll's own mark and `error` is true.
 */
export function useFormReported({ rows, employees, dateFrom, dateTo, viewAs }: {
  rows: AttendanceRow[]; employees: { email: string }[];
  dateFrom: string; dateTo: string; viewAs: string;
}): { rows: AttendanceRow[]; loading: boolean; error: boolean } {
  const [rawForms, loading, err] = useLoadAction(
    loadMondayAttendanceFormsRangeAction, [] as ReportForm[],
    { dateFrom, dateTo, manager: '', viewAs },
  );
  const idByEmail = useMemo(() => idsByEmail(employees ?? []), [employees]);
  const out = useMemo(
    () => (loading || err ? rows : reportedFromForms(rows, (rawForms as ReportForm[]) ?? [], idByEmail)),
    [rows, rawForms, idByEmail, loading, err],
  );
  return { rows: out, loading, error: !!err };
}
