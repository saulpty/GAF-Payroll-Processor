# A-excused-split — notes for Saul (not for UIB)

Companion to `A-excused-split.md`. This is the stuff that does **not** go into
the UIB prompt: tests to write by hand, risks I found while reading, and the
calls I made that you may want to overrule.

---

## 1. Tests to add to `tests/attendanceStats.test.ts`

You write these. The existing file only has two tests and a `row()` factory that
defaults to `status: 'On Time'`, so all of these can reuse it with
`row({ status: 'Absent - Unexplained', bucket: 'absent', entry_time: null, minutes_late: 0 })`.

The current baseline is 104 tests. These add 12.

### The core semantics

**A1 — an absence is scored, an excused day is not.**
Rows: 1 On Time, 1 `Absent - Unexplained`, 1 `Excused (PTO/FH/Perm)`, 1 `Permission`.
Assert `days === 2` (on time + absent), `absent === 1`, `excused === 1`,
`permission === 1`, `pctOnTime === 50`.
*This is the whole bug in one test: before the change `days` would have been 1
and `pctOnTime` 100.*

**A2 — `isExcluded` did not widen.**
`assert.equal(isExcluded('Absent - Unexplained'), false)` and
`assert.equal(isAbsent('Absent - Unexplained'), true)`, plus
`isExcluded('Excused (PTO/FH/Perm)')` and `isExcluded('Permission')` both true,
`isAbsent` false for both. Cheap, and it catches the tempting "just add it to
EXCUSED_STATUSES" regression directly.

**A3 — `avgMinLate` ignores absences.**
Rows: one `Late - Unreported` with `minutes_late: 20`, one
`Absent - Unexplained` with `minutes_late: 0`.
Assert `avgMinLate === 20` (not 10) and `daysWorked === 1` and `days === 2`.
*This is the one people will get wrong. If it comes back 10, the denominator is
`active` instead of `arrived`.*

**A4 — `avgMinLate` is unchanged by adding absences to a dataset.**
Compute stats for `[onTime, late20]`, then for `[onTime, late20, absent]`, and
assert both `avgMinLate` values are equal. Proves the metric's meaning survived.

**A5 — bucket counters ignore absences.**
A row with `status: 'Absent - Unexplained', bucket: 'absent'` must not increment
`b1to10`, `b11to30`, `b31plus`, `onTime`, `reported`, `unreported` or
`totalLate`. Assert all seven are 0.

### The identities (this is what stops a "461 of 482")

**A6 — company identity 1.**
On a mixed dataset:
`kpis.daysTracked === kpis.onTime + kpis.lateReported + kpis.lateUnreported + kpis.absent`.

**A7 — company identity 2.**
`kpis.totalRows === kpis.daysTracked + kpis.excused + kpis.permission`, and
`kpis.totalRows === rows.length`.

**A8 — `daysWorked` identity.**
`kpis.daysWorked === kpis.daysTracked - kpis.absent`, and the same for
`EmpStats`: `s.daysWorked === s.days - s.absent`.

**A9 — per-employee sums roll up to the company numbers.**
Two employees, mixed rows. Assert
`sum(empStats.absent) === kpis.absent` and `sum(empStats.days) === kpis.daysTracked`.
*The Donuts component derives `b1to10` etc. by summing `empStats`, so a drift
between the two aggregations shows up as a donut that disagrees with the KPI row.*

### Trends

**A10 — absences land in `tracked` but not in `worked`.**
`computeTrends([onTime, absent], 'month')` → `tracked === 2`, `worked === 1`,
`absent === 1`, `sumMin === 0`.

**A11 — `sumMin` and `worked` stay a matched pair.**
`[late20, absent]` → `sumMin === 20`, `worked === 1`, so `sumMin / worked === 20`.
Assert the division, not just the parts — that's the number the chart plots.

**A12 — excused days are still skipped entirely by `computeTrends`.**
`[onTime, excused, permission]` → `tracked === 1`. Unchanged behaviour, but it's
the one thing in `computeTrends` I asked UIB not to touch, so pin it.

### Edge cases worth one assertion each (fold into the above if you'd rather)

- An employee whose rows are **all** absences: `pctOnTime === 0` (not `NaN`),
  `avgMinLate === 0` (not `NaN` — `arrived.length` is 0, guard is `> 0`).
