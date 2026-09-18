# 01b — Attendance → Today: show the "No Reports Yet" chip

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`. Never create a
top-level folder named `src`.**

## Files that may change

- `src/app/pages/attendance/TodayRow.tsx` — the one edit below, nothing else

No other file may be touched.

## The edit

In the Why column, the chip is currently rendered only when `why && why.kind !== 'none'`. Remove
the `why.kind !== 'none'` condition: when `whyFor` returns a chip of kind `none` (label
`No Reports Yet`, tone `amber`) it must be shown like any other chip, using the amber class from
`WHY_CHIP_CLS`. Only `why === null` / `undefined` renders the muted "—".

Nothing else changes: `isOnLeave` still ignores kind `none`, so the Status stays `No Records`.

## Acceptance (check on /dev)

1. Only `TodayRow.tsx` changed.
2. A scheduled person with no records today shows Status `No Records` and Why `No Reports Yet` (amber).
