# Attendance filters: back in Periods mode, the chosen period's own dates apply again

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only this file may change:** `src/app/components/AttendanceRangeControls.tsx`. **No other file
may be touched.** No migration, no action file.

Rules that hold for this prompt:

- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Dates are `YYYY-MM-DD` strings and are compared as strings. Never `new Date(str)` for date math.

## Why (found 2026-10-13)

On Attendance → List: switch to **Dates**, pick **Last 30 Days**, switch back to **Periods**. The bar
then reads `Q2-Oct-2026 · 09-14-2026 → 10-13-2026` and the page shows 30 days under the name of a
3-day period. Switching the mode only changes the mode; the dates stay whatever Dates mode left
behind. The same happens on arriving from Activity (which works in Dates) at List or Reports (which
work in Periods).

The fix: whenever the bar is in Periods mode with periods chosen, their own date range is put back.

## `src/app/components/AttendanceRangeControls.tsx` — two edits, nothing else

**a.** Replace

```tsx
import { useMemo } from 'react';
```

with

```tsx
import { useEffect, useMemo } from 'react';
```

**b.** Replace

```tsx
    dateTo, setDateTo,
  } = useGlobalFilters();
```

with

```tsx
    dateTo, setDateTo,
  } = useGlobalFilters();

  // Back in Periods mode (by the switch, or by arriving from a page that works in Dates): the
  // chosen periods' own dates apply again. Dates mode may have left another range behind.
  useEffect(() => {
    if (attendanceMode !== 'periods' || attendancePeriods.length === 0) return;
    const range = rangeOf(attendancePeriods);
    if (range && (range.from !== dateFrom || range.to !== dateTo)) setAttendancePeriods(attendancePeriods, range);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceMode, periods.length]);
```

Nothing else in the file changes. `rangeOf`, `periods`, `attendancePeriods`, `setAttendancePeriods`,
`dateFrom` and `dateTo` are already in scope.

## Acceptance — visible facts

1. Attendance → List: switch to Dates, pick Last 30 Days (the cards grow), switch back to Periods:
   the bar reads the period's own dates again (for `Q2-Oct-2026` on 2026-10-13: `10-11-2026 →
   10-13-2026`) and the cards return to that period's numbers.
2. Attendance → Activity (Dates, last 14 days), then the List tab: the bar reads the period's own
   dates and the cards match them.
3. In Dates mode nothing changes: From, To and Quick behave as before, and Activity still opens on
   its last 14 days.
4. Choosing two periods in Periods mode still shows the range that covers both.
5. No console errors.

When done, reply with a one-line summary per file.
