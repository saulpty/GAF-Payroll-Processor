# Make `attendanceReport.ts` survive what the database actually returns

The Reports tab renders but shows **every day as an unexplained absence** —
440 absent, 0 on-time, for all 45 employees, on days that plainly have punches.
The cause is not the SQL. It is that the module trusts its inputs to be clean.

## The only file you may change

- `src/app/lib/attendanceReport.ts`

**No other file.** Not an action, not a page, not a component, not a test, not
`attendanceReportTypes.ts`. The last prompt was read-only and three action files
were edited anyway — do not do that again. If you believe another file needs to
change, say so in your reply and stop.

## Why the page is wrong

Two things arrive differently from how the module assumes:

1. **A Postgres `DATE` read through `::text` arrives as
   `"2026-06-01T00:00:00.000Z"`, not `"2026-06-01"`.** This is already recorded
   in `docs/LESSONS.md` — *"Postgres hands back full timestamps — slice to 10"*.
   It affects `periods.start_date` / `end_date` (from `loadPeriods`),
   `holidays.date` (from `loadHolidays`), `employees.start_date`, and any
   `form_date` / request date not explicitly formatted.

2. **A `BIGINT` can arrive as a string.** `employees.id` and
   `payroll_entries.employee_id` are both `BIGINT`. If one side is the number
   `1` and the other the string `"1"`, every `Map` lookup misses silently — and
   a missed punch lookup renders as an absence. That is exactly the symptom.

Neither failure throws. Both produce a page that looks plausible and is wrong,
which is the worst possible outcome and the reason this must be fixed in the
module rather than patched query by query.

## The change

Normalise **at the boundary** — as the input is indexed, once, in
`buildAttendanceReport`. Do not sprinkle `.slice(0, 10)` through the comparison
logic.

**Dates.** Add a small local helper and run every incoming date-only value
through it: `employee.start_date`, `payrollRow.work_date`, `form.form_date`,
`request.start_date` / `end_date` / `return_date`, `holiday.date`,
`period.start_date` / `end_date`.

```ts
/** Postgres hands back a DATE as "2026-06-01T00:00:00.000Z" through ::text.
 *  Every date in this module is a plain YYYY-MM-DD string. */
function ymd(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : '';
}
```

An empty result must behave exactly as a missing value does today — an employee
with no `start_date` is not filtered out, a request with no `start_date` covers
nothing.

**`submitted_at` is different — do not slice it to 10.** It is
`"2026-09-02 09:03"` and the time is the whole point. Take its *date part* as
the first 10 characters when comparing days, and keep parsing the time as it
does now.

**Ids.** Key every index by `String(id)` and look up by `String(id)`, so a
number and a numeric string resolve to the same entry. This applies to
`payrollIndex`, `formIndex`, `requestIndex` and the employee map. Keep
`ReportRow.employeeId` reporting the employee's own id value as it does now.

## The tests are already written

`tests/attendanceReport.test.ts` has five new cases, R43 to R47, that feed the
module ISO timestamps and string ids. **They currently fail.** Do not edit them
— make them pass. All 42 existing cases must keep passing unchanged.

## Acceptance

1. Only `src/app/lib/attendanceReport.ts` changed.
2. Normalisation happens once, where the inputs are indexed.
3. `submitted_at` keeps its time; only its date part is compared as a day.
4. Indexes are keyed by `String(id)` on both write and read.
5. The file stays under 15 KB.
6. No `toISOString()`, no `new Date(str)` for date maths — the existing
   noon-anchored `new Date(ymd + 'T12:00:00')` for building a `Date` to hand to
   the helpers stays as it is.
