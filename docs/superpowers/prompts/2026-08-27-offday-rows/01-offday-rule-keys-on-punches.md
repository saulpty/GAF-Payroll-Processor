# A day off with no punches must not produce a row

One file: **`src/app/lib/classificationEngine.ts`**. No other file may be
touched.

## The bug

An employee came out of a payroll run with rows on Saturday 2026-08-22 and
Sunday 2026-08-23 — days she does not work — carrying **no punches at all**.
Entry and Exit were empty, Late and Early were zero.

The engine already checks each employee's schedule at line 462. The problem is
what it does on a day off: it asks *"is there a form?"* when it should ask
*"are there punches?"*. `permissionCoversDate` (line 407) is a plain inclusive
string range, so a permission running Friday→Monday also matches the Saturday
and Sunday in between, and each match manufactured a YELLOW row.

The rule is backwards in both directions:

| On a day off | Now | Must become |
|---|---|---|
| Punches, no form | row dropped silently | **YELLOW row carrying the real punches** |
| Form, no punches | YELLOW row created | **no row** |
| Punches and a form | YELLOW row with punches | unchanged — still one row |
| Neither | no row | unchanged |

## Change 1 — rewrite the off-day branch

Replace the whole block currently at lines 461-493 (from the
`// ── Non-scheduled day …` comment through its closing `}`) with:

```ts
      // ── Non-scheduled day (weekend for Mon–Fri workers, or weekday for weekend-shift workers) ──
      // The question here is "are there punches?", never "is there a form?".
      // A form covering a day the employee does not work explains nothing about
      // payroll — they were not due to be there. A permission's date range
      // routinely spans a weekend, and treating that as a payroll event
      // manufactured rows with no punches on them.
      if (!isScheduledWorkDay(date, emp.work_days)) {
        const tmData = teramindData.get(emp.teramind_email)?.get(dateStr);

        // No punches on a day off is not a payroll event, form or no form.
        if (!tmData) continue;

        // They worked a day they were not scheduled for. Show the real punches
        // and let an operator decide what it is worth: no event type, no pay
        // impact, no discount are assigned automatically.
        const dowName = DOW_ABBR[date.getDay()];
        const entry = buildEntry(
          { ...baseEntry, entry_time: formatTime12(tmData.entry), exit_time: formatTime12(tmData.exit) },
          {
            event_type_1: '', pay_impact_1: '', event_type_2: '', pay_impact_2: '',
            documentation: '', notes: '',
            auto_notes: `${dowName} is not a scheduled workday — worked anyway. Operator review required.`,
            initial_status: 'YELLOW',
          }
        );
        results.push(entry);
        continue;
      }
```

Notes on the choices, so they are not "improved" later:

- **`isScheduledWorkDay` is reused as-is.** Do not write a second work-day
  check; there are already two implementations in the codebase (this one and
  the SQL ISODOW idiom) and a third would drift from them.
- **`event_type_1` and `pay_impact_1` stay empty on purpose.** Unscheduled work
  may be overtime, comp time, or a mistake. The engine must not guess.
- **`documentation` is empty for now.** A later change names which Monday form
  was involved; do not invent a value here.
- The `console.log` that was in the old branch goes away with it.

## Change 2 — the work-day gate must run before the outage check

`// ── Step 0: Outage date ──` at line 448 currently runs **first**, so a
Teramind outage date landing on an employee's day off stamps a GREEN full-day
row using the schedule's own start and end times, as if they had worked it.
That is a second source of rows on days nobody works.

**Move the entire non-scheduled-day block above the Step 0 outage block**, so
the order inside the date loop becomes:

1. non-scheduled day (the block from Change 1)
2. Step 0 — outage date
3. Step 1 — holiday
4. everything after, unchanged

Move the block; do not duplicate it, and do not change the outage block's own
contents. `baseEntry` is built above both (lines 434-446) and stays where it is.

## Do not touch

- **No other file.** Not `ProcessPayroll.tsx`, not any action, not any test.
- Do not change `isScheduledWorkDay`, `parseWorkDays`, `DOW_ABBR`,
  `permissionCoversDate`, `rowMatchesEmp`, or `buildEntry`.
- Do not change the holiday, permission, absence-form, macbook-swap, no-data or
  normal-day branches — Steps 1 through 7 are out of scope.
- Do not change any schedule, DST, grace, discount or late/early calculation.
- Do not add or remove a config key.

## Acceptance criteria

The repo's own test suite covers all of this; it is currently red on exactly
these four cases and must go green:

- A Mon–Fri employee punching on a Saturday produces **one YELLOW row** whose
  `entry_time` and `exit_time` are the real punch times, with `event_type_1`,
  `pay_impact_1` and `discount_total_minutes` all empty or zero, and an
  `auto_notes` naming the day and saying it is not a scheduled workday.
- A Mon–Fri employee with a Saturday attendance form and **no punches** produces
  **no row**.
- A permission running Fri→Mon produces **no Saturday or Sunday rows** for a
  Mon–Fri employee, while the same permission still produces its row on the
  Monday.
- A Teramind outage on a Mon–Fri employee's Saturday produces **no row**, while
  an outage on their Monday still produces its GREEN row with the default
  schedule applied.
- Everything already passing stays passing: a Wed–Sun employee's Saturday is
  still a normal workday with lateness measured, a holiday on their Saturday is
  still `Feriado`, and their Monday is still not an unjustified absence.

Then confirm every identifier used in the file is imported.
