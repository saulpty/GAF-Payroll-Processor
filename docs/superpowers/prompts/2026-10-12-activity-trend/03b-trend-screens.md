# Activity trend, part 2b: the Trend column, the card lines and the opened row

**Copy every file and edit exactly, character for character. Do not rewrite, reformat or "improve"
anything else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only these two files may change**, both in `src/app/pages/attendance/activity/`: `ActivityByEmployee.tsx` (replaced whole) and
`AttendanceActivity.tsx` (six edits). **No other file may be touched.** No migration, no action file,
no lib file. Do not edit `ActivityByDay.tsx`, `ActivityNeedsLook.tsx`, `AttendancePanel.tsx`,
`SourceBadge.tsx`, `useActivityData.ts`, or the four files created by the previous prompt
(`TrendPill.tsx`, `ActivityCompare.tsx`, `ActivityDayChart.tsx`, `ActivityDaysSideBySide.tsx`).

Design rules (src/DESIGN.md): tokens only, never a raw hex; Title Case for headings, column
headers and buttons; never ALL CAPS; numbers use `tabular-nums`.

## 1. `src/app/pages/attendance/activity/ActivityByEmployee.tsx` — replace the whole file with

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { EmployeeActivitySummary, ActivityDay, ActivitySettings } from '@/app/lib/activityDays';
import { thresholdFor } from '@/app/lib/activityDays';
import type { EmployeeTrend } from '@/app/lib/activityTrend';
import { VERDICT_ORDER } from '@/app/lib/activityTrend';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import { AttendancePanel } from '@/app/pages/attendance/AttendancePanel';
import DataTable from '@/app/components/DataTable';
import type { Col } from '@/app/components/DataTable';
import { TrendPill, ChangeArrow } from './TrendPill';
import ActivityCompare from './ActivityCompare';
import ActivityDayChart from './ActivityDayChart';
import ActivityDaysSideBySide from './ActivityDaysSideBySide';

type SortKey = 'employeeName' | 'trend' | 'daysWorked' | 'avgActiveMin' | 'avgFirstMin' | 'avgLastMin' | 'needsLook' | 'missed' | 'awayDays';

/** Everything the comparison needs, straight from useActivityData. */
export type TrendProps = {
  trends: Record<number, EmployeeTrend>;
  prevDays: Record<number, ActivityDay[]>;
  startDates: Record<number, string>;
  beforeLabel: string; afterLabel: string; prevDayCount: number;
  today: string; settings: ActivitySettings;
};

type Props = TrendProps & {
  byEmployee: EmployeeActivitySummary[];
  expandedId?: number | null;
  onToggle?: (id: number) => void;
};

const TD = 'px-3 py-2 text-sm text-slate-700 align-top whitespace-nowrap';
const MAX_BAR = 480;
const MUTED = 'text-slate-400';

function columns(tip: string): Col<EmployeeActivitySummary>[] {
  return [
    { key: 'employeeName', label: 'Employee' },
    { key: 'trend',        label: 'Trend', tip },
    { key: 'daysWorked',   label: 'Days With Work' },
    { key: 'avgActiveMin', label: 'Avg Active' },
    { key: 'avgFirstMin',  label: 'Avg Entry' },
    { key: 'avgLastMin',   label: 'Avg Exit' },
    { key: 'needsLook',    label: '⚠️ Days' },
    { key: 'missed',       label: 'Days Missed' },
    { key: 'awayDays',     label: 'Away Days' },
  ];
}

