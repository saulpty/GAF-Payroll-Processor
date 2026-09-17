import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import { Activity, Clock, RefreshCw } from 'lucide-react';
import { easternDate, easternMinutes } from '@/app/lib/teramindTime';
import { buildToday, fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import type { TodayEmployee, TodayPunch, TodayRow, TodayStatus } from '@/app/lib/teramindToday';
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '@/app/lib/classificationEngine';
import { matchesManager } from '@/app/lib/managerFilter';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import loadTeramindDayPunchesAction from '@/actions/loadTeramindDayPunches';
import loadHolidaysAction from '@/actions/loadHolidays';
import loadDstCalendarAction from '@/actions/loadDstCalendar';

type HolidayRow = { date: string; name: string };
type DstRow = { year: number; us_dst_start: string; us_dst_end: string };
type PunchRaw = TodayPunch & { synced_at: string | null };

const STATUS_CHIP: Record<TodayStatus, { label: string; cls: string }> = {
  working:     { label: 'Working',       cls: 'bg-green-100 text-green-700 border-green-200' },
  away:        { label: 'Away',          cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  not_in_yet:  { label: 'Not In Yet',   cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  late_not_in: { label: 'No Records',    cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  finished:    { label: 'Finished',      cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  day_off:     { label: 'Day Off',       cls: 'bg-slate-100 text-slate-400 border-slate-200' },
  holiday:     { label: 'Holiday',       cls: 'bg-slate-100 text-slate-400 border-slate-200' },
  not_started: { label: 'Not Started',  cls: 'bg-slate-100 text-slate-400 border-slate-200' },
};

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

  const { rows, summary } = useMemo(() => {
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

  const loading = loadingEmps || loadingPunches || loadingHols || loadingDst;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header bar */}
      <div className="shrink-0 px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center gap-3">
        <Clock className="w-4 h-4 text-[#2AA876] shrink-0" />
        <span className="font-semibold text-[#1e7a56] text-sm">Live View — Unofficial.</span>
        <span className="text-slate-500 text-xs">
          Data As Of {dataAsOf}. Records refresh about every 15 minutes while a super user has the Hub open. Times are US Eastern.
        </span>
        <span className="w-full text-[11px] text-muted-foreground mt-0.5">
          Leave, sick forms and permissions are not shown here yet — 'No Records' does not mean absent without reason. Check Attendance → Reports for the official record.
        </span>
        {loadingPunches && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin ml-auto" />}

        {/* Day picker */}
        <div className="ml-auto flex items-center gap-2">
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
            Loading attendance data…
          </div>
        )}

        {punchError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
            Error loading punch data. The teramind_sessions table may not exist yet — apply migrations first.
          </div>
        )}

        {!loading && employees.length === 0 && (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            No employees match these filters.
          </div>
        )}

        {employees.length > 0 && (
          <>
            {/* Summary tiles */}
            <div className="flex flex-wrap gap-3 mb-5">
              <SummaryTile label="Scheduled" value={summary.scheduled} />
              {isToday && <SummaryTile label="Working" value={summary.working} accent="text-green-600" />}
              {isToday && <SummaryTile label="Away" value={summary.away} accent="text-amber-600" />}
              {isToday && <SummaryTile label="Not In Yet" value={summary.notInYet} />}
              <SummaryTile label="No Records" value={summary.lateNotIn} accent={summary.lateNotIn > 0 ? 'text-amber-600' : undefined} />
              <SummaryTile label="Finished" value={summary.finished} accent="text-blue-600" />
              <SummaryTile label="Day Off / Holiday" value={summary.dayOff + summary.holiday} />
              <SummaryTile label="Late Arrivals" value={summary.lateArrivals} accent={summary.lateArrivals > 0 ? 'text-red-600' : undefined} />
            </div>

            {/* Table */}
            <TodayTable rows={rows} isToday={isToday} />
          </>
        )}
      </div>
    </div>
  );
}

function TodayTable({ rows, isToday }: { rows: TodayRow[]; isToday: boolean }) {
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
              <TodayTableRow key={row.employeeId} row={row} isToday={isToday} tdCls={tdCls} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TodayTableRow({ row, isToday, tdCls }: { row: TodayRow; isToday: boolean; tdCls: string }) {
  const chip = STATUS_CHIP[row.status];
  const chipLabel = row.status === 'holiday' && row.holidayName ? row.holidayName : chip.label;

  const scheduledStr =
    row.scheduledStartMin !== null && row.scheduledEndMin !== null
      ? `${fmtClock(row.scheduledStartMin)} – ${fmtClock(row.scheduledEndMin)}`
      : '—';

  const lateStr = row.entryMin !== null
    ? row.minutesLate === 0
      ? <span className="text-slate-400 text-xs">on time</span>
      : <span className={row.lateAfterGrace ? 'text-red-600 font-medium' : 'text-amber-600'}>+{row.minutesLate}m</span>
    : <span className="text-slate-400">—</span>;

  const lastActivityStr = row.lastActivityMin !== null
    ? `${fmtClock(row.lastActivityMin)}${row.lastActivityNextDay ? ' +1d' : ''}`
    : '—';

  const idleStr = (isToday && (row.status === 'working' || row.status === 'away'))
    ? fmtDuration(row.idleMinutes)
    : null;

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className={tdCls}>
        <div className="font-medium leading-tight">{row.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{row.role}</div>
      </td>
      <td className={tdCls}>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${chip.cls}`}>
          {chipLabel}
        </span>
      </td>
      <td className={`${tdCls} tabular-nums whitespace-nowrap text-slate-600 text-xs`}>
        {scheduledStr}
      </td>
      <td className={`${tdCls} tabular-nums whitespace-nowrap`}>
        {row.entryMin !== null ? fmtClock(row.entryMin) : <span className="text-slate-400">—</span>}
      </td>
      <td className={`${tdCls} tabular-nums`}>{lateStr}</td>
      <td className={`${tdCls} tabular-nums whitespace-nowrap`}>
        {lastActivityStr !== '—' ? lastActivityStr : <span className="text-slate-400">—</span>}
      </td>
      {isToday && (
        <td className={`${tdCls} tabular-nums`}>
          {idleStr !== null ? idleStr : <span className="text-slate-300">—</span>}
        </td>
      )}
      <td className={`${tdCls} tabular-nums`}>
        {row.activeMinutes > 0 ? fmtDuration(row.activeMinutes) : <span className="text-slate-400">—</span>}
      </td>
      <td className={tdCls}>
        <div className="flex items-center gap-1.5">
          {row.records > 0 && (
            <span className="text-xs text-slate-600 tabular-nums">{row.records}</span>
          )}
          {row.hasManual && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
              manual
            </span>
          )}
          {row.records === 0 && <span className="text-slate-400">—</span>}
        </div>
      </td>
    </tr>
  );
}
