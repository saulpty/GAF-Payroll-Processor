# Phone view, Attendance → Activity: rows instead of tables

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today the Activity page is the computer page squeezed: the four cards and the
controls wrap into an untidy block, and the By Employee, By Day and Needs a Look tables each
slide sideways inside their own box. This prompt gives a phone-sized screen one row per line
instead of each table, puts the cards two across, and puts the controls on one line that slides.
A computer keeps exactly what it has.

**Only these files may change.** One new: `src/app/pages/attendance/activity/ActivityRows.tsx`.
Five edited: `src/app/pages/attendance/activity/AttendanceActivity.tsx`,
`src/app/pages/attendance/activity/ActivityByEmployee.tsx`,
`src/app/pages/attendance/activity/ActivityByDay.tsx`,
`src/app/pages/attendance/activity/ActivityNeedsLook.tsx`,
`src/app/pages/attendance/activity/ActivityThresholds.tsx`. **No other file may be touched.**
No migration, no action file.

Rules:
- Only these files may change: the six listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Follow the Phone section of `src/DESIGN.md`.

Already in the app from earlier prompts. **Use them; do not create, edit or redefine them:**
- `src/app/lib/useIsPhone.ts` exports the hook `useIsPhone(): boolean` (a named export).
- `src/tailwind.config.js` has a screen named `phone`, so a class written `phone:px-4` applies
  only on a phone-sized screen. Do not replace any `phone:` class below with `sm:`, `md:` or
  `max-md:`.
- `src/app/components/mobile/MobileRow.tsx` (default export): one row of a phone list.
- `src/app/pages/attendance/AttendancePanel.tsx`: the employee panel. It is opened here with
  exactly the seven properties the By Employee table already passes; it is not edited.
- `src/index.css` has the class `no-scrollbar`.

If `src/app/components/mobile/MobileRow.tsx` or `src/app/lib/useIsPhone.ts` does not exist, stop
and say so. Do not write them.

