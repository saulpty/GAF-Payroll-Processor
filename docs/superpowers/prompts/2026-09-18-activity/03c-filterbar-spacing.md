# 03c — FilterBar: breathing room above and below, especially when it wraps

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

## Files that may change

- `src/app/FilterBar.tsx` — the one edit below, nothing else

No other file may be touched.

## The edit

The outer wrapper is
`<div className="shrink-0 bg-white border-b border-slate-200 px-4 flex items-center gap-3 flex-wrap z-30 min-h-[48px]">`.
Add vertical padding and row gap so the bar has the same air above and below its controls whether it
renders on one row or wraps to two (Dates mode on Attendance): change it to
`… px-4 py-2 flex items-center gap-x-3 gap-y-2 flex-wrap z-30 min-h-[48px]`.

Nothing else changes.

## Acceptance (check on /dev)

1. Only `FilterBar.tsx` changed, and only that className.
2. Attendance → List in Dates mode: the two rows have even spacing above, between and below.
3. Payroll → Action Required: the bar looks the same as before, just not glued to the nav.
