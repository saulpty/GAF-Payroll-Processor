// Hook: resolves the "Why" chip for each employee for a single date.
// Uses the same data sources as AttendanceReport so we can call whyFor().
import { useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useViewer } from '@/app/context/ViewerContext';
import { buildAttendanceReport } from '@/app/lib/attendanceReport';
import { whyFor } from '@/app/lib/activityDays';
import type { WhyChip } from '@/app/lib/activityDays';
import type { ReportEmployee, ReportPayrollRow, ReportForm, ReportRequest, ReportHoliday, ReportPeriod, ReportRow } from '@/app/lib/attendanceReportTypes';
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '@/app/lib/classificationEngine';
import loadAttendanceReportDaysAction from '@/actions/loadAttendanceReportDays';
import loadMondayAttendanceFormsRangeAction from '@/actions/loadMondayAttendanceFormsRange';
import loadMondayRequestsRangeAction from '@/actions/loadMondayRequestsRange';
import loadHolidaysAction from '@/actions/loadHolidays';
import loadPeriodsAction from '@/actions/loadPeriods';
import loadDstCalendarAction from '@/actions/loadDstCalendar';

export type { WhyChip };

export function useTodayWhy(args: {
  day: string;
  employees: ReportEmployee[];
  /** rows already built by AttendanceToday — used for scheduled/hasActivity per employee */
  scheduledById: Map<number, boolean>;
  hasActivityById: Map<number, boolean>;
}): { whyById: Map<number, WhyChip | null>; loading: boolean } {
  const { viewAs } = useViewer();
  const { day, employees, scheduledById, hasActivityById } = args;

  const [rawDays, loadingDays] = useLoadAction(
    loadAttendanceReportDaysAction, [] as ReportPayrollRow[],
    { dateFrom: day, dateTo: day, manager: '', viewAs },
  );
  const [rawForms, loadingForms] = useLoadAction(
    loadMondayAttendanceFormsRangeAction, [] as ReportForm[],
    { dateFrom: day, dateTo: day, manager: '', viewAs },
  );
  const [rawRequests, loadingReqs] = useLoadAction(
    loadMondayRequestsRangeAction, [] as ReportRequest[],
    { dateFrom: day, dateTo: day, manager: '', viewAs },
  );
  const [rawHolidays, loadingHols] = useLoadAction(loadHolidaysAction, [] as ReportHoliday[]);
  const [rawPeriods, loadingPeriods] = useLoadAction(loadPeriodsAction, [] as ReportPeriod[]);
  const [rawDst, loadingDst] = useLoadAction(
    loadDstCalendarAction,
    [] as { year: number; us_dst_start: string; us_dst_end: string }[],
  );

  const loading = loadingDays || loadingForms || loadingReqs || loadingHols || loadingPeriods || loadingDst;

  const whyById = useMemo<Map<number, WhyChip | null>>(() => {
    if (loading || employees.length === 0) return new Map();

    const { rows } = buildAttendanceReport({
      dateFrom: day,
      dateTo: day,
      employees,
      payrollRows: (rawDays as ReportPayrollRow[]) ?? [],
      forms: (rawForms as ReportForm[]) ?? [],
      requests: (rawRequests as ReportRequest[]) ?? [],
      holidays: (rawHolidays as ReportHoliday[]) ?? [],
      periods: (rawPeriods as ReportPeriod[]) ?? [],
      dstWindows: (rawDst as { year: number; us_dst_start: string; us_dst_end: string }[]) ?? [],
      helpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes },
    });

    // Index requests by employee for whyFor()
    const reqByEmp = new Map<number, ReportRequest[]>();
    for (const r of (rawRequests as ReportRequest[]) ?? []) {
      const list = reqByEmp.get(Number(r.employee_id)) ?? [];
      list.push(r);
      reqByEmp.set(Number(r.employee_id), list);
    }

    // Index report rows by employee
    const reportByEmp = new Map<number, ReportRow>();
    for (const rr of rows) {
      reportByEmp.set(Number(rr.employeeId), rr);
    }

    const result = new Map<number, WhyChip | null>();
    for (const emp of employees) {
      const eid = Number(emp.id);
      const reportRow = reportByEmp.get(eid) ?? null;
      const scheduled = scheduledById.get(eid) ?? false;
      const hasActivity = hasActivityById.get(eid) ?? false;
      const empReqs = reqByEmp.get(eid) ?? [];
      result.set(eid, whyFor({ reportRow, requests: empReqs, scheduled, hasActivity }));
    }
    return result;
  }, [loading, day, employees, rawDays, rawForms, rawRequests, rawHolidays, rawPeriods, rawDst, scheduledById, hasActivityById]);

  return { whyById, loading };
}
