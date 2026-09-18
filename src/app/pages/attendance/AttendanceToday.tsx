import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import { Activity, Clock, RefreshCw } from 'lucide-react';
import { easternDate, easternMinutes } from '@/app/lib/teramindTime';
import { buildToday, fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import type { TodayEmployee, TodayPunch, TodayRow, TodayStatus } from '@/app/lib/teramindToday';
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '@/app/lib/classificationEngine';
import { fmtDayShort } from '@/app/lib/activityDays';
import type { WhyChip } from '@/app/lib/activityDays';
import { matchesManager } from '@/app/lib/managerFilter';
import { useTodayWhy } from './useTodayWhy';
import { TodayTableRow, isOnLeave } from './TodayRow';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import loadTeramindDayPunchesAction from '@/actions/loadTeramindDayPunches';
import loadHolidaysAction from '@/actions/loadHolidays';
import loadDstCalendarAction from '@/actions/loadDstCalendar';
import type { ReportEmployee } from '@/app/lib/attendanceReportTypes';

type HolidayRow = { date: string; name: string };
type DstRow = { year: number; us_dst_start: string; us_dst_end: string };
type PunchRaw = TodayPunch & { synced_at: string | null };

const ON_LEAVE_KINDS = new Set<string>(['pto', 'permission', 'sick', 'form', 'holiday']);

function SummaryTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[90px]">
      <span className={`text-2xl font-bold tabular-nums ${accent ?? 'text-slate-800'}`}>{value}</span>
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">{label}</span>
    </div>
  );
}

