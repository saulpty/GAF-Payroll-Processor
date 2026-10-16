# Attendance → List: the On-Time pill, and the phone rows say each fact once (part 2 of 3)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only these files may change.** Three edited: `src/app/pages/attendance/AttendanceTable.tsx`,
`src/app/pages/attendance/AttendanceListRows.tsx`, `src/app/lib/attendanceSort.ts`. **No other
file may be touched.** No migration, no action file, no loader, no change to
`src/app/lib/attendanceStats.ts`.

Rules that hold for this prompt:

- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- Every file stays under 15 KB.
- Presentation only: no number is calculated differently. Every value comes from the same
  `EmpStats` field as today.
- Tailwind class names are written out whole (never built from pieces like `bg-status-${x}-ink`).
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Dates are `YYYY-MM-DD` strings and are compared as strings. Never `new Date(str)` for date math.
  (Nothing in this prompt touches dates.)

## Why (Saul, 2026-10-16)

The List is a punctuality scorecard, and it said several things twice. "Good / Fair / At Risk" is
decided by the on-time rate alone, so it repeats the % On-Time number in words; Total Late is
Reported + Unreported. After this part and the next, each fact appears once, in the same words on
a phone and on a computer: **On-Time** (a rate, green / amber / red), **Late** (with how many were
not reported), **Absent**, **Reporting**.

This part adds the On-Time pill and its explanation next to the table's other pills, and moves the
phone rows onto them. The computer table does not change yet (that is part 3), so `PctBar`,
`StatusBadge` and `STATUS_TOOLTIP` stay in place for now.

## 1. `src/app/pages/attendance/AttendanceTable.tsx` — one edit, nothing else

Replace

```tsx
function PctBar({ pct }: { pct: number }) {
```

with

```tsx
type Tone = 'green' | 'yellow' | 'red';

/** Green 90% or above, amber 75–89%, red below 75%. The only place these limits are written. */
function onTimeTone(pct: number): Tone {
  if (pct >= 90) return 'green';
  if (pct >= 75) return 'yellow';
  return 'red';
}

const BAR: Record<Tone, string> = {
  green: 'bg-status-green-ink',
  yellow: 'bg-status-yellow-ink',
  red: 'bg-status-red-ink',
};

const PILL: Record<Tone, string> = {
  green: 'bg-status-green-fill text-status-green-ink',
  yellow: 'bg-status-yellow-fill text-status-yellow-ink',
  red: 'bg-status-red-fill text-status-red-ink',
};

export const ON_TIME_TOOLTIP = 'On-time days divided by expected days (on time + late + absent). Green is 90% or above, amber 75–89%, red below 75%. Time off and permissions are not counted either way.';

/** Computer table: a bar and the rate, coloured by the limits above. A dash when no day was expected. */
export function OnTimeBar({ pct, days }: { pct: number; days: number }) {
  if (days === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-border rounded-full min-w-10">
        <div className={`h-1 rounded-full ${BAR[onTimeTone(pct)]}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

/** Phone rows: the same rate as a pill, in the same colours. A dash when no day was expected. */
export function OnTimePill({ pct, days }: { pct: number; days: number }) {
  if (days === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums whitespace-nowrap ${PILL[onTimeTone(pct)]}`}>
      {pct.toFixed(0)}% On Time
    </span>
  );
}

function PctBar({ pct }: { pct: number }) {
```

`PctBar`, `STATUS_TOOLTIP`, `StatusBadge`, the header row and the table rows stay exactly as they
are in this part.

## 2. `src/app/pages/attendance/AttendanceListRows.tsx` — four edits, nothing else

**2a.** Replace

```tsx
import { REPORTING_TOOLTIP, ReportingBadge, STATUS_TOOLTIP, StatusBadge } from './AttendanceTable';
```

with

```tsx
import { ON_TIME_TOOLTIP, OnTimePill, REPORTING_TOOLTIP, ReportingBadge } from './AttendanceTable';
```

**2b.** Replace

```tsx
// The Good / Fair / At Risk pill and the Reporting pill are the table's own, imported.
```

with

```tsx
// The On-Time pill and the Reporting pill are the table's own, imported.
```

**2c.** Replace

```tsx
          What Status and Reporting Mean
        </summary>
        <p className="pb-1"><span className="font-medium text-slate-700">Status.</span> {STATUS_TOOLTIP}</p>
```

with

```tsx
          What On-Time and Reporting Mean
        </summary>
        <p className="pb-1"><span className="font-medium text-slate-700">On-Time.</span> {ON_TIME_TOOLTIP}</p>
```

**2d.** Replace

```tsx
              right={<StatusBadge pct={s.pctOnTime} days={s.days} />}
              chevron="right"
              onClick={() => onRowClick(s.email)}
              facts={
                <>
                  <span><span className="font-medium text-slate-700">{s.pctOnTime.toFixed(0)}%</span> on time</span>
                  <span>Late {s.totalLate}</span>
                  <span>Unreported {s.unreported}</span>
                  <span>Absent {s.absent}</span>
                  <span className="inline-flex items-center gap-1.5">Reporting <ReportingBadge s={s} /></span>
                </>
              }
```

with

```tsx
              right={<OnTimePill pct={s.pctOnTime} days={s.days} />}
              chevron="right"
              onClick={() => onRowClick(s.email)}
              facts={
                <>
                  <span>
                    Late {s.totalLate}
                    {s.unreported > 0 && <span className="text-status-red-ink"> ({s.unreported} Not Reported)</span>}
                  </span>
                  <span>Absent {s.absent}</span>
                  <span className="inline-flex items-center gap-1.5">Reporting <ReportingBadge s={s} /></span>
                </>
              }
```

## 3. `src/app/lib/attendanceSort.ts` — one edit, nothing else

The keys and directions do not change; only the words in the phone's Sort By box. Replace

```ts
  { key: 'pctOnTime', dir: 'asc', label: '% On-Time (Lowest First)' },
  { key: 'unreported', dir: 'desc', label: 'Unreported (Most First)' },
  { key: 'absent', dir: 'desc', label: 'Absent (Most First)' },
  { key: 'totalLate', dir: 'desc', label: 'Total Late (Most First)' },
```

with

```ts
  { key: 'pctOnTime', dir: 'asc', label: 'On-Time (Lowest First)' },
  { key: 'unreported', dir: 'desc', label: 'Late, Not Reported (Most First)' },
  { key: 'absent', dir: 'desc', label: 'Absent (Most First)' },
  { key: 'totalLate', dir: 'desc', label: 'Late (Most First)' },
```

## Acceptance — visible facts

1. Attendance → List on a phone: each row shows the name, the title under it, and on the right a
   coloured pill such as `92% On Time` (green at 90% or above, amber 75–89%, red below 75%; a dash
   for someone with no expected days). The percentage is the one the computer's % On-Time column
   shows for that person.
2. The second line reads `Late n`, then ` (x Not Reported)` in red only when x is above 0, then
   `Absent n`, then `Reporting` with its Complete / Gaps / Rarely pill.
3. The fold-out under Sort By reads `What On-Time and Reporting Mean`.
4. Sort By offers, in order: Name (A to Z), On-Time (Lowest First), Late, Not Reported (Most
   First), Absent (Most First), Late (Most First). Each orders the rows as before.
5. On a computer the table looks exactly as it did before this part.
6. Tapping a row still opens the employee sheet. No console errors.

When done, reply with a one-line summary per file.
