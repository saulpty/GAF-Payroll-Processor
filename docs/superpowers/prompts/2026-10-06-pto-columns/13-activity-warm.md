# Attendance → Activity: Warm look

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Same look as Attendance → Today (approved 2026-10-06). Visual only — every number, flag,
threshold, sort and click behaves exactly as before.
- Tiles: Title Case label with a coloured dot (never ALL CAPS); Avg Active Time in Excel green,
  Needs a Look in Excel yellow, Late Arrivals in Excel red when above zero.
- By Employee / By Day switch: navy (`bg-primary`) for the active side, replacing the old teal.
- Needs a Look box: Excel yellow tint, Title Case headers, sentence-case messages.
- Both tables: Title Case headers via `DataTable`'s `titleCase` prop; the expanded day header
  loses its ALL CAPS; the active-time bar is navy; the name hover is the safe orange text.
- Thresholds dialog: Save is the orange primary with navy ink.

**Only these five files may change** (all in `src/app/pages/attendance/activity/`), each a whole
file below: `AttendanceActivity.tsx`, `ActivityNeedsLook.tsx`, `ActivityByEmployee.tsx`,
`ActivityByDay.tsx`, `ActivityThresholds.tsx`.
No other file may be touched (not `useActivityData.ts`, `activityDays.ts`, `DataTable.tsx`,
`GhostMark.tsx`, `SourceBadge.tsx`, `WhyChipBadge.tsx`, any action, or `src/components/ui/*`).

## `src/app/pages/attendance/activity/AttendanceActivity.tsx` (whole file)