function ActiveBar({ activeMin, shiftMin }: { activeMin: number | null; shiftMin: number }) {
  if (activeMin === null) return <span className={MUTED}>—</span>;
  const pct = Math.min(100, Math.round((activeMin / Math.max(shiftMin, 1)) * 100));
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums text-sm font-medium">{fmtDuration(activeMin)}</span>
      <span className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <span className="block h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

/** "2 of 13"; a zero count is muted so the eye lands on the rows that have something. */
function OutOf({ n, of }: { n: number; of: number }) {
  return <span className={`tabular-nums ${n === 0 ? MUTED : ''}`}>{n} of {of}</span>;
}

function OpenedRow({ emp, trend, p }: { emp: EmployeeActivitySummary; trend: EmployeeTrend; p: TrendProps }) {
  const [showDays, setShowDays] = useState(false);
  const before = p.prevDays[emp.employeeId] ?? [];
  const startDate = p.startDates[emp.employeeId] ?? '';
  const lists = (
    <ActivityDaysSideBySide
      before={trend.verdict === 'nodata' ? null : before} after={emp.days}
      beforeLabel={p.beforeLabel} afterLabel={p.afterLabel}
      beforeSum={trend.before} afterSum={trend.after}
      today={p.today} startDate={startDate}
    />
  );

  if (trend.verdict === 'nodata') {
    return (
      <div className="p-4 bg-slate-50 border-b-2 border-slate-300">
        <p className="text-[13px] text-slate-600 mb-3">
          Nothing to compare yet: fewer than the minimum days with work in one of the two periods.
        </p>
        {lists}
      </div>
    );
  }

  const total = before.length + emp.days.length;
  return (
    <div className="p-4 bg-slate-50 border-b-2 border-slate-300">
      <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-4">
        <ActivityCompare trend={trend} beforeLabel={p.beforeLabel} afterLabel={p.afterLabel} />
        <ActivityDayChart
          before={before} after={emp.days}
          beforeLabel={p.beforeLabel} afterLabel={p.afterLabel}
          beforeAvg={trend.before ? trend.before.avgActiveMin : null} afterAvg={trend.after.avgActiveMin}
          today={p.today} startDate={startDate}
          thresholdMin={thresholdFor(emp.days[0]?.shiftMinutes ?? MAX_BAR, p.settings)}
        />
      </div>
      <button
        type="button"
        onClick={() => setShowDays(v => !v)}
        aria-expanded={showDays}
        className="mt-3 w-full h-9 flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white text-[13px] font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
      >
        {showDays ? `▲ Hide the ${total} Days` : `▼ Show All ${total} Days`}
        {!showDays && <span className="font-medium text-slate-500">entry, exit, active and breaks for each day</span>}
      </button>
      {showDays && <div className="mt-3">{lists}</div>}
    </div>
  );
}

type EmployeeRowProps = {
  emp: EmployeeActivitySummary; trend: EmployeeTrend; p: TrendProps;
  onOpenPanel: (emp: EmployeeActivitySummary) => void;
  expanded: boolean; onToggle: () => void;
};

function EmployeeRow({ emp, trend, p, onOpenPanel, expanded, onToggle }: EmployeeRowProps) {
  const shift = emp.days.length > 0 ? (emp.days[0]?.shiftMinutes ?? MAX_BAR) : MAX_BAR;
  const a = trend.after;

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className={TD}>
          <div className="flex items-center gap-2">
            <button onClick={onToggle} className="shrink-0 text-slate-400 hover:text-slate-600"
              aria-label={expanded ? 'Collapse' : 'Expand'} aria-expanded={expanded}>
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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
        <td className={TD}><TrendPill verdict={trend.verdict} /></td>
        <td className={TD}>
          <span className="font-medium">{emp.daysWorked}</span>
          <span className={MUTED}> / {emp.scheduledDays}</span>
        </td>
        <td className={TD}>
          <ActiveBar activeMin={emp.avgActiveMin} shiftMin={shift} />
          <ChangeArrow measure="active" change={trend.active} />
        </td>
        <td className={TD}>
          {emp.avgFirstMin !== null ? fmtClock(emp.avgFirstMin) : '—'}
          <ChangeArrow measure="entry" change={trend.entry} />
        </td>
        <td className={TD}>{emp.avgLastMin !== null ? fmtClock(emp.avgLastMin) : '—'}</td>
        <td className={TD}>
          <OutOf n={a.lowDays} of={a.worked} />
          <ChangeArrow measure="low" change={trend.low} />
        </td>
        <td className={TD}>
          <OutOf n={a.missedDays} of={a.scheduled} />
          <ChangeArrow measure="missed" change={trend.missed} />
        </td>
        <td className={TD}>
          {emp.awayDays > 0 ? emp.awayLabel : <span className={MUTED}>—</span>}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={9} className="p-0">
            <OpenedRow emp={emp} trend={trend} p={p} />
          </td>
        </tr>
      )}
    </>
  );
}

