Build the Approvals tab of the PTO Tracker: pending Monday submissions at the top, the ledger below, and a Record dialog. `pto_approvals` is the ledger; Monday rows are suggestions until Tim records them.

Files that may be created: `src/actions/loadPendingPtoRequests.ts`, `src/actions/loadPtoApprovals.ts`, `src/actions/upsertPtoApproval.ts`, `src/actions/updatePtoApprovalStatus.ts`, `src/app/pages/pto/ApprovalsTab.tsx`, `src/app/pages/pto/RecordApprovalDialog.tsx`.
Files that may be modified: `src/app/pages/PtoTracker.tsx` (render `ApprovalsTab` for `?tab=approvals`).
No other file may change.

## SQL actions (`GAF Planilla DB`)
`loadPendingPtoRequests` (param `manager` optional):
```sql
SELECT r.monday_item_id, r.employee_id, e.display_name, r.employee_name_raw, r.start_date::text AS start_date, r.end_date::text AS end_date, r.return_date::text AS return_date, r.total_days_requested, r.details, r.submitted_at
FROM monday_requests r
LEFT JOIN employees e ON e.id = r.employee_id
LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
WHERE r.request_type = 'PTO / Vacation' AND r.deleted_on_monday = false AND a.id IS NULL
  AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
ORDER BY r.start_date DESC NULLS LAST
```
`loadPtoApprovals` (params `employee_id`, `status`, `manager`, all optional):
```sql
SELECT a.id, a.employee_id, e.display_name, a.leave_on::text AS leave_on, a.return_on::text AS return_on, a.total_days, a.status, a.source, a.gaf_comments, a.monday_item_id, a.recorded_by, a.recorded_at
FROM pto_approvals a JOIN employees e ON e.id = a.employee_id
WHERE ({{params.employee_id}} IS NULL OR a.employee_id = {{params.employee_id}})
  AND ({{params.status}} IS NULL OR {{params.status}} = '' OR a.status = {{params.status}})
  AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
ORDER BY a.leave_on DESC, a.id DESC
```
`upsertPtoApproval`:
```sql
INSERT INTO pto_approvals (id, employee_id, leave_on, return_on, total_days, status, source, gaf_comments, monday_item_id, recorded_by, recorded_at)
VALUES (COALESCE({{params.id}}, nextval(pg_get_serial_sequence('pto_approvals','id'))), {{params.employee_id}}, {{params.leave_on}}::date, {{params.return_on}}::date, {{params.total_days}}, {{params.status}}, {{params.source}}, {{params.gaf_comments}}, {{params.monday_item_id}}, {{params.recorded_by}}, CASE WHEN {{params.status}} = 'recorded' THEN NOW() ELSE NULL END)
ON CONFLICT (id) DO UPDATE SET employee_id = EXCLUDED.employee_id, leave_on = EXCLUDED.leave_on, return_on = EXCLUDED.return_on, total_days = EXCLUDED.total_days, status = EXCLUDED.status, source = EXCLUDED.source, gaf_comments = EXCLUDED.gaf_comments, monday_item_id = EXCLUDED.monday_item_id, recorded_by = EXCLUDED.recorded_by, recorded_at = COALESCE(pto_approvals.recorded_at, EXCLUDED.recorded_at), updated_at = NOW()
```
If `pto_approvals.id` is `GENERATED ALWAYS AS IDENTITY` and the INSERT rejects an explicit id, use `OVERRIDING SYSTEM VALUE` after the column list.
`updatePtoApprovalStatus`: `UPDATE pto_approvals SET status = {{params.status}}, updated_at = NOW() WHERE id = {{params.id}}`.

## pto/ApprovalsTab.tsx
- **Pending from Monday** panel (collapsible, open when count > 0): rows from `loadPendingPtoRequests`. Columns: Employee (display_name, or the raw name in amber with "unmatched — add an alias on Admin → Employees → Monday" if `employee_id` is null), Requested (start–end), Return, Days requested, Details, Submitted, and two buttons: **Record** (opens the dialog prefilled; disabled when unmatched) and **Dismiss** (calls `upsertPtoApproval` with `status='withdrawn'`, `source='monday'`, `total_days = 0`, the request's dates and `monday_item_id`, `gaf_comments = 'Dismissed from pending'`).
- **Ledger** table from `loadPtoApprovals`: filters — employee (from `GlobalFilterContext` employee filter or a local combobox), status chips All / Recorded / Pending / Withdrawn. Columns: Employee · Leave on · Return on · Total days · Status chip · Source chip (Monday / Excel / Manual) · GAF comments · Recorded by/at · actions **Edit** (opens the dialog with the row) and **Withdraw** (`updatePtoApprovalStatus` to `withdrawn`, with confirm). Button **Add manually** opens the dialog empty with `source='manual'`.
- After any save: reload both lists.

## pto/RecordApprovalDialog.tsx
- Props: `open`, `onClose`, `onSaved`, `initial` (partial row: employee_id, leave_on, return_on, total_days, gaf_comments, monday_item_id, source, id).
- Fields: Employee (combobox from `loadAllEmployees`, locked when opened from a Monday row), Leave on (date input, string), Return on (date input), Total days (number, default `defaultTotalDays(leave_on, return_on)` from `src/app/lib/ptoAccrual.ts` whenever either date changes and the field has not been hand-edited; step 0.5), GAF comments (textarea), Recorded by (text, remembers the last value in localStorage). Save calls `upsertPtoApproval` with `status='recorded'`, the given `source`, and `monday_item_id` when present.
- Validation: return_on ≥ leave_on; total_days ≥ 0; employee required.

Acceptance:
- Pending panel count equals `SELECT count(*) FROM monday_requests r LEFT JOIN pto_approvals a ON a.monday_item_id=r.monday_item_id WHERE r.request_type='PTO / Vacation' AND r.deleted_on_monday=false AND a.id IS NULL`.
- Recording one pending request removes it from the panel, adds a `recorded` ledger row with `source='monday'` and its `monday_item_id`, and the employee's Taken on the Balances tab increases by its total days.
- Add manually / Edit / Withdraw round-trip; a withdrawn row no longer counts toward Taken.
- Only the files named above changed.

## Facts confirmed with the owner — build to these
- `pto_approvals` is currently **empty**. The historical ledger is imported by a
  separate migration right after this task. So the ledger table will be empty on
  first load and the Pending panel will hold real Monday requests. Do not add
  demo rows.
- The ledger is the record of what Tim actually decided, not what the employee
  asked for. Employees often take different days than requested, which is
  exactly why Record opens an editable dialog rather than copying the request
  straight in. Keep Total days editable and pre-filled, never read-only.
- Headcount is 45, so expect tens of ledger rows, not thousands.
- Dates are `YYYY-MM-DD` strings. Never construct a `Date` to do date arithmetic
  or to format one for display — slice the string. This codebase has about ten
  migrations that are all successive fixes to the same timezone bug. If a value
  arrives as a timestamp like `2026-02-02T00:00:00.000Z`, display
  `String(v).slice(0, 10)`.

## Hard constraints
- No Monday board or column id in any file. Tests H4/H5 fail the suite if one
  appears.
- Each new component under 15 KB; `PtoTracker.tsx` stays under 8 KB. Split a row
  component out if a tab would exceed that, as BalancesTab already does.
- Use `defaultTotalDays` from `src/app/lib/ptoAccrual.ts` for the pre-filled day
  count. Do not reimplement it.
