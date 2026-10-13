# Activity: Needs a Look closed by default, "Low Activity Days", frozen open row, bold names

**Make exactly the edits below, character for character. These are small, targeted edits: do not
rewrite, reformat, reorder or "improve" anything else in any file. If your context is compacted
mid-task, re-read this prompt before writing.**

**Only these four files may change**, all in `src/app/pages/attendance/activity/`: `ActivityNeedsLook.tsx`,
`ActivityByEmployee.tsx`, `ActivityCompare.tsx`, `ActivityDaysSideBySide.tsx`. **No other file may be touched.**
Do not edit `src/app/components/DataTable.tsx`.

## Why (Saul, 2026-10-13)
1. The yellow Needs a Look box is in the way: closed by default, shown as a small chip the viewer can open.
2. The column header "⚠️ Days" says nothing: it is now "Low Activity Days", with a tooltip.
3. When a row is open, that employee's row stays frozen under the column headers while its detail scrolls.
4. Employee names in bold.

## 1. `src/app/pages/attendance/activity/ActivityNeedsLook.tsx`

Edit 1. Replace

```tsx
import { useMemo } from 'react';
```

with

```tsx
import { useMemo, useState } from 'react';
```

Edit 2. Replace

```tsx
export default function ActivityNeedsLook({ days, dateTo, settings, onPick }: Props) {
```

with

```tsx
export default function ActivityNeedsLook({ days, dateTo, settings, onPick }: Props) {
  // Closed by default (Saul, 2026-10-13): a small chip the viewer opens when they want the list.
  const [open, setOpen] = useState(false);
```

Edit 3. Replace

```tsx
  if (totalFlagged === 0) return null;
```

with

```tsx
  if (totalFlagged === 0) return null;

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

Edit 4. Replace

```tsx
        <span className="text-xs text-amber-600 whitespace-nowrap">
          {totalFlagged} flagged {totalFlagged === 1 ? 'day' : 'days'} in the whole range
        </span>
```

with

```tsx
        <span className="flex items-center gap-3 text-xs text-amber-600 whitespace-nowrap">
          {totalFlagged} flagged {totalFlagged === 1 ? 'day' : 'days'} in the whole range
          <button type="button" onClick={() => setOpen(false)} aria-expanded className="font-semibold text-amber-800 hover:underline underline-offset-2">
            Hide
          </button>
        </span>
```

## 2. `src/app/pages/attendance/activity/ActivityByEmployee.tsx`

Edit 1. Replace

```tsx
import { useState } from 'react';
```

with

```tsx
import { useEffect, useRef, useState } from 'react';
```

Edit 2. Replace

```tsx
function columns(tip: string): Col<EmployeeActivitySummary>[] {
```

with

```tsx
function columns(tip: string, lowTip: string): Col<EmployeeActivitySummary>[] {
```

Edit 3. Replace

```tsx
    { key: 'needsLook',    label: '⚠️ Days' },
```

with

```tsx
    { key: 'needsLook',    label: 'Low Activity Days', tip: lowTip },
```

Edit 4. Replace

```tsx
      <div className="grid grid-cols-1 xl:grid-cols-[480px_minmax(0,1fr)] gap-4 items-start">
```

with

```tsx
      <div className="grid grid-cols-1 xl:grid-cols-[500px_minmax(0,1fr)] gap-4 items-start">
```

Edit 5. Replace

```tsx
  const a = trend.after;
```

with

```tsx
  const a = trend.after;
  const rowRef = useRef<HTMLTableRowElement>(null);
  const detailRef = useRef<HTMLTableRowElement>(null);

  // While a row is open it stays frozen under the column headers, and is pushed out by the end of
  // its own detail. (A sticky <tr> on its own would stay pinned to the end of the whole table.)
  useEffect(() => {
    const row = rowRef.current, detail = detailRef.current;
    if (!expanded || !row || !detail) return;
    const scroller = row.closest('.overflow-auto') as HTMLElement | null;
    const head = row.closest('table')?.querySelector('thead') as HTMLElement | null;
    if (!scroller || !head) return;
    const place = () => {
      const headH = head.getBoundingClientRect().height;
      const room = detail.getBoundingClientRect().bottom - scroller.getBoundingClientRect().top - row.getBoundingClientRect().height;
      row.style.top = `${Math.min(headH, room)}px`;
    };
    place();
    scroller.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      scroller.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
      row.style.top = '';
    };
  }, [expanded]);
```

Edit 6. Replace

```tsx
      <tr className="hover:bg-slate-50 transition-colors">
        <td className={TD}>
          <div className="flex items-center gap-2">
```

with

```tsx
      <tr ref={rowRef} className={expanded ? 'sticky z-[5] bg-white shadow-sm' : 'hover:bg-slate-50 transition-colors'}>
        <td className={TD}>
          <div className="flex items-center gap-2">
```

Edit 7. Replace

```tsx
                className="font-medium text-slate-800 hover:text-warm-text hover:underline underline-offset-2 text-left transition-colors"
```

with

```tsx
                className="font-semibold text-slate-900 hover:text-warm-text hover:underline underline-offset-2 text-left transition-colors"
```

Edit 8. Replace

```tsx
      {expanded && (
        <tr>
          <td colSpan={9} className="p-0">
```

with

```tsx
      {expanded && (
        <tr ref={detailRef}>
          <td colSpan={9} className="p-0">
```

Edit 9. Replace

```tsx
  const sorted = sortEmployees(byEmployee, sortKey, sortDir, p.trends);
```

with

```tsx
  const lowTip = `Days with work but under the minimum active time (${fmtDuration(p.settings.minActiveMinutes)} on a full shift).`;
  const sorted = sortEmployees(byEmployee, sortKey, sortDir, p.trends);
```

Edit 10. Replace

```tsx
        columns={columns(tip)}
```

with

```tsx
        columns={columns(tip, lowTip)}
```

## 3. `src/app/pages/attendance/activity/ActivityCompare.tsx`

Edit 1. Replace

```tsx
          <Row label="⚠️ Days" before=
```

with

```tsx
          <Row label="Low Activity Days" before=
```

## 4. `src/app/pages/attendance/activity/ActivityDaysSideBySide.tsx`

Edit 1. Replace

```tsx
          <Figure label="⚠️ Days" value=
```

with

```tsx
          <Figure label="Low Activity Days" value=
```

## Acceptance (Attendance → Activity)
1. The yellow box is replaced by a small amber chip "Needs a Look N Show"; clicking it opens the box, and "Hide" closes it.
2. The column reads "Low Activity Days" with an info tooltip; the Before and After table and the day lists use the same words.
3. Open a row and scroll inside the table: the employee's row stays under the column headers until its detail ends.
4. Employee names are bold.

When done, reply with a one-line summary per file.
