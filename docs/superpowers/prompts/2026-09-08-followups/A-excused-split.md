# Split unexplained absences out of "Excused" on the Attendance dashboard

Apply one migration **and** update six React/TS files. Change no other file.

## Files you may change — and nothing else

1. `src/migrations/1781994000_v_attendance_daily_split_unexplained_absence.sql` (new)
2. `src/app/lib/attendanceStats.ts`
3. `src/app/pages/attendance/AttendanceKpis.tsx`
4. `src/app/pages/attendance/AttendanceDonuts.tsx`
5. `src/app/pages/attendance/AttendanceTable.tsx`
6. `src/app/pages/attendance/AttendancePanel.tsx`
7. `src/app/pages/attendance/AttendanceTrends.tsx`

**No other file may be touched.** In particular do not touch
`src/app/lib/classificationEngine.ts`, `src/app/lib/attendanceReport.ts`,
`src/app/pages/attendance/AttendanceReport*.tsx`, `src/app/pages/Attendance.tsx`,
`src/actions/loadAttendanceDaily.ts`, any file under `src/components/ui/`,
`ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
`AdminLookups.tsx`, `AGENTS.md`, or anything under `tests/`.

## Why the migration and the React changes must ship in the SAME prompt

The migration makes `v_attendance_daily` emit a **status string that has never
existed before**: `'Absent - Unexplained'`. The moment it does, every dashboard
component that switches on a status string has no branch for it:

- `attendanceStats.ts` would treat it as a late day with 0 minutes late.
- `BUCKET_COLORS` / `STATUS_COLORS` would return `undefined` → grey or `#ccc` dots.
- The KPI row would show numbers that no longer sum to the days tracked.

So **do not** split this into two steps and **do not** apply the migration on its
own to "check it first". Write the SQL file, apply it, and land all six React/TS
edits in the same pass.

## The defect

`v_attendance_daily` decides "this day is excused" from this list:

```
'PTO', 'Feriado', 'Compensatory Day', 'Birthday Day Off',
'Ausencia Justificada.', 'Ausencia Injustificada'
```

The last entry means the **opposite** of the other five.
`classificationEngine.ts` writes `'Ausencia Injustificada'` at Step 5
("No data + no form", around line 646) when **nobody clocked in and nothing was
filed** — a no-show. Because the status `CASE` tests `is_excused` first, those
no-shows render as `Excused (PTO/FH/Perm)`, get a `NULL` bucket, and are dropped
from the on-time denominator entirely. A person who simply did not show up
scores exactly like a person on approved vacation.

Measured on the live view: **29 of the 343 `Excused` rows (8.5%)** are
`Ausencia Injustificada`. The other 314 are legitimately excused — PTO 160,
`Ausencia Justificada.` 90, Feriado 64 (Compensatory Day 0, Birthday Day Off 0).

The rule this restores, in Saul's words: *attendance is about whether someone was
on time, late, or absent. PTO and birthday days off matter, but they must not
affect the score.*

---

## Part 1 — the migration

Create and apply
`src/migrations/1781994000_v_attendance_daily_split_unexplained_absence.sql`
with exactly this content. It is the current view
(`1781993000_v_attendance_daily_accept_attendance_form.sql`) with five changes,
all listed in the header comment. The nine output columns — `email`, `name`,
`date`, `entry_time`, `status`, `bucket`, `filed_gaf`, `minutes_late`,
`period_name` — keep their names, their types and their order.