```tsx
import { useState, useMemo, useEffect, useRef } from 'react';
import { Activity, AlertCircle, Info } from 'lucide-react';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import { fmtDuration } from '@/app/lib/teramindToday';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { useActivityData } from './useActivityData';
import ActivityNeedsLook from './ActivityNeedsLook';
import ActivityByEmployee from './ActivityByEmployee';
import ActivityByDay from './ActivityByDay';
import ActivityThresholds from './ActivityThresholds';

type ViewMode = 'byEmployee' | 'byDay';

function todayYmd() { return toLocalYMD(new Date()); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return toLocalYMD(d); }

// Warm look (2026-10-06): same tile as Attendance → Today — Title Case label with a dot.
function SummaryTile({ label, value, accent, dot }: { label: string; value: string | number; accent?: string; dot?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-col gap-0.5 min-w-[110px] shadow-card">
      <span className={`text-[22px] leading-7 font-bold tabular-nums ${accent ?? 'text-slate-900'}`}>{value}</span>
      <span className="text-[12px] text-slate-600 font-medium flex items-center gap-1.5 whitespace-nowrap">
        <span className={`w-2 h-2 rounded-full ${dot ?? 'bg-slate-300'}`} aria-hidden="true" />
        {label}
      </span>
    </div>
  );
}

export default function AttendanceActivity() {
  const { dateFrom, dateTo, attendanceMode, setAttendanceMode, setDateFrom, setDateTo } = useGlobalFilters();
  const { isSuper } = useViewer();

  // On first mount: ensure we are in Dates mode with last 14 days
  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    if (attendanceMode !== 'dates' || !dateFrom || !dateTo) {
      setAttendanceMode('dates');
      setDateTo(todayYmd());
      setDateFrom(daysAgo(14));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeFrom = dateFrom || daysAgo(14);
  const safeTo   = dateTo   || todayYmd();

  const isOneDay = safeFrom === safeTo;
  const [viewMode, setViewMode] = useState<ViewMode>(isOneDay ? 'byDay' : 'byEmployee');

  // Lifted expanded employee state (for Needs A Look → expand row)
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<number | null>(null);

  function handlePickEmployee(employeeId: number) {
    setViewMode('byEmployee');
    setExpandedEmployeeId(employeeId);
  }

  function handleToggleEmployee(employeeId: number) {
    setExpandedEmployeeId(prev => prev === employeeId ? null : employeeId);
  }

  const { days, byEmployee, totals, settings, loading, error, configFallbacks, reloadConfig, retry } = useActivityData({
    dateFrom: safeFrom,
    dateTo: safeTo,
  });

  const filteredNeedsLook = useMemo(() => days.filter(d => d.needsLook), [days]);

  const avgActiveLabel = totals.avgActiveMin !== null ? fmtDuration(totals.avgActiveMin) : '—';

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-auto px-4 py-4">

        {/* Config fallback notice */}
        {configFallbacks.length > 0 && !loading && (
          <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600 mb-4">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
            Using default thresholds for: {configFallbacks.join(', ')}. Configure in Admin → Rules & Config.
          </div>
        )}

        {/* Error — show ONLY this, never partial zero-row tables */}
        {error && !loading && (
          <div className="flex flex-col items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-4 text-sm text-red-700 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Couldn't load activity data. It usually works on retry.</span>
            </div>
            <button
              onClick={retry}
              className="ml-6 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-100 text-red-800 hover:bg-red-200 transition-colors border border-red-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Activity className="w-5 h-5 animate-pulse" />
            Loading activity data…
          </div>
        )}

        {!loading && !error && (
          <>
            {/* KPI tiles + Thresholds button */}
            <div className="flex flex-wrap items-start gap-3 mb-4">
              <SummaryTile label="Avg Active Time"  value={avgActiveLabel}    accent="text-status-green-ink" dot="bg-green-600" />
              <SummaryTile label="Days With Work"   value={totals.daysWorked} />
              <SummaryTile label="Needs a Look"     value={totals.needsLook}  accent={totals.needsLook > 0 ? 'text-status-yellow-ink' : undefined} dot="bg-yellow-500" />
              <SummaryTile label="Late Arrivals"    value={totals.lateArrivals} accent={totals.lateArrivals > 0 ? 'text-status-red-ink' : undefined} dot="bg-red-600" />
              {isSuper && (
                <div className="flex items-center self-center ml-auto">
                  <ActivityThresholds settings={settings} onSaved={reloadConfig} />
                </div>
              )}
            </div>

            {/* By Employee / By Day switch */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex rounded-md border border-slate-300 overflow-hidden">
                <button
                  onClick={() => setViewMode('byEmployee')}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors',
                    viewMode === 'byEmployee' ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  By Employee
                </button>
                <button
                  onClick={() => setViewMode('byDay')}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l',
                    viewMode === 'byDay' ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  By Day
                </button>
              </div>
            </div>

            {/* Needs A Look list */}
            <ActivityNeedsLook days={filteredNeedsLook} dateTo={safeTo} settings={settings} onPick={handlePickEmployee} />

            {/* Main table */}
            {viewMode === 'byEmployee'
              ? <ActivityByEmployee
                  byEmployee={byEmployee}
                  expandedId={expandedEmployeeId}
                  onToggle={handleToggleEmployee}
                />
              : <ActivityByDay days={days} dateFrom={safeFrom} dateTo={safeTo} />
            }

            {/* Footer */}
            <p className="text-xs text-slate-400 text-center mt-6 pb-2">
              Data Updates Every 15 Minutes · Times In US Eastern
            </p>
          </>
        )}
      </div>
    </div>
  );
}
```

## `src/app/pages/attendance/activity/ActivityNeedsLook.tsx` (whole file)

