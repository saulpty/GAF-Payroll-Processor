# Attendance filters: the range you picked stays when you change tab

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only these files may change.** Two edited: `src/app/FilterBar.tsx`,
`src/app/pages/attendance/activity/AttendanceActivity.tsx`. **No other file may be touched.** No
migration, no action file. `src/app/lib/filterRoutes.ts` does not change (its
`ATTENDANCE_SWITCH_ROUTES` export simply stops being imported).

Rules that hold for this prompt:

- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Dates are `YYYY-MM-DD` strings and are compared as strings. Never `new Date(str)` for date math.

## Why (Saul, 2026-10-16)

"When I have already filtered a date range and go to List or Reports, it just resets."

Two pieces of code force a mode every time the tab changes:

1. `FilterBar.tsx` sets the Periods | Dates switch from the route on every tab change: List and
   Reports are forced to **Periods**, Activity to **Dates**. Arriving at List or Reports in Periods
   mode then puts the period's own dates back (the effect in `AttendanceRangeControls.tsx`), so the
   dates picked on another tab are thrown away.
2. `AttendanceActivity.tsx` on arrival forces **Dates · last 14 days** whenever the switch is not
   already on Dates, so a period picked on List or Reports is thrown away on Activity.

The fix: the switch and the range are one shared choice across Attendance. Changing tab keeps them.
Activity still starts on **Dates · last 14 days** when nothing has been picked yet (no dates at all).

## 1. `src/app/FilterBar.tsx` — three edits, nothing else

**1a.** Replace

```tsx
import { getConfig, ATTENDANCE_SWITCH_ROUTES, hasVisibleFilter } from '@/app/lib/filterRoutes';
```

with

```tsx
import { getConfig, hasVisibleFilter } from '@/app/lib/filterRoutes';
```

**1b.** Replace

```tsx
    attendanceMode, setAttendanceMode,
    period, setPeriod,
```

with

```tsx
    attendanceMode,
    period, setPeriod,
```

**1c.** Replace

```tsx
  // Reset mode to route default on attendance sub-route change
  const prevRouteRef = useRef<string | null>(null);
  useEffect(() => {
    const matchKey = Object.keys(ATTENDANCE_SWITCH_ROUTES)
      .filter(k => location.pathname === k || location.pathname.startsWith(k + '/'))
      .sort((a, b) => b.length - a.length)[0];
    const routeKey = matchKey ?? null;
    if (routeKey !== null && routeKey !== prevRouteRef.current) {
      prevRouteRef.current = routeKey;
      setAttendanceMode(ATTENDANCE_SWITCH_ROUTES[routeKey]!);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
```

with

```tsx
  // Periods | Dates and the range are one choice across Attendance: changing tab keeps them
  // (Saul, 2026-10-16). Activity alone picks Dates · last 14 days when nothing is chosen yet.
```

`useRef` stays imported: `arVersionRef` and `versionRef` still use it.

## 2. `src/app/pages/attendance/activity/AttendanceActivity.tsx` — two edits, nothing else

**2a.** Replace

```tsx
  const { dateFrom, dateTo, attendanceMode, setAttendanceMode, setDateFrom, setDateTo } = useGlobalFilters();
```

with

```tsx
  const { dateFrom, dateTo, setAttendanceMode, setDateFrom, setDateTo } = useGlobalFilters();
```

**2b.** Replace

```tsx
  // On first mount: ensure we are in Dates mode with last 14 days
  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    if (attendanceMode !== 'dates' || !dateFrom || !dateTo) {
```

with

```tsx
  // On first mount, only when no range is chosen yet: Dates mode with the last 14 days.
  // A range picked on another Attendance tab is kept (Saul, 2026-10-16).
  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    if (!dateFrom || !dateTo) {
```

The three lines inside that `if` (`setAttendanceMode('dates')`, `setDateTo(...)`,
`setDateFrom(...)`) do not change. Nothing else in the file reads `attendanceMode`, which is why 2a
drops it.

## Acceptance (check on /dev after a hard refresh)

1. Attendance → List, switch to **Dates**, Quick → **Last 30 Days**. Click **Reports**: still Dates,
   same From and To, and the page shows those 30 days. Click **List** again: same.
2. On List pick a period other than the current one (Periods mode). Click **Activity**: still
   Periods, that period, and Activity shows its days. Click **Reports**: same period.
3. Fresh load straight onto Activity: Dates · last 14 days, as before.
4. On List in Dates mode, flip the switch back to **Periods**: the chosen period's own dates come
   back (the 2026-10-13 fix still works).
5. The phone Filters sheet behaves the same.
