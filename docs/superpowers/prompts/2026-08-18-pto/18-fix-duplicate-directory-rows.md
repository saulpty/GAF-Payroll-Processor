Fix a live correctness bug in the Directory sync.

Two files may change, and only these two:
- `src/app/pages/admin/employees/syncDirectory.ts` — the fix itself.
- `src/app/pages/admin/employees/mondaySync.ts` — **only** to request the group id and widen one type, as described in step 1. Nothing else in that file may change; every other board's sync depends on it.

## The rule, from the owner

> "I don't consider an employee active until he is on that Panama Employee Directory board, in the Current Employees group."

So group membership is the authority for `employees.active`. Not the Status column.

## The bug

`syncDirectory` loops over board items and, for each one that resolves to an employee, writes `active`, `role` and `manager`. When two board rows resolve to the *same* employee, both write, and whichever is processed last wins. Whether a person ends up active then depends on the order Monday happens to return rows in.

This is live right now. Johann Morante has two rows on board 8592460836:

| Item id | Group | Status |
|---|---|---|
| `12843769792` | Current Employees | *(blank)* |
| `10605676067` | Past employees | Resigned |

That is the normal shape of a rehire: the old record stays in Past employees, a new one is added to Current Employees. Note his new row has **no Status value**, so the Status column cannot classify him — only the group can.

Measured across all 65 rows on that board on 2026-08-19: the current group holds 44 Active plus that one blank; the past group holds 8 Resigned and 12 Offboarded. Group and Status agree everywhere except that one row.

## The fix

**1. Read the group id from config.** Two keys now exist:
`monday_group_directory_current` (value `topics`) and `monday_group_directory_past`. Add `monday_group_directory_current` to the required-keys list for the Directory card, so a missing or empty value shows the red banner and disables the sync, exactly like the existing keys. Never hardcode a group id.

The pager currently requests `group { title }` only, so the group id is not available yet. In `mondaySync.ts` make exactly two changes and nothing else:

- change `group { title }` to `group { id title }` in **both** the first-page query and the `next_items_page` query;
- widen the `MondayItem` type from `group?: { title: string }` to `group?: { id: string; title: string }`.

Both are additive — every other board's sync keeps working untouched, because they only read `group.title`.

**2. Pick one winning row per employee, instead of letting every row write.** After resolving each item to an `employee_id`, group the resolved items by that id. For each employee with more than one row, choose the winner:

- prefer a row whose `group.id` equals `monday_group_directory_current`;
- if several remain, prefer the one with the **highest** `monday_item_id`, which is the most recently created;
- write only the winner.

For Johann this picks `12843769792`, the Current Employees row.

**3. Derive `active` from the group, not the Status column.**
`const mondayActive = item.group?.id === dk.monday_group_directory_current;`
Delete the `colText(item, dk.monday_col_directory_active) === 'Active'` test. Leave the `monday_col_directory_active` config key in place — other things may read it — but this sync no longer uses it for the active flag.

**4. Report it.** Include the number of employees that had more than one board row in the card's result summary, e.g. `"N updated · M created · K start dates set · 1 duplicate row collapsed · U unmatched"`. Silent de-duplication is how a person quietly ends up in the wrong state; the operator should see it happened.

## Do not change
- The email → alias → name resolution order.
- The add-missing-employees dialog, which must still default to creating nobody.
- The onboarding start-date pass.
- Anything outside `syncDirectory.ts`.

## Acceptance
- `syncDirectory.ts` requires `monday_group_directory_current` and reads it from config.
- No board, column or group id is hardcoded anywhere in the file (tests H4/H5 enforce this).
- An employee with two board rows produces exactly one write, from the Current Employees row.
- `active` is true if and only if the winning row is in the current group.
- The result summary mentions collapsed duplicates when there are any.
- Running the Directory sync twice in a row still reports "0 updated" the second time.
