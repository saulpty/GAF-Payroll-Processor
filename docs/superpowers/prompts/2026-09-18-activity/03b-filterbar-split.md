# 03b — FilterBar is 17.3 KB: move the Attendance range controls into their own file

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`. Never create a
top-level folder named `src`.**

## Files that may change

- `src/app/FilterBar.tsx` — shrink only (remove what moves out; render the new component)
- NEW `src/app/components/AttendanceRangeControls.tsx`
- `src/app/components/AttendanceQuickPicks.tsx` — may be merged into the new file and deleted, or
  left as is; your choice

No other file may be touched. **Zero visual or behavioural change** — this is a pure split.

## What moves

Everything prompt 03 added for the Attendance routes: the `Periods | Dates` segmented switch, the
Dates-mode date inputs, the quick picks (`Today · This Week · Last 14 Days · This Period So Far ·
Last Period`) and the helpers that compute those ranges. `AttendanceRangeControls` receives what it
needs as props (or reads the same context hook FilterBar reads — whichever keeps FilterBar smallest)
and FilterBar renders `<AttendanceRangeControls … />` in the exact spot the block is today.

The auto-select effect gated on `attendanceMode === 'periods'` stays wherever it is now (it must
keep the same gate).

## Hard limits

- Every file under 15 KB (aim: FilterBar ≤ 12 KB, the new file ≤ 8 KB).
- Non-attendance routes (`/action-required`, `/payroll-master`, `/hrk-summary`, `/process`) render
  exactly as before.

## Acceptance (check on /dev)

1. `git`-level: only the files listed changed; FilterBar under 15 KB.
2. Attendance → List: switch `Periods | Dates`, quick pick `This Week` sets Sep 14 → Sep 18 (today
   2026-09-18); `Periods` again restores the period multi-select.
3. Action Required and Payroll Master filter bars unchanged.
