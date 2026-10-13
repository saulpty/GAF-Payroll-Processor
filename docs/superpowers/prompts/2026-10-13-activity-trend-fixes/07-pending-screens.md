# Activity: pending fixes, part 2 (screens) — tooltip wording, screen readers, narrow windows, crowded chart labels, whole numbers

**Make exactly the edits below, character for character. These are small, targeted edits: do not
rewrite, reformat, reorder or "improve" anything else in any file. If your context is compacted
mid-task, re-read this prompt before writing.**

**Only these five files may change**, all in `src/app/pages/attendance/activity/`: `ActivityByEmployee.tsx`,
`ActivityDayChart.tsx`, `ActivityThresholds.tsx`, `ActivityCompare.tsx`, `ActivityDaysSideBySide.tsx`. **No other file may be touched.**

## 1. `src/app/pages/attendance/activity/ActivityByEmployee.tsx`

Edit 1. Replace

```tsx
    ? `Compares ${p.afterLabel} with the ${p.prevDayCount} days right before it, ${p.beforeLabel}. Days off, PTO, sick days and holidays are left out of both. Change the dates above to compare a different period.`
```

with

```tsx
    ? `Compares ${p.afterLabel} with the ${p.prevDayCount} ${p.prevDayCount === 1 ? 'day' : 'days'} right before it, ${p.beforeLabel}. Days off, PTO, permissions, sick days and holidays are left out of both. Change the dates above to compare a different period.`
```

Edit 2. Replace

```tsx
        {showDays ? `▲ Hide the ${total} Days` : `▼ Show All ${total} Days`}
```

with

```tsx
        <span aria-hidden="true">{showDays ? '▲' : '▼'}</span>
        {showDays ? `Hide All ${total} Days` : `Show All ${total} Days`}
```

Edit 3. Directly above the line `function OpenedRow(` add:

```tsx
// The opened row stays as wide as the visible table area and sticks to its left edge, so on a
// narrow window it does not scroll sideways with the columns.
const OPENED_WIDTH = { width: 'min(100%, calc(100vw - 50px))' };

```

Edit 4. This line appears **twice** in `OpenedRow`. Replace **both** occurrences of

```tsx
      <div className="p-4 bg-slate-50 border-b-2 border-slate-300">
```

with

```tsx
      <div className="sticky left-0 p-4 bg-slate-50 border-b-2 border-slate-300" style={OPENED_WIDTH}>
```

(the second occurrence is indented by four spaces instead of six; keep its own indentation).

Edit 5. The Before and After panel was 430px wide and cut off its Change column; it also stretched to the chart's height. Replace

```tsx
      <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-4">
```

with

```tsx
      <div className="grid grid-cols-1 xl:grid-cols-[480px_minmax(0,1fr)] gap-4 items-start">
```

## 2. `src/app/pages/attendance/activity/ActivityDayChart.tsx`

Edit 1. Replace

```tsx
        {bars.map(b => {
          const [dow, , day] = fmtDayShort(b.date).split(' ');
          return (
            <span key={b.date} className="flex-1 min-w-0 text-center text-[11px] leading-tight text-slate-500">
              {(dow ?? '').charAt(0)}<span className="block font-semibold text-slate-700">{day}</span>
            </span>
          );
        })}
```

with

```tsx
        {bars.map((b, i) => {
          const [dow, , day] = fmtDayShort(b.date).split(' ');
          // A long range has too many bars to label each one: label Mondays (and the first bar) only.
          const show = bars.length <= 26 || dow === 'Mon' || i === 0;
          return (
            <span key={b.date} className="flex-1 min-w-0 flex flex-col items-center text-[11px] leading-tight text-slate-500 whitespace-nowrap">
              {show ? <>{(dow ?? '').charAt(0)}<span className="block font-semibold text-slate-700">{day}</span></> : null}
            </span>
          );
        })}
```

Then five more edits in the same file (labels in Title Case; the header says what the number is):

Edit 2. Replace

```tsx
          {avg === null ? 'No days with work' : `${fmtMinutes(avg)} a day on average`}
```

with

```tsx
          {avg === null ? 'No Days With Work' : `Avg Active ${fmtMinutes(avg)}`}
```

Edit 3. Replace

```tsx
          <span><i className={`${SWATCH} bg-primary`} />Normal day</span>
```

with

```tsx
          <span><i className={`${SWATCH} bg-primary`} />Normal Day</span>
```

Edit 4. Replace

```tsx
⚠️ Under the {fmtMinutes(p.thresholdMin)} minimum</span>
```

with

```tsx
⚠️ Under the {fmtMinutes(p.thresholdMin)} Minimum</span>
```

Edit 5. Replace

```tsx
✕ Missed, no approved reason</span>
```

with

```tsx
✕ Missed, No Approved Reason</span>
```

Edit 6. Replace

```tsx
border-dashed border-status-yellow-ink" />{fmtMinutes(p.thresholdMin)} minimum</span>
```

with

```tsx
border-dashed border-status-yellow-ink" />{fmtMinutes(p.thresholdMin)} Minimum</span>
```

## 3. `src/app/pages/attendance/activity/ActivityThresholds.tsx`

Edit 1. Replace

```tsx
  if (!Number.isFinite(n) || n <= 0) return null;
  const stored = field.unit === 'hours' ? Math.round(n * 60) : Math.round(n);
```

with

```tsx
  if (!Number.isFinite(n) || n <= 0) return null;
  // Minutes and days are stored as typed: 2.5 days must not silently become 3.
  if (field.unit !== 'hours' && !Number.isInteger(n)) return null;
  const stored = field.unit === 'hours' ? Math.round(n * 60) : Math.round(n);
```

Edit 2. Replace

```tsx
        setError('All values must be positive numbers.');
```

with

```tsx
        setError('All values must be positive numbers. Minutes and days must be whole numbers.');
```

Edit 3. Replace

```tsx
            Applies to everyone. A shorter shift is scaled proportionally.
```

with

```tsx
            Applies to everyone. The minimum active time is scaled for a shorter shift.
```

## 4. `src/app/pages/attendance/activity/ActivityCompare.tsx`

Table cells are 13px like every other table cell in the app.

Edit 1. Replace

```tsx
const TD = 'px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap border-t border-slate-100';
```

with

```tsx
const TD = 'px-3 py-2 text-right text-[13px] tabular-nums whitespace-nowrap border-t border-slate-100';
```

## 5. `src/app/pages/attendance/activity/ActivityDaysSideBySide.tsx`

Edit 1. Replace

```tsx
        {sum && <span className="text-xs text-slate-500">{sum.worked} days with work</span>}
```

with

```tsx
        {sum && <span className="text-xs text-slate-500">{sum.worked} Days With Work</span>}
```

## Acceptance
1. The Trend tooltip mentions permissions and says "1 day" for a one-day comparison.
2. On a 90-day range the chart labels no longer overlap (Mondays only).
3. On a window narrower than the table, an opened row stays in view instead of scrolling sideways.
4. The Before and After panel shows its whole Change column and is only as tall as its table.
5. Labels read in Title Case: Not Enough Data, No Change, Normal Day, Avg Active 7h 4m, 10 Days With Work, Hide All 21 Days.
6. Thresholds: typing 2.5 in a days field and saving shows an error instead of storing 3.

When done, reply with a one-line summary per file.