- An employee with **only** excused rows: `days === 0`, `pctOnTime === 0`,
  `daysWorked === 0`. This case exists today and must not start dividing by zero.

---

## 2. Risks I found

### 2.1 The `WHERE` clause is the one that can silently delete data

`v_attendance_daily` ends with:

```sql
AND (entry_t IS NOT NULL OR is_excused OR is_permission)
```

Absence rows have **no entry time**. The moment `Ausencia Injustificada` leaves
`is_excused`, those 29 rows stop satisfying every disjunct and **vanish from the
view** — no error, the dashboard just quietly loses 29 days and the excused
count drops to 314 exactly as expected, so the headline number looks right while
the total is wrong. That is why the prompt's first verification is the **total
row count (4,164)**, not the excused count. If someone implements this from the
one-line summary ("remove it from the array") rather than the full SQL, this is
the bug they ship.

### 2.2 The `bucket` CASE ordering can invert the fix

`bucket` currently reads `WHEN is_excused OR is_permission THEN NULL / WHEN
late_minutes = 0 THEN 'on_time' / ...`. An absence carries `late_minutes = 0`.
Put the `is_absent` branch *after* the `late_minutes = 0` test and every no-show
is bucketed `on_time` — worse than the bug we're fixing, because it would then
be counted as punctual rather than merely ignored. Same trap in the `status`
CASE. The prompt puts `is_absent` immediately after `is_excused` in both, and
the verification asserts `On Time` stayed at 2,394.

### 2.3 Not every absence row is punch-less

Seed data has rows like `Carlos Aloma 2026-04-10` with
`event_type_1 = 'Ausencia Injustificada'` **and** an entry time of 10:50, and
`Ángela Rodgers 2026-04-15` with 240 discount minutes. So a handful of the 29
may carry a real `entry_time` and a non-zero `minutes_late`.

The prompt's CASE puts `is_absent` ahead of the lateness tests, which means
those rows become `Absent - Unexplained` rather than `Late - Unreported`. I
think that's right — the payroll record says the day is an unjustified absence,
and that's the operator's judgement, not the view's — but it is a judgement
call. Consequence: `avgMinLate` may shift by a fraction of a minute, because
those rows leave the average. The prompt asks for the shift to be reported
rather than treated as a defect. If you'd rather those rows stay in the late
buckets, the fix is one line: change the status CASE to
`WHEN is_absent AND entry_t IS NULL THEN 'Absent - Unexplained'`. I did **not**
do that because it would split the 29 into two groups and break the clean
343 → 314 + 29 verification.

### 2.4 `Ausencia Injustificada` also appears as `event_type_2`

`classificationEngine.ts:611` writes it as `event_type_2` on the partial-medical-
note branch (`Ausencia Justificada.` for part of the day, `Ausencia
Injustificada` for the remainder). The view only reads `event_type_1`, so those
days stay `Excused` — correct, they *are* partly excused. Nothing to do, but
worth knowing the string appears in two columns with two meanings.

### 2.5 The Donuts legend/slice colour mismatch is a real, live bug

`AttendanceDonuts.tsx` passes positional colour arrays into pies whose data is
`.filter(d => d.value > 0)`, while the legends index those arrays by hand. The
"Late Arrivals — By Window" donut is already wrong **today**: the pie draws
1–10 min with `COLORS_BUCKETS[0]` (`#2AA876`, green) while the legend swatch
uses `COLORS_BUCKETS[1]` (`#FBBF24`, amber). Go look at it — a green slice
labelled with an amber dot.

I folded the fix (each datum carries its own colour) into this prompt because
adding a sixth series to the overview donut makes the filter-shift far more
likely to bite. If you want a tighter diff, it can be pulled out into its own
prompt — but then the overview donut will mis-colour Absent on any filtered
view where one series is zero.

### 2.6 `AttendancePanel.tsx` is 16.6 KB

`CLAUDE.md` says files stay under 15 KB. This one is already over and my changes
add roughly another 900 bytes. I told UIB explicitly **not** to refactor or split
it as part of this change — a split would balloon the diff and put a
payroll-adjacent component through an unrelated restructure. Worth a separate
prompt later; there is no automated guard on file size (I checked
`tests/repoHygiene.test.ts` — it only checks `.gitattributes`, `.gitignore` and
CR characters).

