import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '@/app/lib/classificationEngine';
import { buildAttendanceReport } from '@/app/lib/attendanceReport';
import { liveWindow, liveReport } from '@/app/lib/liveAttendance';
import { liveListRowsWithOutside, NO_LIVE_WINDOW } from '@/app/lib/liveListRows';
import type { ActivityDayRow } from '@/app/lib/activityDays';
import type { ReportEmployee, ReportForm, ReportRequest, ReportHoliday, ReportPeriod } from '@/app/lib/attendanceReportTypes';
import type { AttendanceRow } from '@/app/lib/attendanceStats';
import { easternDate } from '@/app/lib/teramindTime';

import loadPeriodsAction                    from '@/actions/loadPeriods';
import loadTeramindActivityDaysAction       from '@/actions/loadTeramindActivityDays';
import loadMondayAttendanceFormsRangeAction from '@/actions/loadMondayAttendanceFormsRange';
import loadMondayRequestsRangeAction        from '@/actions/loadMondayRequestsRange';
import loadHolidaysAction                   from '@/actions/loadHolidays';
import loadDstCalendarAction                from '@/actions/loadDstCalendar';

type DstRow = { year: number; us_dst_start: string; us_dst_end: string };

/**
 * Attendance List rows for days payroll has not processed yet, from Teramind (2026-10-07: they
 * count, exactly as payroll would count them). Only the live window is loaded (after the newest
 * processed period, up to today). With no window every ranged loader gets NO_LIVE_WINDOW and
 * returns nothing. `loading` stays true until the window's own data has arrived, so the page can
 * wait and its numbers never flash without these days.
 */
export function useLiveListRows({ dateFrom, dateTo, viewAs, employees, official }: {
  dateFrom: string; dateTo: string; viewAs: string;
  employees: ReportEmployee[]; official: AttendanceRow[];
}): { rows: AttendanceRow[]; loading: boolean; error: boolean } {
  const today = easternDate(Date.now());   // Teramind's "today" is US Eastern

  const [rawPeriods, loadingPeriods, errPeriods] = useLoadAction(loadPeriodsAction, [] as ReportPeriod[]);
  const win = useMemo(
    () => (loadingPeriods ? null : liveWindow((rawPeriods as ReportPeriod[]) ?? [], dateFrom, dateTo, today)),
    [loadingPeriods, rawPeriods, dateFrom, dateTo, today],
  );
  // 2026-10-16: employees outside payroll never get payroll rows, so the whole range is live
  // for them (wide). The loaders load the wide range; payroll employees still use `win`.
  const anyOutside = (employees ?? []).some(e => e.in_payroll === false);
  const wide = useMemo(
    () => (anyOutside ? liveWindow([], dateFrom, dateTo, today) : null),
    [anyOutside, dateFrom, dateTo, today],
  );
  const hasLive = win !== null || wide !== null;
  const range = wide ?? win ?? NO_LIVE_WINDOW;

  const [rawTm,    loadingTm,    errTm]    = useLoadAction(
    loadTeramindActivityDaysAction, [] as ActivityDayRow[],
    { dateFrom: range.from, dateTo: range.to, viewAs },
  );
  const [rawForms, loadingForms, errForms] = useLoadAction(
    loadMondayAttendanceFormsRangeAction, [] as ReportForm[],
    { dateFrom: range.from, dateTo: range.to, manager: '', viewAs },
  );
  const [rawReqs,  loadingReqs,  errReqs]  = useLoadAction(
    loadMondayRequestsRangeAction, [] as ReportRequest[],
    { dateFrom: range.from, dateTo: range.to, manager: '', viewAs },
  );
  const [rawHols,  loadingHols]  = useLoadAction(loadHolidaysAction, [] as ReportHoliday[]);
  const [rawDst,   loadingDst]   = useLoadAction(loadDstCalendarAction, [] as DstRow[]);

  const error = !!(errPeriods || (hasLive && (errTm || errForms || errReqs)));

  // Build rows only once the window's own data has arrived (no one-render flash with the
  // previous, empty results).
  const winKey = hasLive ? `${range.from}|${range.to}` : '';
  const busy = loadingTm || loadingForms || loadingReqs;
  const [dataFor, setDataFor] = useState('');
  const wasBusy = useRef(false);
  useEffect(() => {
    if (busy) wasBusy.current = true;
    else if (wasBusy.current) { wasBusy.current = false; setDataFor(winKey); }
  }, [busy, winKey]);

  const loading = loadingPeriods || (hasLive && !error &&
    (loadingTm || loadingForms || loadingReqs || loadingHols || loadingDst || dataFor !== winKey));

  const rows = useMemo(() => {
    if (loading || error || !hasLive || dataFor !== winKey) return [] as AttendanceRow[];
    return liveListRowsWithOutside({
      window: win,
      wide,
      today,
      employees: employees ?? [],
      forms: (rawForms as ReportForm[]) ?? [],
      requests: (rawReqs as ReportRequest[]) ?? [],
      holidays: (rawHols as ReportHoliday[]) ?? [],
      periods: (rawPeriods as ReportPeriod[]) ?? [],
      dstWindows: (rawDst as DstRow[]) ?? [],
      tmRows: (rawTm as ActivityDayRow[]) ?? [],
      official: official ?? [],
      deps: {
        buildAttendanceReport, liveReport,
        reportHelpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes },
      },
    });
  }, [loading, error, win, wide, hasLive, winKey, dataFor, today, employees, rawForms, rawReqs, rawHols, rawPeriods, rawDst, rawTm, official]);

  return { rows, loading, error };
}