function sortEmployees(
  list: EmployeeActivitySummary[], key: SortKey, dir: 'asc' | 'desc', trends: Record<number, EmployeeTrend>,
): EmployeeActivitySummary[] {
  const val = (e: EmployeeActivitySummary): number | string => {
    const t = trends[e.employeeId];
    if (key === 'employeeName') return e.employeeName;
    if (key === 'trend') return t ? VERDICT_ORDER[t.verdict] : VERDICT_ORDER.nodata;
    if (key === 'daysWorked') return e.daysWorked;
    if (key === 'avgActiveMin') return e.avgActiveMin ?? -1;
    if (key === 'avgFirstMin') return e.avgFirstMin ?? -1;
    if (key === 'avgLastMin') return e.avgLastMin ?? -1;
    if (key === 'needsLook') return t ? t.after.lowDays : 0;
    if (key === 'missed') return t ? t.after.missedDays : 0;
    return e.awayDays;
  };
  return [...list].sort((x, y) => {
    const av = val(x), bv = val(y);
    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const diff = (av as number) - (bv as number);
    // Ties keep people in name order whichever way the column is sorted.
    return diff !== 0 ? (dir === 'asc' ? diff : -diff) : x.employeeName.localeCompare(y.employeeName);
  });
}

export default function ActivityByEmployee({ byEmployee, expandedId, onToggle, ...p }: Props) {
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
    if (onToggle) onToggle(id);
    else setLocalExpandedId(prev => prev === id ? null : id);
  }

  if (byEmployee.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <span className="text-sm">No activity for these filters.</span>
      </div>
    );
  }

  const tip = p.prevDayCount > 0
    ? `Compares ${p.afterLabel} with the ${p.prevDayCount} days right before it, ${p.beforeLabel}. Days off, PTO, sick days and holidays are left out of both. Change the dates above to compare a different period.`
    : 'Pick a date range above to compare it with the days right before it.';
  const sorted = sortEmployees(byEmployee, sortKey, sortDir, p.trends);

  return (
    <>
      <DataTable
        columns={columns(tip)}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        titleCase
        className="max-h-[70vh]"
      >
        {sorted.map(emp => {
          const trend = p.trends[emp.employeeId];
          if (!trend) return null;
          return (
            <EmployeeRow
              key={emp.employeeId}
              emp={emp}
              trend={trend}
              p={p}
              onOpenPanel={setPanelEmp}
              expanded={effectiveExpandedId === emp.employeeId}
              onToggle={() => handleToggle(emp.employeeId)}
            />
          );
        })}
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

## 2. Edits to `src/app/pages/attendance/activity/AttendanceActivity.tsx`

Make exactly these six edits and nothing else in this file.

**2a.** After `import { toLocalYMD } from '@/app/lib/classificationEngine';` add:

```ts
import { rangeLabel, fmtMinutes } from '@/app/lib/activityTrend';
```

**2b.** Replace the whole `SummaryTile` function with:

```tsx
type TileNote = { note?: string; noteTone?: 'good' | 'bad' | '' };

// Warm look (2026-10-06): same tile as Attendance → Today — Title Case label with a dot.
// note (2026-10-12): one line comparing with the period right before the selected dates.
function SummaryTile({ label, value, accent, dot, note, noteTone }: { label: string; value: string | number; accent?: string; dot?: string } & TileNote) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-col gap-0.5 min-w-[110px] shadow-card">
      <span className={`text-[22px] leading-7 font-bold tabular-nums ${accent ?? 'text-slate-900'}`}>{value}</span>
      <span className="text-[12px] text-slate-600 font-medium flex items-center gap-1.5 whitespace-nowrap">
        <span className={`w-2 h-2 rounded-full ${dot ?? 'bg-slate-300'}`} aria-hidden="true" />
        {label}
      </span>
      {note && (
        <span className={`text-[12px] mt-1 pt-1 border-t border-slate-100 whitespace-nowrap tabular-nums ${noteTone === 'good' ? 'text-status-green-ink' : noteTone === 'bad' ? 'text-status-red-ink' : 'text-slate-500'}`}>
          {note}
        </span>
      )}
    </div>
  );
}
```

**2c.** Replace

```tsx
  const { days, byEmployee, totals, settings, loading, error, configFallbacks, reloadConfig, retry } = useActivityData({
    dateFrom: safeFrom,
    dateTo: safeTo,
  });
```

with

```tsx
  const {
    days, byEmployee, totals, settings, loading, error, configFallbacks, reloadConfig, retry,
    prev, today, trends, prevDays, startDates, totalsChange,
  } = useActivityData({
    dateFrom: safeFrom,
    dateTo: safeTo,
    compare: true,
  });
```

**2d.** After `const avgActiveLabel = …;` add:

```tsx

  const beforeLabel = rangeLabel(prev.from, prev.to);
  const afterLabel = rangeLabel(safeFrom, safeTo);
  // One line under each card: these dates against the same number of days right before them.
  // The raw difference; the minimums only apply to each employee's Trend.
  const versus = (delta: number | null, lowerIsBetter: boolean, fmt: (n: number) => string): TileNote => {
    if (delta === null || prev.days === 0) return {};
    if (delta === 0) return { note: `Same as ${beforeLabel}`, noteTone: '' };
    return {
      note: `${delta > 0 ? '↑' : '↓'} ${fmt(Math.abs(delta))} vs ${beforeLabel}`,
      noteTone: (delta < 0) === lowerIsBetter ? 'good' : 'bad',
    };
  };
  const activeNote = versus(totalsChange ? totalsChange.avgActiveMin : null, false, fmtMinutes);
  const lookNote = versus(totalsChange ? totalsChange.needsLook : null, true, String);
  const lateNote = versus(totalsChange ? totalsChange.lateArrivals : null, true, String);
  const workedNote = totalsChange && prev.days > 0 ? `${totalsChange.daysWorkedBefore} in ${beforeLabel}` : undefined;
```

**2e.** Replace the four `<SummaryTile … />` lines with:

```tsx
              <SummaryTile label="Avg Active Time"  value={avgActiveLabel}    accent="text-status-green-ink" dot="bg-green-600" note={activeNote.note} noteTone={activeNote.noteTone} />
              <SummaryTile label="Days With Work"   value={totals.daysWorked} note={workedNote} />
              <SummaryTile label="Needs a Look"     value={totals.needsLook}  accent={totals.needsLook > 0 ? 'text-status-yellow-ink' : undefined} dot="bg-yellow-500" note={lookNote.note} noteTone={lookNote.noteTone} />
              <SummaryTile label="Late Arrivals"    value={totals.lateArrivals} accent={totals.lateArrivals > 0 ? 'text-status-red-ink' : undefined} dot="bg-red-600" note={lateNote.note} noteTone={lateNote.noteTone} />
```

**2f.** Replace

```tsx
              ? <ActivityByEmployee
                  byEmployee={byEmployee}
                  expandedId={expandedEmployeeId}
                  onToggle={handleToggleEmployee}
                />
```

with

```tsx
              ? <ActivityByEmployee
                  byEmployee={byEmployee}
                  expandedId={expandedEmployeeId}
                  onToggle={handleToggleEmployee}
                  trends={trends}
                  prevDays={prevDays}
                  startDates={startDates}
                  beforeLabel={beforeLabel}
                  afterLabel={afterLabel}
                  prevDayCount={prev.days}
                  today={today}
                  settings={settings}
                />
```

## Acceptance (Attendance → Activity, By Employee)
1. Each of the four cards shows one extra line comparing with the period right before the selected dates.
2. The table has the columns Employee, Trend, Days With Work, Avg Active, Avg Entry, Avg Exit, ⚠️ Days, Days Missed, Away Days.
3. Opening a row shows a Before and After table, an Hours Active Each Day chart, and a Show All N Days button.
4. By Day view, the Needs a Look box and the employee side panel are unchanged.

When done, reply with a one-line summary per file.