```tsx
import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ActivityDay, ActivitySettings } from '@/app/lib/activityDays';
import { fmtDayShort, addDays, thresholdFor } from '@/app/lib/activityDays';
import { fmtDuration } from '@/app/lib/teramindToday';
import WhyChipBadge from './WhyChipBadge';

type Props = {
  days: ActivityDay[];
  dateTo: string;
  settings: ActivitySettings;
  onPick?: (employeeId: number) => void;
};

const TH = 'px-2 py-1 text-left text-[12px] font-semibold text-status-yellow-ink whitespace-nowrap';
const TD = 'px-2 py-1.5 text-xs text-amber-900 align-middle';

/** True when `date` falls in the last 7 calendar days of the range (inclusive). */
function inLast7(date: string, dateTo: string): boolean {
  // d is in window iff d <= dateTo AND addDays(d, 6) >= dateTo
  return date <= dateTo && addDays(date, 6) >= dateTo;
}

/**
 * Step a YYYY-MM-DD string back by one day using the same month-length
 * arithmetic addDays uses — no new Date(), no toISOString().
 */
function stepBack(date: string): string {
  let y = Number(date.slice(0, 4));
  let m = Number(date.slice(5, 7));
  let d = Number(date.slice(8, 10)) - 1;
  if (d < 1) {
    if (--m < 1) { m = 12; y -= 1; }
    // days in the new month
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const DIMS = [0,31,isLeap?29:28,31,30,31,30,31,31,30,31,30,31];
    d = DIMS[m];
  }
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Derive the earliest date in the last-7 window by stepping back from dateTo
 * up to 6 times — giving the window start regardless of which dates are present.
 */
function windowStartDate(dateTo: string): string {
  let cur = dateTo;
  for (let i = 0; i < 6; i++) cur = stepBack(cur);
  return cur;
}

export default function ActivityNeedsLook({ days, dateTo, settings, onPick }: Props) {
  const flagged = days.filter(d => d.needsLook);
  const totalFlagged = flagged.length;

  const windowRows = useMemo(() => {
    const inWindow = flagged.filter(d => inLast7(d.date, dateTo));
    // Sort: lowest activeMin first, then newest date first, then name
    inWindow.sort((a, b) => {
      if (a.activeMin !== b.activeMin) return a.activeMin - b.activeMin;
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return a.employeeName.localeCompare(b.employeeName);
    });
    return inWindow.slice(0, 10);
  }, [days, dateTo]);

  if (totalFlagged === 0) return null;

  const headingStart = fmtDayShort(windowStartDate(dateTo));
  const headingEnd   = fmtDayShort(dateTo);

  return (
    <div className="bg-status-yellow-tint border border-amber-200 rounded-lg px-4 py-3 mb-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-sm font-semibold text-amber-800">
            Needs a Look — Worst 10, {headingStart} – {headingEnd}
          </span>
        </div>
        <span className="text-xs text-amber-600 whitespace-nowrap">
          {totalFlagged} flagged {totalFlagged === 1 ? 'day' : 'days'} in the whole range
        </span>
      </div>

      {windowRows.length === 0 ? (
        <p className="text-xs text-amber-700/70 italic py-1">Nothing to look at in the last 7 days</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-amber-200">
                <th className={TH}>Employee</th>
                <th className={TH}>Date</th>
                <th className={TH}>Active</th>
                <th className={TH}>Short By</th>
                <th className={TH}>Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {windowRows.map(d => {
                const threshold = thresholdFor(d.shiftMinutes, settings);
                const shortBy   = Math.max(0, threshold - d.activeMin);
                return (
                  <tr
                    key={`${d.employeeId}-${d.date}`}
                    className={onPick ? 'cursor-pointer hover:bg-amber-100/60 transition-colors' : ''}
                    onClick={onPick ? () => onPick(d.employeeId) : undefined}
                  >
                    <td className={`${TD} font-medium`}>
                      {onPick ? (
                        <button
                          type="button"
                          className="hover:underline underline-offset-2 text-amber-900 transition-colors text-left"
                          onClick={e => { e.stopPropagation(); onPick(d.employeeId); }}
                        >
                          {d.employeeName}
                        </button>
                      ) : (
                        d.employeeName
                      )}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{fmtDayShort(d.date)}</td>
                    <td className={`${TD} tabular-nums whitespace-nowrap`}>
                      {d.records === 0 ? 'No records' : fmtDuration(d.activeMin)}
                    </td>
                    <td className={`${TD} tabular-nums whitespace-nowrap`}>
                      {shortBy > 0 ? fmtDuration(shortBy) : '—'}
                    </td>
                    <td className={TD}>
                      {d.why ? <WhyChipBadge chip={d.why} /> : <span className="text-amber-700/50">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

## `src/app/pages/attendance/activity/ActivityByEmployee.tsx` (whole file)

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { EmployeeActivitySummary, ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import WhyChipBadge from './WhyChipBadge';
import SourceBadge from './SourceBadge';
import GhostMark from './GhostMark';
import { AttendancePanel } from '@/app/pages/attendance/AttendancePanel';
import DataTable from '@/app/components/DataTable';
import type { Col } from '@/app/components/DataTable';

type SortKey = 'employeeName' | 'daysWorked' | 'avgActiveMin' | 'avgFirstMin' | 'avgLastMin' | 'needsLook' | 'awayDays';

type Props = {
  byEmployee: EmployeeActivitySummary[];
  shiftMinutes?: number;
  expandedId?: number | null;
  onToggle?: (id: number) => void;
};

const TD = 'px-3 py-2 text-sm text-slate-700 align-top';
const SUBTD = 'px-3 py-1.5 text-xs text-slate-600';
const SUBTH = 'sticky top-[33px] z-[9] px-3 py-1.5 text-left text-[12px] font-semibold text-slate-500 whitespace-nowrap bg-slate-50';

const MAX_BAR = 480;

const COLUMNS: Col<EmployeeActivitySummary>[] = [
  { key: 'employeeName', label: 'Employee' },
  { key: 'daysWorked',   label: 'Days With Work' },
  { key: 'avgActiveMin', label: 'Avg Active' },
  { key: 'avgFirstMin',  label: 'Avg Entry' },
  { key: 'avgLastMin',   label: 'Avg Exit' },
  { key: 'needsLook',    label: 'Needs A Look' },
  { key: 'awayDays',     label: 'Away Days' },
];

function ActiveBar({ activeMin, shiftMin }: { activeMin: number | null; shiftMin: number }) {
  if (activeMin === null) return <span className="text-slate-400">—</span>;
  const pct = Math.min(100, Math.round((activeMin / Math.max(shiftMin, 1)) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums text-sm font-medium">{fmtDuration(activeMin)}</span>
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ExpandedDayRow({ d }: { d: ActivityDay }) {
  const rowBg = d.needsLook ? 'bg-amber-50 hover:bg-amber-100/50' : 'bg-slate-50 hover:bg-slate-100/50';
  return (
    <tr className={`${rowBg} transition-colors`}>
      <td className={SUBTD}>{fmtDayShort(d.date)}</td>
      <td className={`${SUBTD} whitespace-nowrap tabular-nums`}>
        {d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'}
        <GhostMark ghostMin={d.ghostMin} />
      </td>
      <td className={`${SUBTD} whitespace-nowrap tabular-nums`}>
        {d.shownLastMin !== null
          ? fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')
          : '—'}
      </td>
      <td className={SUBTD}>{fmtDuration(d.activeMin)}</td>
      <td className={SUBTD}>{d.records <= 1 ? '—' : fmtDuration(d.breaksMin)}</td>
      <td className={SUBTD}>
        <div className="flex flex-wrap gap-1">
          {d.needsLook && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Needs A Look
            </span>
          )}
          {d.flag === 'long_break' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              Long Break
            </span>
          )}
          {d.why ? <WhyChipBadge chip={d.why} /> : null}
        </div>
      </td>
      <td className={SUBTD}><SourceBadge official={d.official} edited={d.edited} /></td>
    </tr>
  );
}

function ExpandedHeader() {
  return (
    <tr>
      <th className={SUBTH}>Date</th>
      <th className={SUBTH}>Entry</th>
      <th className={SUBTH}>Exit</th>
      <th className={SUBTH}>Active</th>
      <th className={SUBTH}>Breaks</th>
      <th className={SUBTH}>Why</th>
      <th className={SUBTH}>Source</th>
    </tr>
  );
}

type EmployeeRowProps = {
  emp: EmployeeActivitySummary;
  onOpenPanel: (emp: EmployeeActivitySummary) => void;
  expanded: boolean;
  onToggle: () => void;
};

function EmployeeRow({ emp, onOpenPanel, expanded, onToggle }: EmployeeRowProps) {
  const avgShift = emp.days.length > 0 ? (emp.days[0]?.shiftMinutes ?? MAX_BAR) : MAX_BAR;

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className={TD}>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className="shrink-0 text-slate-400 hover:text-slate-600"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded
                ? <ChevronDown className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />}
            </button>
            <div>
              <button
                className="font-medium text-slate-800 hover:text-warm-text hover:underline underline-offset-2 text-left transition-colors"
                onClick={() => onOpenPanel(emp)}
              >
                {emp.employeeName}
              </button>
              <div className="text-xs text-slate-400">{emp.role}</div>
            </div>
          </div>
        </td>
        <td className={TD}>
          <span className="font-medium">{emp.daysWorked}</span>
          <span className="text-slate-400"> / {emp.scheduledDays}</span>
        </td>
        <td className={TD}>
          <ActiveBar activeMin={emp.avgActiveMin} shiftMin={avgShift} />
        </td>
        <td className={TD}>{emp.avgFirstMin !== null ? fmtClock(emp.avgFirstMin) : '—'}</td>
        <td className={TD}>{emp.avgLastMin  !== null ? fmtClock(emp.avgLastMin)  : '—'}</td>
        <td className={TD}>
          {emp.needsLook > 0
            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                {emp.needsLook}
              </span>
            : null}
        </td>
        <td className={TD}>
          {emp.awayDays > 0 ? emp.awayLabel : <span className="text-slate-400">—</span>}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} className="p-0">
            <table className="w-full divide-y divide-slate-100">
              <thead><ExpandedHeader /></thead>
              <tbody className="divide-y divide-slate-100">
                {emp.days.map(d => <ExpandedDayRow key={d.date} d={d} />)}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

function sortEmployees(list: EmployeeActivitySummary[], key: SortKey, dir: 'asc' | 'desc'): EmployeeActivitySummary[] {
  return [...list].sort((a, b) => {
    let av: number | string | null, bv: number | string | null;
    if (key === 'employeeName') { av = a.employeeName; bv = b.employeeName; }
    else if (key === 'daysWorked') { av = a.daysWorked; bv = b.daysWorked; }
    else if (key === 'avgActiveMin') { av = a.avgActiveMin ?? -1; bv = b.avgActiveMin ?? -1; }
    else if (key === 'avgFirstMin') { av = a.avgFirstMin ?? -1; bv = b.avgFirstMin ?? -1; }
    else if (key === 'avgLastMin') { av = a.avgLastMin ?? -1; bv = b.avgLastMin ?? -1; }
    else if (key === 'needsLook') { av = a.needsLook; bv = b.needsLook; }
    else { av = a.awayDays; bv = b.awayDays; }

    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const an = av as number, bn = bv as number;
    return dir === 'asc' ? an - bn : bn - an;
  });
}

export default function ActivityByEmployee({ byEmployee, expandedId, onToggle }: Props) {
  const [panelEmp, setPanelEmp] = useState<EmployeeActivitySummary | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('employeeName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // local expanded state fallback when parent doesn't control it
  const [localExpandedId, setLocalExpandedId] = useState<number | null>(null);
  const effectiveExpandedId = expandedId !== undefined ? expandedId : localExpandedId;

  function handleSort(key: string) {
    const k = key as SortKey;
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }

  function handleToggle(id: number) {
    if (onToggle) {
      onToggle(id);
    } else {
      setLocalExpandedId(prev => prev === id ? null : id);
    }
  }

  if (byEmployee.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <span className="text-sm">No activity for these filters.</span>
      </div>
    );
  }

  const sorted = sortEmployees(byEmployee, sortKey, sortDir);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        titleCase
        className="max-h-[70vh]"
      >
        {sorted.map(emp => (
          <EmployeeRow
            key={emp.employeeId}
            emp={emp}
            onOpenPanel={setPanelEmp}
            expanded={effectiveExpandedId === emp.employeeId}
            onToggle={() => handleToggle(emp.employeeId)}
          />
        ))}
      </DataTable>

      {panelEmp && (
        <AttendancePanel
          stats={null}
          employeeId={panelEmp.employeeId}
          days={panelEmp.days}
          displayName={panelEmp.employeeName}
          displayRole={panelEmp.role}
          displayManager={panelEmp.manager}
          onClose={() => setPanelEmp(null)}
        />
      )}
    </>
  );
}
```

