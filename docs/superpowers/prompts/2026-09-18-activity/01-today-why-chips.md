# 01 — Attendance → Today: a Why column, so "No Records" stops sounding like an accusation

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`. Never create a
top-level folder named `src`.**

**Send this prompt AFTER prompt 02 ("Activity lib + settings").** It depends on
`src/app/lib/activityDays.ts` and its exported `whyFor` function, which prompt 02 creates. If that
file does not exist yet in the export, stop and say so — do not stub or re-implement `whyFor` here.

## Files that may change

- `src/app/pages/attendance/AttendanceToday.tsx` — edit only, per section 2 below
- `src/app/pages/attendance/useTodayWhy.ts` — NEW, per section 1 below
- `src/app/pages/attendance/TodayRow.tsx` — NEW, **only if** the edit would push
  `AttendanceToday.tsx` over 15 KB; if so, move the `<tr>` rendering (the existing
  `TodayTableRow` function) into this file and import it back. Otherwise do not create it.

No other file may be touched. Do not edit `teramindToday.ts`, `activityDays.ts`, or anything under
`src/components/ui/`. This page only reads.

## 1. `src/app/pages/attendance/useTodayWhy.ts` — NEW hook

Purpose: for the one day `AttendanceToday.tsx` is showing, load the same HR data the Reports tab
loads (`AttendanceReport.tsx`), run `buildAttendanceReport` for that single day, and hand back one
`WhyChip | null` per employee.

Signature:

```ts
export function useTodayWhy(args: {
  day: string;               // YYYY-MM-DD, the day AttendanceToday is showing
  viewAs: string;
  employees: { id: number; name: string; email: string; role: string; manager: string;
               work_days: string; start_date: string | null;
               standard_start: string; standard_end: string; dst_start: string; dst_end: string;
               grace_minutes: number }[];             // pass the page's already-filtered employees
  scheduledById: Map<number, boolean>;                 // TodayRow.scheduled, keyed by employeeId
  hasActivityById: Map<number, boolean>;                // TodayRow.records > 0, keyed by employeeId
}): { whyById: Map<number, import('@/app/lib/activityDays').WhyChip | null>; loading: boolean };
```

Body:

- Load, with `dateFrom: args.day, dateTo: args.day, manager: '', viewAs: args.viewAs` (flat params,
  never a `{ params: {} }` wrapper):
  `loadAttendanceReportDaysAction`, `loadMondayAttendanceFormsRangeAction`,
  `loadMondayRequestsRangeAction` — the same three actions `AttendanceReport.tsx` imports.
- Load, with no params: `loadHolidaysAction`, `loadPeriodsAction`, `loadDstCalendarAction` — same
  three the Reports tab loads.
- Call `buildAttendanceReport` (from `@/app/lib/attendanceReport`) exactly the way
  `AttendanceReport.tsx` does: `dateFrom: args.day, dateTo: args.day`, `employees: args.employees`,
  the six loaded arrays, and `helpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes }`
  imported from `@/app/lib/classificationEngine` (import only — never edit that file).
- For each employee in `args.employees`, find their `ReportRow` where `row.date === args.day`
  (there is at most one, since the range is a single day) and collect that employee's
  `ReportRequest[]` (filter the raw requests array by `employee_id`). Call
  `whyFor({ reportRow, requests: employeeRequests, scheduled: args.scheduledById.get(id) ?? false,
  hasActivity: args.hasActivityById.get(id) ?? false })` from `@/app/lib/activityDays`, and put the
  result in the returned map under that employee's id (`reportRow` is `null` when none was found).
- `loading` is true while any of the six loads is in flight.
- No date math beyond what's shown above; no `new Date(...)` arithmetic in this file.

## 2. `AttendanceToday.tsx` — edits

**Wire the hook.** After `rows`/`summary` are computed, build `scheduledById` and `hasActivityById`
maps from `rows` (`records > 0` = has activity) and call `useTodayWhy({ day, viewAs, employees,
scheduledById, hasActivityById })`. Import `useTodayWhy` from `./useTodayWhy`.

**Header line.** Change `"Live View — Unofficial."` to **`"Live"`**.

**Selected-date label.** Immediately to the left of the date `<input>`, add the selected day in
Title Case short form using `fmtDayShort(day)` from `@/app/lib/activityDays` (renders like
`Wed Sep 18`).

**Remove** the sentence "Leave, sick forms and permissions are not shown here yet — 'No Records'
does not mean absent without reason. Check Attendance → Reports for the official record." **Replace**
it with one muted line: `"Data Updates Every 15 Minutes · Times In US Eastern"`.

**Why column.** Add a `Why` column to the table, right after `Status`. For each row, look up
`whyById.get(row.employeeId)`. If it's `null`, render `—` (muted). Otherwise render a small chip
using its `kind`/`tone`/`label`: `tone: 'blue'` → the existing blue chip classes already used on this
page's Status column (`bg-blue-100 text-blue-700 border-blue-200`); `tone: 'amber'` → the existing
amber classes (`bg-amber-100 text-amber-800 border-amber-200`); `tone: 'gray'` → slate/gray
(`bg-slate-100 text-slate-600 border-slate-200`). Reuse these exact class strings — do not invent new
colors.

**Status override.** When a row's displayed status chip is `No Records` (i.e. `row.status ===
'late_not_in'`) and `whyById.get(row.employeeId)` is a chip whose `kind` is one of `pto`,
`permission`, `sick`, `form`, `holiday` (i.e. not `wfh`, `day_off`, or `none`), change the **Status**
column for that row to a new label **`On Leave`** with the blue tone
(`bg-blue-100 text-blue-700 border-blue-200`) instead of the amber `No Records` chip. Every other
status (`Working`, `Away`, `Finished`, etc.) is unaffected — it keeps its own chip, and the Why chip
still shows separately in the Why column. `No Records` stays exactly as it is today only when
`whyById.get(row.employeeId)` is `null` or has `kind: 'none'` (label `No Reports Yet`).

**On Leave summary tile.** Add a new tile labelled **`On Leave`** between the existing `Not In Yet`
tile and the `No Records` tile. Its value is the count of rows whose Why chip `kind` is one of
`pto`, `permission`, `sick`, `form`, `holiday` (same set as the status-override rule above). Give it
the blue accent (`text-blue-600`), same styling convention as the other accented tiles.

**Day Off filtering.** Drop rows from the table (and from every summary tile count) where
`row.status === 'day_off'` and that employee has no activity (`records === 0`). A Day Off row only
appears when there is activity to show.

**Title Case.** Check every visible label on this page (tile labels, column headers, chip labels,
button text) and make sure each is Title Case, matching the rest of the Hub (e.g. "On Time",
"Not In Yet"). Fix any that aren't.

**Keep unchanged:** the 60-second refresh timer, the day picker and "Today" button, the loading
state, the calm "Couldn't refresh…" / "Couldn't load…" notices, the `synced_at`-based "Data As Of"
line and its Eastern-clock formatting, every other column, and the amber/blue/green/slate chip class
strings already used elsewhere on the page.

## Rules

Every file under 15 KB · `useLoadAction(action, default, {...flatParams})`, never a `{ params: {} }`
wrapper · dates are `YYYY-MM-DD` strings compared as strings; "today" comes from `easternDate` only ·
no `Intl`, no timezone maths outside `teramindTime.ts` · `activityDays.ts` stays `import type`-only
from this page's perspective — you only call its exported functions, never edit it · this page never
calls Teramind and never writes anything.

## Acceptance (check on /dev)

1. Only `AttendanceToday.tsx` and `useTodayWhy.ts` changed (plus `TodayRow.tsx` if it was needed for
   size — say which happened).
2. A person on approved PTO today shows Status **On Leave** (blue) and Why **PTO**.
3. A scheduled person today with no records at all shows Status **No Records** (amber) and Why
   **No Reports Yet** (amber) — unchanged from before except for the new Why chip.
4. A person working today from home shows their normal Working/Finished status plus a gray **WFH**
   chip in the Why column.
5. Someone not scheduled today with zero records does not appear in the table at all.
6. The header reads "Live", not "Live View — Unofficial."; the old "Leave, sick forms…" sentence is
   gone, replaced by "Data Updates Every 15 Minutes · Times In US Eastern"; the selected date shows
   in `Wed Sep 18` style next to the date picker.
7. `AttendanceToday.tsx` (and `TodayRow.tsx` if created) are each under 15 KB.
