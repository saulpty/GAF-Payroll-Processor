Wire the remaining three cards on the Employees hub Monday tab: Requests (Permissions & Requests board), Attendance forms (GAF Attendance board), Contracts (Employee Onboarding board). Each syncs the board into its mirror table.

Files that may be created: `src/actions/upsertMondayRequests.ts`, `src/actions/upsertMondayAttendanceForms.ts`, `src/actions/upsertMondayContracts.ts`, `src/actions/updateMondayRequestsDeleted.ts`, `src/actions/updateMondayAttendanceFormsDeleted.ts`, `src/actions/updateMondayContractsDeleted.ts`, plus these four new modules required by the split described below: `src/app/pages/admin/employees/mondaySync.ts`, `src/app/pages/admin/employees/syncRequests.ts`, `src/app/pages/admin/employees/syncAttendanceForms.ts`, `src/app/pages/admin/employees/syncContracts.ts`, and optionally `src/app/pages/admin/employees/syncDirectory.ts` (see the split section).
Files that may be modified: `src/app/pages/admin/employees/MondayTab.tsx`.
No other file may change. Do NOT modify `ProcessPayroll.tsx` (its own Monday pull stays as is), `pullMondayBoard.ts`, `MondaySyncCard.tsx`, or anything else.

Rules: same as the Directory card — all IDs from `classification_config` with no fallback and a red banner naming any missing key; Monday only via `pullMondayBoard` with the whole query as `params.query`; dates stored as Monday's text; never write an ID literal.

## SQL actions (datasource `GAF Planilla DB`)
Each upsert takes one param `rows` (a JSON string of an array) and does a set-based upsert:

`upsertMondayRequests`:
```sql
INSERT INTO monday_requests (monday_item_id, employee_id, employee_name_raw, employee_email_raw, manager_email_raw, board_group, request_type, permission_type, start_date, end_date, return_date, start_datetime, end_datetime, total_days_requested, hours_approved, reason, details, submitted_at, raw, deleted_on_monday, synced_at)
SELECT (r->>'monday_item_id')::bigint, NULLIF(r->>'employee_id','')::bigint, r->>'employee_name_raw', r->>'employee_email_raw', r->>'manager_email_raw', r->>'board_group', r->>'request_type', r->>'permission_type', NULLIF(r->>'start_date','')::date, NULLIF(r->>'end_date','')::date, NULLIF(r->>'return_date','')::date, r->>'start_datetime', r->>'end_datetime', NULLIF(r->>'total_days_requested','')::numeric, NULLIF(r->>'hours_approved','')::numeric, r->>'reason', r->>'details', r->>'submitted_at', (r->'raw'), false, NOW()
FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
ON CONFLICT (monday_item_id) DO UPDATE SET
  employee_id = EXCLUDED.employee_id, employee_name_raw = EXCLUDED.employee_name_raw, employee_email_raw = EXCLUDED.employee_email_raw, manager_email_raw = EXCLUDED.manager_email_raw, board_group = EXCLUDED.board_group, request_type = EXCLUDED.request_type, permission_type = EXCLUDED.permission_type, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, return_date = EXCLUDED.return_date, start_datetime = EXCLUDED.start_datetime, end_datetime = EXCLUDED.end_datetime, total_days_requested = EXCLUDED.total_days_requested, hours_approved = EXCLUDED.hours_approved, reason = EXCLUDED.reason, details = EXCLUDED.details, submitted_at = EXCLUDED.submitted_at, raw = EXCLUDED.raw, deleted_on_monday = false, synced_at = NOW()
```
`upsertMondayAttendanceForms` — same pattern with columns `monday_item_id, employee_id, employee_name_raw, employee_email_raw, board_group, form_type, reason, details, eta, form_date (date), submitted_at, raw`.
`upsertMondayContracts` — same pattern with columns `monday_item_id, employee_id, employee_name_raw, employee_email_raw, board_group, position, state, manager_raw, start_date (date), contract_end_date (date), raw`.

`updateMondayRequestsDeleted` (param `seen_ids`, JSON string of an array of item ids as strings):
```sql
UPDATE monday_requests SET deleted_on_monday = NOT (monday_item_id IN (SELECT (jsonb_array_elements_text({{params.seen_ids}}::jsonb))::bigint))
```
`updateMondayAttendanceFormsDeleted` and `updateMondayContractsDeleted` — identical for their tables.

## MondayTab.tsx — the three cards
Common: pull all items with the tab's `pullAllItems(boardId, columnIds)`, resolve each with the resolver (email column → alias → item name), map to the row objects below, upsert in batches of 100 (`JSON.stringify(batch)` as `rows`), then call the table's `…Deleted` action with all seen ids, then `upsertMondaySyncLog` for the board and `onDone()`. Column values: use `text` for everything except date-range and date columns, where you parse `value` (JSON) — date range: `{ from, to }`; date: `{ date }` — and store the `YYYY-MM-DD` text as returned, no conversion. Numbers: `Number(text)` or empty.

