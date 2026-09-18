# 03 — Ghost records: Today marker + payroll capture warning

Send AFTER prompt 02 (the lib split, `GhostMark`, and the view + actions from prompt 01).

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`. Never create a
top-level folder named `src`.**

## Files that may change

- `src/app/pages/attendance/AttendanceToday.tsx`
- `src/app/pages/attendance/TodayRow.tsx`
- `src/app/pages/process/TeramindSourceCard.tsx`
- `src/app/lib/teramindPunches.ts` — type only, see below
- NEW `src/app/pages/attendance/TodayHeader.tsx` — **only** if `AttendanceToday.tsx` would
  otherwise cross 15 KB (see "Size" below)

No other file may be touched. `ProcessPayroll.tsx` is untouchable and must not be edited.

## Why

The 2026-09-18 stray-early-record contract (see `loadTeramindDayPunches` and
`loadTeramindPunchDays`, already changed in prompt 01) adds a `ghost_min` column: minutes since
midnight of an early Teramind record that lasted under a minute and was followed by an hour or more
of nothing — a computer waking up, not an arrival. Prompt 02 taught the Activity tables to show this
as a small "Early Record … Ignored" marker via the new `GhostMark` component. This prompt does the
same for the live Today table, and warns Tim before he runs payroll on a period that has one.

## Edit 1 — AttendanceToday.tsx: carry `ghost_min` through to each row

- `PunchRaw` (the type this file already declares for `loadTeramindDayPunches`'s raw response)
  gains `ghost_min?: number`.
- Wherever `punches` is built from `rawPunches` (the `useMemo` that maps `PunchRaw[]` into the
  shape passed to `buildToday`), also carry `ghost_min` through as a number (use `-1` when absent,
  matching how the lib treats "no ghost record").
- Build one more `useMemo`: a `Map<number, number>` from `employee_id` to `ghost_min`, keeping only
  entries where `Number(ghost_min) >= 0` (so a Map lookup miss and an explicit "no ghost" both mean
  "no marker").
- Pass that map down to `TodayTable` / `TodayTableRow` as a new prop, e.g. `ghostByEmployee`, so
  each row can look up its own employee's ghost minutes (or `null` when absent).

Do not change `buildToday`'s input type (`TodayPunch` in `teramindToday.ts` is unchanged per the
CONTRACT — the ghost minute is carried alongside `punches`, not through `buildToday`, exactly the
way `synced_at` already is for the "data as of" banner).

## Edit 2 — TodayRow.tsx: render the marker

`TodayTableRow` takes the new `ghostMin: number | null` prop (from the map built in edit 1) and
renders `<GhostMark ghostMin={ghostMin} />` (import from
`@/app/pages/attendance/activity/GhostMark`) directly under the Entry cell's time, the same way the
Activity tables do it in prompt 02. Nothing else in the row changes.

## Edit 3 — teramindPunches.ts: type only

`PunchDay` gains two **optional** fields:

```ts
export type PunchDay = {
  teramind_email: string;
  first_ymd: number;
  first_min: number;
  last_ymd: number;
  last_min: number;
  ghost_min?: number;
  display_name?: string;
};
```

**`punchDaysToRawRows` itself must not change** — it still reads only the five original fields and
skips/keeps rows exactly as it does today. This file has its own test suite
(`tests/teramindPunches.test.ts` or equivalent); do not touch its logic, only the type.

## Edit 4 — TeramindSourceCard.tsx: the amber warning after a capture

- `ApiCapture` gains `ghostDays: number`.
- In `readDays` (where `rawDays: PunchDay[]` is built from the action response and then converted
  with `punchDaysToRawRows`), also read `ghost_min` and `display_name` off each raw response row
  (same `Record<string, unknown>` cast already used for `has_manual`), and compute:
  `const ghostDays = manualRows.filter(r => Number(r.ghost_min) >= 0);` — reusing the same
  `manualRows` array already built for the manual-time warning. Pass `ghostDays.length` into the
  `ApiCapture` object as `ghostDays`.
- When `capture.ghostDays > 0` (in the "capture result box" branch, where the green success card is
  shown), render one more amber block, styled like the existing amber warnings in this file
  (`AlertTriangle` icon, `bg-amber-50 border-amber-200 text-amber-700`):
  - Heading: `Early Stray Records Ignored — N` (N = `capture.ghostDays`).
  - A list of rows, one per ghost day, each reading:
    `Name · Fri Sep 18 · Ignored 6:24 AM → Entry 9:21 AM` — built from `display_name` (fall back to
    the email when absent), `fmtDayShort` (import from `@/app/lib/activityDays`) on the day, and
    `fmtClock` (import from `@/app/lib/teramindToday`) on `ghost_min` and on the day's real entry
    minute. Cap the visible list at 15 rows; beyond that show `And N More` (N = the remaining
    count).
  - One muted line below the list: `Check These Before Running. The backup file upload does not
    apply this rule.`
- You will need to keep the raw per-day rows (with `ghost_min`, `display_name`, entry minute, and
  date) around long enough to render this list — store them in a small piece of state alongside
  `manualDays` / `manualEmails` (e.g. `ghostRows`), set in `readDays`, cleared wherever
  `manualDays`/`manualEmails` are cleared (`handleCapture`, `handleUseSaved`).
- `ProcessPayroll.tsx` is not edited: the extra `ghostDays` count reaches the run only through the
  existing `capture` object this component already hands back via `onCaptured`.

## Size

`AttendanceToday.tsx` is already about 14.1 KB. Keep the edit 1 addition minimal (one optional
field, one small `useMemo`, one prop). If it would still cross 15 KB, move the header bar and the
stale-data notice block (the `<div className="shrink-0 px-5 py-3 …">…</div>` and the amber
stale-data `<div>` right after it) into a new `TodayHeader.tsx`, passing it the handful of props it
needs (`dataAsOf`, `day`, `today`, `isToday`, `setDay`, `loadingPunches`, `nowMin`, `dataAsOfMin`).
Only do this split if the byte count requires it.

## Acceptance (check on /dev)

1. Only the files listed above changed (plus `TodayHeader.tsx` only if the split was needed); all
   files under 15 KB; `ProcessPayroll.tsx` untouched.
2. Attendance → Today, Fri Sep 18: Nichole Harris shows Entry `9:21 AM`, Late `+21m`, and the
   `Early Record 6:24 AM Ignored` marker under Entry.
3. Process Payroll → step with `TeramindSourceCard` → Capture From Teramind for
   2026-09-11 → 2026-09-18: the amber "Early Stray Records Ignored" block lists all four Sep 18
   records (Nichole Harris, Charis Dixon, Monique Luque, Yessenia Moran) with their ignored and
   real entry times.
