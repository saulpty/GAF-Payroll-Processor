# Fixes from the code review

A full review of today's work found five correctness problems. Tests for four of
them are already written and **currently failing** — R48, R50, R51, R53, R54 in
`tests/attendanceReport.test.ts`. **Do not edit the tests. Make them pass.**

## Files you may change

- `src/app/lib/attendanceReport.ts`
- `src/app/pages/attendance/AttendanceTable.tsx`
- `src/app/lib/attendanceStats.ts`
- `src/migrations/1781995000_v_attendance_daily_add_time_off_kind.sql` — the
  comment block only, no SQL

**No other file.** Not `classificationEngine.ts`, not an action, not a test.

---

## 1. A form with no clock time is judged "filed late" (R48, R49, R50)

`parseSubmittedAt` returns `null` when `submitted_at` has no space:

```ts
const spaceIdx = submittedAt.indexOf(' ');
if (spaceIdx < 0) return null;
```

`submitted_at` is TEXT written verbatim from Monday, and
`syncAttendanceForms.ts:41` says so: *"use date text as-is (may include time on
some Monday column types)"*. So a date-only value is expected.

When it returns null, `buildFormView` leaves `onTime = false` **and never reaches
the "submitted before the day is always on time" branch**. A form filed two days
early is reported as filed late.

**Fix.** Return the date part even when there is no time, and accept `T` as well
as a space:

```ts
function parseSubmittedAt(
  submittedAt: string | null,
): { datePart: string; minutes: number | null } | null {
  if (!submittedAt) return null;
  const s = submittedAt.trim();
  if (s.length < 10) return null;
  const datePart = s.slice(0, 10);
  const rest = s.slice(10).trim();          // "" | "08:30" | "08:30:00"
  if (rest === '') return { datePart, minutes: null };
  const [hStr, mStr] = rest.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return { datePart, minutes: null };
  return { datePart, minutes: h * 60 + m };
}
```

In `buildFormView`, keep the existing structure and handle the null minutes:

- `parsed.datePart < rowDate` → `onTime = true`, `submittedMinutes = null`.
  **An earlier date is on time whether or not a clock time came with it.**
- `parsed.datePart === rowDate` and `minutes === null` → `onTime = false`,
  `submittedMinutes = null`. Without a time there is no evidence it beat the
  shift; "not proven on time" is the claim we can defend.
- `parsed.datePart === rowDate` and `minutes !== null` → unchanged.
- a later date → unchanged.

## 2. An employee with no payroll rows reads as absent every day (R51, R52)

The verdict chain asks *"was this period processed?"* and never *"does this
employee appear in it?"*:

```ts
} else if (!dateInProcessedPeriod(date, periods)) {
```

So a new hire added mid-period, or anyone an operator excluded from a run, gets
`unexplained_absence` on every scheduled day — a summary reading **0% on-time
with a month of absences** for someone who simply is not in the data.

**Fix.** In the per-employee loop, before the date loop, compute whether this
employee has any payroll row at all in range:

```ts
const hasAnyPayroll = (payrollIndex.get(String(emp.id))?.size ?? 0) > 0;
```

Then require it alongside the period check:

```ts
} else if (!hasAnyPayroll || !dateInProcessedPeriod(date, periods)) {
  verdict = 'not_processed';
}
```

**R52 pins the limit of this fix**: an employee who *does* have rows still gets
`unexplained_absence` on their blank days. The guard must not suppress real
absences — it must only stop inventing them for someone with no data at all.

## 3. Request types are matched exactly; the engine matches loosely (R53)

`AWAY_REQUEST_TYPES.includes(r.request_type)` is an exact, case-sensitive match.
`classificationEngine.ts:573-579` matches the same board data with
`.toLowerCase().includes(...)`. Two matchers, two answers, one dataset — the
Dashboard and the Reports tab can show opposite verdicts for the same day.

The live values currently match the array exactly, so this is not producing
wrong data today. It is one stray space or a renamed board column away from
doing so.

**Fix.** Normalise both sides before comparing — trim and lowercase — for
`AWAY_REQUEST_TYPES`, `PASSTHROUGH_REQUEST_TYPES` and `PTO_REQUEST_TYPES`.
Keep exact-value semantics otherwise: normalised equality, **not** substring
matching, so `'Work on a Holiday'` can never be swallowed by a `'holiday'` token.

## 4. A one-day request covers nothing when return_date equals start_date (R54)

```ts
if (r.return_date) return date < ymd(r.return_date);
```

Someone recording a single day off as `start_date = return_date` gets **zero**
covered days, and that day becomes a scored unexplained absence. The `end_date`
fallback that would have saved it is unreachable once `return_date` is set.

**Fix.** Only treat `return_date` as the exclusive bound when it is actually
after the start:

```ts
if (r.return_date && ymd(r.return_date) > s) return date < ymd(r.return_date);
```

falling through to the existing `end_date`-inclusive branch otherwise.

## 5. Somebody with no expected days is badged "At Risk"

`computeEmployeeStats` returns `pctOnTime = 0` when `days === 0`, and
`StatusBadge` only sees the percentage, so `0 < 75` renders a red **At Risk**.

An employee on PTO for the whole selected range is therefore branded At Risk on
the roster, while the Reports tab correctly shows "—" for the same person.
`ReportingBadge` two lines away already handles its own zero case properly.

**Fix.** Pass the expected-day count into `StatusBadge` and return the same
neutral `—` treatment `ReportingBadge` uses when it is 0. Do not change the
thresholds. `computeEmployeeStats` keeps returning `0` — only the badge changes,
so nothing downstream shifts.

## 6. The rollback note on migration 1781995000 is wrong

It says *"Rollback: re-run 1781994000"*. But `loadAttendanceDaily.ts` now selects
`time_off_kind`; dropping that column takes the whole Attendance page down with
`column "time_off_kind" does not exist`.

**Fix — comment only, no SQL change.** Amend the rollback line to say that
reverting this view also requires reverting `src/actions/loadAttendanceDaily.ts`
and the `time_off_kind` reads in `attendanceStats.ts` and `AttendanceDonuts.tsx`,
and that doing the migration alone will break the page rather than degrade it.

---

## Acceptance

1. `node --test "tests/attendanceReport.test.ts"` → **54 of 54 pass.**
2. The full suite still passes; no existing test changed behaviour.
3. `attendanceReport.ts` still has no runtime import and stays under 15 KB.
4. Only the four files above changed.
