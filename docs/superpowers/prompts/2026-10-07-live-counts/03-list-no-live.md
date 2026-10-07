# Count unprocessed days, step 3 of 4: List without Live tags; delete LiveBadge.tsx

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Saul (2026-10-07): days payroll hasn't processed must **count in every total exactly as payroll
would count them** (late / on time from Teramind; Monday form / PTO / holiday as usual; a past
workday with no punches and nothing on file = absent; today counts only once someone has punched
in), and the **Live pills and notes go** — they were confusing. When payroll processes a day, its
row replaces the Teramind stand-in automatically.

The List loses its "N live days not yet counted" note and its "Live · N" chip; Day by Day shows the
normal status for every day; the arrival chart includes every day. Afterwards nothing uses
`LiveBadge.tsx` any more.

**Only these files may change:** the four whole files below, plus exactly one edit in
`src/app/pages/attendance/AttendancePanelBody.tsx`, and **delete the file
`src/app/pages/attendance/LiveBadge.tsx`** (after the edits, so nothing imports it). No other file
may be touched.

## `src/app/pages/Attendance.tsx` (whole file)

```tsx
import { useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import { useLocation } from 'react-router-dom';
import { Activity } from 'lucide-react';
import loadAttendanceDailyAction from '@/actions/loadAttendanceDaily';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import {
  AttendanceRow, EmpInfo, computeEmployeeStats, computeCompanyKpis,
} from '@/app/lib/attendanceStats';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { AttendanceKpis }   from '@/app/pages/attendance/AttendanceKpis';
import { AttendanceTable }  from '@/app/pages/attendance/AttendanceTable';
import { AttendancePanel }  from '@/app/pages/attendance/AttendancePanel';
import AttendanceReport     from '@/app/pages/attendance/AttendanceReport';
import AttendanceToday      from '@/app/pages/attendance/AttendanceToday';
import AttendanceActivity   from '@/app/pages/attendance/activity/AttendanceActivity';
import { matchesManager }   from '@/app/lib/managerFilter';
import type { ReportEmployee } from '@/app/lib/attendanceReportTypes';
import { useLiveListRows } from '@/app/pages/attendance/useLiveListRows';
import { useState } from 'react';

type Tab = 'list' | 'reports' | 'today' | 'activity';

function tabFromPath(pathname: string): Tab {
  if (pathname.includes('/reports'))  return 'reports';
  if (pathname.includes('/activity')) return 'activity';
  if (pathname.includes('/list'))     return 'list';
  return 'today';
}

// Reports/Today/Activity tabs have their own data layer — render them without loading the heavy daily view
export default function Attendance() {
  const { pathname } = useLocation();

  const tab: Tab = tabFromPath(pathname);

  if (tab === 'today')    return <AttendanceToday />;
  if (tab === 'reports')  return <AttendanceReport />;
  if (tab === 'activity') return <AttendanceActivity />;

  return <AttendanceInner tab="list" />;
}

function AttendanceInner({ tab }: { tab: 'list' }) {
  const {
    dateFrom, dateTo,
    employee: globalEmployee,
    manager, role,
  } = useGlobalFilters();
  const { viewAs } = useViewer();

  const [panelEmail, setPanelEmail] = useState<string | null>(null);

  function today() { return toLocalYMD(new Date()); }
  function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return toLocalYMD(d); }
  const safeFrom = dateFrom || daysAgo(30);
  const safeTo   = dateTo   || today();

  const [rawRows, loadingRows, rowsError] = useLoadAction(
    loadAttendanceDailyAction,
    [] as AttendanceRow[],
    { dateFrom: safeFrom, dateTo: safeTo, email: '', viewAs },
  );
  const [empList, loadingEmps] = useLoadAction(
    loadAttendanceEmployeesAction,
    [] as EmpInfo[],
    { viewAs },
  );

  const rows = (rawRows as AttendanceRow[]) ?? [];
  const emps = (empList as EmpInfo[]) ?? [];

  // Days payroll has not processed yet (from Teramind) are appended and counted like any day.
  const live = useLiveListRows({
    dateFrom: safeFrom, dateTo: safeTo, viewAs,
    employees: empList as unknown as ReportEmployee[], official: rows,
  });
  const allRows = useMemo(
    () => (live.rows.length > 0 ? [...rows, ...live.rows] : rows),
    [rows, live.rows],
  );

  const empMap = useMemo(() => {
    const m = new Map<string, EmpInfo>();
    emps.forEach(e => m.set(e.email, e));
    return m;
  }, [emps]);

  const matchEmails = useMemo(
    () => new Set(
      emps
        .filter(e =>
          matchesManager(e, manager) &&
          (!role || e.role === role) &&
          (!globalEmployee || e.name?.toLowerCase().includes(globalEmployee.toLowerCase()) ||
            e.email?.toLowerCase().includes(globalEmployee.toLowerCase()))
        )
        .map(e => e.email),
    ),
    [emps, manager, role, globalEmployee],
  );

  const filteredRows = useMemo(
    () => allRows.filter(r => matchEmails.has(r.email)),
    [allRows, matchEmails],
  );

  const empStats = useMemo(
    () => computeEmployeeStats(filteredRows, empMap, matchEmails),
    [filteredRows, empMap, matchEmails],
  );

  const kpis = useMemo(() => computeCompanyKpis(filteredRows), [filteredRows]);

  const panelStats = panelEmail ? empStats.find(s => s.email === panelEmail) ?? null : null;
  const panelEmpId = panelEmail ? Number((empMap.get(panelEmail) as { id?: number } | undefined)?.id) : NaN;
  // Wait for those days too, so the numbers never flash without them.
  const loading = loadingRows || loadingEmps || live.loading;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-auto px-4 py-4 w-full">
        <div className="w-full">
          {loading && (
            <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
              <Activity className="w-5 h-5 animate-pulse" />
              Loading attendance data…
            </div>
          )}

          {rowsError && (
            <div className="bg-status-red-tint border border-status-red-fill rounded-lg px-4 py-3 text-sm text-status-red-ink mb-4">
              Error loading data. The view may not be created yet — apply the migration first.
            </div>
          )}

          {!loading && (
            <>
              <AttendanceKpis kpis={kpis} />
              {live.error && (
                <div className="-mt-2 mb-4 px-1 text-xs text-slate-500">
                  Teramind could not be loaded, so days payroll has not processed yet are not counted.
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold">Employee Directory</span>
                    <span className="bg-muted text-muted-foreground text-xs font-medium px-2.5 py-1 rounded-full">
                      {empStats.length} employees
                    </span>
                  </div>
                </div>
                <AttendanceTable stats={empStats} onRowClick={setPanelEmail} search={globalEmployee} />
              </div>
            </>
          )}
        </div>
      </div>

      {panelEmail && (
        <AttendancePanel stats={panelStats} employeeId={Number.isFinite(panelEmpId) ? panelEmpId : undefined} onClose={() => setPanelEmail(null)} />
      )}
    </div>
  );
}
```

