# 12c — Attendance → Today: a failed refresh is not an emergency

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

## Files that may change

- `src/app/pages/attendance/AttendanceToday.tsx` — the one edit below, nothing else

No other file may be touched.

## What happened

The board re-loads its data every 60 seconds. One of those refreshes failed once (a momentary
database blip while the draft was being redeployed) and the page showed a red banner:
"Error loading punch data. The teramind_sessions table may not exist yet — apply migrations first."
That is misleading — the table exists and the data on screen was fine — and it is alarming for a
manager.

## The edit

Replace that red banner (the block rendered when `punchError` is truthy) with:

- **When rows are already on screen** (`rows.length > 0`): a small amber, single-line notice —
  "Couldn't refresh just now — showing the last data loaded. It will try again in a minute."
- **When there is nothing to show yet**: a red box — "Couldn't load today's records. It will try
  again in a minute; if this stays, tell an administrator."

Do not mention tables or migrations. Keep showing the tiles and the table whenever there is data.
Nothing else in the file changes — same timers, same loaders, same labels.

## Acceptance

1. Only `AttendanceToday.tsx` changed.
2. The words "migrations" and "teramind_sessions" no longer appear in the file.
