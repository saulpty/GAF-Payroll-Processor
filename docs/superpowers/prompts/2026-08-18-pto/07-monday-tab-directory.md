Add the Monday tab to the Employees hub with its first card: Directory sync, re-implemented config-driven. This replaces what `AdminEmployeeSync.tsx` does today, but that file must not be modified — it stays live until a later step deletes it.

Files that may be created: `src/app/pages/admin/employees/MondayTab.tsx`, `src/app/pages/admin/employees/MondaySyncCard.tsx`, `src/actions/upsertMondaySyncLog.ts`, `src/actions/loadMondaySyncLog.ts`.
Files that may be modified: `src/app/pages/admin/AdminEmployeesHub.tsx` (only to import and render `MondayTab` in place of the "Coming next" placeholder for the monday tab).
No other file may change. Do NOT modify `AdminEmployeeSync.tsx`, `loadEmployeeDirectory.ts`, `fetchMondayStartDates.ts`, `pullMondayBoard.ts`, `ProcessPayroll.tsx`, or `classificationEngine.ts`.

## Non-negotiable rules for this change
- Every Monday board ID and column ID is read from `classification_config` via the existing `loadClassificationConfig` action. There is NO fallback value: if a required key is missing or empty, show a red banner naming the key and do not call Monday. Never write a board or column ID literal anywhere in these files.
- Call Monday only through the existing generic action `src/actions/pullMondayBoard.ts`, passing the whole GraphQL query string as `params.query` and an object as `params.variables`. Never put `{{params.…}}` inside a quoted string.
- Dates from Monday are stored as the text Monday returns. No timezone conversion.

## New SQL actions (datasource `GAF Planilla DB`, one per file, `import { action } from '@uibakery/data'` pattern like the other actions)
- `upsertMondaySyncLog`: `INSERT INTO monday_sync_log (board_key, last_synced_at, item_count, matched_count, unmatched_count, last_error) VALUES ({{params.board_key}}, NOW(), {{params.item_count}}, {{params.matched_count}}, {{params.unmatched_count}}, {{params.last_error}}) ON CONFLICT (board_key) DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at, item_count = EXCLUDED.item_count, matched_count = EXCLUDED.matched_count, unmatched_count = EXCLUDED.unmatched_count, last_error = EXCLUDED.last_error`.
- `loadMondaySyncLog`: `SELECT board_key, last_synced_at, item_count, matched_count, unmatched_count, last_error FROM monday_sync_log ORDER BY board_key`.

## MondayTab.tsx
- Loads config (`loadClassificationConfig`), employees (`loadAllEmployees`), aliases (`loadNameAliases`), and the sync log (`loadMondaySyncLog`).
- Exposes internally a helper `pullAllItems(boardId, columnIds)` that pages through the board: first query `{ boards(ids: [<boardId>]) { items_page(limit: 500) { cursor items { id name group { title } column_values(ids: [<columnIds>]) { id text value } } } } }`, then while `cursor` is non-null query `{ next_items_page(limit: 500, cursor: "<cursor>") { cursor items { id name group { title } column_values(ids: [<columnIds>]) { id text value } } } }`. Build the query string in TypeScript and call `pullMondayBoard` with `{ query, variables: {} }`. Concatenate all items.
- Builds a resolver with `buildResolver(employees, aliases, normalizeName)` from `src/app/lib/mondayResolve.ts`, importing `normalizeName` from `@/app/lib/classificationEngine`.
- Renders a 2×2 grid of `MondaySyncCard`s for keys `directory`, `requests`, `attendance_forms`, `contracts`. In this step only the Directory card is wired; the other three cards render with their title and log row but the Sync now button disabled with tooltip "Next step".

## MondaySyncCard.tsx
- Props: `boardKey`, `title`, `onSync` (async, returns `{ items, matched, unmatched }`), `log` (the row from `loadMondaySyncLog` for this key, may be undefined), `onDone` (called after a sync so the parent reloads the log).
- Shows: title, "Last synced" (`last_synced_at` formatted, or "never"), three counters (items / matched / unmatched), `last_error` in red if present, and a **Sync now** button with a spinner while running. On error: show the message under the button; call `upsertMondaySyncLog` with `last_error` = message and the previous counts.

## Directory card behaviour (must equal what Admin → Directory Sync does today)
Reads keys `monday_board_directory`, `monday_col_directory_email`, `monday_col_directory_role`, `monday_col_directory_manager`, `monday_col_directory_active`. Pulls all items. For each item: resolve to an employee (email from the email column → alias → name). Then:
1. Matched employees: update `role` and `manager` from the role/manager columns via `updateEmployeeRoleManager({ id, role, manager })`; update `active` from the active-status column (Active → true, anything else → false) via `updateEmployeeFlag({ id, is_grace_list, is_macbook_swap, excluded_from_payroll, active })` passing the employee's current values for the three flags. Only call these when a value actually changed.
2. Unmatched items whose email column is non-empty and does not exist in `employees`: offer to create them exactly as the current page's "Add missing" flow does — with `upsertEmployee` — but behind a confirmation dialog listing them; default is to skip. (Do not auto-create.)
3. Start dates: read `monday_board_onboarding` and `monday_col_onboarding_start_date`, pull that board with `pullAllItems`, resolve by name/email, and for matched employees whose `employees.start_date` is empty, call `updateEmployeeStartDate({ display_name, start_date })` with the date text (YYYY-MM-DD) exactly as Monday returns it. Never overwrite a non-empty start_date.
Finally call `upsertMondaySyncLog({ board_key: 'directory', item_count, matched_count, unmatched_count, last_error: null })` and `onDone()`.
Show a result summary under the card: "N updated · M created · K start dates set · U unmatched".

Acceptance:
- On `/admin/employees-hub?tab=monday`, pressing Sync now on Directory completes and the card shows counts; `SELECT * FROM monday_sync_log WHERE board_key='directory'` has a fresh `last_synced_at`.
- Running it a second time reports the same item/matched/unmatched counts and "0 updated".
- Roles/managers in `/admin/employees` match what `/admin/directory-sync` produces (compare a few rows).
- Removing the value of `monday_col_directory_role` in Admin → Rules & Config and reloading shows a red banner naming that key and the button is disabled; restoring the value re-enables it.
- Only the files named above changed.

## Verified facts about these boards — do not re-derive them
Read from Monday's API on 2026-08-18 (docs/findings/2026-08-18-monday-column-map.md):
- `monday_board_directory` = 8592460836 is "🌎 Panama Employee Directory". `monday_board_onboarding` = 8661565945 is "🚀 Employee Onboarding". They are different boards; a past migration confused them.
- On the directory board `text_mkzj84w1` is **Manager** and `text_mkzj8b73` is **Manager Email**. Read the manager from config, never by pattern-matching an ID.
- The onboarding start date column is `date_mknz53sh`.
- Some columns are `mirror`/`lookup` type. For those read `column_values[].text`; their `value` JSON is not shaped like a native column.
All of these are already seeded in `classification_config` — read them from there, and do not hardcode any of the IDs quoted above.
