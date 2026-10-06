# Attendance → Today: Warm look (tiles, status chips, house time formats, Title Case table)

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Saul approved the Attendance mockup (2026-10-06, https://claude.ai/artifact/UB7uj557cZ7gA6gLpYghwo).
Visual only — every status, count, filter and calculation stays exactly the same.

- **Header line:** a green "Live" chip, then `Data as of 4:14 PM · updates every 15 minutes ·
  times in US Eastern` in sentence case. The clock icon is navy; the day box and the "Today"
  button use the Warm look (orange button with navy ink).
- **Tiles:** Title Case label with a coloured dot (never ALL CAPS); numbers in the Excel inks
  (Working green, Away yellow, No Records and Late Arrivals red, On Leave and Finished blue).
- **Status chips:** Excel fills — Working green, Away yellow, No Records red. On Leave and
  Finished light blue.
- **Times:** house format `9AM–5PM`, `9:05AM`, `3:52PM` (via `fmtTime`). Lateness reads
  `+3 min` / `+2h 47m` (was `+167m`); red when past grace, amber otherwise.
- **Table:** Title Case headers on white (no ALL CAPS). The table moves to its own file
  `TodayTable.tsx` because `AttendanceToday.tsx` was 15,042 bytes, over the 15 KB limit.
- Messages in sentence case ("Loading attendance data…", "No employees match these filters.").

**Only these four files may change** (all in `src/app/pages/attendance/`):
- `AttendanceToday.tsx` — whole file below (TodayTable removed from it).
- **New** `TodayTable.tsx` — whole file below (moved out, header restyled).
- `TodayTiles.tsx` — whole file below.
- `TodayRow.tsx` — whole file below.

No other file may be touched (not `useTodayWhy.ts`, `teramindToday.ts`, `fmtTime.ts`,
`AttendancePanel*.tsx`, the Activity / List / Reports pages, any action, or `src/components/ui/*`).

## `src/app/pages/attendance/AttendanceToday.tsx` (whole file)

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import { Activity, Clock, RefreshCw } from 'lucide-react';
import InfoTip from '@/app/components/InfoTip';
import TodayTiles from './TodayTiles';
import { easternDate, easternMinutes } from '@/app/lib/teramindTime';
import { buildToday, fmtClock } from '@/app/lib/teramindToday';
import type { TodayEmployee, TodayPunch, TodayRow } from '@/app/lib/teramindToday';
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '@/app/lib/classificationEngine';
import { fmtDayShort } from '@/app/lib/activityDays';
import { matchesManager } from '@/app/lib/managerFilter';
import { useTodayWhy } from './useTodayWhy';
import { isOnLeave } from './TodayRow';
import TodayTable from './TodayTable';
import { AttendancePanel } from './AttendancePanel';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import loadTeramindDayPunchesAction from '@/actions/loadTeramindDayPunches';
import loadHolidaysAction from '@/actions/loadHolidays';
import loadDstCalendarAction from '@/actions/loadDstCalendar';
import type { ReportEmployee } from '@/app/lib/attendanceReportTypes';

type HolidayRow = { date: string; name: string };
type DstRow = { year: number; us_dst_start: string; us_dst_end: string };
type PunchRaw = TodayPunch & { synced_at: string | null; ghost_min?: number };

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
      ghost_min: p.ghost_min !== undefined ? Number(p.ghost_min) : -1,
    }));
  }, [rawPunches]);

  const ghostByEmployee = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of (rawPunches as PunchRaw[]) ?? []) {
      const gm = Number(p.ghost_min);
      if (Number.isFinite(gm) && gm >= 0) m.set(Number(p.employee_id), gm);
    }
    return m;
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

  // Everyone the viewer manages. People who are off today stay in the table (buildToday
  // already sorts them to the bottom) and are muted by TodayTableRow.
  const rows = allRows;
  const offTodayCount = useMemo(
    () => allRows.filter(r => r.status === 'day_off' && r.records === 0).length,
    [allRows],
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

  // Expected to work today: not a holiday, not a day off, not a future start date.
  // A day-off row is excluded even when the person worked anyway.
  const scheduledCount = rows.filter(
    r => r.status !== 'holiday' && r.status !== 'day_off' && r.status !== 'not_started',
  ).length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header bar */}
      <div className="shrink-0 px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center gap-3">
        <Clock className="w-4 h-4 text-primary shrink-0" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-status-green-fill px-2.5 py-0.5 text-[12px] font-semibold text-status-green-ink">
          <span className="w-1.5 h-1.5 rounded-full bg-status-green-ink" aria-hidden="true" />
          Live
        </span>
        <InfoTip text="Teramind data syncs every 15 minutes. The time shown is the latest sync received." />
        <span className="text-slate-500 text-[13px]">
          Data as of {dataAsOf} · updates every 15 minutes · times in US Eastern
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
            className="h-8 px-2.5 text-[13px] border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-warm-ring"
          />
          {!isToday && (
            <button
              onClick={() => setDay(today)}
              className="h-8 px-3 text-[13px] rounded-md bg-warm text-warm-ink font-semibold hover:brightness-95 transition"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Stale data notice — only for today, only when data is >25 min old */}
      {isToday && dataAsOfMin !== null && nowMin - dataAsOfMin > 25 && (
        <div className="shrink-0 px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
          Data is {nowMin - dataAsOfMin} minutes old — statuses are as of {fmtClock(dataAsOfMin)}. It refreshes while a super user has the Hub open.
        </div>
      )}

      <div className="flex-1 overflow-auto px-5 py-4">
        {/* Loading state */}
        {loading && rows.length === 0 && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Activity className="w-5 h-5 animate-pulse" />
            Loading attendance data…
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
            No employees match these filters.
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
              offTodayCount={offTodayCount}
            />

            {/* Table */}
            <TodayTable rows={rows} isToday={isToday} whyById={whyById} whyLoading={whyLoading} ghostByEmployee={ghostByEmployee} onRowClick={setPanelRow} />
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
```

## `src/app/pages/attendance/TodayTable.tsx` (whole file)

```tsx
import InfoTip from '@/app/components/InfoTip';
import type { TodayRow } from '@/app/lib/teramindToday';
import type { WhyChip } from '@/app/lib/activityDays';
import { TodayTableRow } from './TodayRow';

// The Today board's table (moved out of AttendanceToday.tsx on 2026-10-06 to keep both under
// 15 KB). Warm look: Title Case headers on white, never ALL CAPS.
export default function TodayTable({
  rows, isToday, whyById, whyLoading, ghostByEmployee, onRowClick,
}: {
  rows: TodayRow[];
  isToday: boolean;
  whyById: Map<number, WhyChip | null>;
  whyLoading: boolean;
  ghostByEmployee: Map<number, number>;
  onRowClick?: (row: TodayRow) => void;
}) {
  const thCls = 'px-3 py-2.5 text-left text-[12px] font-semibold tracking-[0.02em] text-slate-600 whitespace-nowrap select-none';
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
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-white border-b border-slate-200">
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
                ghostMin={ghostByEmployee.has(row.employeeId) ? (ghostByEmployee.get(row.employeeId) ?? null) : null}
                tdCls={tdCls}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## `src/app/pages/attendance/TodayTiles.tsx` (whole file)

```tsx
import InfoTip from '@/app/components/InfoTip';

// Warm look (2026-10-06): Title Case label with a coloured dot, number in the matching ink.
// dot / accent: Tailwind classes. Excel status inks for working / away / no records / late.
function SummaryTile({
  label, value, accent, dot, tip,
}: {
  label: string;
  value: number;
  accent?: string;
  dot?: string;
  tip?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-col gap-0.5 min-w-[104px] shadow-card">
      <span className={`text-[22px] leading-7 font-bold tabular-nums ${accent ?? 'text-slate-900'}`}>{value}</span>
      <span className="text-[12px] text-slate-600 font-medium flex items-center gap-1.5 whitespace-nowrap">
        <span className={`w-2 h-2 rounded-full ${dot ?? 'bg-slate-300'}`} aria-hidden="true" />
        {label}
        {tip && <InfoTip text={tip} />}
      </span>
    </div>
  );
}

interface TodayTilesProps {
  scheduledCount: number;
  isToday: boolean;
  summary: {
    working: number;
    away: number;
    notInYet: number;
    finished: number;
    lateArrivals: number;
  };
  onLeaveCount: number;
  noRecordsCount: number;
  offTodayCount: number;
}

export default function TodayTiles({
  scheduledCount,
  isToday,
  summary,
  onLeaveCount,
  noRecordsCount,
  offTodayCount,
}: TodayTilesProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <SummaryTile
        label="Scheduled"
        value={scheduledCount}
        tip="Employees expected to work today. Excludes holidays and anyone whose schedule gives them the day off."
      />
      {isToday && (
        <SummaryTile
          label="Working"
          value={summary.working}
          accent="text-status-green-ink"
          dot="bg-green-600"
          tip="Has Teramind activity in the last 15 minutes."
        />
      )}
      {isToday && (
        <SummaryTile
          label="Away"
          value={summary.away}
          accent="text-status-yellow-ink"
          dot="bg-yellow-500"
          tip="Clocked in but no activity detected in the last 15 minutes."
        />
      )}
      {isToday && (
        <SummaryTile
          label="Not In Yet"
          value={summary.notInYet}
          tip="Scheduled today, shift has started, no entry recorded yet."
        />
      )}
      <SummaryTile
        label="On Leave"
        value={onLeaveCount}
        accent={onLeaveCount > 0 ? 'text-blue-700' : undefined}
        dot="bg-blue-600"
        tip="A PTO, permission, sick form, other form, or holiday covers today."
      />
      {offTodayCount > 0 && (
        <SummaryTile
          label="Off Today"
          value={offTodayCount}
          accent="text-slate-500"
          dot="bg-slate-300"
          tip="Their schedule gives them the day off and no activity was recorded. They are listed, greyed out, at the bottom of the table."
        />
      )}
      <SummaryTile
        label="No Records"
        value={noRecordsCount}
        accent={noRecordsCount > 0 ? 'text-status-red-ink' : undefined}
        dot="bg-red-600"
        tip="Scheduled, past the grace period, no Teramind activity and no report on file."
      />
      <SummaryTile
        label="Finished"
        value={summary.finished}
        accent="text-blue-700"
        dot="bg-blue-600"
        tip="Last activity is at or after their scheduled end time."
      />
      <SummaryTile
        label="Late Arrivals"
        value={summary.lateArrivals}
        accent={summary.lateArrivals > 0 ? 'text-status-red-ink' : undefined}
        dot="bg-red-600"
        tip="Arrived after their scheduled start plus grace period."
      />
    </div>
  );
}
```

## `src/app/pages/attendance/TodayRow.tsx` (whole file)

```tsx
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import { fmtTime } from '@/app/lib/fmtTime';
import type { TodayRow, TodayStatus } from '@/app/lib/teramindToday';
import type { WhyChip } from '@/app/lib/activityDays';
import GhostMark from '@/app/pages/attendance/activity/GhostMark';

export const STATUS_CHIP: Record<TodayStatus, { label: string; cls: string }> = {
  working:     { label: 'Working',      cls: 'bg-status-green-fill text-status-green-ink border-transparent' },
  away:        { label: 'Away',         cls: 'bg-status-yellow-fill text-status-yellow-ink border-transparent' },
  not_in_yet:  { label: 'Not In Yet',  cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  late_not_in: { label: 'No Records',  cls: 'bg-status-red-fill text-status-red-ink border-transparent' },
  finished:    { label: 'Finished',     cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  day_off:     { label: 'Day Off',      cls: 'bg-slate-100 text-slate-400 border-slate-200' },
  holiday:     { label: 'Holiday',      cls: 'bg-slate-100 text-slate-400 border-slate-200' },
  not_started: { label: 'Not Started', cls: 'bg-slate-100 text-slate-400 border-slate-200' },
};

const ON_LEAVE_KINDS = new Set(['pto', 'permission', 'sick', 'form', 'holiday'] as WhyChip['kind'][]);

const WHY_CHIP_CLS: Record<WhyChip['tone'], string> = {
  blue:  'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  gray:  'bg-slate-100 text-slate-500 border-slate-200',
};

export function isOnLeave(status: TodayStatus, why: WhyChip | null | undefined): boolean {
  return status === 'late_not_in' && why !== null && why !== undefined && ON_LEAVE_KINDS.has(why.kind);
}

export function TodayTableRow({
  row, isToday, why, ghostMin, tdCls,
}: {
  row: TodayRow;
  isToday: boolean;
  why: WhyChip | null | undefined;
  ghostMin?: number | null;
  tdCls: string;
}) {
  // Status chip: override to "On Leave" when applicable
  const offToday = row.status === 'day_off' && row.records === 0;
  const onLeave = isOnLeave(row.status, why);
  const chip = onLeave
    ? { label: 'On Leave', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
    : STATUS_CHIP[row.status];
  const chipLabel =
    !onLeave && row.status === 'holiday' && row.holidayName ? row.holidayName : chip.label;

  const STATUS_TITLE: Record<string, string> = {
    working:     'Has Teramind activity in the last 15 minutes.',
    away:        'Clocked in but no activity detected in the last 15 minutes.',
    not_in_yet:  'Scheduled today, shift has started, no entry recorded yet.',
    late_not_in: 'Scheduled, past the grace period, no Teramind activity and no report on file.',
    finished:    'Last activity is at or after their scheduled end time.',
    day_off:     'Not scheduled to work today.',
    holiday:     'A company holiday — not a working day.',
    not_started: 'Shift has not started yet.',
    on_leave:    'A PTO, permission, sick form, other form or holiday covers today.',
  };
  const chipTitle = onLeave ? STATUS_TITLE.on_leave : (STATUS_TITLE[row.status] ?? '');

  // House formats (design system): 9AM–5PM, 9:05AM; minutes as 45 min, 1h 15m.
  const clock = (min: number) => fmtTime(fmtClock(min));
  const scheduledStr =
    row.scheduledStartMin !== null && row.scheduledEndMin !== null
      ? `${clock(row.scheduledStartMin)}–${clock(row.scheduledEndMin)}`
      : '—';
  const lateBy = (m: number) => (m < 60 ? `+${m} min` : `+${fmtDuration(m)}`);

  const lateStr =
    row.entryMin !== null ? (
      row.minutesLate === 0 ? (
        <span className="text-slate-500 text-xs">On time</span>
      ) : (
        <span className={row.lateAfterGrace ? 'text-status-red-ink font-semibold' : 'text-amber-700 font-medium'}>
          {lateBy(row.minutesLate)}
        </span>
      )
    ) : (
      <span className="text-slate-400">—</span>
    );

  const lastActivityStr =
    row.lastActivityMin !== null
      ? `${clock(row.lastActivityMin)}${row.lastActivityNextDay ? ' +1d' : ''}`
      : '—';

  const idleStr =
    isToday && (row.status === 'working' || row.status === 'away')
      ? fmtDuration(row.idleMinutes)
      : null;

  return (
    <tr className={`hover:bg-slate-50 transition-colors${offToday ? ' opacity-60' : ''}`}>
      <td className={tdCls}>
        <div className="font-medium leading-tight">{row.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{row.role}</div>
      </td>
      <td className={tdCls}>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${chip.cls}`}
          title={chipTitle}
        >
          {chipLabel}
        </span>
      </td>
      {/* Why column */}
      <td className={tdCls}>
        {why ? (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${WHY_CHIP_CLS[why.tone]}`}
          >
            {why.label}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className={`${tdCls} tabular-nums whitespace-nowrap text-slate-600 text-xs`}>
        {scheduledStr}
      </td>
      <td className={`${tdCls} tabular-nums whitespace-nowrap`}>
        {row.entryMin !== null ? (
          clock(row.entryMin)
        ) : (
          <span className="text-slate-400">—</span>
        )}
        <GhostMark ghostMin={ghostMin ?? null} />
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
              Manual
            </span>
          )}
          {row.records === 0 && <span className="text-slate-400">—</span>}
        </div>
      </td>
    </tr>
  );
}
```

## Report
- Byte size of the four files (each under 15,000); confirm no other file changed and that
  Attendance → Today renders (today and a past day) with no console errors.
