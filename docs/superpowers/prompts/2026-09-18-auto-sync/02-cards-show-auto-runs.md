# 02 — The four Monday cards must show the automatic runs too

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

## Files that may change

- `src/app/components/MondayAutoSync.tsx` — the one addition below

No other file may be touched.

## What is wrong

After the automatic sync runs, the Monday tab says "Last Run Sep 18, 2026, 12:02 PM" but the four
cards (Employee Directory, Permissions & Requests, Attendance Forms, Contracts) still show
"Sep 14, 2026, 11:13 AM", because the cards read `monday_sync_log` (written only by the manual
`MondaySyncCard` path via `upsertMondaySyncLog`), while the auto run writes only `sync_log`.

## The addition

In `MondayAutoSync.tsx`, after each board's sync succeeds (no error), also call the existing
action `upsertMondaySyncLog` (`@/actions/upsertMondaySyncLog`, params flat:
`board_key`, `item_count`, `matched_count`, `unmatched_count`, `last_error`) with the same values
`MondaySyncCard.tsx` writes for that board (`board_key` is `directory` / `requests` /
`attendance_forms` / `contracts`; counts from the sync result: `items`, `matched`, `unmatched`;
`last_error` `''`). On a failed board, write `last_error` with the message and keep the counts at 0.
Keep `sync_log` writes exactly as they are. Best-effort: wrap in try/catch, `console.warn` on failure.

If the file would exceed 15 KB (it is 12 KB), move the "record outcome" block into a small helper
in the same file rather than adding a new file.

## Acceptance (check on /dev)

1. Only `MondayAutoSync.tsx` changed; under 15 KB.
2. After the next automatic run, all four cards show today's time and the status line's Last Run
   matches within a minute.