## `src/app/pages/attendance/AttendanceKpis.tsx` (whole file)

```tsx
import { CompanyKpis } from '@/app/lib/attendanceStats';

type Tone = 'lead' | 'alert' | 'plain';
type Props = { kpis: CompanyKpis };

function Kpi({
  label, value, sub, color, tone = 'plain', tooltip,
}: {
  label: string; value: string; sub?: string; color?: string; tone?: Tone; tooltip?: string;
}) {
  const cardCls = tone === 'lead'
    ? 'bg-white rounded-lg border border-primary p-3 shadow-[inset_3px_0_0_var(--primary)] min-w-0'
    : 'bg-white rounded-lg border border-border p-3 shadow-card min-w-0';

  const valueCls = tone === 'plain'
    ? 'text-2xl font-bold tracking-tight leading-none tabular-nums mb-0.5 text-foreground'
    : `text-2xl font-bold tracking-tight leading-none tabular-nums mb-0.5 ${color ?? ''}`;

  return (
    <div className={cardCls}>
      <div
        className="text-xs font-semibold text-slate-600 mb-1 truncate cursor-default"
        title={tooltip}
        tabIndex={tooltip ? 0 : undefined}
        aria-label={tooltip ? `${label}: ${tooltip}` : undefined}
      >
        {label}{tooltip && <span className="ml-0.5 opacity-50">ⓘ</span>}
      </div>
      <div className={valueCls}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

export function AttendanceKpis({ kpis }: Props) {
  const totalCheck = kpis.onTime + kpis.lateDays + kpis.absent + kpis.excused + kpis.permission;
  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-10 gap-2 mb-1">
        <Kpi
          label="On-Time Rate"
          value={`${kpis.onTimeRate.toFixed(1)}%`}
          sub={`${kpis.onTime} of ${kpis.daysTracked} Expected`}
          tone="lead"
          color="text-secondary"
          tooltip="On-time days divided by expected days (on time + late + absent). Time off and permissions are not counted either way."
        />
        <Kpi
          label="Late Rate"
          value={`${kpis.lateRate.toFixed(1)}%`}
          sub={`${kpis.lateDays} of ${kpis.daysTracked} Expected`}
          tone="alert"
          color="text-status-yellow-ink"
          tooltip="Late days divided by expected days (on time + late + absent)."
        />
        <Kpi
          label="Work Days"
          value={`${kpis.workDays}`}
          sub="Scheduled Shifts"
          tone="plain"
          tooltip="Every day someone was scheduled on their shift in this range, including time off and permissions."
        />
        <Kpi
          label="Late Days"
          value={`${kpis.lateDays}`}
          sub={`${kpis.lateReported} Reported · ${kpis.lateUnreported} Not`}
          tone="plain"
          tooltip="Days someone clocked in after their shift start."
        />
        <Kpi
          label="Avg Min Late"
          value={`${kpis.avgMinLate.toFixed(1)}m`}
          sub="Per Late Day"
          tone="plain"
          tooltip="Average minutes late across the late days only. On-time days and absences are not included."
        />
        <Kpi
          label="Absent Days"
          value={`${kpis.absent}`}
          sub="Reported or Not"
          tone="alert"
          color="text-status-red-ink"
          tooltip="Scheduled to work with no clock-in and no time off or permission covering the day, whether or not a form was filed."
        />
        <Kpi
          label="Reported"
          value={`${kpis.reported}`}
          sub="Late/Absent, Form Filed"
          tone="plain"
          tooltip="Late or absent days with an attendance form on file."
        />
        <Kpi
          label="Unreported"
          value={`${kpis.unreported}`}
          sub="Late/Absent, No Form"
          tone="alert"
          color="text-status-red-ink"
          tooltip="Late or absent days with no attendance form on file."
        />
        <Kpi
          label="Time Off"
          value={`${kpis.excused}`}
          sub="PTO, Holidays"
          tone="plain"
          tooltip="Approved days away: PTO, company holidays, birthday and compensatory days. These never affect the score."
        />
        <Kpi
          label="Permission"
          value={`${kpis.permission}`}
          sub="Approved"
          tone="plain"
          tooltip="An approved permission covered the day. Does not affect the score."
        />
      </div>
      <div className="text-[11px] text-muted-foreground px-1">
        On Time ({kpis.onTime}) + Late ({kpis.lateDays}) + Absent ({kpis.absent}) + Time Off ({kpis.excused}) + Permission ({kpis.permission}) = {totalCheck} = Work Days ({kpis.workDays})
      </div>
    </div>
  );
}
```

