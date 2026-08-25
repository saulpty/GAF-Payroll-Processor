# Prompt 33 — Attendance dashboard must honour `schedules.work_days`

Sent to UIB on 2026-08-25. One coherent change: the `v_attendance_daily` view
only.

**Background for the reviewer, not part of the prompt.** `schedules.work_days`
(migration `1781402000`) is honoured by the classification engine but by nothing
downstream. `v_attendance_daily` hard-filters Monday–Friday, so an employee on a
weekend schedule is absent from the entire Attendance dashboard. Three such
schedules exist live (ids 10, 11, 12).

---

## The prompt

Add one new migration that redefines the `v_attendance_daily` view so it filters
on each employee's own working days instead of a hardcoded Monday–Friday test.

**Create exactly one new file:**
`src/migrations/1781900100_v_attendance_daily_honours_work_days.sql`

**Do not modify any other file.** Specifically, do not touch any existing
migration, `src/actions/loadAttendanceDaily.ts`, `src/app/lib/attendanceStats.ts`,
`src/app/pages/attendance/AttendanceTable.tsx`,
`src/app/pages/attendance/AttendancePanel.tsx`,
`src/app/lib/classificationEngine.ts`, or any page component.

### What the migration must contain

A single `CREATE OR REPLACE VIEW public.v_attendance_daily AS …` statement.
Start from the current definition, which is the whole body of
`src/migrations/1781401300_fix_view_remove_dst_display_offset.sql`, and make
only these two changes:

**1. In the `base` CTE**, join the employee's schedule and expose its working
days. Add to the `FROM` clause:

```sql
LEFT JOIN schedules s ON s.id = e.schedule_id
```

and add this one column to the `base` select list:

```sql
COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri') AS work_days
```

The `COALESCE` is required: `schedule_id` may be NULL, and an employee with no
schedule must keep behaving exactly as Monday–Friday.

**2. In the final `WHERE` clause**, replace this line:

```sql
WHERE EXTRACT(isodow FROM work_date) < 6
```

with this:

```sql
WHERE (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])[EXTRACT(ISODOW FROM work_date)::int]
      = ANY (string_to_array(work_days, ','))
```

Leave the rest of that `WHERE` clause — `AND (entry_t IS NOT NULL OR is_excused
OR is_permission)` — exactly as it is.

### Constraints

- **Use the literal array shown above. Do not use `TO_CHAR(work_date, 'Dy')`.**
  `TO_CHAR` day abbreviations depend on the server's `lc_time` setting. The
  literal array is deterministic and matches `DOW_ABBR` in
  `src/app/lib/classificationEngine.ts` exactly, so the view and the engine can
  never disagree about what "Wed" means.
- **The view's output columns must not change** — same nine columns, same names,
  same order: `email`, `name`, `date`, `entry_time`, `status`, `bucket`,
  `filed_gaf`, `minutes_late`, `period_name`. `work_days` is used only inside the
  `WHERE` clause and must **not** appear in the final `SELECT` list.
  `CREATE OR REPLACE VIEW` will error if the column list changes, and
  `attendanceStats.ts` reads these columns by name.
- **Timezone invariant — restated because this view handles dates.** This app
  stores everything in US Eastern wall-clock and performs **no** timezone
  conversion. `work_date` is derived as `LEFT(pe.work_date, 10)::date`, a text
  prefix cast; `EXTRACT(ISODOW …)` on a `date` is timezone-free. Do not
  introduce `AT TIME ZONE`, `NOW()`, `CURRENT_DATE`, `timestamptz`, or any
  offset arithmetic anywhere in this view.
- **Do not touch the time-display logic.** Leave the `normalized` and `parsed`
  CTEs, the `entry_t` parsing, and `TO_CHAR(entry_t, 'HH24:MI') AS entry_time`
  byte-for-byte as they are. Migration `1781401300` exists specifically to remove
  a +1 hour DST offset from that display; reintroducing any offset there is a
  regression.
- Do not change `late_minutes`, `status`, `bucket`, `gaf_filed`, the
  `DISTINCT ON` clause, or the `ORDER BY`.

### Acceptance criteria — observable outcomes

1. An employee whose schedule has `work_days = 'Mon,Tue,Wed,Thu,Fri'` shows the
   **identical** set of rows, tardiness counts and buckets on the Attendance page
   as before this change. This is the most important criterion: 48 of 50
   employees must be completely unaffected.
2. An employee whose schedule includes `Sat` or `Sun` now has Saturday and Sunday
   rows on the Attendance page for days they have a clock-in.
3. That same employee no longer has rows for the weekdays their schedule excludes
   — e.g. an employee on `Wed,Thu,Fri,Sat,Sun` shows no Monday or Tuesday rows.
4. An employee whose `schedule_id` is NULL still shows Monday–Friday rows only.
5. The Attendance page loads with no runtime error, and the view returns the same
   nine columns in the same order.

### Rollback

Re-running `src/migrations/1781401300_fix_view_remove_dst_display_offset.sql`
restores the previous definition exactly.

---

## After UIB reports done — our side

1. Export, `node tools/sync-export.mjs`, and confirm the diff is **one added
   file** and nothing else.
2. `node --test "tests/*.test.ts"` — 87 must still pass.
3. **Load the Attendance page.** Mandatory: this change is read by
   `loadAttendanceDaily`, and step 7 of `CHANGE-LOOP.md` applies. Check criterion
   1 against a known Mon–Fri employee before checking anything else.
4. Criteria 2 and 3 cannot be verified until the four weekend employees are
   assigned to schedules 10/11/12 in Admin → Employees → Roster **and** a period
   is reprocessed. Until then, expect this change to be a no-op in the UI — that
   is the correct outcome, not a failure.
