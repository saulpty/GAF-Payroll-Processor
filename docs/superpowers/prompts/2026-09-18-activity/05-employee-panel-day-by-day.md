# 05 — Employee panel: a Day By Day section fed by Activity data

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/app/…` means `app/…` and `src/actions/…` means `actions/…`. Never create a top-level folder
named `src`.**

## Files that may change

- `src/app/pages/attendance/AttendancePanel.tsx` — split, then extended (steps 1 and 3 below)
- `src/app/pages/attendance/AttendancePanelBody.tsx` — NEW (step 1: the moved chart + donuts, zero
  visual change)
- `src/app/pages/attendance/AttendancePanelDays.tsx` — NEW (step 3: the new section)
- `src/app/pages/Attendance.tsx` — one handler edit, described in step 4
- `src/app/pages/attendance/AttendanceToday.tsx` — one handler edit, described in step 4
- `src/app/pages/attendance/activity/ActivityByEmployee.tsx` — one handler edit, described in step 4
  (only if prompt 04 has already shipped and this file exists — otherwise skip this file entirely and
  say so)

No other file may be touched. Never edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`,
`ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything
under `src/components/ui/`. Never edit `AttendanceDonuts.tsx`, `AttendanceKpis.tsx`,
`AttendanceReportTable.tsx`, `AttendanceReportStrips.tsx`, `AttendanceTable.tsx`, or the
`useActivityData` hook / activity lib files from prompt 04 — this prompt only *consumes* them.

## Contract

Read `docs/superpowers/prompts/2026-09-18-activity/CONTRACT.md` in full first — it defines
`ActivityDay` and `EmployeeActivitySummary` exactly, and the Why-chip / Title Case / US-Eastern rules
that apply here too. If `src/app/lib/activityDays.ts` or the `useActivityData` hook from prompt 04 do
not exist yet, stop and report that instead of improvising them.

## Why

`AttendancePanel.tsx` is already at 12.8 KB (the 15 KB cap leaves little room), and it currently shows
only a 20-day arrival scatter plus donuts — no day-by-day detail of what someone actually worked. The
new Activity data (Time Records shaped into `ActivityDay`s with Why context) is the natural source for
that detail without querying anything new.

## 1. Split first: `AttendancePanelBody.tsx`

Before adding anything, move the **existing** arrival-trend chart block and the `AttendanceDonuts`
render (currently the last two sections of `AttendancePanel.tsx`, from the `{/* Day-by-day arrival
scatter */}` comment through the `<AttendanceDonuts stats={stats} />` line) into a new component
`AttendancePanelBody.tsx`, default export, prop `{ stats: EmpStats }`. Copy the code verbatim — same
markup, same classes, same chart config, same imports it needs (`recharts` pieces, `computeArrival
Scatter`, `ArrivalPoint`, `AttendanceDonuts`, the `fmtMinutes`/`fmtClock`/`toDateStr`/`ArrivalTooltip`
helpers it uses, the `EXCUSED_Y`/`ABSENT_Y`/`SCATTER_LEGEND`/`yTicks` constants). **Zero visual
change** — this is a pure extraction. `AttendancePanel.tsx` renders `<AttendancePanelBody stats=
{stats} />` where that block used to be, and drops the now-unused imports it moved out.

Also move the "Mini KPIs" grid and the "Recent Activity" table (the two sections between the header
and the arrival chart) into `AttendancePanelBody.tsx` as well if that is what it takes to get
`AttendancePanel.tsx` comfortably under 15 KB once the new section is added — use your judgment on
exactly where the line falls, but the header (name/role/manager/close button) must stay in
`AttendancePanel.tsx` itself, and the new Day By Day section (step 3) must render **below** the donuts,
so `AttendancePanel.tsx`'s render order becomes: header, `AttendancePanelBody`, `AttendancePanelDays`.

## 2. Give the panel its data

`AttendancePanel.tsx`'s exported component gains an optional prop `days?: ActivityDay[]` (type from
`@/app/lib/activityDays`). When a caller passes `days`, use them as-is. When it does not, call
`useActivityData` (from `@/app/pages/attendance/activity/useActivityData`) inside `AttendancePanel`
itself for the page's current range — `dateFrom`/`dateTo` from `useGlobalFilters()` — and filter the
returned `days`/`byEmployee` down to this employee (`stats.employeeId` or equivalent identifier
already on `EmpStats` — check what `AttendanceTable.tsx`/`attendanceStats.ts` expose and use whatever
uniquely matches the row, by id not by name). If `useActivityData` needs an id type
`useActivityData` doesn't already accept, do not modify that hook — filter its output in this file.

Keep the existing `stats: EmpStats | null` prop and null-check exactly as they are.

## 3. `AttendancePanelDays.tsx` — the new section

Default export, props `{ days: ActivityDay[] }` (already filtered to one employee, newest first per
the contract). Section header matching the existing "Recent Activity" section style (the small
vertical bar + bold label pattern already in `AttendancePanel.tsx`): **"Day By Day"**.

Next to the header, an **"Open In Teramind ↗"** link/button, shown only when an agent id is available.
Build it from `loadTeramindAgents` (load it here with `useLoadAction`, flat params, no wrapper —
match this employee by `employee_id`) and the config key `teramind_base_url` from
`loadClassificationConfig` (filter by `key === 'teramind_base_url'`). If no matching agent id is
loaded, or the config key is missing, omit the link entirely — do not render a dead or `#` link.
Construct the URL as `` `${baseUrl.replace(/\/$/, '')}/${agentId}` `` unless the config value already
documents a different join pattern (check `TeramindAgentsCard.tsx` or `useTeramindPull.ts` for how an
existing feature already builds a Teramind URL from this config key, and match that instead of
guessing).