export default function AttendanceToday() {
  const today = easternDate(Date.now());
  const [day, setDay] = useState(today);
  const isToday = day === today;

  const [nowMin, setNowMin] = useState(() => easternMinutes(Date.now()));

  const { employee: globalEmployee, manager, role } = useGlobalFilters();
  const { viewAs } = useViewer();

  const [rawEmps, loadingEmps] = useLoadAction(
    loadAttendanceEmployeesAction,
    [] as TodayEmployee[],
    { viewAs },
  );
  const [rawPunches, loadingPunches, punchError, refetchPunches] = useLoadAction(
    loadTeramindDayPunchesAction,
    [] as PunchRaw[],
    { day, manager: '', viewAs },
  );
  const [rawHolidays, loadingHols] = useLoadAction(loadHolidaysAction, [] as HolidayRow[]);
  const [rawDst, loadingDst] = useLoadAction(loadDstCalendarAction, [] as DstRow[]);

  // 60-second refresh interval — only on today
  const refetchRef = useRef(refetchPunches);
  refetchRef.current = refetchPunches;
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => {
      setNowMin(easternMinutes(Date.now()));
      refetchRef.current();
    }, 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  const employees = useMemo(() => {
    const raw = (rawEmps as TodayEmployee[]) ?? [];
    return raw.filter(e =>
      matchesManager(e, manager) &&
      (!role || e.role === role) &&
      (!globalEmployee ||
        e.name?.toLowerCase().includes(globalEmployee.toLowerCase()) ||
        e.email?.toLowerCase().includes(globalEmployee.toLowerCase()))
    ).map(e => ({
      ...e,
      id: Number(e.id),
      grace_minutes: Number(e.grace_minutes),
      start_date: e.start_date || null,
    }));
  }, [rawEmps, manager, role, globalEmployee]);

  const punches = useMemo(() => {
    return ((rawPunches as PunchRaw[]) ?? []).map(p => ({
      employee_id: Number(p.employee_id),
      first_min: p.first_min !== null && p.first_min !== undefined ? Number(p.first_min) : null,
      last_ymd: p.last_ymd !== null && p.last_ymd !== undefined ? Number(p.last_ymd) : null,
      last_min: p.last_min !== null && p.last_min !== undefined ? Number(p.last_min) : null,
      records: Number(p.records ?? 0),
      active_s: Number(p.active_s ?? 0),
      has_manual: Boolean(p.has_manual),
      synced_at: p.synced_at,
    }));
  }, [rawPunches]);

  const dataAsOf = useMemo(() => {
    const vals = ((rawPunches as PunchRaw[]) ?? [])
      .map(p => p.synced_at)
      .filter((v): v is string => !!v);
    if (!vals.length) return '—';
    const newest = vals.reduce((a, b) => (a > b ? a : b));
    const ms = new Date(newest).getTime();
    return Number.isFinite(ms) ? fmtClock(easternMinutes(ms)) : '—';
  }, [rawPunches]);

  const holidays = (rawHolidays as HolidayRow[]) ?? [];
  const dstWindows = (rawDst as DstRow[]) ?? [];

  const { rows: allRows, summary } = useMemo(() => {
    if (employees.length === 0) return { rows: [], summary: { total: 0, scheduled: 0, working: 0, away: 0, notInYet: 0, lateNotIn: 0, finished: 0, dayOff: 0, holiday: 0, lateArrivals: 0 } };
    return buildToday({
      day, nowMin, isToday,
      employees,
      punches,
      holidays,
      dstWindows,
      helpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes },
    });
  }, [day, nowMin, isToday, employees, punches, holidays, dstWindows]);

  // Drop day_off rows with zero records from the visible table and tile counts
  const rows = useMemo(() =>
    allRows.filter(r => !(r.status === 'day_off' && r.records === 0)),
    [allRows]
  );

  // Maps for useTodayWhy
  const scheduledById = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const r of allRows) {
      m.set(r.employeeId, r.status !== 'day_off' && r.status !== 'not_started');
    }
    return m;
  }, [allRows]);

  const hasActivityById = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const r of allRows) {
      m.set(r.employeeId, r.records > 0);
    }
    return m;
  }, [allRows]);

  // employees cast to ReportEmployee for useTodayWhy
  const reportEmployees = useMemo(() =>
    employees.map(e => e as unknown as ReportEmployee),
    [employees]
  );

  const { whyById, loading: whyLoading } = useTodayWhy({
    day,
    employees: reportEmployees,
    scheduledById,
    hasActivityById,
  });

  const loading = loadingEmps || loadingPunches || loadingHols || loadingDst;

  // Derived counts from rows (day_off already filtered out)
  const onLeaveCount = useMemo(() =>
    rows.filter(r => isOnLeave(r.status, whyById.get(r.employeeId) ?? null)).length,
    [rows, whyById]
  );
  const noRecordsCount = useMemo(() =>
    rows.filter(r => r.status === 'late_not_in' && !isOnLeave(r.status, whyById.get(r.employeeId) ?? null)).length,
    [rows, whyById]
  );

  // Tile counts also exclude day_off (rows already filtered)
  const scheduledCount = rows.filter(r => r.status !== 'holiday').length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header bar */}
      <div className="shrink-0 px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center gap-3">
        <Clock className="w-4 h-4 text-[#2AA876] shrink-0" />
        <span className="font-semibold text-[#1e7a56] text-sm">Live</span>
        <span className="text-slate-500 text-xs">
          Data As Of {dataAsOf} · Data Updates Every 15 Minutes · Times In US Eastern
        </span>
        {loadingPunches && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin ml-auto" />}

        {/* Day picker */}
        <div className="ml-auto flex items-center gap-2">
          {day && (
            <span className="text-[13px] text-slate-600 font-medium whitespace-nowrap">
              {fmtDayShort(day)}
            </span>
          )}
          <input
            type="date"
            value={day}
            max={today}
            onChange={e => setDay(e.target.value)}
            className="h-8 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2AA876]/30"
          />
          {!isToday && (
            <button
              onClick={() => setDay(today)}
              className="h-8 px-3 text-[13px] rounded-lg bg-[#2AA876] text-white font-medium hover:bg-[#22966a] transition-colors"
            >
              Today
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-4">
        {/* Loading state */}
        {loading && rows.length === 0 && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Activity className="w-5 h-5 animate-pulse" />
            Loading Attendance Data…
          </div>
        )}

        {punchError && rows.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 mb-3">
            Couldn't refresh just now — showing the last data loaded. It will try again in a minute.
          </div>
        )}
        {punchError && rows.length === 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
            Couldn't load today's records. It will try again in a minute; if this stays, tell an administrator.
          </div>
        )}

        {!loading && employees.length === 0 && (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            No Employees Match These Filters.
          </div>
        )}

        {employees.length > 0 && (
          <>
            {/* Summary tiles */}
            <div className="flex flex-wrap gap-3 mb-5">
              <SummaryTile label="Scheduled" value={scheduledCount} />
              {isToday && <SummaryTile label="Working" value={summary.working} accent="text-green-600" />}
              {isToday && <SummaryTile label="Away" value={summary.away} accent="text-amber-600" />}
              {isToday && <SummaryTile label="Not In Yet" value={summary.notInYet} />}
              <SummaryTile label="On Leave" value={onLeaveCount} accent={onLeaveCount > 0 ? 'text-blue-600' : undefined} />
              <SummaryTile label="No Records" value={noRecordsCount} accent={noRecordsCount > 0 ? 'text-amber-600' : undefined} />
              <SummaryTile label="Finished" value={summary.finished} accent="text-blue-600" />
              <SummaryTile label="Late Arrivals" value={summary.lateArrivals} accent={summary.lateArrivals > 0 ? 'text-red-600' : undefined} />
            </div>

            {/* Table */}
            <TodayTable rows={rows} isToday={isToday} whyById={whyById} whyLoading={whyLoading} />
          </>
        )}
      </div>
    </div>
  );
}

function TodayTable({
  rows, isToday, whyById, whyLoading,
}: {
  rows: TodayRow[];
  isToday: boolean;
  whyById: Map<number, WhyChip | null>;
  whyLoading: boolean;
}) {
  const thCls = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap select-none';
  const tdCls = 'px-3 py-2.5 text-sm text-slate-800 align-top';

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className={thCls}>Employee</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Why</th>
              <th className={thCls}>Scheduled</th>
              <th className={thCls}>Entry</th>
              <th className={thCls}>Late</th>
              <th className={thCls}>Last Activity</th>
              {isToday && <th className={thCls}>Idle</th>}
              <th className={thCls}>Active Time</th>
              <th className={thCls}>Records</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => (
              <TodayTableRow
                key={row.employeeId}
                row={row}
                isToday={isToday}
                why={whyLoading ? undefined : (whyById.get(row.employeeId) ?? null)}
                tdCls={tdCls}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
