# Phone view, Attendance → Activity, part 1 of 2 (the phone rows, and Needs a Look)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today the Activity page is the computer page squeezed: the four cards and the
controls wrap into an untidy block, and the By Employee, By Day and Needs a Look tables each
slide sideways inside their own box. This prompt gives a phone-sized screen one row per line
instead of each table, puts the cards two across, and puts the controls on one line that slides.
A computer keeps exactly what it has.

**This is part 1 of 2.** It adds the one new file with every phone row in it, makes Needs a Look use it, and edits one class string of the Thresholds button. By Employee, By Day, the cards and the controls stay exactly as they are after this part. Part 2 follows as a separate prompt. Write everything exactly as given: do not adapt or shorten it, and do not wire the new file into any other file. Exports that nothing uses yet (`EmployeeRows`, `DayRows`, `RowsLoading`) are expected: leave them.

**Only these files may change.** One new: `src/app/pages/attendance/activity/ActivityRows.tsx`. Two edited: `src/app/pages/attendance/activity/ActivityNeedsLook.tsx`, `src/app/pages/attendance/activity/ActivityThresholds.tsx`. **No other file may be touched.** No migration, no action file.

Rules:
- Only these files may change: the three listed above. No other file may be touched. No action file, no migration.
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


## Acceptance

1. `ActivityRows.tsx` exists with exactly the content above; `ActivityNeedsLook.tsx` has exactly its five edits and `ActivityThresholds.tsx` its one.
2. On a computer (1440 wide, mouse), Attendance → Activity looks and works exactly as before: the toolbar, both tables, and Needs a Look opening as the small amber table.
3. On a phone-sized screen (375 × 667) the only changes are: the `Needs a Look` chip, its `Hide` link and the `Thresholds` button are taller, and the open amber box lists rows instead of a table. By Employee and By Day are still tables.
4. No console errors.

When done, reply with a one-line summary per file.
