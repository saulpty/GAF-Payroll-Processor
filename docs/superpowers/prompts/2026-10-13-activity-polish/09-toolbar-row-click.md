# Activity: one toolbar row; click anywhere on a row to open it

**Make exactly the edits below, character for character. These are small, targeted edits: do not
rewrite, reformat, reorder or "improve" anything else in any file. If your context is compacted
mid-task, re-read this prompt before writing.**

**Only these three files may change**, all in `src/app/pages/attendance/activity/`: `AttendanceActivity.tsx`,
`ActivityNeedsLook.tsx`, `ActivityByEmployee.tsx`. **No other file may be touched.**

## Why (Saul, 2026-10-13)
1. The cards, the By Employee / By Day switch and the Needs a Look chip sat on three stacked rows. They
   become one row: cards on the left; chip, switch and Thresholds on the right. The Needs a Look list still
   opens under that row, so the page now owns its open/closed state.
2. Clicking anywhere on an employee row opens or closes it; the arrow is no longer the only target.
   Clicking the name still opens the side panel.

## 1. `src/app/pages/attendance/activity/ActivityNeedsLook.tsx`

Edit 1. Replace

```tsx
import { useMemo, useState } from 'react';
```

with

```tsx
import { useMemo } from 'react';
```

Edit 2. Replace

```tsx
  onPick?: (employeeId: number) => void;
};
```

with

```tsx
  onPick?: (employeeId: number) => void;
  // The page owns open/closed and renders this twice: the chip in its toolbar, the box under it.
  open: boolean;
  onToggle: () => void;
  part: 'chip' | 'box';
};
```

Edit 3. Replace

```tsx
export default function ActivityNeedsLook({ days, dateTo, settings, onPick }: Props) {
  // Closed by default (Saul, 2026-10-13): a small chip the viewer opens when they want the list.
  const [open, setOpen] = useState(false);
```

with

```tsx
// Closed by default (Saul, 2026-10-13): a small chip the viewer opens when they want the list.
export default function ActivityNeedsLook({ days, dateTo, settings, onPick, open, onToggle, part }: Props) {
```

Edit 4. Replace

```tsx
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="inline-flex items-center gap-2 h-8 px-3 mb-4 rounded-full bg-status-yellow-tint border border-amber-200 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        Needs a Look
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-200 text-amber-900 tabular-nums">{totalFlagged}</span>
        <span className="font-medium text-amber-700">Show</span>
      </button>
    );
  }
```

with

```tsx
  if (part === 'chip') {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-status-yellow-tint border border-amber-200 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors whitespace-nowrap"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        Needs a Look
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-200 text-amber-900 tabular-nums">{totalFlagged}</span>
        <span className="font-medium text-amber-700">{open ? 'Hide' : 'Show'}</span>
      </button>
    );
  }
  if (!open) return null;
```

Edit 5. Replace

```tsx
          <button type="button" onClick={() => setOpen(false)} aria-expanded className=
```

with

```tsx
          <button type="button" onClick={onToggle} aria-expanded className=
```

## 2. `src/app/pages/attendance/activity/AttendanceActivity.tsx`

Edit 1. Replace

```tsx
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<number | null>(null);
```

with

```tsx
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<number | null>(null);
  // Needs a Look starts closed: a chip in the toolbar opens the list under it.
  const [lookOpen, setLookOpen] = useState(false);
  const toggleLook = () => setLookOpen(v => !v);
```

Edit 2. Replace this whole block, from the comment `{/* KPI tiles + Thresholds button */}` through the `<ActivityNeedsLook … />` line:

```tsx
            {/* KPI tiles + Thresholds button */}
            <div className="flex flex-wrap items-start gap-3 mb-4">
              <SummaryTile label="Avg Active Time"  value={avgActiveLabel}    accent="text-status-green-ink" dot="bg-green-600" note={activeNote.note} noteTone={activeNote.noteTone} />
              <SummaryTile label="Days With Work"   value={totals.daysWorked} note={workedNote} />
              <SummaryTile label="Needs a Look"     value={totals.needsLook}  accent={totals.needsLook > 0 ? 'text-status-yellow-ink' : undefined} dot="bg-yellow-500" note={lookNote.note} noteTone={lookNote.noteTone} />
              <SummaryTile label="Late Arrivals"    value={totals.lateArrivals} accent={totals.lateArrivals > 0 ? 'text-status-red-ink' : undefined} dot="bg-red-600" note={lateNote.note} noteTone={lateNote.noteTone} />
              {isSuper && (
                <div className="flex items-center self-center ml-auto">
                  <ActivityThresholds settings={settings} minimums={minimums} onSaved={reloadConfig} />
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
```

with

```tsx
            {/* One row (Saul, 2026-10-13): KPI tiles on the left; the Needs a Look chip, the view switch
                and Thresholds on the right. The Needs a Look list opens underneath. */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <SummaryTile label="Avg Active Time"  value={avgActiveLabel}    accent="text-status-green-ink" dot="bg-green-600" note={activeNote.note} noteTone={activeNote.noteTone} />
              <SummaryTile label="Days With Work"   value={totals.daysWorked} note={workedNote} />
              <SummaryTile label="Needs a Look"     value={totals.needsLook}  accent={totals.needsLook > 0 ? 'text-status-yellow-ink' : undefined} dot="bg-yellow-500" note={lookNote.note} noteTone={lookNote.noteTone} />
              <SummaryTile label="Late Arrivals"    value={totals.lateArrivals} accent={totals.lateArrivals > 0 ? 'text-status-red-ink' : undefined} dot="bg-red-600" note={lateNote.note} noteTone={lateNote.noteTone} />
              <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
                <ActivityNeedsLook part="chip" open={lookOpen} onToggle={toggleLook} days={filteredNeedsLook} dateTo={safeTo} settings={settings} onPick={handlePickEmployee} />
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
                {isSuper && <ActivityThresholds settings={settings} minimums={minimums} onSaved={reloadConfig} />}
              </div>
            </div>

            {/* Needs A Look list */}
            <ActivityNeedsLook part="box" open={lookOpen} onToggle={toggleLook} days={filteredNeedsLook} dateTo={safeTo} settings={settings} onPick={handlePickEmployee} />
```

## 3. `src/app/pages/attendance/activity/ActivityByEmployee.tsx`

Edit 1. Replace

```tsx
      <tr ref={rowRef} className={expanded ? 'sticky z-[5] bg-white shadow-sm' : 'hover:bg-slate-50 transition-colors'}>
```

with

```tsx
      <tr ref={rowRef} onClick={onToggle} className={expanded ? 'sticky z-[5] bg-white shadow-sm cursor-pointer' : 'hover:bg-slate-50 transition-colors cursor-pointer'}>
```

Edit 2. Replace

```tsx
            <button onClick={onToggle} className="shrink-0 text-slate-400 hover:text-slate-600"
```

with

```tsx
            <button onClick={e => { e.stopPropagation(); onToggle(); }} className="shrink-0 text-slate-400 hover:text-slate-600"
```

Edit 3. Replace

```tsx
                onClick={() => onOpenPanel(emp)}
```

with

```tsx
                onClick={e => { e.stopPropagation(); onOpenPanel(emp); }}
```

## Acceptance (Attendance → Activity)
1. Cards, the Needs a Look chip, the By Employee / By Day switch and Thresholds are on one row.
2. The chip reads Show; clicking it opens the list under the row and the chip reads Hide.
3. Clicking anywhere on an employee row opens it; clicking again closes it. The arrow still works. Clicking the name opens the side panel and does not open the row.

When done, reply with a one-line summary per file.