## `src/app/pages/attendance/AttendanceTable.tsx` (whole file)

```tsx
import { useState } from 'react';
import { EmpStats } from '@/app/lib/attendanceStats';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import InfoTip from '@/app/components/InfoTip';

type SortKey = keyof EmpStats | 'reporting';

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: 'asc' | 'desc' }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30 inline ml-0.5" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 inline ml-0.5 text-warm-text" />
    : <ChevronDown className="w-3 h-3 inline ml-0.5 text-warm-text" />;
}

function PctBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-status-green-ink' : pct >= 75 ? 'bg-status-yellow-ink' : 'bg-status-red-ink';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-border rounded-full min-w-10">
        <div className={`h-1 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

const STATUS_TOOLTIP = 'Based on on-time rate alone: Good is 90% or above, Fair is 75–89%, At Risk is below 75%.';

function StatusBadge({ pct, days }: { pct: number; days: number }) {
  if (days === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (pct >= 90) return (
    <span
      title={STATUS_TOOLTIP}
      tabIndex={0}
      aria-label={`Good — ${STATUS_TOOLTIP}`}
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-green-fill text-status-green-ink cursor-default"
    >
      Good
    </span>
  );
  if (pct >= 75) return (
    <span
      title={STATUS_TOOLTIP}
      tabIndex={0}
      aria-label={`Fair — ${STATUS_TOOLTIP}`}
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-yellow-fill text-status-yellow-ink cursor-default"
    >
      Fair
    </span>
  );
  return (
    <span
      title={STATUS_TOOLTIP}
      tabIndex={0}
      aria-label={`At Risk — ${STATUS_TOOLTIP}`}
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-red-fill text-status-red-ink cursor-default"
    >
      At Risk
    </span>
  );
}

const REPORTING_TOOLTIP = 'Of the days that needed an explanation — late or absent — how many had a GAF Attendance form on file.';

/** Ratio for sorting: -1 means needed=0 (always last in both directions) */
function reportingRatio(s: EmpStats): number {
  if (s.filing.needed === 0) return -1;
  return s.filing.filed / s.filing.needed;
}

function ReportingBadge({ s }: { s: EmpStats }) {
  const { filed, needed } = s.filing;
  if (needed === 0) {
    return <span className="text-muted-foreground text-xs tabular-nums">—</span>;
  }
  const label = `${filed}/${needed}`;
  if (filed === needed) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-green-fill text-status-green-ink">Complete</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{label}</span>
      </span>
    );
  }
  const missing = needed - filed;
  if (missing < needed / 2) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-yellow-fill text-status-yellow-ink">Gaps</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-red-fill text-status-red-ink">Rarely</span>
      <span className="text-[11px] text-muted-foreground tabular-nums">{label}</span>
    </span>
  );
}

