# Prompt 36 — Teramind coverage warning must use each employee's own workdays

Sent to UIB on 2026-08-25. One coherent change across two files.

**Background for the reviewer, not part of the prompt.** `ProcessPayroll.tsx`
builds one global `expectedWorkdays` list that skips Saturday and Sunday for
everybody, then warns when an employee's Teramind data covers less than 70% of
it. The four weekend-schedule employees work Saturdays and Sundays, so they will
now trigger that warning on every run no matter how complete their data is —
and, worse, a genuine gap in their real workdays is invisible because those days
were never in the list.

Warning-only, no effect on pay. **Both files touched are on the never-edit list
in `CLAUDE.md`; Saul asked for this change directly on 2026-08-25.** The
`classificationEngine.ts` edit is adding the word `export` to one line and
nothing else.

---

## The prompt

The Teramind coverage warning on the Process page assumes every employee works
Monday to Friday. Employees on weekend schedules therefore always trigger a
false "covers only 0/N workdays" warning. Make the check use each employee's own
working days.

**Modify exactly two files, and only in the ways described:**

1. `src/app/lib/classificationEngine.ts` — **add the keyword `export` to the
   existing `isScheduledWorkDay` function declaration (currently line 32), and
   change nothing else in the file whatsoever.** Do not touch
   `runClassificationEngine`, `computeDiscount`, `parseWorkDays`, `getSchedule`,
   any constant, any type, any comment, or the order of anything. This file
   computes payroll; the only acceptable diff in it is one added word.

2. `src/app/pages/ProcessPayroll.tsx` — the data-quality block, currently lines
   338-357, plus the import from `@/app/lib/classificationEngine`.

**No other file may be touched.**

### The change in ProcessPayroll.tsx

Add `isScheduledWorkDay` and `toLocalYMD` to the existing named import from
`@/app/lib/classificationEngine` (that import block is at lines 26-36; leave its
other entries alone).

Replace the single shared `expectedWorkdays` array with a per-employee one.
Today:

```ts
const expectedWorkdays: string[] = [];
for (const d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
  if (d.getDay() !== 0 && d.getDay() !== 6) expectedWorkdays.push(d.toISOString().slice(0, 10));
}
```

Build the list of dates in the period once, then filter it per employee inside
the existing `for (const emp of activeEmps)` loop, using
`isScheduledWorkDay(date, emp.work_days)`. `emp.work_days` is already on the
`Employee` type (line 42) and is already selected by `loadEmployees.ts`.

Points that are easy to get wrong:

- **Push a copy of the date, not the loop variable.** The existing loop mutates
  one `Date` object with `setDate`, so `periodDates.push(d)` would fill the array
  with references to the same object. Push `new Date(d)`.
- **Use `toLocalYMD(d)`, not `d.toISOString().slice(0, 10)`.** `toLocalYMD` is
  already exported from `classificationEngine`. `CLAUDE.md` forbids
  `toISOString().slice(0,10)` for date keys; the current line survives only
  because of the `T12:00:00` anchor, and it must not be carried into the new
  code.
- **Guard against an empty list.** If an employee's `work_days` matches no day in
  the period, skip them rather than dividing by zero in the `gap / length` test.
- Keep the 30% threshold, the message wording, and the `level: 'warn'` shape
  exactly as they are.

Leave the `missingTm` warning immediately above completely untouched.

### Acceptance criteria — observable outcomes

1. Processing a period produces **exactly the same warnings as before** for every
   Mon–Fri employee. This is the important one — 44 of 48 employees must see no
   change at all.
2. The four weekend-schedule employees — Cemiriamiz Iglesias, Euclides Gonzalez,
   Michael Antonio Jones Roye, Edwin Broce — no longer produce a coverage warning
   when their Teramind data is complete for the days they actually work.
3. An employee with a genuine coverage gap still gets warned, and the N in
   "covers only X/N workdays" is now the count of *their* workdays in the period,
   not the count of weekdays.
4. `grep "toISOString" src/app/pages/ProcessPayroll.tsx` returns nothing in this
   block.
5. `git diff src/app/lib/classificationEngine.ts` shows exactly one changed line,
   and the change is the added word `export`.
6. The Process page loads and a period processes end to end with no runtime error.

---

## After UIB reports done — our side

1. Export, sync. **The diff must be exactly two files.** Anything else in
   `classificationEngine.ts` is collateral — revert in UIB and re-prompt.
2. `node --test "tests/*.test.ts"` — 96 must pass. The engine tests are the
   guard here; if any fails, `classificationEngine.ts` was modified beyond the
   one word.
3. Load the Process page. Criterion 1 first.
