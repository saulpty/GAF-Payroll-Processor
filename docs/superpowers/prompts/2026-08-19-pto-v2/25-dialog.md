Rework the PTO record dialog's layout. Only `src/app/pages/pto/RecordApprovalDialog.tsx` may change. No other file.

Keep its exports exactly as they are (`PendingRequest`, `LedgerRow`, `DialogMode`, and the default component taking `{ mode, onClose, onSaved }`) and keep all three modes working.

## 1. Remove "Recorded by"
Delete the Recorded by `Input`, its `Label`, the `recordedBy` state, the `LS_RECORDED_BY` localStorage read and write, and the `'Recorded by is required.'` validation. On insert (record and manual modes) send `recorded_by: 'app'`. On edit, send the row's existing `recorded_by` unchanged (`mode.row.recorded_by`), so old provenance is preserved.

## 2. Title and context line
`DialogTitle` reads `Record PTO` / `Edit PTO` / `Add PTO manually` by mode. Directly under it, a 12px muted caption: the employee's name, plus `· from Monday request` in record mode.

## 3. The Monday block (record mode only)
Above the form, a read-only card: `rounded-lg bg-slate-50 border border-slate-200 p-3`, with an 11px uppercase tracking-wide muted section label `Requested on Monday`, then in 13px:
`{leave_on} → {return_on} · {total_days} day(s)`
and, if `reason` is present, the reason on the next line in 12px muted.
Dates may come back from Postgres as full timestamps — display `String(v).slice(0, 10)`. Never construct a `Date`.
This block is not rendered in edit or manual mode.

## 4. Section label for the form
An 11px uppercase tracking-wide muted label `Recording` above the leave/return/total/comments fields.

## 5. Day-count note
Under the Total days input, when `mode.kind === 'record'` and `Number(mode.request.total_days) !== Number(totalDays)`, show a 12px muted line:
`Monday request said {mode.request.total_days} day(s); the calendar span is {totalDays}.`
It is informational only and never blocks saving.

## 6. Validation order (unchanged)
1. leave and return both present — `Leave date and return date are required.`
2. `returnOn < leaveOn` (plain string comparison) — `Return date must be on or after the leave date.`
3. total days parses and is > 0 — `Total days must be a positive number.`
4. manual mode has an employee — `Please select an employee.`

## 7. Footer
`Cancel` (outline) then the primary button, labelled `Record approval` / `Save changes` / `Add approval` by mode, showing a `Loader2` spinner while saving.

## Constraints
- File under 15 KB.
- No `new Date(...)` on any date string.
- No Monday board, column or group id anywhere.
- Do not touch any action, any other page file, or anything under `src/components/ui/`.
