import { useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useViewer } from '@/app/context/ViewerContext';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { matchesManager } from '@/app/lib/managerFilter';
import { toLocalYMD, isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '@/app/lib/classificationEngine';
import { buildAttendanceReport } from '@/app/lib/attendanceReport';
import { buildActivityDays } from '@/app/lib/activityDays';
import type { ActivitySettings, ActivityDay, ActivityDayRow, EmployeeActivitySummary, ActivityTotals, ActivityEmployee } from '@/app/lib/activityDays';
import type { ReportEmployee, ReportPayrollRow, ReportForm, ReportRequest, ReportPeriod, ReportHoliday } from '@/app/lib/attendanceReportTypes';

import loadTeramindActivityDaysAction from '@/actions/loadTeramindActivityDays';
import loadAttendanceEmployeesAction  from '@/actions/loadAttendanceEmployees';
import loadAttendanceReportDaysAction from '@/actions/loadAttendanceReportDays';
import loadMondayAttendanceFormsRangeAction from '@/actions/loadMondayAttendanceFormsRange';
import loadMondayRequestsRangeAction from '@/actions/loadMondayRequestsRange';
import loadHolidaysAction from '@/actions/loadHolidays';
import loadPeriodsAction from '@/actions/loadPeriods';
import loadDstCalendarAction from '@/actions/loadDstCalendar';
import loadClassificationConfigAction from '@/actions/loadClassificationConfig';

type ConfigRow = { key: string; value: string; label: string; description: string; category: string };
type DstRow = { year: number; us_dst_start: string; us_dst_end: string };

export type ActivityDataResult = {
  days: ActivityDay[];
  byEmployee: EmployeeActivitySummary[];
  totals: ActivityTotals;
  settings: ActivitySettings;
  loading: boolean;
  error: boolean;
  configFallbacks: string[];
  reloadConfig: () => Promise<void>;
};

const FALLBACK_MIN_ACTIVE = 390;
const FALLBACK_BREAK = 60;
const FALLBACK_BREAK_OVER = 30;

function parseSettings(rows: ConfigRow[]): { settings: ActivitySettings; fallbacks: string[] } {
  const teramind = rows.filter(r => r.category === 'teramind');
  const pick = (key: string) => teramind.find(r => r.key === key)?.value;
  const fallbacks: string[] = [];

  const minActive = Number(pick('activity_min_active_minutes'));
  const breakMin = Number(pick('activity_break_minutes'));
  const breakOver = Number(pick('activity_break_over_minutes'));

  if (!Number.isFinite(minActive) || minActive <= 0) fallbacks.push('activity_min_active_minutes');
  if (!Number.isFinite(breakMin)  || breakMin <= 0)  fallbacks.push('activity_break_minutes');
  if (!Number.isFinite(breakOver) || breakOver <= 0) fallbacks.push('activity_break_over_minutes');

  return {
    settings: {
      minActiveMinutes: (Number.isFinite(minActive) && minActive > 0) ? minActive : FALLBACK_MIN_ACTIVE,
      breakMinutes:     (Number.isFinite(breakMin)  && breakMin > 0)  ? breakMin  : FALLBACK_BREAK,
      breakOverMinutes: (Number.isFinite(breakOver) && breakOver > 0) ? breakOver : FALLBACK_BREAK_OVER,
    },
    fallbacks,
  };
}

export function useActivityData({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }): ActivityDataResult {
  const { viewAs } = useViewer();
  const { employee, manager, role } = useGlobalFilters();

  const safeFrom = dateFrom || toLocalYMD(new Date());
  const safeTo   = dateTo   || toLocalYMD(new Date());

  const [rawTm,      loadingTm,  errTm]                        = useLoadAction(loadTeramindActivityDaysAction, [],       { dateFrom: safeFrom, dateTo: safeTo, viewAs });
  const [rawEmps,    loadingEmps,    errEmps]                  = useLoadAction(loadAttendanceEmployeesAction,  [],       { viewAs });
  const [rawDays,    loadingDays,    errDays]                  = useLoadAction(loadAttendanceReportDaysAction, [],       { dateFrom: safeFrom, dateTo: safeTo, manager: '', viewAs });
  const [rawForms,   loadingForms,   errForms]                 = useLoadAction(loadMondayAttendanceFormsRangeAction, [], { dateFrom: safeFrom, dateTo: safeTo, manager: '', viewAs });
  const [rawReqs,    loadingReqs,    errReqs]                  = useLoadAction(loadMondayRequestsRangeAction,  [],       { dateFrom: safeFrom, dateTo: safeTo, manager: '', viewAs });
  const [rawHols,    loadingHols,    errHols]                  = useLoadAction(loadHolidaysAction,   [], {});
  const [rawPeriods, loadingPeriods, errPeriods]               = useLoadAction(loadPeriodsAction,    [], {});
  const [rawDst,     loadingDst,     errDst]                   = useLoadAction(loadDstCalendarAction, [], {});
  const [rawConfig,  loadingConfig,  errConfig, reloadConfig]  = useLoadAction(loadClassificationConfigAction, [], {});

  const loading =
    loadingTm || loadingEmps || loadingDays || loadingForms ||
    loadingReqs || loadingHols || loadingPeriods || loadingDst || loadingConfig;

  const error = !!(errTm || errEmps || errDays || errForms || errReqs || errHols || errPeriods || errDst || errConfig);

  const result = useMemo<Omit<ActivityDataResult, 'loading' | 'error' | 'reloadConfig'>>(() => {
    // When any loader errored, return empty safe data — never render accusations from partial state.
    if (error) {
      const { settings } = parseSettings([]);
      return {
        days: [],
        byEmployee: [],
        totals: { avgActiveMin: null, daysWorked: 0, needsLook: 0, lateArrivals: 0 },
        settings,
        configFallbacks: [],
      };
    }
    const allEmployees = (rawEmps as ReportEmployee[]) ?? [];
    const employees = allEmployees.filter(e =>
      matchesManager(e, manager) &&
      (!role || e.role === role) &&
      (!employee || e.name?.toLowerCase().includes(employee.toLowerCase()) ||
        e.email?.toLowerCase().includes(employee.toLowerCase()))
    );
    const tmRows      = (rawTm as ActivityEmployee[]) ?? [];
    const payrollRows = (rawDays as ReportPayrollRow[]) ?? [];
    const forms       = (rawForms as ReportForm[]) ?? [];
    const requests    = (rawReqs as ReportRequest[]) ?? [];
    const holidays    = (rawHols as ReportHoliday[]) ?? [];
    const periods     = (rawPeriods as ReportPeriod[]) ?? [];
    const dstWindows  = (rawDst as DstRow[]) ?? [];
    const configRows  = (rawConfig as ConfigRow[]) ?? [];

    const { settings, fallbacks: configFallbacks } = parseSettings(configRows);

    const { rows: reportRows } = buildAttendanceReport({
      dateFrom: safeFrom,
      dateTo: safeTo,
      employees,
      payrollRows,
      forms,
      requests,
      holidays,
      periods,
      dstWindows,
      helpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes },
    });

    const activityEmployees: ActivityEmployee[] = employees.map(e => ({
      id: e.id,
      name: e.name,
      role: e.role,
      manager: e.manager,
      work_days: e.work_days,
      schedule_start: e.standard_start,
      schedule_end: e.standard_end,
    }));

    const isScheduledFor = (emp: unknown, date: string) =>
      isScheduledWorkDay(
        new Date(date + 'T12:00:00'),
        (emp as { work_days?: string }).work_days,
      );

    const today = toLocalYMD(new Date());

    const { days, byEmployee, totals } = buildActivityDays({
      dateFrom: safeFrom,
      dateTo: safeTo,
      today,
      employees: activityEmployees,
      rows: tmRows as unknown as ActivityDayRow[],
      reportRows,
      requests,
      settings,
      isScheduledWorkDay: isScheduledFor,
    });

    return { days, byEmployee, totals, settings, configFallbacks };
  }, [error, rawEmps, rawTm, rawDays, rawForms, rawReqs, rawHols, rawPeriods, rawDst, rawConfig, safeFrom, safeTo, employee, manager, role]);

  return { ...result, loading, error, reloadConfig };
}
