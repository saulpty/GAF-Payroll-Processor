# Punctuality and Reports for employees outside payroll, part 2 of 2 (wiring)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

Part 1 added `in_payroll` to `loadAttendanceEmployees`, `liveReportWithOutside` in
`src/app/lib/liveAttendance.ts` and `liveListRowsWithOutside` in `src/app/lib/liveListRows.ts`.
This part uses them on Attendance → Reports and in the List hook (Punctuality and the employee
panel). Employees outside payroll get every date in the range from Teramind (the `wide` window);
payroll employees are computed exactly as today. Teramind, forms and requests are loaded for the
wide range when anyone outside payroll is on the page; the old window always sits inside it.

**Only these files may change:** `src/app/pages/attendance/AttendanceReport.tsx`,
`src/app/pages/attendance/useLiveListRows.ts`. **No other file may be touched.**

Rules:
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, `attendanceReport.ts`, or
  anything in `src/components/ui/`.
- Loader params stay flat (never `{ params: {...} }`). Under 15 KB. Nothing else changes.

## 1. `src/app/pages/attendance/AttendanceReport.tsx`

a. The import `import { liveWindow, liveReport } from '@/app/lib/liveAttendance';` becomes:

```ts
import { liveWindow, liveReportWithOutside } from '@/app/lib/liveAttendance';
```

b. Directly after the `const win = useMemo(...)` statement (it ends with
`[loadingPeriods, rawPeriods, safeFrom, safeTo, tmToday],` and `);`), add:

```ts
  // 2026-10-16: employees outside payroll never get payroll rows, so the whole range is live
  // for them (wide). Teramind is loaded for the wide range; payroll employees still use `win`.
  const anyOutside = ((rawEmps as ReportEmployee[]) ?? []).some(e => e.in_payroll === false);
  const wide = useMemo(
    () => (anyOutside ? liveWindow([], safeFrom, safeTo, tmToday) : null),
    [anyOutside, safeFrom, safeTo, tmToday],
  );
  const tmWin = wide ?? win;
```

c. In the Teramind loader, `{ dateFrom: win?.from ?? NO_LIVE.from, dateTo: win?.to ?? NO_LIVE.to, viewAs },`
becomes:

```ts
    { dateFrom: tmWin?.from ?? NO_LIVE.from, dateTo: tmWin?.to ?? NO_LIVE.to, viewAs },
```

d. `const winKey = win ? `${win.from}|${win.to}` : '';` becomes:

```ts
  const winKey = tmWin ? `${tmWin.from}|${tmWin.to}` : '';
```

e. In `const loading = …`, the last part `(win !== null && (loadingTm || (!errTm && tmFor !== winKey)));`
becomes:

```ts
                  (tmWin !== null && (loadingTm || (!errTm && tmFor !== winKey)));
```

f. Inside the report `useMemo`, replace

```ts
    if (!win || errTm) return main;
    return liveReport({
      input, main, window: win, today: tmToday,
```

with

```ts
    if (!tmWin || errTm) return main;
    return liveReportWithOutside({
      input, main, window: win, wide, today: tmToday,
```

(the next line, `tmRows: (rawTm as ActivityDayRow[]) ?? [], build: buildAttendanceReport,`, and the
closing `});` stay). In that `useMemo`'s dependency list, after `win, errTm,` add `wide, tmWin,`.

## 2. `src/app/pages/attendance/useLiveListRows.ts`

a. The import `import { liveWindow, liveReport } from '@/app/lib/liveAttendance';` stays.
The import `import { liveListRows, NO_LIVE_WINDOW } from '@/app/lib/liveListRows';` becomes:

```ts
import { liveListRowsWithOutside, NO_LIVE_WINDOW } from '@/app/lib/liveListRows';
```

b. Replace the line `  const range = win ?? NO_LIVE_WINDOW;` with:

```ts
  // 2026-10-16: employees outside payroll never get payroll rows, so the whole range is live
  // for them (wide). The loaders load the wide range; payroll employees still use `win`.
  const anyOutside = (employees ?? []).some(e => e.in_payroll === false);
  const wide = useMemo(
    () => (anyOutside ? liveWindow([], dateFrom, dateTo, today) : null),
    [anyOutside, dateFrom, dateTo, today],
  );
  const hasLive = win !== null || wide !== null;
  const range = wide ?? win ?? NO_LIVE_WINDOW;
```

c. `const error = !!(errPeriods || (win !== null && (errTm || errForms || errReqs)));` becomes:

```ts
  const error = !!(errPeriods || (hasLive && (errTm || errForms || errReqs)));
```

d. `const winKey = win ? `${win.from}|${win.to}` : '';` becomes:

```ts
  const winKey = hasLive ? `${range.from}|${range.to}` : '';
```

e. The `loading` statement becomes:

```ts
  const loading = loadingPeriods || (hasLive && !error &&
    (loadingTm || loadingForms || loadingReqs || loadingHols || loadingDst || dataFor !== winKey));
```

f. In the `rows` `useMemo`:
- `if (loading || error || !win || dataFor !== winKey) return [] as AttendanceRow[];` becomes
  `if (loading || error || !hasLive || dataFor !== winKey) return [] as AttendanceRow[];`
- `return liveListRows({` becomes `return liveListRowsWithOutside({`
- directly after the line `      window: win,` add the line `      wide,`
- in its dependency list, after `win,` add `wide, hasLive,`.

Nothing else changes. Reply with the diff of both files.