```sql
-- Split unexplained absences out of the "excused" bucket.
--
-- 'Ausencia Injustificada' is written by classificationEngine.ts Step 5
-- ("No data + no form", ~line 646) when nobody clocked in and no form was
-- filed. It is the OPPOSITE of the other five values that shared the
-- is_excused list, and because the status CASE tests is_excused first, every
-- one of those no-shows rendered as 'Excused (PTO/FH/Perm)', carried a NULL
-- bucket, and was removed from the on-time denominator. 29 of the 343 Excused
-- rows on the live view are no-shows.
--
-- Changes from 1781993000_v_attendance_daily_accept_attendance_form.sql:
--   1. 'Ausencia Injustificada' removed from the is_excused array.
--   2. New is_absent flag carrying that one value.
--   3. status CASE gains  WHEN is_absent THEN 'Absent - Unexplained'.
--   4. bucket CASE gains  WHEN is_absent THEN 'absent'  placed BEFORE the
--      late_minutes = 0 test. Without that ordering an absence (which carries
--      0 late minutes) would be bucketed 'on_time' and counted as punctual --
--      the exact inversion this migration exists to fix.
--   5. WHERE gains  OR is_absent. These rows have no entry_time, so without it
--      they would DISAPPEAR from the view instead of moving bucket, and the
--      row total would drop by 29.
--
-- The gaf_filed expression is untouched and still names both documentation
-- strings ('Form Submitted', 'Attendance Form') on one line -- test L6 in
-- tests/filedGafGuard.test.ts reads the newest v_attendance_daily migration
-- and greps that single line.
--
-- Nine output columns, names and order: unchanged.
-- Rollback: re-run 1781993000_v_attendance_daily_accept_attendance_form.sql.

CREATE OR REPLACE VIEW public.v_attendance_daily AS
WITH base AS (
  SELECT
    pe.employee_id,
    e.display_name AS name,
    e.teramind_email AS email,
    LEFT(pe.work_date, 10)::date AS work_date,
    NULLIF(TRIM(pe.entry_time), '') AS entry_time_txt,
    COALESCE(NULLIF(TRIM(pe.event_type_1), ''), '') AS event_type_1,
    GREATEST(0, COALESCE(pe.late_minutes, 0)) AS late_minutes,
    TRIM(COALESCE(pe.documentation, '')) IN ('Form Submitted', 'Attendance Form') AS gaf_filed,
    pe.period_name,
    COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri') AS work_days
  FROM payroll_entries pe
  JOIN employees e ON e.id = pe.employee_id
  LEFT JOIN schedules s ON s.id = e.schedule_id
  WHERE e.active = true
    AND COALESCE(e.excluded_from_payroll, false) = false
    AND pe.deleted_at IS NULL
),
normalized AS (
  SELECT
    b.*,
    CASE
      WHEN b.entry_time_txt IS NULL THEN NULL
      WHEN UPPER(b.entry_time_txt) ~ '^[0-9]{1,2}[AP]M$'
        THEN REGEXP_REPLACE(UPPER(b.entry_time_txt), '^([0-9]{1,2})([AP]M)$', '\1:00 \2')
      ELSE UPPER(b.entry_time_txt)
    END AS entry_time_norm
  FROM base b
),
parsed AS (
  SELECT
    n.*,
    CASE
      WHEN n.entry_time_norm IS NULL THEN NULL::time
      ELSE to_timestamp(n.entry_time_norm, 'HH12:MI AM')::time
    END AS entry_t,
    n.event_type_1 = ANY(ARRAY[
      'PTO','Feriado','Compensatory Day','Birthday Day Off',
      'Ausencia Justificada.'
    ]) AS is_excused,
    n.event_type_1 = 'Ausencia Injustificada' AS is_absent,
    n.event_type_1 = ANY(ARRAY[
      'Permiso Remunerado','Permiso No remunerado','Permission','Time Off'
    ]) AS is_permission
  FROM normalized n
)
SELECT DISTINCT ON (employee_id, work_date)
  email,
  name,
  work_date AS date,
  -- No DST offset: stored times are already US Eastern wall-clock
  TO_CHAR(entry_t, 'HH24:MI') AS entry_time,
  CASE
    WHEN is_excused    THEN 'Excused (PTO/FH/Perm)'
    WHEN is_absent     THEN 'Absent - Unexplained'
    WHEN is_permission THEN 'Permission'
    WHEN late_minutes = 0 THEN 'On Time'
    WHEN gaf_filed THEN 'Late - Reported'
    ELSE 'Late - Unreported'
  END AS status,
  CASE
    WHEN is_excused OR is_permission    THEN NULL
    WHEN is_absent                      THEN 'absent'
    WHEN late_minutes = 0               THEN 'on_time'
    WHEN late_minutes BETWEEN 1 AND 10  THEN 'late_1to10'
    WHEN late_minutes BETWEEN 11 AND 30 THEN 'late_11to30'
    ELSE 'late_830plus'
  END AS bucket,
  gaf_filed AS filed_gaf,
  late_minutes AS minutes_late,
  period_name
FROM parsed
WHERE (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])[EXTRACT(ISODOW FROM work_date)::int]
      = ANY (string_to_array(work_days, ','))
  AND (entry_t IS NOT NULL OR is_excused OR is_permission OR is_absent)
ORDER BY employee_id, work_date, period_name DESC;
```

