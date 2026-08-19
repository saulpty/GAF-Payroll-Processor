# "Some employees have 0 attendance data" — 2026-08-19

Reported: Jean Pierre, Maria Urriola and others show nothing on Attendance.
Checked against the live `GAF Planilla DB` with read-only queries.

## Result: the data is there. No matching bug.

`v_attendance_daily` joins `payroll_entries` to `employees` on `employee_id`
and exposes `employees.teramind_email` as `email`; the page then groups rows by
that email. So the two ways this could break are a missing/duplicated
`teramind_email` or missing payroll entries. Neither is happening:

- **No active employee is missing `teramind_email`.**
- **No two active employees share one.**
- **Jean Pierre Montfort** (id 45, `jp.m@mombaaz.com`): 20 payroll rows,
  20 view rows, 2026-07-13 → 2026-08-07.
- **Maria Alejandra De Urriola** (id 52): same shape, 20 rows from 2026-07-13.
- Every active employee's latest attendance row is 2026-08-07, which is the
  latest date in the whole view. Nobody is behind.

The only two active employees with **zero** rows are **Timothy Moore** (a
manager we deliberately don't track) and **Johann Morante** (the rehire, whose
history was dropped on purpose).

## What is actually going on

These people are recent hires, and their history is short:

| Starts | Rows | Who |
|---|---|---|
| 2026-07-13 | 20 | Cemiriamiz Iglesias, Edwin Broce, Jean Pierre Montfort, Maria Alejandra De Urriola |
| 2026-07-27 | 10 | Euclides Gonzalez, Isaac Chung, Nichole Harris, Rocio Pretto |

The Attendance page defaults to the last 30 days (`GlobalFilterContext.tsx`,
`DEFAULT_FROM = daysAgo(30)`), and in that window all of them do have rows. But
pick any range or period that ends before mid-July — which is easy to do from
the period dropdown — and a new hire renders as a **row of zeros**, visually
identical to someone who was here all along and never clocked in.

## The fix is UX, not data

A new hire outside the range should not be shown as 0 / 0 / 0. Options, cheapest
first:

1. Show the hire date in the employee row and label out-of-range people
   "hired 2026-07-13 — no data in this range" instead of zeros.
2. Grey out or move to a separate "not yet employed in this range" group.
3. Clamp each employee's denominator to the overlap between the selected range
   and their `start_date`, so percentages stay honest.

`employees.start_date` is already synced from the Monday directory, so option 1
needs no new data.

Worth folding into the Attendance pass of the UI/UX work rather than fixing on
its own.

---

## Correction, later the same day

The conclusion above is incomplete. While working in the app I saw the
Attendance page for **Maria Alejandra De Urriola** over a 90-day window
(2026-05-21 → 08-19) report **DAYS TRACKED 0**, ON-TIME 0 of 0, with EXCUSED 5
and PERMISSION 15. Her 20 rows are all excused or permission — *not one is a
worked day*. So the date-range explanation is only part of it: for at least some
recent hires the Teramind side does not appear to be landing at all, and only
their Monday permission requests are.

That is a real gap and deserves its own investigation. See
`docs/findings/2026-08-19-pto-v2/README.md`.