Table/list below, one row per `ActivityDay`, header row: **Date** (`fmtDayShort`, e.g. `Wed Sep 11`) ·
**First – Last** (`fmtClock` from `@/app/lib/teramindToday`, "—" when null, "+1d" suffix when
`crossesMidnight`) · **Active** (`fmtDuration`) · **Why** (the chip, or nothing when `why` is null) ·
**Source** (`Live` / `Official` with a check / `Official, Edited` with a dot — same rendering as
`ActivityByEmployee.tsx`'s Source column from prompt 04; if that file exists, match its exact chip
markup rather than inventing a second version). Empty state: "No activity data for this range." Title
Case headers. Keep this file under 6 KB — it's one table.

## 4. Wire the panel open from three places

The panel must open from a click on the employee **name** (not the whole row, unless that is already
the existing behavior — check each file before changing it):

- **`Attendance.tsx`** (List tab): it already opens the panel via `onRowClick={setPanelEmail}` passed
  to `AttendanceTable`. Leave this as-is if `AttendanceTable.tsx`'s row click already targets the name
  — do not edit `AttendanceTable.tsx` (not in the allowed file list). Only change something here if
  the panel currently receives no way to also pass `days` — if so, load `useActivityData` in
  `AttendanceInner` (or let `AttendancePanel` self-load per step 2, which is the simpler option and
  needs no change here at all). Prefer making no change to this file; only touch it if step 2's
  self-load genuinely cannot work from here.
- **`AttendanceToday.tsx`**: currently the table has no click-to-open-panel behavior at all (it has no
  `AttendancePanel` usage). Add one: wrap the employee name cell in `TodayTableRow` in a button/
  clickable span, `onClick` sets a new local `panelEmployeeId` state in `AttendanceToday`, and render
  `<AttendancePanel stats={...} onClose={...} />` when it is set. Building the `stats: EmpStats` this
  panel needs from `TodayRow`/`TodayEmployee` data may not line up one-to-one with what
  `AttendancePanel` expects — if `EmpStats` requires fields Today's data doesn't have (e.g. the
  30-day `rows` history), do not fabricate them; instead pass only `stats` fields you can populate
  correctly and let `AttendancePanel`'s existing null-safety handle the rest, and rely on step 2's
  self-loaded `days` for the new section (that part works from just an employee id and the page's
  date range, independent of `EmpStats`). If wiring a full `EmpStats` from Today's data is not
  reasonably possible without touching `attendanceStats.ts` (not in the allowed file list), open the
  panel with `stats` limited to name/role/manager/employee id and let the donuts/scatter section show
  its own "not enough data" state rather than crashing — do not edit `AttendanceDonuts.tsx` to
  accommodate this.
- **`ActivityByEmployee.tsx`** (only if it exists from prompt 04): the employee name in each row's
  first column becomes clickable the same way, opening the same `AttendancePanel`, passing this row's
  already-computed `days` (`EmployeeActivitySummary.days`) directly as the `days` prop — no need for
  `AttendancePanel` to self-load in this case since the data is already in hand.

If `AttendancePanel` ends up needing an employee id it doesn't currently carry, add it to `EmpStats`
only if that type lives in a file you're allowed to touch (check `attendanceStats.ts` — if not, thread
the id as a separate prop to `AttendancePanel` instead of extending `EmpStats`).

## Rules

`AttendancePanel.tsx`, `AttendancePanelBody.tsx`, `AttendancePanelDays.tsx` each stay under 15 KB (this
is what motivates the split). Title Case headers. `useLoadAction(action, default, {...flatParams})`,
never a `{ params: {} }` wrapper. Dates are `YYYY-MM-DD` strings compared as strings. No hardcoded
Monday board/column/group ids. Never call a Teramind HTTP action or `useTeramindPull` from these
files — only the saved-copy loaders.

## Acceptance (check on /dev)

1. Clicking an employee name on List opens the panel exactly as before, now showing Day By Day below
   the donuts with real rows for the current filter range.
2. Clicking an employee name on Today opens the panel; it does not crash even if some header/donut
   fields are sparse; Day By Day still shows that person's days.
3. If the Activity tab shipped: clicking a name in By Employee opens the panel pre-loaded with that
   row's days (no extra network call for the days themselves).
4. "Open In Teramind" appears only when an agent id and `teramind_base_url` are both available, and
   links to the right place; it is silently omitted otherwise — never a dead link.
5. `AttendancePanel.tsx` is comfortably under 15 KB; all three panel files pass a visual check with no
   layout shift in the moved chart/donuts section.
6. Only the files listed above changed; `node --test "tests/*.test.ts"` still passes.
