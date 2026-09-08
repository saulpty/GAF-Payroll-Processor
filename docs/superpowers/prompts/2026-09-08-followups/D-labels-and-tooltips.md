# Make the Attendance labels say what they mean

Saul's words: *"i dont know what those forms are and who they impact the numbers
actually. also statuses like at risk etc like whats that?"* — and, on the Reports
tab, *"it is also kinda weird on the data labels it shows, it isnt so clear."*

This prompt fixes the words and adds one-line explanations. It changes **no
calculation** — every number on screen must be identical before and after.

## Files you may change

- `src/app/lib/attendanceStats.ts` — the `Time off` grouping only
- `src/app/pages/attendance/AttendanceKpis.tsx`
- `src/app/pages/attendance/AttendanceDonuts.tsx`
- `src/app/pages/attendance/AttendanceTable.tsx`
- `src/app/pages/attendance/AttendanceReport.tsx`
- `src/app/pages/attendance/AttendanceReportStrips.tsx`
- `src/app/pages/attendance/AttendanceReportTable.tsx`

**No other file.** No migration, no action, no `classificationEngine.ts`, no
change to `v_attendance_daily`. The database keeps emitting the status strings it
emits today — this is a presentation layer change.

## 1. "Excused" becomes "Time off"

Once unexplained absences moved out, what remains in that bucket is approved
time away. Call it that. **Only the display label changes** — the underlying
status string from the view stays `Excused (PTO/FH/Perm)` and no SQL is touched.

Everywhere the user sees `Excused`, show **`Time off`**. Its sub-label becomes
**`PTO, holidays, approved`** rather than `PTO / Holiday`.

## 2. Break "Time off" into its real parts — in the legend, not in more cards

The KPI row is already at seven cards. **Do not add more.** The Attendance
Overview donut's legend is a vertical list and is the right place for detail.

Split the single `Time off` legend row into the categories it actually contains,
driven by `event_type_1` on the underlying rows:

| Legend row | `event_type_1` values |
|---|---|
| PTO | `PTO` |
| Holiday | `Feriado` |
| Birthday / comp day | `Birthday Day Off`, `Compensatory Day` |
| Approved absence | `Ausencia Justificada.` |

Rules for this:
- **Omit any category with a count of zero.** Today `Compensatory Day` and
  `Birthday Day Off` are both 0; showing empty rows is noise.
- Keep them visually grouped — same colour family, indented or otherwise
  subordinate to the others, so it reads as a breakdown of one thing rather than
  four new top-level categories.
- The donut segments themselves may stay as one `Time off` slice. The legend
  carries the detail; the ring stays readable.
- If the row data does not carry `event_type_1`, say so and stop rather than
  inventing a source. **Do not add a database column for this** — check what the
  page already loads first.

## 3. Tooltips — one line each, on the label

Add a small info affordance to each KPI card label and to the At Risk badge.
Follow whatever tooltip primitive already exists under `src/components/ui/`; if
there is none, a native `title` attribute is acceptable — **do not add a tooltip
library.**

Exact text, one line each. Say what counts, not how it is implemented:

| Where | Tooltip |
|---|---|
| On-Time Rate | `On-time days divided by the days someone was expected. Time off and approved permissions are not counted either way.` |
| Late — Reported | `Arrived late and filed a GAF Attendance form. Permission and Time Adjustment forms do not count here.` |
| Late — Unreported | `Arrived late with no GAF Attendance form on file.` |
| Absent | `Scheduled to work, no clock-in, and nothing explaining it — no form, no permission, no PTO.` |
| Time off | `Approved days away: PTO, company holidays, birthday and compensatory days, and approved absences. These never affect the score.` |
| Permission | `An approved permission covered the day. Does not affect the score.` |
| Avg Min Late | `Average minutes late across the days someone actually worked.` |
| Days Expected | `Scheduled work days in range, excluding time off and permissions.` |
| At Risk badge | `Based on on-time rate alone: Good is 90% or above, Fair is 75–89%, At Risk is below 75%.` |

## 4. The Reports tab labels

The verdict badges are currently compressed to the point of being code —
`Late / Late Form`, `Absent / Reported ✓`. Replace with plain statements. **The
verdict values themselves do not change**, only how they are rendered:

| Verdict | Badge text |
|---|---|
| `on_time` | `On time` |
| `late_reported_on_time` | `Late — reported ahead` |
| `late_reported_late` | `Late — form sent after shift` |
| `late_no_form` | `Late — no form` |
| `absent_reported_on_time` | `Absent — reported ahead` |
| `absent_reported_late` | `Absent — reported after shift` |
| `unexplained_absence` | `Absent — unexplained` |
| `pto` | `PTO` |
| `permission` | `Permission` |
| `holiday` | `Holiday` |
| `not_processed` | `Payroll not run yet` |

"Reported ahead" is the phrase doing the work: it says the form beat the shift
start, which is the actual company rule.

Apply the same wording to the weekly strip tiles and to the verdict filter chips
so all three read identically. Where a tile is too narrow for the full phrase,
shorten the *tile* (e.g. `Late`, `Absent`) and keep the full phrase in its
tooltip and in the detail line — never invent a third vocabulary.

Add one tooltip on the Reports tab's own summary strip, on `Scheduled days`:
`Days someone was expected to work in this range. Time off, permissions and holidays are excluded.`

### The flag wording

`recordedUnexplainedButFormOnFile` currently implies a payroll error. It is not
one — we established that the engine found the form, raised the day for review,
and an operator deliberately recorded it as unjustified. Change the text to
describe that fact without accusing anything:

`Recorded as an unjustified absence even though a form was filed.`

Keep `formEmailUnrecognised` as it is.

## Constraints

- **No number changes.** Verify by comparing the KPI values before and after on
  the same date range; they must be identical. The identity line under the KPI
  row must still balance.
- Every file stays under 15 KB.
- Keep the existing visual language — no new colours, no new component library,
  no layout rewrite. This is wording plus one legend breakdown.
- Tooltips must be reachable by keyboard, not hover-only, if the existing
  primitive supports it.

## Acceptance

1. No card shows the word `Excused`; the group reads `Time off`.
2. The Time off legend lists only its non-zero categories, visually subordinate.
3. Every KPI label and the At Risk badge carries its one-line explanation.
4. All three Reports surfaces — badge, tile, filter chip — use the same wording.
5. Every number is unchanged and the identity line still balances.
6. Only the seven files above changed.