### Why the status string is `'Absent - Unexplained'`

Do not invent a different one. It was chosen to match the vocabulary already in
the view and on the Reports tab:

- The view's compound statuses use `<Noun> - <Qualifier>` with an **ASCII
  hyphen surrounded by single spaces**: `Late - Reported`, `Late - Unreported`.
  `Absent - Unexplained` is the same shape. Do not use an en-dash or em-dash.
- `Absent` is the third leg of Saul's on time / late / absent split, and it
  reads as its own category next to `Late`.
- `Unexplained` is the word the Reports tab already uses for the same day
  (`unexplained_absence` → "Unexplained Absence"), so one vocabulary covers both
  tabs.
- It leaves room for a future `Absent - Reported` without renaming anything.

---

## Part 2 — `src/app/lib/attendanceStats.ts`

### 2.1 Status constants

Keep `EXCUSED_STATUSES` and `PERMISSION_STATUSES` exactly as they are, and add:

```ts
export const ABSENT_STATUSES = ['Absent - Unexplained'];
```

Keep `isExcluded` unchanged — it must keep meaning "the person was not expected
at work", which an unexplained absence is not. Add next to it:

```ts
/** An unexplained absence: expected at work, no punch, no form. Scored. */
export function isAbsent(status: string) {
  return ABSENT_STATUSES.includes(status);
}
```

Because `isExcluded` does not include the new status, every `active` /
`!isExcluded` filter in this file automatically starts counting absences. That
is intended: `active` now means **days the person was expected to work**.

### 2.2 `EmpStats` — two new fields

Add to the `EmpStats` type and to the object `computeEmployeeStats` returns:

```ts
absent: number;      // unexplained absences
daysWorked: number;  // expected days on which the person actually arrived
```

Keep every existing field name. `days` keeps its name but now means **expected
days** (it grows by the number of absences).

### 2.3 `computeEmployeeStats` — the arithmetic

Inside the `map`, after `const active = empRows.filter(r => !isExcluded(r.status));`:

```ts
const absent  = active.filter(r =>  isAbsent(r.status)).length;
const arrived = active.filter(r => !isAbsent(r.status));   // days with a punch
```

Then:

- `onTime`, `reported`, `unreported`, `excused`, `permission`, `b1to10`,
  `b11to30`, `b31plus` — **leave every one of these exactly as it is.** They
  filter on a specific status or bucket, and an absence matches none of them.
- `days = active.length` — unchanged line, new meaning (expected days).
- `daysWorked = arrived.length`.
- `pctOnTime = days > 0 ? (onTime / days) * 100 : 0` — **unchanged line.** The
  denominator now includes absences, which is the fix: a no-show lowers your
  on-time rate.
- `sumMin` and `avgMinLate` **must change denominator**:

