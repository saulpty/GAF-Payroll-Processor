Floating holidays become leave records instead of a manual counter. Four actions change to carry `leave_type`.

Files that may be modified: `src/actions/loadPtoBalancesInputs.ts`, `src/actions/loadPtoEmployeeDetail.ts`, `src/actions/upsertPtoApproval.ts`, `src/actions/updatePtoApproval.ts`. No other file may change.

Background: `pto_approvals` now has `leave_type TEXT NOT NULL DEFAULT 'pto'` constrained to `('pto','floating_holiday')`. On Monday, PTO requests have `request_type = 'PTO / Vacation'` and floating holidays have `request_type = 'Floating Holiday'`. Both kinds now flow through the same ledger.

## 1. `loadPtoBalancesInputs.ts`

Three changes to the query; everything else stays byte-identical.

- **`taken_days`** must count PTO only. Add `AND a.leave_type = 'pto'` to its sub-select.
- **`fh_used`** stops coming from `pto_floating_holidays` and becomes derived. Replace the `COALESCE(fh.fh_used, 0) AS fh_used` term with:
  ```sql
  (SELECT count(*) FROM pto_approvals a
    WHERE a.employee_id = e.id AND a.leave_type = 'floating_holiday' AND a.status = 'recorded'
      AND EXTRACT(YEAR FROM a.leave_on) = {{params.year}}) AS fh_used
  ```
  Keep `COALESCE(fh.fh_allocated, 2) AS fh_allocated` and the `LEFT JOIN pto_floating_holidays` exactly as they are — allocation still comes from that table.
- **`pending_count`** must count both kinds of unrecorded Monday request. Change its `r.request_type = 'PTO / Vacation'` to `r.request_type IN ('PTO / Vacation','Floating Holiday')`.

## 2. `loadPtoEmployeeDetail.ts`

- In the **`pending`** aggregate: change `AND r.request_type = 'PTO / Vacation'` to `AND r.request_type IN ('PTO / Vacation','Floating Holiday')`, and add a field to the `json_build_object`:
  `'leave_type', CASE WHEN r.request_type = 'Floating Holiday' THEN 'floating_holiday' ELSE 'pto' END`
- In the **`ledger`** aggregate: add `'leave_type', a.leave_type` to the `json_build_object`.
- Leave the `fh` aggregate exactly as it is (it still supplies `fh_allocated`, `start_date` and `pto_start_date_override` for the eligibility rule).

## 3. `upsertPtoApproval.ts`

Add `leave_type` to the insert column list, to `VALUES` as `{{params.leave_type}}`, and to the `DO UPDATE SET` list as `leave_type = EXCLUDED.leave_type`. Change nothing else — the conflict target and every other column stay as they are.

## 4. `updatePtoApproval.ts`

Add `leave_type = {{params.leave_type}}` to the `SET` list. The `WHERE id = {{params.id}}::bigint` stays.

## Constraints
- `{{params.x}}` is never placed inside a quoted string.
- No Monday board, column or group id anywhere — the request-type strings above are column *values*, not ids, and are already used elsewhere in these files.
- Each file under 15 KB.
- Do not touch any page, `upsertFloatingHoliday.ts`, or anything under `src/components/ui/`.