type Props = { stats: EmpStats[]; onRowClick: (email: string) => void; search: string };

export function AttendanceTable({ stats, onRowClick, search }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = stats.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'reporting') {
      const ar = reportingRatio(a), br = reportingRatio(b);
      // needed=0 rows always last (ratio=-1) regardless of direction
      if (ar === -1 && br === -1) return 0;
      if (ar === -1) return 1;
      if (br === -1) return -1;
      return sortDir === 'asc' ? ar - br : br - ar;
    }
    const av = a[sortKey as keyof EmpStats], bv = b[sortKey as keyof EmpStats];
    if (typeof av === 'string' && typeof bv === 'string')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    if (typeof av === 'number' && typeof bv === 'number')
      return sortDir === 'asc' ? av - bv : bv - av;
    return 0;
  });

  const Th = ({ label, col, tooltip }: { label: string; col: SortKey; tooltip?: string }) => (
    <th
      className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap bg-slate-50 border-b border-border hover:text-foreground"
      onClick={() => handleSort(col)}
      title={tooltip}
    >
      {label}{tooltip && <InfoTip text={tooltip} />}<SortIcon col={col} sortKey={sortKey} dir={sortDir} />
    </th>
  );

  return (
    <div className="bg-white rounded-lg border border-border shadow-card overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th label="Employee"         col="name"      tooltip="Name from the roster. Click a row to open the viewer." />
              <Th label="Role"             col="role"      tooltip="Role from the Employee Directory." />
              <Th label="Manager"          col="manager"   tooltip="Manager from the Employee Directory." />
              <Th label="Schedule"         col="schedule"  tooltip="The shift assigned in Admin → Schedules; lateness is measured against its start time." />
              <th
                className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-border whitespace-nowrap cursor-default"
                title={STATUS_TOOLTIP}
              >
                Status<InfoTip text={STATUS_TOOLTIP} />
              </th>
              <Th label="Reporting" col="reporting" tooltip={REPORTING_TOOLTIP} />
              <Th label="Expected"         col="days"        tooltip="Scheduled work days in range, excluding time off and permissions." />
              <Th label="On Time"          col="onTime"      tooltip="Days clocked in at or before the scheduled start." />
              <Th label="Total Late"       col="totalLate"   tooltip="Days clocked in after the scheduled start (Reported + Unreported)." />
              <Th label="Reported"         col="reported"    tooltip="Late days that had a GAF Attendance form on file." />
              <Th label="Unreported"       col="unreported"  tooltip="Late days with no GAF Attendance form." />
              <Th label="Absent"           col="absent"      tooltip="Scheduled days with no clock-in and no time off or permission." />
              <Th label="Avg Min (Worked)" col="avgMinLate"  tooltip="Average minutes late across the days someone actually worked." />
              <Th label="% On-Time"        col="pctOnTime"   tooltip="On Time ÷ Expected. Green 90%+, amber 75–89%, red below 75%." />
              <Th label="1–10m"            col="b1to10"      tooltip="Late days where the delay was 1 to 10 minutes." />
              <Th label="11–30m"           col="b11to30"     tooltip="Late days where the delay was 11 to 30 minutes." />
              <Th label="31+m"             col="b31plus"     tooltip="Late days where the delay was more than 30 minutes." />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={17} className="px-4 py-12 text-center text-muted-foreground">No employees match these filters.</td></tr>
            )}
            {sorted.map(s => (
              <tr key={s.email}
                className="border-b border-border/60 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => onRowClick(s.email)}>
                <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">{s.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.role || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.manager || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.schedule}</td>
                <td className="px-3 py-2.5"><StatusBadge pct={s.pctOnTime} days={s.days} /></td>
                <td className="px-3 py-2.5"><ReportingBadge s={s} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums">{s.days}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-status-green-ink font-medium">{s.onTime}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-status-yellow-ink font-medium">{s.totalLate}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-status-yellow-ink">{s.reported}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-status-red-ink">{s.unreported}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-status-red-ink">{s.absent}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{s.avgMinLate.toFixed(1)}</td>
                <td className="px-3 py-2.5 min-w-[120px]"><PctBar pct={s.pctOnTime} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs">{s.b1to10}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs">{s.b11to30}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs">{s.b31plus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## `src/app/pages/attendance/AttendancePanelDays.tsx` (whole file)

```tsx
import type { ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import type { AttendanceRow } from '@/app/lib/attendanceStats';
import { STATUS_COLORS } from './AttendancePanelBody';
import WhyChipBadge from './activity/WhyChipBadge';
import SourceBadge from './activity/SourceBadge';
import GhostMark from './activity/GhostMark';

type Props = {
  days: ActivityDay[];
  attendanceRows?: AttendanceRow[];
};

const TH = 'px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap';
const TD = 'px-3 py-2 text-xs text-slate-700';

/** House minutes format: '45 min', '1h 15m'. */
const fmtMins = (m: number): string => (m < 60 ? `${m} min` : fmtDuration(m));

function toDateKey(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

export default function AttendancePanelDays({ days, attendanceRows = [] }: Props) {
  // Index attendance rows by YYYY-MM-DD for O(1) lookup
  const attByDate = new Map<string, AttendanceRow>();
  for (const r of attendanceRows) {
    const key = toDateKey(r.date);
    if (key) attByDate.set(key, r);
  }

  // Newest first
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-semibold mb-3">
        <div className="w-0.5 h-3.5 bg-primary rounded-full" />
        Day by Day
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No activity data for this range.
        </p>
      ) : (
        <div className="bg-white border border-border rounded-lg shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className={TH}>Date</th>
                  <th className={TH}>Entry</th>
                  <th className={TH}>Exit</th>
                  <th className={TH}>Active</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Late</th>
                  <th className={TH}>Why</th>
                  <th className={TH}>Source</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(d => {
                  const att = attByDate.get(d.date);
                  const rowBg = d.needsLook ? 'bg-status-yellow-tint' : 'hover:bg-slate-50';
                  return (
                    <tr key={d.date} className={`border-b border-border/50 ${rowBg}`}>
                      <td className={TD}>{fmtDayShort(d.date)}</td>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>
                        {d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'}
                        <GhostMark ghostMin={d.ghostMin} />
                      </td>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>
                        {d.shownLastMin !== null
                          ? fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')
                          : '—'}
                      </td>
                      <td className={`${TD} tabular-nums`}>{fmtDuration(d.activeMin)}</td>
                      <td className={TD}>
                        {att ? (
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: STATUS_COLORS[att.status] ?? '#ccc' }}
                            />
                            <span className="whitespace-nowrap">{att.status}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className={`${TD} tabular-nums whitespace-nowrap`}>
                        {att && att.minutes_late > 0
                          ? <span className="text-status-yellow-ink">{fmtMins(att.minutes_late)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={TD}>
                        <div className="flex flex-wrap gap-1">
                          {d.needsLook && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-status-yellow-fill text-status-yellow-ink">
                              Needs a Look
                            </span>
                          )}
                          {d.flag === 'long_break' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Long Break
                            </span>
                          )}
                          {d.why ? <WhyChipBadge chip={d.why} /> : <span className="text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className={TD}>
                        <SourceBadge official={d.official} edited={d.edited} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

## `src/app/pages/attendance/AttendancePanelBody.tsx`: one edit

Replace exactly

```tsx
  const scatterPoints = computeArrivalScatter(stats.rows.filter(r => !r.live)).map(p => ({
```

with exactly

```tsx
  const scatterPoints = computeArrivalScatter(stats.rows).map(p => ({
```

## Report
- Byte size of the five files; confirm `LiveBadge.tsx` is deleted and nothing imports it, no other
  file changed; Attendance → List renders and opens an employee with no console errors.