```ts
const sumMin = arrived.reduce((s, r) => s + r.minutes_late, 0);
const avgMinLate = arrived.length > 0 ? sumMin / arrived.length : 0;
```

**Why `avgMinLate` uses `arrived`, not `active`.** "Average minutes late" is
only meaningful for a day the person actually turned up. An absence has no
arrival time. Averaging it in as 0 minutes would make a chronic absentee look
*more* punctual the more days they miss — the exact inversion this whole change
exists to remove. Imputing some penalty (420 minutes, say) would be inventing
data the view does not carry. So absences are excluded from this one metric and
this one only, and the KPI is relabelled to say so. As a bonus this keeps
today's number byte-identical: `arrived` is precisely the set the old `active`
used to be.

### 2.4 `CompanyKpis` and `computeCompanyKpis`

Extend the type with three fields (keep every existing field and its name):

```ts
absent: number;      // unexplained absences
daysWorked: number;  // daysTracked - absent
totalRows: number;   // every row loaded = daysTracked + excused + permission
```

In `computeCompanyKpis`, mirror 2.3 exactly:

```ts
const active  = rows.filter(r => !isExcluded(r.status));
const absent  = active.filter(r =>  isAbsent(r.status)).length;
const arrived = active.filter(r => !isAbsent(r.status));
const sumMin  = arrived.reduce((s, r) => s + r.minutes_late, 0);
const daysTracked = active.length;          // expected days
const daysWorked  = arrived.length;
const avgMinLate  = daysWorked  > 0 ? sumMin / daysWorked : 0;
const onTimeRate  = daysTracked > 0 ? (onTime / daysTracked) * 100 : 0;
const totalRows   = rows.length;
```

Two identities must hold for every input, and the UI depends on both:

```
daysTracked === onTime + lateReported + lateUnreported + absent
totalRows   === daysTracked + excused + permission
```

### 2.5 Colours

Add the new status to `BUCKET_COLORS` and give it a branch in `arrivalColor`:

```ts
const BUCKET_COLORS: Record<string, string> = {
  'On Time':               '#2AA876',
  'late_1to10':            '#FBBF24',
  'late_11to30':           '#D97706',
  'late_830plus':          '#EF4444',
  'Absent - Unexplained':  '#B91C1C',
  'Excused (PTO/FH/Perm)': '#94A3B8',
  'Permission':            '#6366F1',
};
```

In `arrivalColor`, add **before** the `'On Time'` check:

```ts
if (row.status === 'Absent - Unexplained') return BUCKET_COLORS['Absent - Unexplained'];
```

`#B91C1C` is deliberately a darker red than Late-Unreported's `#EF4444` — an
absence is worse than a late arrival and must be distinguishable at a glance.
Use this exact hex everywhere the new status is coloured.

### 2.6 `TrendPoint` and `computeTrends`

Add two counters to `TrendPoint`:

```ts
absent: number;
worked: number;   // tracked - absent; the denominator for avg minutes late
```

Initialise both to `0` in the `groups.set(...)` seed object. Inside the
`rows.forEach`, after `g.tracked++`:

```ts
if (isAbsent(r.status)) g.absent++;
else { g.worked++; g.sumMin += r.minutes_late; }
```

That is: move the existing `g.sumMin += r.minutes_late;` inside the `else`, so
`sumMin` and `worked` stay a matched pair, consistent with 2.3. Do not change
the `isExcluded` early-return at the top of the callback — absences must flow
through and land in `tracked`.

### 2.7 `toISOString` — do not add one

Test L3 in `tests/lessonGuards.test.ts` ratchets this file at exactly **3**
`toISOString()` uses. Do not add or remove any. Dates in this module are
`YYYY-MM-DD` strings compared as strings; never call `new Date(str)` for date
math.

---

## Part 3 — `src/app/pages/attendance/AttendanceKpis.tsx`

The row goes from 7 KPI cards to 8, plus one footnote line that proves the
arithmetic on screen.

