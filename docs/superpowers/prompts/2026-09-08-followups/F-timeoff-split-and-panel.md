# Split "Time off" into its real categories, and finish the rename

Two loose ends from prompt D, plus the Reporting column.

## Files you may change

Create:
- `src/migrations/1781995000_v_attendance_daily_add_time_off_kind.sql`

Modify:
- `src/app/pages/attendance/AttendanceDonuts.tsx`
- `src/app/pages/attendance/AttendancePanel.tsx`
- `src/app/pages/attendance/AttendanceTable.tsx`
- `src/app/lib/attendanceStats.ts`

**No other file.** No action, no `classificationEngine.ts`, no page outside
`attendance/`.

---

## Part 1 — a tenth column on the view

The Dashboard cannot break "Time off" apart because `v_attendance_daily` does
not expose the event type. Add **one column at the end** — Postgres allows
`CREATE OR REPLACE VIEW` to append columns, but **not** to rename, reorder or
remove existing ones, so the nine current columns must stay exactly as they are,
in order, and the new one goes last.

The migration is the current view
(`1781994000_v_attendance_daily_split_unexplained_absence.sql`) with **one added
output column** and nothing else changed:

```sql
  CASE
    WHEN event_type_1 = 'PTO'               THEN 'pto'
    WHEN event_type_1 = 'Feriado'           THEN 'holiday'
    WHEN event_type_1 = 'Birthday Day Off'  THEN 'birthday'
    WHEN event_type_1 = 'Compensatory Day'  THEN 'comp_day'
    WHEN event_type_1 = 'Ausencia Justificada.' THEN 'approved_absence'
    ELSE NULL
  END AS time_off_kind
```

Note `'Ausencia Justificada.'` carries a **trailing period** — it is
load-bearing, and `AGENTS.md` says so. Copy it exactly.

`time_off_kind` is `NULL` on every row that is not time off. It says nothing
about whether a day is scored — `status` already decides that, and this column
must not be used for any calculation.

Open the migration with a comment block naming what changed and the rollback
(`1781994000_...`), matching the style of the last two.

### Verify

```sql
SELECT status, time_off_kind, COUNT(*)
FROM v_attendance_daily
GROUP BY status, time_off_kind
ORDER BY status, time_off_kind;
```

Every `Excused (PTO/FH/Perm)` row must carry a non-null `time_off_kind`, and
every other status must have `time_off_kind` null. **Report the total row count
before and after — it must be identical.** Adding a column must not change which
rows the view returns.

## Part 2 — split the legend

In `AttendanceDonuts.tsx`, replace the single `Time off` legend row with its
real categories, from `time_off_kind`:

| Legend row | value |
|---|---|
| PTO | `pto` |
| Holiday | `holiday` |
| Birthday / comp day | `birthday` + `comp_day` combined |
| Approved absence | `approved_absence` |

- **Omit any category whose count is zero.** Today `birthday` and `comp_day` are
  both 0, so that row should not render at all.
- Keep them visually subordinate — same colour family as the old Time off swatch,
  indented or otherwise clearly a breakdown of one thing rather than four new
  peers.
- **The donut ring itself does not change.** One `Time off` slice; the legend
  carries the detail. A six-or-more-slice ring at these proportions is unreadable.
- The `Time off` KPI card and its number stay exactly as they are.

If a category name would be ambiguous on its own, the legend row may carry the
same one-line tooltip style used elsewhere. Do not add a second tooltip system.

## Part 3 — finish the rename

`AttendancePanel.tsx` still shows **`Excused`** in three places — a legend entry,
and two donut datasets. Prompt D renamed it everywhere else, so the same concept
is currently labelled two ways inside one feature.

Change the **display label** to `Time off`. Leave the status string
`'Excused (PTO/FH/Perm)'` alone wherever it is compared or used as a key — that
is the value the database emits and it is not changing.

## Part 4 — the Reporting column

In `AttendanceTable.tsx`, add one column headed **`Reporting`**, immediately
after the existing on-time/status badge column.

It answers: *when this person needed to explain a day, did they file a form?*

- **needed** = days that were late **or** absent — every day requiring an
  explanation. On-time days, time off, permissions and holidays are excluded.
- **filed** = of those, the days with `filed_gaf` true.

Display `filed / needed` with a badge:

| Badge | Rule |
|---|---|
| `Complete` | filed equals needed |
| `Gaps` | some missing, fewer than half |
| `Rarely` | more than half missing |
| `—` (neutral) | needed is 0 |

**The zero case matters.** Someone never late and never absent shows a neutral
dash — not `0/0`, not a red badge. Perfect attendance is not a reporting failure.

Header tooltip, in the established one-line style:

`Of the days that needed an explanation — late or absent — how many had a GAF Attendance form on file.`

Sort by the ratio, with `needed = 0` rows last in **both** directions.

**Do not change the At Risk badge or its thresholds** (Good ≥ 90, Fair ≥ 75).
Punctuality and reporting stay separate measures — that is the point of adding a
column rather than folding it into the badge.

## Constraints

- No existing number changes. The KPI identity line must still balance.
- Every file under 15 KB.
- No new colour palette, no new tooltip mechanism, no layout rewrite.
- If the table gets cramped, shorten the header, not the table.

## Acceptance

1. The migration appends `time_off_kind` and the nine existing columns are
   untouched in name and order; total row count identical.
2. The legend lists only non-zero time-off categories, visually subordinate.
3. The word `Excused` appears nowhere in the UI; the status string still does in
   code.
4. A `Reporting` column exists, and an employee with nothing to report shows a
   neutral dash.
5. At Risk is unchanged.
6. Only the five files above changed.