No data is loaded differently: no new loader, no new query, no new sorting. Each phone list is
handed the very list its table draws (already sorted by the table's own code) and shows the same
numbers.

## 1. New file `src/app/pages/attendance/activity/ActivityRows.tsx`

The whole file:

```tsx
import { useState } from 'react';
import type { ActivityDay, ActivitySettings, EmployeeActivitySummary } from '@/app/lib/activityDays';
import { fmtDayShort, thresholdFor } from '@/app/lib/activityDays';
import type { EmployeeTrend } from '@/app/lib/activityTrend';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import { AttendancePanel } from '@/app/pages/attendance/AttendancePanel';
import MobileRow from '@/app/components/mobile/MobileRow';
import { TrendPill, ChangeArrow } from './TrendPill';
import WhyChipBadge from './WhyChipBadge';

// The Activity lists on a phone: one row for each line of the computer's tables. Every list
// arrives already filtered and sorted by the table's own code, and every number is the one the
// table shows. Nothing is loaded, sorted or worked out again here.

// The page has 16px side padding; a phone list runs edge to edge.
const LIST = '-mx-4 bg-white border-t border-slate-200';
const HEADLINE = 'text-[14px] font-semibold text-slate-900 tabular-nums';
const PILL = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border';

/** "2 of 13"; a zero count is muted so the eye lands on the rows that have something. */
function OutOf({ n, of }: { n: number; of: number }) {
  return <span className={n === 0 ? 'text-slate-400' : 'text-slate-700'}>{n} of {of}</span>;
}

/** Grey placeholder rows while the page loads. */
export function RowsLoading() {
  return (
    <div className={LIST} role="status" aria-label="Loading activity data">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="h-[60px] border-b border-slate-200 bg-white animate-pulse" />
      ))}
    </div>
  );
}

type EmployeeRowsProps = {
  /** The table's own list, already sorted. */
  list: EmployeeActivitySummary[];
  trends: Record<number, EmployeeTrend>;
  /** The employee picked in Needs a Look (the row a computer opens in place). */
  openId?: number | null;
  /** Called with that employee's id when their panel is closed. */
  onClosePicked?: (employeeId: number) => void;
};

/** By Employee. Tap a row: the employee panel, opened as the name does on a computer. */
export function EmployeeRows({ list, trends, openId, onClosePicked }: EmployeeRowsProps) {
  const [tapped, setTapped] = useState<EmployeeActivitySummary | null>(null);
  // Nothing opens in place on a phone, so an employee picked in Needs a Look opens the panel too.
  const picked = openId == null ? null : list.find(e => e.employeeId === openId) ?? null;
  const panelEmp = tapped ?? picked;
  const closePanel = () => {
    setTapped(null);
    if (picked) onClosePicked?.(picked.employeeId);
  };

  return (
    <>
      <div className={LIST}>
        {list.map(emp => {
          const trend = trends[emp.employeeId];
          if (!trend) return null;
          // Same figures as the table row: the comparison's own days.
          const a = trend.after;
          return (
            <MobileRow
              key={emp.employeeId}
              title={emp.employeeName}
              sub={emp.role}
              right={<TrendPill verdict={trend.verdict} />}
              chevron="right"
              onClick={() => setTapped(emp)}
              facts={
                <>
                  <span>
                    Avg Active <span className="text-slate-700">{a.avgActiveMin !== null ? fmtDuration(a.avgActiveMin) : '—'}</span>
                    <ChangeArrow measure="active" change={trend.active} />
                  </span>
                  <span>
                    Low Activity <OutOf n={a.lowDays} of={a.worked} />
                    <ChangeArrow measure="low" change={trend.low} />
                  </span>
                  <span>
                    Missed <OutOf n={a.missedDays} of={a.scheduled} />
                    <ChangeArrow measure="missed" change={trend.missed} />
                  </span>
                </>
              }
            />
          );
        })}
      </div>

      {panelEmp && (
        <AttendancePanel
          stats={null}
          employeeId={panelEmp.employeeId}
          days={panelEmp.days}
          displayName={panelEmp.employeeName}
          displayRole={panelEmp.role}
          displayManager={panelEmp.manager}
          onClose={closePanel}
        />
      )}
    </>
  );
}

/** By Day. Reading only: a row opens nothing, exactly as in the table. */
export function DayRows({ days }: { days: ActivityDay[] }) {
  return (
    <div className={LIST}>
      {days.map(d => (
        <MobileRow
          key={`${d.employeeId}-${d.date}`}
          title={d.employeeName}
          sub={fmtDayShort(d.date)}
          right={<span className={HEADLINE}>{fmtDuration(d.activeMin)}</span>}
          tone={d.needsLook ? 'yellow' : 'none'}
          facts={
            <>
              <span>
                {d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'}
                {' → '}
                {d.shownLastMin !== null ? fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '') : '—'}
              </span>
              <span>Breaks {d.records <= 1 ? '—' : fmtDuration(d.breaksMin)}</span>
              {d.needsLook && <span className={`${PILL} bg-amber-50 text-amber-700 border-amber-200`}>Needs A Look</span>}
              {d.flag === 'long_break' && <span className={`${PILL} bg-slate-100 text-slate-600 border-slate-200`}>Long Break</span>}
              {d.why && <WhyChipBadge chip={d.why} />}
              {d.ghostMin !== null && <span className="text-[12px]">Early Record {fmtClock(d.ghostMin)} Ignored</span>}
            </>
          }
        />
      ))}
    </div>
  );
}

type LookRowsProps = {
  /** The worst ten, already chosen and ordered by the Needs a Look box. */
  rows: ActivityDay[];
  settings: ActivitySettings;
  onPick?: (employeeId: number) => void;
};

/** Needs a Look, inside its amber box. Tap a row: the same call the table row makes. */
export function LookRows({ rows, settings, onPick }: LookRowsProps) {
  return (
    <div className="-mx-4 -mb-3 mt-2 bg-white border-t border-amber-200 rounded-b-lg overflow-hidden [&>div:last-child]:border-b-0">
      {rows.map(d => {
        const shortBy = Math.max(0, thresholdFor(d.shiftMinutes, settings) - d.activeMin);
        return (
          <MobileRow
            key={`${d.employeeId}-${d.date}`}
            title={d.employeeName}
            sub={fmtDayShort(d.date)}
            right={<span className={HEADLINE}>{d.records === 0 ? 'No records' : fmtDuration(d.activeMin)}</span>}
            chevron={onPick ? 'right' : 'none'}
            onClick={onPick ? () => onPick(d.employeeId) : undefined}
            facts={
              <>
                <span>Short By <span className="text-slate-700">{shortBy > 0 ? fmtDuration(shortBy) : '—'}</span></span>
                {d.why && <WhyChipBadge chip={d.why} />}
              </>
            }
          />
        );
      })}
    </div>
  );
}
```

## 2. `src/app/pages/attendance/activity/ActivityByEmployee.tsx`: five small edits, nothing else

This file is close to its size limit. Make these five edits and no other change of any kind: do
not tidy, move, rename or re-indent anything. `EmployeeRow`, its `useEffect` (the scroll listener
that keeps an open row frozen under the column headers), `OpenedRow`, `sortEmployees`, `columns`
and the `AttendancePanel` block at the end stay exactly as they are, byte for byte.

**2a.** Directly after the line `import { AttendancePanel } from '@/app/pages/attendance/AttendancePanel';` add:

```tsx
import { useIsPhone } from '@/app/lib/useIsPhone';
```

**2b.** Directly after the line `import ActivityDaysSideBySide from './ActivityDaysSideBySide';` add:

```tsx
import { EmployeeRows } from './ActivityRows';
```

**2c.** Inside `ActivityByEmployee`, directly after the line `  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');` add:

```tsx
  const isPhone = useIsPhone();
```

It must stay there, above the line `if (byEmployee.length === 0) {` (a hook may not come after an
early return).

**2d.** Replace

```tsx
      <DataTable
        columns={columns(tip, lowTip)}
```

with

```tsx
      {isPhone ? <EmployeeRows list={sorted} trends={p.trends} openId={effectiveExpandedId} onClosePicked={handleToggle} /> : <DataTable
        columns={columns(tip, lowTip)}
```

**2e.** Replace

```tsx
      </DataTable>
```

with

```tsx
      </DataTable>}
```

Every line between 2d and 2e (the `DataTable` properties and the `sorted.map(…)` that draws
`EmployeeRow`) stays exactly as it is, with the same indentation.

## 3. `src/app/pages/attendance/activity/ActivityByDay.tsx`: five small edits, nothing else

**3a.** Directly after the line `import type { Col } from '@/app/components/DataTable';` add:

```tsx
import { useIsPhone } from '@/app/lib/useIsPhone';
import { DayRows } from './ActivityRows';
```

**3b.** Inside `ActivityByDay`, directly after the line `  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');` add:

```tsx
  const isPhone = useIsPhone();
```

It must stay there, above the line `if (days.length === 0) {`.

**3c.** Replace

```tsx
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
```

with

```tsx
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm phone:min-h-11"
```

**3d.** Replace

```tsx
      <DataTable
        columns={COLUMNS}
```

with

```tsx
      {isPhone ? <DayRows days={sorted} /> : <DataTable
        columns={COLUMNS}
```

**3e.** Replace

```tsx
      </DataTable>
```

with

```tsx
      </DataTable>}
```

`exportCsv`, `sortDays`, `COLUMNS`, the Export CSV button's `onClick` and every table row stay
exactly as they are.

## 4. `src/app/pages/attendance/activity/ActivityNeedsLook.tsx`: five small edits, nothing else

**4a.** Directly after the line `import WhyChipBadge from './WhyChipBadge';` add:

```tsx
import { useIsPhone } from '@/app/lib/useIsPhone';
import { LookRows } from './ActivityRows';
```

**4b.** Directly after the line `export default function ActivityNeedsLook({ days, dateTo, settings, onPick, open, onToggle, part }: Props) {` add:

```tsx
  const isPhone = useIsPhone();
```

It must be the first line of the component, above `useMemo` and above every `return`.

**4c.** (The chip.) Replace

```tsx
        className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-status-yellow-tint border border-amber-200 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors whitespace-nowrap"
```

with

```tsx
        className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-status-yellow-tint border border-amber-200 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors whitespace-nowrap phone:h-11 phone:shrink-0"
```

**4d.** (The Hide link in the open box.) Replace

```tsx
          <button type="button" onClick={onToggle} aria-expanded className="font-semibold text-amber-800 hover:underline underline-offset-2">
```

with

```tsx
          <button type="button" onClick={onToggle} aria-expanded className="font-semibold text-amber-800 hover:underline underline-offset-2 phone:min-h-11 phone:px-2">
```

**4e.** Replace

```tsx
      ) : (
        <div className="overflow-x-auto">
```

with

```tsx
      ) : isPhone ? (
        <LookRows rows={windowRows} settings={settings} onPick={onPick} />
      ) : (
        <div className="overflow-x-auto">
```

The table inside that `<div className="overflow-x-auto">`, `inLast7`, `stepBack`,
`windowStartDate`, the `useMemo` that picks the worst ten, and the heading stay exactly as they
are.

## 5. `src/app/pages/attendance/activity/AttendanceActivity.tsx`: eleven small edits, nothing else

**5a.** Directly after the line `import { useViewer } from '@/app/context/ViewerContext';` add:

```tsx
import { useIsPhone } from '@/app/lib/useIsPhone';
```

**5b.** Directly after the line `import ActivityThresholds from './ActivityThresholds';` add:

```tsx
import { RowsLoading } from './ActivityRows';
```

**5c.** Directly after the line `  const { isSuper } = useViewer();` add:

```tsx
  const isPhone = useIsPhone();
```

**5d.** (A card. Two across on a phone.) Replace

```tsx
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-col gap-0.5 min-w-[110px] shadow-card">
```

with

```tsx
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-col gap-0.5 min-w-[110px] shadow-card phone:w-[calc(50%-6px)] phone:min-w-0 phone:px-3">
```

**5e.** (The comparison line under a card may wrap on a phone.) Replace

```tsx
        <span className={`text-[12px] mt-1 pt-1 border-t border-slate-100 whitespace-nowrap tabular-nums ${noteTone === 'good' ? 'text-status-green-ink' : noteTone === 'bad' ? 'text-status-red-ink' : 'text-slate-500'}`}>
```

with

```tsx
        <span className={`text-[12px] mt-1 pt-1 border-t border-slate-100 whitespace-nowrap phone:whitespace-normal tabular-nums ${noteTone === 'good' ? 'text-status-green-ink' : noteTone === 'bad' ? 'text-status-red-ink' : 'text-slate-500'}`}>
```

**5f.** (Retry, full width on a phone.) Replace

```tsx
              className="ml-6 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-100 text-red-800 hover:bg-red-200 transition-colors border border-red-200"
```

with

```tsx
              className="ml-6 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-100 text-red-800 hover:bg-red-200 transition-colors border border-red-200 phone:ml-0 phone:w-full phone:min-h-11"
```

**5g.** (Loading: grey rows on a phone.) Replace

```tsx
        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
```

with

```tsx
        {loading && isPhone && <RowsLoading />}
        {loading && !isPhone && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
```

**5h.** (The controls: their own line on a phone, sliding sideways.) Replace

```tsx
              <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
```

with

```tsx
              <div className="flex flex-wrap items-center justify-end gap-2 ml-auto no-scrollbar phone:ml-0 phone:w-full phone:flex-nowrap phone:justify-start phone:overflow-x-auto">
```

**5i.** Replace

```tsx
                <div className="flex rounded-md border border-slate-300 overflow-hidden">
```

with

```tsx
                <div className="flex rounded-md border border-slate-300 overflow-hidden phone:shrink-0">
```

**5j.** (The By Employee button.) Replace

```tsx
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors',
```

with

```tsx
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors phone:min-h-11 phone:px-4 phone:whitespace-nowrap',
```

**5k.** (The By Day button.) Replace

```tsx
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l',
```

with

```tsx
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l phone:min-h-11 phone:px-4 phone:whitespace-nowrap',
```

Everything else in this file stays exactly as it is, including these three lines, which must
remain character for character:
`<ActivityByDay days={days} dateFrom={safeFrom} dateTo={safeTo} />`,
`<ActivityNeedsLook part="box" open={lookOpen} onToggle={toggleLook} days={filteredNeedsLook} dateTo={safeTo} settings={settings} onPick={handlePickEmployee} />`
and `<ActivityThresholds settings={settings} minimums={minimums} onSaved={reloadConfig} />`.
Do not pass any new property to `ActivityByEmployee`, `ActivityByDay`, `ActivityNeedsLook` or
`ActivityThresholds`: each of the three lists reads `useIsPhone()` itself.

## 6. `src/app/pages/attendance/activity/ActivityThresholds.tsx`: one class string, nothing else

Replace

```tsx
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
```

with

```tsx
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm phone:min-h-11 phone:shrink-0"
```

The pop-up, its fields and its saving stay exactly as they are.

## Known and accepted

- **The Before and After comparison, the day chart and the two side-by-side day lists are not
  shown on a phone.** They need their own design. On a phone a row opens the employee panel
  instead; the comparison stays on the computer.
- On a phone the By Employee list is in name order and By Day in date order (the order each
  table starts in). There are no column headers to tap, so the order cannot be changed there.
- By Day on a phone leaves out the Source column (Live / Official) and the role under the name.
- Entry and Exit averages and Away Days are not on the By Employee row; they are in the panel.
- Tapping a Needs a Look row on a phone switches to By Employee and opens that employee's
  panel (on a computer it opens their row in place, which a phone does not have).
- The page keeps its one scrolling area (the page itself). No list has a scroll box of its own.

## Acceptance — visible facts

On a phone-sized screen (375 × 667), Attendance → Activity:
1. The four cards sit two across, two rows. Under them, on one line that slides sideways: the
   amber `Needs a Look N Show` chip, `By Employee | By Day`, and (super users) `Thresholds`.
   Each is at least 44 px tall. Nothing wraps into a block.
2. By Employee: one row per employee, edge to edge, a hairline between rows. Line 1: the name,
   the role under it, and at the right the Trend pill (`Improved`, `Worse`, `Mixed`, `No Change`,
   `Not Enough Data`) and a `›`. Line 2: `Avg Active 7h 4m`, `Low Activity 2 of 13`,
   `Missed 0 of 14`, with the same small coloured arrows the table shows. The numbers match the
   same employee's row on a computer for the same dates.
3. Tap a row: the employee panel opens for that person. Close it: the list is where it was.
4. No table, no Before and After, no chart on the phone. The page scrolls as one; no list
   scrolls inside a box.
5. By Day: one row per day. Name, the date under it, active time at the right; then
   `8:02 AM → 5:10 PM`, `Breaks 45m`, and the chips (`Needs A Look`, `Long Break`, the reason).
   A day that needs a look has the pale yellow wash. Tapping a row does nothing. `Export CSV`
   is above the list and downloads the same file as on a computer.
6. Tap the `Needs a Look` chip: the amber box opens with up to ten rows (name, date, active
   time or `No records`, `Short By …`, the reason). Tap one: the view is By Employee and that
   person's panel is open. Close it, tap the same row again: it opens again. `Hide` closes the box.
7. While loading, five grey placeholder rows show instead of a blank page.
8. Sideways (667 × 375): the same rows; nothing is cut off.
9. No console errors on load or after each tap.

On a computer nothing changes (1440 wide, mouse):
10. One toolbar row: cards on the left; chip, switch and Thresholds on the right, the same sizes
    as before.
11. By Employee is the table: sortable headers, the Trend column, a click on a row opens Before
    and After, the open row stays frozen under the headers while its detail scrolls, the name
    opens the side panel.
12. By Day is the table with Export CSV; Needs a Look opens as the small amber table and a click
    on a line opens that employee's row.

When done, reply with a one-line summary per file.