1. Change the grid class from `lg:grid-cols-7` to `lg:grid-cols-8`.
2. Wrap the grid in a `<div className="mb-4">`, move `mb-4` off the grid onto
   that wrapper, and put the footnote after the grid (see step 4).
3. The eight cards, in this order, with these exact labels and sub-lines:

| # | label | value | sub | tone / color |
|---|---|---|---|---|
| 1 | `On-Time Rate` | `${kpis.onTimeRate.toFixed(1)}%` | `${kpis.onTime} of ${kpis.daysTracked}` | `lead`, `text-secondary` |
| 2 | `Late — Reported` | `${kpis.lateReported}` | `GAF filed` | `plain` |
| 3 | `Late — Unreported` | `${kpis.lateUnreported}` | `no GAF` | `alert`, `text-destructive` |
| 4 | `Absent` | `${kpis.absent}` | `no punch, no form` | `alert`, `text-[#B91C1C]` |
| 5 | `Excused` | `${kpis.excused}` | `PTO / Holiday — not scored` | `plain` |
| 6 | `Permission` | `${kpis.permission}` | `Approved — not scored` | `plain` |
| 7 | `Avg Min Late` | `${kpis.avgMinLate.toFixed(1)}m` | `per day worked` | `plain` |
| 8 | `Days Expected` | `${kpis.daysTracked}` | `excl. PTO / permission` | `plain` |

Card 7's sub-line changes from `per workday` to `per day worked` and card 8's
label changes from `Days Tracked` to `Days Expected` — both because the meaning
of the denominator changed. Do not leave the old wording in place.

4. Directly under the grid, add this footnote so the two identities from 2.4 are
   visible and any future mismatch is obvious on the page (this is the guard
   against the Reports-tab "461 of 482" bug):

```tsx
<div className="text-[11px] text-muted-foreground mb-4">
  {kpis.daysTracked} expected ={' '}
  {kpis.onTime} on time + {kpis.lateReported + kpis.lateUnreported} late +{' '}
  {kpis.absent} absent · not scored: {kpis.excused} excused +{' '}
  {kpis.permission} permission · {kpis.totalRows} days in range
</div>
```

Do not round, abbreviate or reformat those numbers — they exist to be summed by
eye.

---

## Part 4 — `src/app/pages/attendance/AttendanceDonuts.tsx`

### 4.1 Make every slice carry its own colour

The three donuts currently pass a positional `colors` array while `overviewData`
and `reportingData` are `.filter(d => d.value > 0)`. The moment any series is
zero, the pie colours shift but the legend's hardcoded indices do not — and the
"Late Arrivals — By Window" legend is *already* off by one against its pie.
Adding a sixth series makes this worse, so fix it as part of this change:

- Change `DonutChart`'s `data` prop type to
  `{ name: string; value: number; color: string }[]` and **remove its `colors`
  prop entirely.**
- Inside `DonutChart`, render cells as
  `{data.map((d, i) => <Cell key={i} fill={d.color} />)}` and colour the centre
  value with `data[0]?.color ?? '#2AA876'`.
- Delete the module-level `COLORS_OVERVIEW`, `COLORS_BUCKETS` and
  `COLORS_REPORTING` constants and put the hex on each datum instead.
- Build each `Legend` from the same array the donut was given, so a legend row
  can never disagree with its slice.

### 4.2 Attendance Overview donut

Six series, in this order, each with its colour, then `.filter(d => d.value > 0)`:

| name | value | color |
|---|---|---|
| `On Time` | `kpis.onTime` | `#2AA876` |
| `Late Reported` | `kpis.lateReported` | `#FBBF24` |
| `Late Unreported` | `kpis.lateUnreported` | `#EF4444` |
| `Absent` | `kpis.absent` | `#B91C1C` |
| `Permission` | `kpis.permission` | `#6366F1` |
| `Excused` | `kpis.excused` | `#94A3B8` |

