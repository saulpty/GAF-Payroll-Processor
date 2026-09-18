import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import { Activity, Clock, RefreshCw } from 'lucide-react';
import InfoTip from '@/app/components/InfoTip';
import TodayTiles from './TodayTiles';
import { easternDate, easternMinutes } from '@/app/lib/teramindTime';
import { buildToday, fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import type { TodayEmployee, TodayPunch, TodayRow, TodayStatus } from '@/app/lib/teramindToday';
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '@/app/lib/classificationEngine';
import { fmtDayShort } from '@/app/lib/activityDays';
import type { WhyChip } from '@/app/lib/activityDays';
import { matchesManager } from '@/app/lib/managerFilter';
import { useTodayWhy } from './useTodayWhy';
import { TodayTableRow, isOnLeave } from './TodayRow';
import { AttendancePanel } from './AttendancePanel';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import loadTeramindDayPunchesAction from '@/actions/loadTeramindDayPunches';
import loadHolidaysAction from '@/actions/loadHolidays';
import loadDstCalendarAction from '@/actions/loadDstCalendar';
import type { ReportEmployee } from '@/app/lib/attendanceReportTypes';

type HolidayRow = { date: string; name: string };
type DstRow = { year: number; us_dst_start: string; us_dst_end: string };
type PunchRaw = TodayPunch & { synced_at: string | null };

const ON_LEAVE_KINDS = new Set<string>(['pto', 'permission', 'sick', 'form', 'holiday']);


export default function AttendanceToday() {
  const today = easternDate(Date.now());
  const [day, setDay] = useState(today);
  const isToday = day === today;
  const [panelRow, setPanelRow] = useState<TodayRow | null>(null);

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

  const { dataAsOf, dataAsOfMin } = useMemo(() => {
    const vals = ((rawPunches as PunchRaw[]) ?? [])
      .map(p => p.synced_at)
      .filter((v): v is string => !!v);
    if (!vals.length) return { dataAsOf: '—', dataAsOfMin: null };
    const newest = vals.reduce((a, b) => (a > b ? a : b));
    const ms = new Date(newest).getTime();
    if (!Number.isFinite(ms)) return { dataAsOf: '—', dataAsOfMin: null };
    const min = easternMinutes(ms);
    return { dataAsOf: fmtClock(min), dataAsOfMin: min };
  }, [rawPunches]);

  const holidays = (rawHolidays as HolidayRow[]) ?? [];
  const dstWindows = (rawDst as DstRow[]) ?? [];

  // When today's data is stale (last sync >2 min ago), judge statuses against the
  // data's own clock rather than the wall clock. This prevents every employee
  // from appearing Away just because the keep-fresh sync didn't run recently.
  const statusNowMin = isToday && dataAsOfMin !== null && nowMin - dataAsOfMin > 2
    ? dataAsOfMin
    : nowMin;

  const { rows: allRows, summary } = useMemo(() => {
    if (employees.length === 0) return { rows: [], summary: { total: 0, scheduled: 0, working: 0, away: 0, notInYet: 0, lateNotIn: 0, finished: 0, dayOff: 0, holiday: 0, lateArrivals: 0 } };
    return buildToday({
      day, nowMin: statusNowMin, isToday,
      employees,
      punches,
      holidays,
      dstWindows,
      helpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes },
    });
  }, [day, statusNowMin, isToday, employees, punches, holidays, dstWindows, dataAsOfMin]);

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
        <span className="font-semibold text-[#1e7a56] text-sm flex items-center gap-0.5">
          Live
          <InfoTip text="Teramind data syncs every 15 minutes. The time shown is the latest sync received." />
        </span>
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

      {/* Stale data notice — only for today, only when data is >25 min old */}
      {isToday && dataAsOfMin !== null && nowMin - dataAsOfMin > 25 && (
        <div className="shrink-0 px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
          Data Is {nowMin - dataAsOfMin} Minutes Old — Statuses Are As Of {fmtClock(dataAsOfMin)}. It Refreshes While A Super User Has The Hub Open.
        </div>
      )}

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
            <TodayTiles
              scheduledCount={scheduledCount}
              isToday={isToday}
              summary={summary}
              onLeaveCount={onLeaveCount}
              noRecordsCount={noRecordsCount}
            />

            {/* Table */}
            <TodayTable rows={rows} isToday={isToday} whyById={whyById} whyLoading={whyLoading} onRowClick={setPanelRow} />
          </>
        )}
      </div>

      {panelRow && (
        <AttendancePanel
          stats={null}
          employeeId={panelRow.employeeId}
          displayName={panelRow.name}
          displayRole={panelRow.role}
          onClose={() => setPanelRow(null)}
        />
      )}
    </div>
  );
}

function TodayTable({
  rows, isToday, whyById, whyLoading, onRowClick,
}: {
  rows: TodayRow[];
  isToday: boolean;
  whyById: Map<number, WhyChip | null>;
  whyLoading: boolean;
  onRowClick?: (row: TodayRow) => void;
}) {
  const thCls = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap select-none';
  const tdCls = 'px-3 py-2.5 text-sm text-slate-800 align-top';

  // Event delegation: find the closest <tr> ancestor from the click target,
  // then match its index in rows array.
  function handleBodyClick(e: React.MouseEvent<HTMLTableSectionElement>) {
    if (!onRowClick) return;
    const tr = (e.target as Element).closest('tr');
    if (!tr) return;
    const tbody = tr.parentElement;
    if (!tbody) return;
    const idx = Array.from(tbody.children).indexOf(tr);
    if (idx >= 0 && idx < rows.length) onRowClick(rows[idx]);
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className={thCls}>Employee <InfoTip text="Employee name and role from the directory." /></th>
              <th className={thCls}>Status <InfoTip text="Current attendance status computed from Teramind activity and schedule." /></th>
              <th className={thCls}>Why <InfoTip text="Reason pulled from Monday.com forms or the holiday calendar." /></th>
              <th className={thCls}>Scheduled <InfoTip text="Contracted shift window for today from the employee's schedule." /></th>
              <th className={thCls}>Entry <InfoTip text="First Teramind activity recorded today." /></th>
              <th className={thCls}>Late <InfoTip text="Minutes after the scheduled start (plus grace period) the employee arrived." /></th>
              <th className={thCls}>Last Activity <InfoTip text="Most recent Teramind event recorded today." /></th>
              {isToday && <th className={thCls}>Idle <InfoTip text="Time since the last activity (live only)." /></th>}
              <th className={thCls}>Active Time <InfoTip text="Total time Teramind recorded active usage today." /></th>
              <th className={thCls}>Records <InfoTip text="Number of Teramind activity records imported for today." /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 cursor-pointer" onClick={handleBodyClick}>
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