**Requests card** — keys `monday_board_permissions`, `monday_col_requests_email`, `monday_col_requests_manager_email`, `monday_col_requests_request_type`, `monday_col_requests_permission_type`, `monday_col_requests_date_range`, `monday_col_requests_return_date`, `monday_col_requests_start_datetime`, `monday_col_requests_end_datetime`, `monday_col_requests_total_days`, `monday_col_requests_hours_approved`, `monday_col_requests_reason`, `monday_col_requests_details`, `monday_col_requests_submitted`. Row: `monday_item_id = item.id`, `employee_name_raw = item.name`, `employee_email_raw = <email col text>`, `board_group = item.group.title`, `request_type`, `permission_type`, `start_date/end_date` from the range, `return_date`, `start_datetime/end_datetime` (text as-is), `total_days_requested`, `hours_approved`, `reason`, `details`, `submitted_at`, `raw = item`.

**Attendance forms card** — keys `monday_board_attendance`, `monday_col_attendance_email`, `monday_col_attendance_date`, `monday_col_attendance_type`, `monday_col_attendance_reason`, `monday_col_attendance_details`, `monday_col_attendance_eta`. Row: `form_type` = type text, `reason`, `details`, `eta`, `form_date` from the date column, `submitted_at` = the date column's raw text if it carries a time, `raw = item`.

**Contracts card** — keys `monday_board_onboarding`, `monday_col_onboarding_position`, `monday_col_onboarding_state`, `monday_col_onboarding_manager`, `monday_col_onboarding_start_date`, `monday_col_onboarding_contract_end`. Row: `position`, `state`, `manager_raw`, `start_date`, `contract_end_date`, `raw = item`. Resolve by item name (this board has no email column) via alias → name.

Acceptance:
- Sync now on each card completes; `SELECT count(*) FROM monday_requests` equals the card's item count; same for the other two tables.
- Syncing again changes no counts and `SELECT count(*) FROM monday_requests WHERE synced_at > now() - interval '5 minutes'` equals the item count (every row refreshed).
- `SELECT count(*) FROM monday_requests WHERE employee_id IS NULL` equals the card's unmatched count.
- Only the files named above changed.

## REQUIRED: split, do not grow MondayTab.tsx

`MondayTab.tsx` is already 18.9 KB. This project has six files that grew past
30 KB and became unsafe to edit; that is the single biggest known cause of
"I asked for one thing and something else broke" here. Adding three more sync
routines inline would start a seventh. So this task must **shrink** MondayTab
while adding functionality:

1. Move the shared plumbing into a new non-component module
   `src/app/pages/admin/employees/mondaySync.ts`: the `pullAllItems` pager, the
   `MondayItem` type, the `colText(item, colId)` helper, the batching helper,
   and a `requireKeys(config, keys)` helper returning the resolved map or the
   list of missing keys. Export them. `MondayTab.tsx` imports from here instead
   of defining them.
2. Put each board's sync in its own module, one exported async function each:
   - `syncRequests.ts` → `syncRequests(deps): Promise<{items:number; matched:number; unmatched:number}>`
   - `syncAttendanceForms.ts` → `syncAttendanceForms(deps)`
   - `syncContracts.ts` → `syncContracts(deps)`
   `deps` is one object carrying what they need: `{ cfg, pull, resolve, upsert, markDeleted, log }`. No React, no JSX, no hooks in these three files — they are plain async functions so they stay testable and small.
3. Leave the existing Directory sync working exactly as it is. You may move its
   body into `syncDirectory.ts` following the same shape if that helps MondayTab
   shrink, and if you do, that file is also allowed — but its behaviour must not
   change and the Directory card must still work identically.

Hard requirement: when you are done, `MondayTab.tsx` must be **smaller than it
is now**, and no new file may exceed 15 KB. State the resulting byte size of
every file you touched.

## Verified board facts — use these, do not re-derive
From Monday's API on 2026-08-18 (`docs/findings/2026-08-18-monday-column-map.md`).
All of these are already in `classification_config`; read them from there and
never hardcode them:
- Requests board `monday_board_permissions`; its columns are the
  `monday_col_requests_*` keys.
- Attendance board `monday_board_attendance`; `monday_col_attendance_*` keys.
- Contracts board `monday_board_onboarding`; `monday_col_onboarding_*` keys.
- The Requests board has **two** columns titled "Total Days Requested". The
  config key `monday_col_requests_total_days` points at the populated one. Use
  the key; do not search by title.
- The Attendance board has **three** columns titled "Name". Only the item's own
  `name` field is the employee's typed name. Do not match columns by title.
- Several columns are `mirror`/`lookup` type (`lookup_*`): read
  `column_values[].text`. Their `value` JSON is not shaped like a native column.
- The Contracts board has no employee email column, so resolve those rows by
  item name through the resolver (alias → normalized name).