Centre value and label stay `${kpis.onTimeRate.toFixed(0)}%` / `On Time`. The
six slices now sum to `kpis.totalRows`.

### 4.3 Late Arrivals — By Window donut

Unchanged data (`b1to10` / `b11to30` / `b31plus`), but each datum now carries
its own colour: `#FBBF24`, `#D97706`, `#EF4444` respectively. This corrects the
existing legend/slice mismatch. Centre stays `totalLate` / `Total Late`.

### 4.4 Reporting Compliance donut

**Do not add Absent to this donut.** It measures whether a *late arrival* had a
form filed, so its universe is days worked, not days expected. Leave the three
series (`On Time` `#2AA876`, `Reported` `#FBBF24`, `Unreported` `#EF4444`) and
`reportPct` exactly as they are. Change only the card's heading block: add, under
the `Reporting Compliance` title, a muted caption
`<div className="text-[10px] text-muted-foreground mb-2">Days worked only — absences excluded</div>`
so it is clear why this donut's total is smaller than the overview's.

---

## Part 5 — `src/app/pages/attendance/AttendanceTable.tsx`

1. Rename the `Days` header label to `Expected` (keep `col="days"` — the sort
   key is unchanged).
2. Add one new sortable column **after** `Unreported` and before `Avg Min`:
   `<Th label="Absent" col="absent" />`.
3. Add the matching body cell, immediately after the `unreported` cell:

```tsx
<td className="px-3 py-2.5 text-right tabular-nums font-medium" style={{ color: '#B91C1C' }}>{s.absent}</td>
```

4. The empty-state row's `colSpan` goes from `15` to `16`. Do not miss this —
   an off-by-one there silently breaks the "No data" row's alignment.
5. Change the `Avg Min` header label to `Avg Min (worked)`.

Do not add a `daysWorked` column; it is available on `EmpStats` for the panel
but the table is already wide.

---

## Part 6 — `src/app/pages/attendance/AttendancePanel.tsx`

1. `STATUS_COLORS`: add `'Absent - Unexplained': '#B91C1C',` after
   `'Late - Unreported'`. This is what colours the dot in the Recent Activity
   table; without it the dot falls back to `#ccc`.
2. `SCATTER_LEGEND`: add `{ label: 'Absent', color: '#B91C1C' }` after
   `31+ min`.
3. Add, next to `EXCUSED_Y`:

```ts
// Fixed Y for unexplained absences — above the whole working range, so a
// no-show reads as "worse than any late arrival" on the trend line.
const ABSENT_Y = 11 * 60 + 10; // 11:10
```

4. In the `scatterPoints` map, extend the null-arrival fallback so absences get
   plotted instead of vanishing:

```ts
minutesSinceMidnight: p.minutesSinceMidnight ?? (
  p.status === 'Absent - Unexplained' ? ABSENT_Y :
  (p.status === 'Excused (PTO/FH/Perm)' || p.status === 'Permission') ? EXCUSED_Y :
  null
),
```

5. `yTicks`: append `ABSENT_Y` to the array.
6. `<YAxis>`: change `domain` to `[EXCUSED_Y - 5, ABSENT_Y + 5]` and extend
   `tickFormatter` to
   `v => v === EXCUSED_Y ? 'Excused' : v === ABSENT_Y ? 'Absent' : fmtMinutes(v)`.
7. Add a `<ReferenceLine>` at `y={ABSENT_Y}` with `stroke="#B91C1C"`,
   `strokeDasharray="4 3"`, `strokeWidth={1}` and
   `label={{ value: 'Absent', position: 'insideTopRight', fontSize: 9, fill: '#B91C1C' }}`.
8. The paragraph under "Arrival Trend (Day-by-Day)" currently reads
   *"Each dot = one workday. Excused / Permission days are plotted at the top."*
   Replace it with *"Each dot = one workday. Absences are plotted on the top
   line; Excused / Permission days on the line below the chart."*
