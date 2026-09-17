# 12b — Attendance → Today: one clock, and no accusation without a reason

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`. Never create a
top-level folder named `src`.**

## Files that may change

- `src/app/pages/attendance/AttendanceToday.tsx` — the three edits below, nothing else

No other file may be touched (in particular not `src/app/lib/teramindToday.ts` — the status *key*
`late_not_in` and `summary.lateNotIn` stay as they are; only what the page *displays* changes).

## 1. "Data As Of" must be on the same clock as everything else

Every time on this page is US Eastern, but "Data As Of" is rendered with
`new Date(newest).toLocaleTimeString(...)`, i.e. in the browser's own timezone (Panama) — so the page
said "Data As Of 4:47 PM" next to a Last Activity of 5:46 PM.

Replace that line with `fmtClock(easternMinutes(new Date(newest).getTime()))` — both functions are
already imported or available from `@/app/lib/teramindToday` and `@/app/lib/teramindTime`. If
`newest` does not parse to a finite number, show "—". No `toLocaleTimeString` may remain in the file.

## 2. Rename the status the page shows

The Hub knows about sick forms, PTO and permissions, but this live view does not read them yet. A
person with no records may be on approved leave, so the page must not call them late.

- Status chip label `Late – Not In` → **`No Records`**, colour amber
  (`bg-amber-100 text-amber-800 border-amber-200`) instead of red.
- Summary tile label `Late – Not In` → **`No Records`**, accent amber instead of red.

## 3. Say what the page does not know

Under the header line add one muted sentence:
"Leave, sick forms and permissions are not shown here yet — 'No Records' does not mean absent
without reason. Check Attendance → Reports for the official record."

## Acceptance (check on /dev)

1. Only `AttendanceToday.tsx` changed.
2. "Data As Of" is within a few minutes of the newest Last Activity on the page.
3. No red "Late – Not In" anywhere; amber "No Records" instead; the new sentence is visible.