## `src/app/pages/attendance/activity/ActivityByDay.tsx` (whole file)

```tsx
import { useState } from 'react';
import { Download } from 'lucide-react';
import type { ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import WhyChipBadge from './WhyChipBadge';
import SourceBadge from './SourceBadge';
import GhostMark from './GhostMark';
import DataTable from '@/app/components/DataTable';
import type { Col } from '@/app/components/DataTable';

type SortKey = 'employeeName' | 'date' | 'shownFirstMin' | 'shownLastMin' | 'activeMin' | 'breaksMin';

type Props = { days: ActivityDay[]; dateFrom: string; dateTo: string };

const COLUMNS: Col<ActivityDay>[] = [
  { key: 'employeeName',  label: 'Employee' },
  { key: 'date',          label: 'Date' },
  { key: 'shownFirstMin', label: 'Entry' },
  { key: 'shownLastMin',  label: 'Exit' },
  { key: 'activeMin',     label: 'Active' },
  { key: 'breaksMin',     label: 'Breaks' },
  { key: 'why',           label: 'Why',    sortable: false },
  { key: 'official',      label: 'Source', sortable: false },
];

function escape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(days: ActivityDay[], dateFrom: string, dateTo: string) {
  const header = ['employee', 'date', 'entry', 'early_record_ignored', 'exit', 'active_minutes', 'breaks_minutes', 'why', 'source'].join(',');
  const body = days.map(d => {
    const entry = d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '';
    const earlyIgnored = d.ghostMin !== null ? fmtClock(d.ghostMin) : '';
    const exit  = d.shownLastMin  !== null ? (fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')) : '';
    const why   = d.why ? d.why.label : '';
    const source = !d.official ? 'Live' : d.edited ? 'Official, Edited' : 'Official';
    return [d.employeeName, d.date, entry, earlyIgnored, exit, d.activeMin, d.breaksMin, why, source].map(escape).join(',');
  }).join('\n');

  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `activity_${dateFrom}_${dateTo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function sortDays(list: ActivityDay[], key: SortKey, dir: 'asc' | 'desc'): ActivityDay[] {
  return [...list].sort((a, b) => {
    let av: number | string | null, bv: number | string | null;
    if (key === 'employeeName') { av = a.employeeName; bv = b.employeeName; }
    else if (key === 'date') { av = a.date; bv = b.date; }
    else if (key === 'shownFirstMin') { av = a.shownFirstMin ?? -1; bv = b.shownFirstMin ?? -1; }
    else if (key === 'shownLastMin')  { av = a.shownLastMin  ?? -1; bv = b.shownLastMin  ?? -1; }
    else if (key === 'activeMin') { av = a.activeMin; bv = b.activeMin; }
    else { av = a.breaksMin; bv = b.breaksMin; }

    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const an = av as number, bn = bv as number;
    return dir === 'asc' ? an - bn : bn - an;
  });
}

const TD = 'px-3 py-2 text-sm text-slate-700';

export default function ActivityByDay({ days, dateFrom, dateTo }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(key: string) {
    const k = key as SortKey;
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }

  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <span className="text-sm">No activity for these filters.</span>
      </div>
    );
  }

  const sorted = sortDays(days, sortKey, sortDir);

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={() => exportCsv(days, dateFrom, dateTo)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      <DataTable
        columns={COLUMNS}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        titleCase
        className="max-h-[70vh]"
      >
        {sorted.map(d => {
          const rowBg = d.needsLook ? 'bg-amber-50 hover:bg-amber-100/50' : 'hover:bg-slate-50';
          return (
            <tr key={`${d.employeeId}-${d.date}`} className={`${rowBg} transition-colors`}>
              <td className={TD}>
                <div className="font-medium">{d.employeeName}</div>
                <div className="text-xs text-slate-400">{d.role}</div>
              </td>
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
              <td className={TD}>{fmtDuration(d.activeMin)}</td>
              <td className={TD}>
                {d.records <= 1 ? '—' : fmtDuration(d.breaksMin)}
              </td>
              <td className={TD}>
                <div className="flex flex-wrap gap-1">
                  {d.needsLook && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      Needs A Look
                    </span>
                  )}
                  {d.flag === 'long_break' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      Long Break
                    </span>
                  )}
                  {d.why ? <WhyChipBadge chip={d.why} /> : null}
                </div>
              </td>
              <td className={TD}>
                <SourceBadge official={d.official} edited={d.edited} />
              </td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}
```

## `src/app/pages/attendance/activity/ActivityThresholds.tsx` (whole file)

```tsx
import { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { Settings2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { ActivitySettings } from '@/app/lib/activityDays';
import upsertClassificationConfigAction from '@/actions/upsertClassificationConfig';

type Props = {
  settings: ActivitySettings;
  onSaved: () => Promise<void>;
};

const CONFIG_META: Record<string, { label: string; description: string }> = {
  activity_min_active_minutes: {
    label: 'Minimum Active Time Per Full Day',
    description: 'Minutes of Teramind activity a full scheduled day must reach. Shorter shifts scale proportionally.',
  },
  activity_break_minutes: {
    label: 'Break Allowance',
    description: 'Minutes of break allowed in a day before the gap is counted against the employee.',
  },
  activity_break_over_minutes: {
    label: 'Flag Breaks Longer Than Allowance By',
    description: 'Minutes past the break allowance before a day is flagged as a long break.',
  },
};

function toHours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

function fromHours(hours: string): number {
  return Math.round(parseFloat(hours) * 60);
}

export default function ActivityThresholds({ settings, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [minActive, setMinActive] = useState('');
  const [breakAl, setBreakAl] = useState('');
  const [breakOver, setBreakOver] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [upsert] = useMutateAction(upsertClassificationConfigAction);

  function handleOpen() {
    setMinActive(toHours(settings.minActiveMinutes));
    setBreakAl(toHours(settings.breakMinutes));
    setBreakOver(toHours(settings.breakOverMinutes));
    setError('');
    setOpen(true);
  }

  async function handleSave() {
    const vals = [
      { key: 'activity_min_active_minutes', hours: minActive },
      { key: 'activity_break_minutes',      hours: breakAl },
      { key: 'activity_break_over_minutes', hours: breakOver },
    ];

    for (const v of vals) {
      const n = parseFloat(v.hours);
      if (!Number.isFinite(n) || n <= 0) {
        setError('All values must be positive numbers.');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      for (const v of vals) {
        const meta = CONFIG_META[v.key];
        await upsert({
          key: v.key,
          value: String(fromHours(v.hours)),
          label: meta.label,
          description: meta.description,
          value_type: 'number',
          category: 'teramind',
        });
      }
      await onSaved();
      setOpen(false);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
      >
        <Settings2 className="w-3.5 h-3.5" />
        Thresholds
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Activity Thresholds</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-slate-500 mb-4">
            Applies to everyone. A shorter shift is scaled proportionally.
          </p>

          <div className="space-y-4">
            {([
              { key: 'activity_min_active_minutes', val: minActive, set: setMinActive },
              { key: 'activity_break_minutes',      val: breakAl,   set: setBreakAl },
              { key: 'activity_break_over_minutes', val: breakOver,  set: setBreakOver },
            ] as const).map(({ key, val, set }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {CONFIG_META[key].label}
                  <span className="ml-1 font-normal text-slate-400">(hours)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={val}
                  onChange={e => set(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="text-xs text-red-600 mt-2">{error}</p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-md bg-warm text-warm-ink text-sm font-semibold hover:brightness-95 disabled:opacity-60 transition"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

## Report
- Byte size of the five files; confirm no other file changed; Attendance → Activity renders in
  both By Employee and By Day with no console errors.