9. Mini-KPI row: change the grid from `sm:grid-cols-6` to `sm:grid-cols-7` and
   insert, between `Unreported` and `Avg Min`:
   `<MiniKpi label="Absent" value={stats.absent} color="#B91C1C" />`.
   Change the `Days` mini-KPI's label to `Expected`, and the `Avg Min` label to
   `Avg Min (worked)`.
10. `arrivalData`: add `{ name: 'Absent', value: stats.absent, color: '#B91C1C' }`
    after the `31+m` entry. Its total must stay equal to `stats.rows.length`.
11. `reportingData`: add `{ name: 'Absent', value: stats.absent, color: '#B91C1C' }`
    after `Unreported`. Same reason — this donut's centre prints the total and
    must still equal `stats.rows.length`.

Note: this file is already over the 15 KB guidance in `CLAUDE.md`. Keep these
edits minimal and do **not** take the opportunity to split or refactor it.

---

## Part 7 — `src/app/pages/attendance/AttendanceTrends.tsx`

The "Avg Min Late" metric must use `worked`, not `tracked`, or absences dilute
it — the same trap as 2.3.

1. `chartData`:

```ts
const chartData = points.map(p => ({
  label: p.label,
  value: isRate
    ? (p.tracked > 0 ? (p.onTime / p.tracked) * 100 : null)
    : (p.worked  > 0 ? p.sumMin / p.worked        : null),
  n: p.tracked,
  isPartial: p.isPartial,
}));
```

2. In the period table body, apply the same split to both `val` and `prevVal`:
   the rate branch divides by `tracked`, the average branch divides by `worked`
   (returning `null` when that denominator is 0).
3. Rename the `Tracked` table header to `Expected`, and add one column between
   `On Time` and `Rate / Avg`: header `Absent`, body cell
   `<td className="px-4 py-2.5 text-right tabular-nums" style={{ color: '#B91C1C' }}>{p.absent}</td>`.
4. The caption under the chart title currently reads
   *"On-time rate = on-time days ÷ tracked days (excused & permission excluded)."*
   Replace it with *"On-time rate = on-time days ÷ expected days. PTO, holidays
   and approved permission are excluded; unexplained absences count against the
   rate."*
   And replace the average-metric caption *"Average lateness across every
   tracked workday (on-time counted as 0). Lower is better."* with *"Average
   lateness across every day worked (on-time counted as 0; absences excluded —
   there is no arrival time to average). Lower is better."*

---

## Verify after applying

### A. The view

```sql
SELECT status, COUNT(*) FROM v_attendance_daily GROUP BY status ORDER BY 2 DESC;
```

Expected, exactly:

| status | before | after |
|---|---|---|
| `On Time` | 2,394 | **2,394** (unchanged) |
| `Late - Reported` | 656 | **656** (unchanged) |
| `Late - Unreported` | 627 | **627** (unchanged) |
| `Excused (PTO/FH/Perm)` | 343 | **314** |
| `Permission` | 144 | **144** (unchanged) |
| `Absent - Unexplained` | — | **29** (new) |
| **total rows** | **4,164** | **4,164** |

**If the total is not still 4,164, stop.** A total of 4,135 means the
`OR is_absent` was left out of the `WHERE` clause and 29 rows fell out of the
view instead of moving bucket.

**If `On Time` moved at all, stop.** That means the `bucket` / `status` CASE
branches were ordered wrong and absences (0 late minutes) were captured by the
`late_minutes = 0` branch.

Then confirm the excused remainder is only genuine leave:

```sql
SELECT pe.event_type_1, COUNT(*)
FROM v_attendance_daily v
JOIN payroll_entries pe
  ON pe.employee_id = (SELECT id FROM employees WHERE teramind_email = v.email)
 AND LEFT(pe.work_date,10)::date = v.date
WHERE v.status = 'Excused (PTO/FH/Perm)'
GROUP BY 1 ORDER BY 2 DESC;
```

