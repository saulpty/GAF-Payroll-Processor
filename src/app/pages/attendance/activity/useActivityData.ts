import { useMemo, useRef, useEffect } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useViewer } from '@/app/context/ViewerContext';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { matchesManager } from '@/app/lib/managerFilter';
import { toLocalYMD, isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '@/app/lib/classificationEngine';
import { buildAttendanceReport } from '@/app/lib/attendanceReport';
import { buildActivityDays } from '@/app/lib/activityDays';
import { comparisonRanges, summarisePeriod, compareEmployee, compareTotals, DEFAULT_TREND_MINIMUMS } from '@/app/lib/activityTrend';
import type { EmployeeTrend, TrendMinimums, TotalsChange } from '@/app/lib/activityTrend';
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
  prev: { from: string; to: string; days: number };
  compareTo: string;
  today: string;
  trends: Record<number, EmployeeTrend>;
  prevDays: Record<number, ActivityDay[]>;
  startDates: Record<number, string>;
  totalsChange: TotalsChange | null;
  minimums: TrendMinimums;
  loading: boolean;
  error: boolean;
  configFallbacks: string[];
  reloadConfig: () => Promise<void>;
  retry: () => void;
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

const TREND_KEYS: [keyof TrendMinimums, string][] = [
  ['activeMinutes', 'activity_trend_min_active_minutes'],
  ['entryMinutes', 'activity_trend_min_entry_minutes'],
  ['days', 'activity_trend_min_days'],
  ['workedDays', 'activity_trend_min_worked_days'],
];

function parseMinimums(rows: ConfigRow[]): { minimums: TrendMinimums; fallbacks: string[] } {
  const minimums: TrendMinimums = { ...DEFAULT_TREND_MINIMUMS };
  const fallbacks: string[] = [];
  for (const [field, key] of TREND_KEYS) {
    const n = Number(rows.find(r => r.category === 'teramind' && r.key === key)?.value);
    if (Number.isFinite(n) && n > 0) minimums[field] = n; else fallbacks.push(key);
  }
  return { minimums, fallbacks };
}

const inRange = (date: string | null | undefined, from: string, to: string): boolean => {
  const d = String(date ?? '').slice(0, 10);
  return d >= from && d <= to;
};

const NO_PREV = { from: '', to: '', days: 0 };

export function useActivityData({ dateFrom, dateTo, compare = false }: { dateFrom: string; dateTo: string; compare?: boolean }): ActivityDataResult {
  const { viewAs } = useViewer();
  const { employee, manager, role } = useGlobalFilters();

  const safeFrom = dateFrom || toLocalYMD(new Date());
  const safeTo   = dateTo   || toLocalYMD(new Date());

  // Today is a partial day and later days have not happened: the comparison stops at yesterday,
  // against the same number of days right before the range.
  const cmp = compare ? comparisonRanges(safeFrom, safeTo, toLocalYMD(new Date())) : null;
  const prev = cmp ? cmp.before : NO_PREV;
  const compareTo = cmp && cmp.before.days > 0 ? cmp.after.to : safeTo;
  const spanFrom = prev.days > 0 ? prev.from : safeFrom;

  const [rawTm,      loadingTm,  errTm,      refetchTm]      = useLoadAction(loadTeramindActivityDaysAction, [],       { dateFrom: spanFrom, dateTo: safeTo, viewAs });
  const [rawEmps,    loadingEmps,    errEmps,    refetchEmps]    = useLoadAction(loadAttendanceEmployeesAction,  [],       { viewAs });
  const [rawDays,    loadingDays,    errDays,    refetchDays]    = useLoadAction(loadAttendanceReportDaysAction, [],       { dateFrom: spanFrom, dateTo: safeTo, manager: '', viewAs });
  const [rawForms,   loadingForms,   errForms,   refetchForms]   = useLoadAction(loadMondayAttendanceFormsRangeAction, [], { dateFrom: spanFrom, dateTo: safeTo, manager: '', viewAs });
  const [rawReqs,    loadingReqs,    errReqs,    refetchReqs]    = useLoadAction(loadMondayRequestsRangeAction,  [],       { dateFrom: spanFrom, dateTo: safeTo, manager: '', viewAs });
  const [rawHols,    loadingHols,    errHols,    refetchHols]    = useLoadAction(loadHolidaysAction,   [], {});
  const [rawPeriods, loadingPeriods, errPeriods, refetchPeriods] = useLoadAction(loadPeriodsAction,    [], {});
  const [rawDst,     loadingDst,     errDst,     refetchDst]     = useLoadAction(loadDstCalendarAction, [], {});
  const [rawConfig,  loadingConfig,  errConfig,  reloadConfig]   = useLoadAction(loadClassificationConfigAction, [], {});

  const loading =
    loadingTm || loadingEmps || loadingDays || loadingForms ||
    loadingReqs || loadingHols || loadingPeriods || loadingDst || loadingConfig;

  const error = !!(errTm || errEmps || errDays || errForms || errReqs || errHols || errPeriods || errDst || errConfig);

  // Keep latest refetch fns in refs so retry() never captures stale closures.
  const refetchRef = useRef({
    refetchTm, refetchEmps, refetchDays, refetchForms, refetchReqs,
    refetchHols, refetchPeriods, refetchDst,
  });
  refetchRef.current = {
    refetchTm, refetchEmps, refetchDays, refetchForms, refetchReqs,
    refetchHols, refetchPeriods, refetchDst,
  };

  function retry() {
    const r = refetchRef.current;
    r.refetchTm();
    r.refetchEmps();
    r.refetchDays();
    r.refetchForms();
    r.refetchReqs();
    r.refetchHols();
    r.refetchPeriods();
    r.refetchDst();
  }

  // Auto-retry once after 1.5 s on first error. Counter resets when range changes or load succeeds.
  // Guard: attemptCount goes 0 → 1 on error (auto-retry fires), capped at 1 so it never loops.
  const autoRetryCount = useRef(0);
  const autoRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset counter whenever the date range changes or a successful load completes.
  const rangeKey = `${safeFrom}/${safeTo}`;
  const prevRangeKey = useRef(rangeKey);
  if (prevRangeKey.current !== rangeKey) {
    prevRangeKey.current = rangeKey;
    autoRetryCount.current = 0;
    if (autoRetryTimer.current !== null) {
      clearTimeout(autoRetryTimer.current);
      autoRetryTimer.current = null;
    }
  }

  // When a load succeeds, reset the counter so a future transient error gets its one auto-retry.
  useEffect(() => {
    if (!loading && !error) {
      autoRetryCount.current = 0;
    }
  }, [loading, error]);

  // Trigger the one-shot auto-retry when error is true and we haven't retried yet.
  useEffect(() => {
    if (!error || loading) return;
    if (autoRetryCount.current >= 1) return; // already used the one free retry
    autoRetryCount.current += 1;
    autoRetryTimer.current = setTimeout(() => {
      autoRetryTimer.current = null;
      retry();
    }, 1500);
    return () => {
      if (autoRetryTimer.current !== null) {
        clearTimeout(autoRetryTimer.current);
        autoRetryTimer.current = null;
      }
    };
  // retry is stable (reads from ref); error/loading are primitive booleans.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, loading]);

  // While the auto-retry is pending (count used but still loading) keep loading=true
  // so the UI never briefly flashes the error box between the auto-retry fire and
  // the loading state being set. Use a derived flag for this.
  const pendingAutoRetry = autoRetryCount.current >= 1 && autoRetryTimer.current !== null;
  const effectiveLoading = loading || pendingAutoRetry;
  const effectiveError   = error && !pendingAutoRetry && !loading;

  const result = useMemo<Omit<ActivityDataResult, 'loading' | 'error' | 'reloadConfig' | 'retry'>>(() => {
    // When any loader errored, return empty safe data — never render accusations from partial state.
    if (error) {
      const { settings } = parseSettings([]);
      return {
        days: [],
        byEmployee: [],
        totals: { avgActiveMin: null, daysWorked: 0, needsLook: 0, lateArrivals: 0 },
        settings,
        configFallbacks: [],
        prev, compareTo, today: toLocalYMD(new Date()), trends: {}, prevDays: {}, startDates: {},
        totalsChange: null, minimums: { ...DEFAULT_TREND_MINIMUMS },
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

    const { settings, fallbacks: settingFallbacks } = parseSettings(configRows);
    const { minimums, fallbacks: minimumFallbacks } = parseMinimums(configRows);
    const configFallbacks = [...settingFallbacks, ...minimumFallbacks];

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

    const build = (from: string, to: string) => {
      const { rows: reportRows } = buildAttendanceReport({
        dateFrom: from,
        dateTo: to,
        employees,
        payrollRows: payrollRows.filter((r) => inRange(r.work_date, from, to)),
        forms: forms.filter((f) => inRange(f.form_date, from, to)),
        requests,
        holidays,
        periods,
        dstWindows,
        helpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes },
      });
      return buildActivityDays({
        dateFrom: from,
        dateTo: to,
        today,
        employees: activityEmployees,
        rows: tmRows as unknown as ActivityDayRow[],
        reportRows,
        requests,
        settings,
        isScheduledWorkDay: isScheduledFor,
      });
    };

    const { days, byEmployee, totals } = build(safeFrom, safeTo);
    const before = prev.days > 0 ? build(prev.from, prev.to) : null;

    const prevDays: Record<number, ActivityDay[]> = {};
    for (const b of before?.byEmployee ?? []) prevDays[b.employeeId] = b.days;
    const startDates: Record<number, string> = {};
    for (const e of employees) startDates[Number(e.id)] = String(e.start_date ?? '').slice(0, 10);
    const trends: Record<number, EmployeeTrend> = {};
    for (const e of byEmployee) {
      const start = startDates[e.employeeId] ?? '';
      const earlier = prevDays[e.employeeId];
      trends[e.employeeId] = compareEmployee(
        earlier ? summarisePeriod(earlier, today, start) : null,
        summarisePeriod(e.days, today, start),
        minimums,
      );
    }
    const totalsChange = before ? compareTotals(before.totals, totals) : null;

    return { days, byEmployee, totals, settings, configFallbacks, prev, compareTo, today, trends, prevDays, startDates, totalsChange, minimums };
  }, [error, rawEmps, rawTm, rawDays, rawForms, rawReqs, rawHols, rawPeriods, rawDst, rawConfig, safeFrom, safeTo, spanFrom, compare, compareTo, employee, manager, role]);

  return { ...result, loading: effectiveLoading, error: effectiveError, reloadConfig, retry };
}
