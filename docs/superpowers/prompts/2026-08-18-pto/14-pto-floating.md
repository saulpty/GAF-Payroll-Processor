Build the Floating Holidays tab of the PTO Tracker.

Files that may be created: `src/actions/loadFloatingHolidays.ts`, `src/actions/upsertFloatingHoliday.ts`, `src/app/pages/pto/FloatingHolidaysTab.tsx`.
Files that may be modified: `src/app/pages/PtoTracker.tsx` (render `FloatingHolidaysTab` for `?tab=floating`).
No other file may change.

`loadFloatingHolidays` (params `year`, `manager` optional):
```sql
SELECT e.id AS employee_id, e.display_name, e.role, e.start_date::text AS start_date, pe.pto_start_date_override::text AS pto_start_date_override,
       COALESCE(fh.fh_allocated, 2) AS fh_allocated, COALESCE(fh.fh_used, 0) AS fh_used, fh.notes,
       (SELECT count(*) FROM monday_requests r WHERE r.employee_id = e.id AND r.request_type = 'Floating Holiday' AND r.deleted_on_monday = false AND EXTRACT(YEAR FROM r.start_date) = {{params.year}}) AS fh_requests
FROM employees e
LEFT JOIN pto_employees pe ON pe.employee_id = e.id
LEFT JOIN pto_floating_holidays fh ON fh.employee_id = e.id AND fh.calendar_year = {{params.year}}
WHERE e.active = true AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
ORDER BY e.display_name
```
`upsertFloatingHoliday`:
```sql
INSERT INTO pto_floating_holidays (employee_id, calendar_year, fh_allocated, fh_used, notes)
VALUES ({{params.employee_id}}, {{params.calendar_year}}, {{params.fh_allocated}}, {{params.fh_used}}, {{params.notes}})
ON CONFLICT (employee_id, calendar_year) DO UPDATE SET fh_allocated = EXCLUDED.fh_allocated, fh_used = EXCLUDED.fh_used, notes = EXCLUDED.notes, updated_at = NOW()
```

`FloatingHolidaysTab.tsx`: a Year selector (default the current year); a policy line "2 per calendar year · non-stacking · eligible 90 days after hire". Table: Employee · Title · Start · Eligible date (`fhEligibleDate(start)` from `src/app/lib/ptoAccrual.ts`, using `pto_start_date_override ?? start_date`) · Eligible? (✔ if eligible date ≤ today, else ⏳ "in N days") · Allocated · Used (inline number input, saves via `upsertFloatingHoliday` on blur then reloads) · Remaining (`fhRemaining`) · Requests on Monday this year (`fh_requests`, informational, with a tooltip "requests are not the ledger; Used is what Tim records") · Notes (inline text). Missing start → "—" with a warning. Loading/empty/error/data states.

Acceptance: `/pto?tab=floating` lists active employees; setting Used to 1 for one row persists (`SELECT * FROM pto_floating_holidays WHERE calendar_year = <year>`); Remaining shows 1. Only the files named changed.

## Constraints and confirmed facts
- Use `fhEligibleDate` and `fhRemaining` from `src/app/lib/ptoAccrual.ts`. Do not
  reimplement either; they are covered by tests pinned to the owner's sheet.
- Dates are `YYYY-MM-DD` strings. If a value arrives as a timestamp such as
  `2026-02-02T00:00:00.000Z`, display `String(v).slice(0, 10)`. Never construct
  a `Date` or use locale formatting — this codebase has about ten migrations
  that are all successive fixes to the same timezone bug.
- `pto_floating_holidays` is currently empty, so every row will show the
  COALESCE defaults: allocated 2, used 0, remaining 2. That is correct on first
  load. Do not seed demo rows.
- Headcount is 45 with 44 active, so expect roughly that many rows.
- The five shadcn primitives added in the previous task (dialog, input, label,
  select, textarea) already exist under `src/components/ui/`. Reuse them; do not
  add new dependencies or new primitives for this tab.
- No Monday board or column id anywhere. Tests H4/H5 fail the suite otherwise.
- Keep the file under 15 KB and `PtoTracker.tsx` under 8 KB.