Expected: `PTO` 160, `Ausencia Justificada.` 90, `Feriado` 64 — and **no**
`Ausencia Injustificada` row at all.

And the new bucket:

```sql
SELECT bucket, COUNT(*) FROM v_attendance_daily
WHERE status = 'Absent - Unexplained' GROUP BY 1;
```

Expected: a single row, `absent` = 29. Not `on_time`, not `NULL`.

### B. The page — load it, do not just build it

Open **Attendance → Dashboard** with the date range set wide enough to cover
Jul–Aug 2026 (the 29 absences are concentrated there: 23 in Q2-Jul-2026, 19 in
Q1-Aug-2026 across 14 active employees; those period counts overlap the range,
they do not sum to 29).

Confirm on screen:

1. Eight KPI cards render, with **Absent** showing a non-zero count.
2. The footnote line's arithmetic is literally correct:
   `expected = on time + late + absent`, and
   `expected + excused + permission = days in range`.
3. **Days Expected** is 29 higher than it was, and **On-Time Rate** is
   correspondingly *lower*: over the full history it moves from
   `2394 / 3677 = 65.1%` to `2394 / 3706 = 64.6%`.
4. **Avg Min Late** is unchanged, or moves by less than 0.2m. If it moves more,
   some `Ausencia Injustificada` rows carry a non-zero `minutes_late` — report
   the number rather than assuming a bug.
5. The Attendance Overview donut has a dark-red **Absent** slice and its legend
   colour matches that slice. Check the Late-Arrivals donut too: 1–10 min must
   now be amber, not green.
6. **Employees** tab: the new `Absent` column shows counts, sorts both ways, and
   the "No data" row still spans the full table when you filter to nothing.
7. Open one affected employee's panel. The Recent Activity table shows
   `Absent - Unexplained` with a dark-red dot (**not** grey `#ccc`), the arrival
   scatter plots those days on the top `Absent` line, and both donut centres
   still equal that employee's total row count.
8. **Trends** tab: switch to *Avg Min Late* and confirm the numbers did not drop
   across the board — if every month fell, `sumMin` is being divided by
   `tracked` instead of `worked`.
9. Browser console: no errors, no React key warnings.

### C. Report back

Give me the before/after status counts, the four KPI numbers
(On-Time Rate, Days Expected, Absent, Avg Min Late), and a screenshot of the
dashboard KPI row including the footnote line.

## Acceptance

1. `src/migrations/1781994000_v_attendance_daily_split_unexplained_absence.sql`
   exists with exactly the SQL above, and is applied and present in
   `uib_migrations`.
2. The nine output columns of `v_attendance_daily` have the same names, types
   and order as before.
3. The view's total row count is unchanged at 4,164; `Excused (PTO/FH/Perm)` is
   314; `Absent - Unexplained` is 29; `On Time`, `Late - Reported`,
   `Late - Unreported` and `Permission` are all unchanged.
4. Every `Absent - Unexplained` row has `bucket = 'absent'`.
5. `attendanceStats.ts` exports `ABSENT_STATUSES` and `isAbsent`; `isExcluded`
   still returns true for exactly `Excused (PTO/FH/Perm)` and `Permission`.
6. `CompanyKpis` satisfies both identities from 2.4 on any input.
7. `avgMinLate` — company-wide, per employee, and in trends — is computed over
   days worked, never over expected days.
8. The dashboard renders eight KPI cards plus the footnote, and every number in
   that footnote sums correctly.
9. No status string anywhere resolves to a missing colour: the new status has an
   entry in `BUCKET_COLORS`, in `STATUS_COLORS`, in the scatter legend, in both
   panel donuts and in the overview donut, all using `#B91C1C`.
10. Only the seven files listed at the top changed. `git status --short` shows
    nothing else.