### 2.7 Guards this change has to stay inside

- **L3 (`lessonGuards.test.ts`)** ratchets `attendanceStats.ts` at exactly 3
  `toISOString()` uses. The ratchet only tightens, so if UIB adds one the suite
  fails, and if it "helpfully" removes one the suite *also* fails (the allowlist
  must stay honest). The prompt says don't touch them.
- **L6 / L6b (`filedGafGuard.test.ts`)** find the newest migration whose
  *filename* matches `/v_attendance_daily/i`, then grep the single line matching
  `/AS\s+gaf_filed/i` for both documentation strings. My filename
  `1781994000_v_attendance_daily_split_unexplained_absence.sql` matches, sorts
  after `1781993000`, and keeps `gaf_filed` on one line with both literals. If
  UIB reformats that line across two lines, L6 fails.

### 2.8 Nothing else reads the view

I grepped: `src/actions/loadAttendanceDaily.ts` is the only consumer, and it
selects the nine columns by name with no status filter. `loadSummaryDashboard.ts`
and `loadSummaryAllPeriods.ts` read `payroll_entries.event_type_1` directly, not
the view, so their `Ausencia Injustificada` counts are unaffected. The Reports
tab (`attendanceReport.ts`) never touches the view at all.

---

## 3. Things I was unsure about — your call

1. **The status string.** I picked `Absent - Unexplained` to mirror
   `Late - Reported` / `Late - Unreported` (ASCII hyphen, spaces either side) and
   to leave room for a future `Absent - Reported`. Alternatives I rejected:
   `Unexplained Absence` (reads as a Reports-tab verdict, not a dashboard
   status, and doesn't sort next to `Absent -` siblings), `No Show` (accurate but
   harsher than the Spanish source term), and keeping the raw
   `Ausencia Injustificada` (the view's status column is English throughout).

2. **`avgMinLate` excludes absences.** Stated at length in the prompt. Net
   effect: the number on screen stays the same as today. The alternative —
   averaging absences in as 0 — would make someone who misses half the month
   look *more* punctual, which is the same inversion we're fixing. The third
   option, imputing a penalty per absence, invents data. If you'd rather see a
   single blended "attendance cost" number, that's a different metric and
   deserves its own name and its own prompt.

3. **Reporting Compliance donut excludes absences.** It answers "when someone
   was late, did they file?", so its universe is days worked. I added a caption
   saying so rather than adding an Absent slice, because adding one would change
   `reportPct`'s meaning without changing its name. If you want absences counted
   as a reporting failure, that's a deliberate metric change — say so and I'll
   write it.

4. **The KPI footnote line.** I added a plain-text line under the KPI row that
   spells out `expected = on time + late + absent` with the actual numbers, and
   `+ excused + permission = days in range`. It's slightly unusual for a
   dashboard, but it makes the Reports-tab class of bug ("461 of 482") visible
   the instant it happens instead of months later. Drop it if it reads as
   clutter — but then A6/A7 in the test list become the only thing catching it.

5. **`days` keeps its name, changes its meaning.** `EmpStats.days` now means
   *expected* days rather than *arrived* days. I kept the field name to avoid a
   rename cascade through the table's `SortKey` type, and changed only the
   user-facing header (`Days` → `Expected`). If you'd rather the field were
   called `daysExpected`, it's a mechanical rename across
   `attendanceStats.ts`, `AttendanceTable.tsx` and `AttendancePanel.tsx` — but it
   would also touch the sort-key column definitions, so it's a bigger diff than
   it looks.

6. **The Q2-Jul / Q1-Aug figures.** The brief gives 23 and 19 for those two
   periods against a total of 29 across 14 employees. Those overlap (a period
   boundary falls mid-range), so they don't sum to 29. I wrote the verification
   section to say that explicitly so nobody chases the arithmetic. If those two
   numbers are meant to be disjoint, the total is wrong somewhere and the probe
   should be re-run before this ships.

---

## 4. What I did not do

- Did not write or modify any test — `tests/` is yours by hand.
- Did not touch `src/` (read-only export mirror).
- Did not run any query against the live database; every number in the prompt is
  the one you supplied, restated.
- Did not open UI Bakery or a browser.
