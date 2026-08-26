# Admin → Schedules must stop implying it assigns employees

`BACKLOG.md` #10. This page invites you to pick an employee and then ignores
which one you picked.

The **Schedule Name** field is labelled *"— pick an employee or type a custom
name"* and is backed by a `<datalist>` of every employee. Picking a name sets
`schedule_name`, a **label**. It never writes `employees.schedule_id`, and this
page never calls `upsertEmployee`. Assignment actually lives on
Admin → Employees → Roster.

**What it cost:** three weekend schedules (ids 10, 11, 12) were defined
correctly and left with **zero employees assigned** for over a month. Tim had
done everything this page allows and reasonably believed the job was done.
Meanwhile the engine built Mon–Fri entries for four people who do not work
Mon–Fri, marked them `Ausencia Injustificada` / RED, and discarded their real
Saturday and Sunday work. Euclides Gonzalez read as a chronic absentee; once
actually assigned he reads 6 of 6 on time.

Two changes, both in **`src/app/pages/admin/AdminSchedules.tsx`** only.

## 1. Remove the false affordance

- Delete the `<datalist id="employee-name-list">` element and the `list="employee-name-list"`
  attribute on the Schedule Name `<input>`. The input stays a plain text field
  with the same `inputCls`, the same `value`, and the same `onChange`.
- Change the label's helper span from
  `— pick an employee or type a custom name` to
  `— a label for this schedule, e.g. "Weekend Mon-Tue OFF"`.
- Change the input's `placeholder` to `e.g. Standard, Weekend Mon-Tue OFF`.
  Drop `John Doe` from it — a person's name is exactly the wrong suggestion here.
- Directly under that input, add one line of helper text, muted and small,
  matching the existing `text-xs text-muted-foreground` style used elsewhere on
  this page:
  `Naming a schedule does not assign anyone to it. Assign employees in Admin → Employees → Roster.`

If `employees` / `allEmployees` becomes unused after removing the datalist, do
**not** delete the `loadAllEmployees` load — change 2 needs it.

## 2. Show how many employees are on each schedule

This is the part that would have caught the original failure: "0 assigned" must
be visible at a glance.

- The page already loads `allEmployees` via `loadAllEmployeesAction`, and the
  `Employee` type already has `schedule_id`. Compute the counts in the component
  from data you already have — **do not add a new action or query.**
- Count only employees where `active` is true, so Past employees do not inflate
  it.
- Add an **`Employees`** column to the schedules table, between `Working Days`
  and `Notes`. Add the header to the existing header array in the same style as
  its neighbours.
- Each row shows the count for that schedule's `id`.
  - When the count is 0, render it as a clear warning — use the existing
    destructive/red styling already present in this file, with the text
    `0 assigned`, so an unused schedule is obvious.
  - Otherwise render the plain number, right-aligned, using `tabular-nums`.

## Do not touch

- Do not change any schedule's data, the `work_days` chips, the time inputs, the
  grace field, or the save/delete logic.
- Do not build an employee-assignment control here. That is a larger change and
  is deliberately out of scope; the helper text points at the page that does it.
- Do not modify `RosterTab.tsx` or any action, migration or other file.
- **No other file may be touched.**

## Acceptance criteria

- The Schedule Name field no longer offers a list of employee names.
- The helper text under it names Admin → Employees → Roster.
- The schedules table has an `Employees` column. Schedules 10, 11 and 12
  (`Weekend Schedule Mon-Tue OFF`, `Tue-Wed OFF`, `Thu-Fri OFF`) show **1, 1 and
  2** respectively — Euclides Gonzalez and Michael Antonio Jones Roye are on 10,
  Cemiriamiz Iglesias on 11, Edwin Broce on 12. Verify against the real page; if
  the numbers differ, report them rather than adjusting the code to match.
- Any schedule with nobody on it shows `0 assigned` in the warning style.
- Creating and editing a schedule still works, and existing schedule names are
  unchanged.

Then confirm every identifier used in the file is imported.
