# `v_attendance_daily` must ignore soft-deleted payroll entries

The eight actions that read `payroll_entries` were fixed in the previous change
to filter `deleted_at IS NULL`. **`v_attendance_daily` was deliberately left for
this one**, and it is the last read path that still counts deleted rows.

Effect today: the 18 off-day rows soft-deleted by migration `1781900200` still
appear on the whole Attendance dashboard — they inflate `DAYS TRACKED`, and
because they have no clock-in they are scored as absences against four weekend
employees who did not work those days.

## Change

Create **one new migration**, `1781900300_v_attendance_daily_excludes_deleted.sql`.

It must `CREATE OR REPLACE VIEW v_attendance_daily` using **the exact body of
`src/migrations/1781900100_v_attendance_daily_honours_work_days.sql`**, with
**one single line added**: in the `base` CTE, after

```sql
  WHERE e.active = true
    AND COALESCE(e.excluded_from_payroll, false) = false
```

add

```sql
    AND pe.deleted_at IS NULL
```

`CREATE OR REPLACE` is correct here because the output columns do not change.

## Copy the rest byte-for-byte

This view has been redefined sixteen times and has **silently lost a fix twice**
by being retyped rather than copied. Two known quirks are present in
`1781900100` and **must be carried over exactly as they are**:

- the final `SELECT` emits `work_date AS date` (no `TO_CHAR` wrapper);
- the `entry_t` parsing and `TO_CHAR(entry_t, 'HH24:MI')` output.

**Do not "fix", tidy, reformat, reorder or improve either of them, or anything
else.** They are being tracked separately. Changing them here would make this
migration impossible to verify. The `work_days` filtering in the final `WHERE`,
the `DISTINCT ON`, the CTE structure, the nine output columns and their order
must all be identical.

I will verify by diffing this migration's view body against `1781900100`, and I
expect **exactly one added line and nothing else**.

## Do not touch

- No `.tsx` or `.ts` file. This change is a single new `.sql` file.
- No existing migration. Do not edit `1781900100` or `1781900200`.
- Do not modify `applied.txt` by hand; UI Bakery maintains it.
- **No other file may be touched.**

## Acceptance criteria

Recorded immediately before this change, `Q2-Aug-2026` / 60-day window
(2026-06-27 → 2026-08-26):

- `DAYS TRACKED` = **1428**, `ON-TIME RATE` = **63.5%** (907 of 1428),
  `LATE — UNREPORTED` = **245**.

After the change, `DAYS TRACKED` must **fall by 18 to 1410**, because those rows
are deleted and should never have been counted. The four affected employees are
Euclides Gonzalez, Michael Antonio Jones Roye, Cemiriamiz Iglesias and Edwin
Broce; their unreported-absence counts should drop, and no other employee's
figures should move.

Payroll Master, HRK Summary and Action Required must be unchanged — they do not
read this view.

Then confirm the view still returns all nine columns with their original names.
