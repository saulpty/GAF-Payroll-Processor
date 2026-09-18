# 08 — Activity tables: Entry and Exit apart, flagged days visible, sortable, thresholds at hand

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`. Never create a
top-level folder named `src`.**

## Files that may change

- `src/app/pages/attendance/activity/ActivityByEmployee.tsx` — edits 1, 2, 3
- `src/app/pages/attendance/activity/ActivityByDay.tsx` — edits 1, 2, 3
- `src/app/pages/attendance/AttendancePanelDays.tsx` — edits 1, 2
- `src/app/pages/attendance/activity/ActivityNeedsLook.tsx` — edit 2 (one line)
- NEW `src/app/pages/attendance/activity/ActivityThresholds.tsx` — edit 4
- `src/app/pages/attendance/activity/AttendanceActivity.tsx` — mount the new component (edit 4)
- `src/app/pages/attendance/activity/useActivityData.ts` — edit 4 (expose `settings` and a config reload)

No other file may be touched. Every file stays under 15 KB (split a table into a row component
if needed, and list it in your summary).

## Edit 1 — "First – Last" in one cell looks bad: two columns, **Entry** and **Exit**

Everywhere a day row shows `8:17 AM – 5:05 PM` in a single cell (the expanded days in By Employee,
the By Day table, the panel's Day By Day), replace it with two columns headed **Entry** and
**Exit** (`d.shownFirstMin` / `d.shownLastMin` through `fmtClock`, `—` when null, the `+1d` suffix
on Exit when `d.crossesMidnight`). The CSV in By Day gets `Entry` and `Exit` columns too.

## Edit 2 — you cannot see *which* days need a look (bug)

Charles Bush shows "2" under Needs A Look but nothing in his expanded days says which two. In every
day table: when `d.needsLook` is true give the row a soft amber background (`bg-amber-50`) and show
an amber chip **Needs A Look** in the Why column *in addition to* the reason chip (the reason is
usually `No Reports Yet` or `—`). When `d.flag === 'long_break'` show a gray chip **Long Break**.
In `ActivityNeedsLook.tsx`, clicking a row opens that employee expanded. The expanded state lives in
`EmployeeRow`'s own `useState`, so this needs real wiring, not one line: hold
`expandedEmployeeId: number | null` in `AttendanceActivity.tsx`, pass `onPick(employeeId)` to
`ActivityNeedsLook` (which also switches `viewMode` to `'byEmployee'`), and pass
`expandedId` + `onToggle` down to `ActivityByEmployee` → `EmployeeRow` in place of its local state.
If that cannot be done inside the file list above, leave the list as plain text and say so in your
summary — do not reach for a DOM query or a global.

## Edit 3 — sortable tables

By Employee: clicking a header sorts by Employee, Days With Work, Avg Active, Avg Entry, Avg Exit,
Needs A Look, Away Days (asc/desc toggle, arrow in the header). By Day: Employee, Date, Entry,
Exit, Active, Breaks. Use the house `DataTable` (`@/app/components/DataTable`, props `columns`,
`sortKey`, `sortDir`, `onSort`) the way `AttendanceTable.tsx` does, or the same header pattern if
DataTable does not fit the expandable rows. Rename the By Employee headers `Avg First` / `Avg Last`
to **Avg Entry** / **Avg Exit**.

## Edit 4 — thresholds where they are used (super users only)

New `ActivityThresholds.tsx`: a small **Thresholds** button at the right of the KPI strip, visible
only when `isSuper` (`useViewer()`). It opens a dialog built on the existing `@/components/ui/dialog` (the file exists — use it, and do
not edit anything under `src/components/ui/`, which is protected) with three
fields shown in **hours** (one decimal): "Minimum Active Time Per Full Day" (`activity_min_active_minutes`),
"Break Allowance" (`activity_break_minutes`), "Flag Breaks Longer Than Allowance By"
(`activity_break_over_minutes`). Show a one-line hint: "Applies to everyone. A shorter shift is
scaled proportionally."

**Reading the current values.** `useActivityData` parses them in `parseSettings` but does not return
them. Add `settings` to `ActivityDataResult` and pass it from `AttendanceActivity` into the dialog —
the fields open on the live numbers (6.5 / 1.0 / 0.5 hours), never on the fallbacks.

**Saving.** `upsertClassificationConfig` is an `INSERT … ON CONFLICT (key) DO UPDATE SET value,
label, description` and takes **six** params — `key`, `value`, `label`, `description`, `value_type`,
`category` — all flat, none inside quotes. Passing only `key` and `value` would overwrite the stored
`label` and `description` with NULL, so send all six every time, per key:

| key | label | description |
|---|---|---|
| `activity_min_active_minutes` | `Minimum Active Time Per Full Day` | `Minutes of Teramind activity a full scheduled day must reach. Shorter shifts scale proportionally.` |
| `activity_break_minutes` | `Break Allowance` | `Minutes of break allowed in a day before the gap is counted against the employee.` |
| `activity_break_over_minutes` | `Flag Breaks Longer Than Allowance By` | `Minutes past the break allowance before a day is flagged as a long break.` |

with `value_type: 'number'` and `category: 'teramind'` for all three, and `value` the rounded minute
count as a string. Keep whatever label and description the row already carries if it differs — read
`classification_config` first rather than inventing one.

**Reloading.** `useLoadAction` returns its refetch as the fourth tuple element (see
`FilterBar.tsx` line 87, `const [periodsRaw, , , refetchPeriods] = useLoadAction(...)`). In
`useActivityData`, capture it from the `loadClassificationConfigAction` call and return it as
`reloadConfig`; the dialog calls it after a successful save, and the KPI tiles and Needs A Look
counts recompute on their own.

## Acceptance (check on /dev)

1. Only the listed files changed; all under 15 KB.
2. Expanded rows and Day By Day show `Entry` and `Exit` as separate columns.
3. Charles Bush, Last 14 Days: his two flagged days have an amber background and a Needs A Look chip.
4. Clicking "Avg Active" sorts the By Employee table; clicking again reverses it.
5. As a super user, Thresholds opens, shows 6.5 / 1.0 / 0.5 hours, saving 6.0 updates
   Needs A Look counts after reload. View As a manager: no Thresholds button.
