# A Reporting column on the Attendance Employees table

Saul: *"maybe have a seperate columnn to flag non reporting"* — in answer to
whether the **At Risk** badge should also account for absences and missing forms.

It should not, and this is the better shape. **At Risk keeps measuring
punctuality**, which is what it has always measured and what its tooltip now
says. Following the company rule — file the form *before* your shift — is a
different behaviour, and blending the two into one badge would hide both.

## The file you may change

- `src/app/pages/attendance/AttendanceTable.tsx`
- `src/app/lib/attendanceStats.ts` — only if the numbers below are not already
  computed there

**No other file.** No migration, no action, no change to any KPI card or donut,
and **no change to the At Risk thresholds** (Good ≥ 90, Fair ≥ 75, else At Risk).

## What to add

One column, headed **`Reporting`**, sitting immediately after the existing
`% On-Time` / status badge column so punctuality and reporting read side by side.

It answers: *when this person needed to file a form, did they?*

### The number

For each employee, over the filtered range:

- **needed** = days with a late arrival or an absence — i.e. every day that
  required an explanation. Days that were on time, on approved time off, on a
  permission or on a holiday are not counted.
- **filed** = of those, the days a GAF Attendance form was on file.

Show `filed / needed`, e.g. `7/9`, with a badge:

| Badge | Rule |
|---|---|
| `Complete` | filed equals needed |
| `Gaps` | at least one missing, but under half |
| `Rarely` | more than half missing |
| `—` | needed is 0 — nothing to report, so nothing to judge |

**The zero case matters.** Somebody who was never late and never absent must
show a neutral dash, not `0/0` and not a red badge. Perfect attendance is not a
reporting failure.

### Where the data comes from

`v_attendance_daily` already carries `filed_gaf` per row, and the Employees tab
already has those rows — the Reporting Compliance donut on the Dashboard is
built from exactly this. **Do not add a loader or a database column.** If the
rows on this page do not carry `filed_gaf`, say so and stop rather than
inventing a source.

Note the definition deliberately counts **absences** as needing a form too, not
just late arrivals — the Dashboard's Reporting Compliance donut looks only at
late arrivals. That is a real difference; say so in the tooltip rather than
quietly diverging.

### Tooltip

On the column header, matching the one-line style of the others:

`Of the days that needed an explanation — arrived late or absent — how many had a GAF Attendance form on file.`

### Sorting

The column sorts by the ratio, with `needed = 0` rows sorted last in both
directions so the empty ones never crowd the top.

## Constraints

- Do not change At Risk, its thresholds, or any existing column.
- No new colours beyond the badge palette already in this file.
- The table must stay readable at the current width — if adding a column makes
  it cramped, shorten the *header* to `Reporting` and keep the detail in the
  tooltip rather than widening the table or shrinking the font.
- File stays under 15 KB.

## Acceptance

1. A `Reporting` column exists showing `filed / needed` plus a badge.
2. An employee with nothing to report shows a neutral dash, never a red badge.
3. At Risk and every other column are byte-for-byte unchanged in behaviour.
4. The header tooltip states that absences count, not only late arrivals.
5. Only the file(s) named above changed.
