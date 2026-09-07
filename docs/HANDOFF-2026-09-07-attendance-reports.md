# Handoff — Attendance Reports tab, 2026-09-07

Second piece of work on 2026-09-07 (the first was the Disciplinary viewer, see
`HANDOFF-2026-09-07.md`).

## What is live

**A fourth tab under Attendance: `/attendance/reports`.** On `/dev/` only —
**not released to prod.**

It answers the question managers could not previously ask: not just *was this
person late*, but *did they say so first, and if they were absent, why?*

One row per employee per scheduled work day, showing the punches, the minutes
late, the Absence/Tardiness form behind the day, and whether that form was
submitted **before the shift started** — which is the company rule.

- **Weekly strips** (default) — a card per employee, a coloured tile per day,
  click a tile for that day's detail. Sorted worst-first.
- **All days** — the same rows as a sortable table with verdict filter chips.
- Both honour the existing global filters: date range, employee, role, manager.

On the live data for 2026-08-08 → 09-07: **482 scheduled days, 266 on-time,
181 late, 35 absent, 14 unexplained, 55% on-time.**

### The scoring rule Saul set

> Attendance is about knowing whether someone was on time, late, or absent. PTO
> and a birthday day off matter too, but they must not affect the score.

So `countsToScore` is true for on-time, every late verdict, and every absence
including reported ones; false for PTO, permission, holiday, and days whose
payroll period has not been run. A fortnight of PTO produces **no score**, never
a 0% score.

## What it found in the real data

Three things the report surfaces rather than hides. None of them is a bug in the
report.

**1. 47 of 97 late days since 2026-08-15 have no form at all.** Roughly half the
time the policy is simply not followed. That is the number the feature was built
to make visible.

**2. 113 forms across 24 employees are invisible to payroll.**
`rowMatchesEmp` (`classificationEngine.ts:391-405`) matches on email *only* when
the form carries one, and never falls back to the name or `name_aliases`. A form
filed from a slightly different address therefore matches nobody. The mirror's
own resolver *does* fall back, so these look correctly matched in
`monday_attendance_forms` and are simultaneously unseen by every payroll run.
Causes are mundane and recurring: wrong company domain (Juan Molina, 34 forms),
a missing dot, `.com` for `hc.com`, domain typos, personal gmail/yahoo
addresses. **One is dated 2026-09-02, so this is live, not historical.**
The report flags these rows *"Form submitted under a different email"*.

**3. 13 days were docked while a form was on file — 85.83 hours across 5
people.** Investigated and **not solved**; see below. The report flags them
*"payroll recorded this as unexplained, but a form is on file"* rather than
silently correcting them.

## Open — needs a decision

### The 13 misclassified days (85.83 discounted hours)

Ángela Rodgers, Carlos Aloma, Osvaldo Medina, Monique Luque, Jennette Torrano.
All 13 forms were filed **before** the period was processed, so timing is ruled
out — the engine had the data and did not use it.

- **6 are explained.** Engine Step 3 (`classificationEngine.ts:583`) fires only
  when `absenceForms.length > 0`, and that list filters to `type === 'Absence'`.
  Someone who filed *Tardiness* and then never arrived has no punches and no
  Absence form, so they fall past Step 3 into Step 5's "No data + no form".
- **7 are not.** They had an Absence form, which Step 3 exists to catch. Two
  hypotheses were tested and both are dead: the emails matched the roster
  exactly, and every snapshot `date` value measures `LENGTH() = 10` (an earlier
  "confirmed" ISO-date diagnosis was read from the wrong column). The forms were
  in the run snapshot with the right person, day and type. **No mechanism
  survives.**

Untested candidates, best first: those rows may be Excel-import output rather
than engine output (check whether `auto_notes` really reads `NO DATA + NO FORM`
on all 7); re-runs in single-employee mode leaving stale rows behind, since
`upsertPayrollEntries` never deletes; Step 2 exiting before Step 3.

**The engine was not changed.** Payroll is Saul's call, and re-running processed
periods is a bigger decision than this feature.

### The 113 mismatched emails

A Monday form / roster cleanup, not a code change — though making
`rowMatchesEmp` fall back to the name when the email fails to resolve would fix
the class permanently. Both need Saul.

### `filed_gaf` breaks on the next payroll run

`v_attendance_daily` computes it as `documentation = 'Form Submitted'`, but
since 2026-08-27 the engine writes `'Attendance Form'`
(`classificationEngine.ts:591,742`). **It is correct today only because the last
processed period ran on 2026-08-25, two days before the rename.** The next run
silently zeroes "Late — Reported" on the existing Dashboard. The fix is one
migration accepting both strings; it was planned as step 0 and deferred when the
probe showed the bug was latent rather than live. **It should ship before the
next payroll run.**

### `Ausencia Injustificada` is grouped as Excused

`v_attendance_daily` lists it among the excused event types, so on the existing
Dashboard a no-show renders as `Excused (PTO/FH/Perm)` and drops out of every
lateness bucket. **29 of 343 Excused rows (8.5%)** are affected. The new Reports
tab does not inherit this. Saul asked for the old dashboard to be cleaned up and
split the same way — not yet done.

## How it is built

- `src/app/lib/attendanceReport.ts` — pure verdict engine, **no imports**;
  helpers arrive through `ReportInput.helpers`, the `mondayResolve.ts` rule, so
  `node --test` can load it. Types in `attendanceReportTypes.ts`, pulled back
  with a **type-only** import.
- Loaders: `loadAttendanceReportDays` (reads `payroll_entries` directly — the
  view drops punchless days and is blind to absences),
  `loadMondayAttendanceFormsRange`, `loadMondayRequestsRange`. All take an
  optional `manager`, so roadmap G stays a wiring job.
- `AttendanceReport.tsx` owns the data; the two view components take plain props.
- **47 tests** in `tests/attendanceReport.test.ts`; 186 in the suite overall.

### The trap that cost the most time

The page first rendered **every day for every employee as an unexplained
absence** — 440 absent, 0 on-time. Nothing threw, nothing logged, and it looked
finished. Two silent input mismatches: a Postgres `DATE` arrives as
`2026-06-01T00:00:00.000Z`, and a `BIGINT` can arrive as a string. A missed
`Map` lookup does not render as an error — it renders as *someone who did not
come to work*.

Fixed by normalising **at the boundary** inside the module, not query by query;
the first attempt patched three actions and the page was still wrong because
`loadPeriods` was not one of them. Recorded in `docs/LESSONS.md` with the
general shape, and guarded by R43–R47.

## Next

1. Ship the `filed_gaf` migration before the next payroll run.
2. Decide on the 13 days and the 113 emails.
3. Split `Ausencia Injustificada` out of Excused on the existing Dashboard.
4. Auto-refresh the Monday mirrors on page open — Saul finds the manual sync
   buttons "VERY annoying", and this was designed but not built. The Reports tab
   currently shows whatever the last manual sync fetched.
5. Release to prod.
