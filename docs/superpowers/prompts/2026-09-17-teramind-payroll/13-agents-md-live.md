# 13 — AGENTS.md: the keep-fresh sync and the Today board

**`AGENTS.md` is the file at the project root that you read before every change.**

## Files that may change

- `AGENTS.md` — **append** the block below at the very end of the file (it continues the existing
  "Teramind saved copy" section). Change nothing else in the file.

No other file may be touched.

## Block to append

```md

### Live use of the saved copy (added 2026-09-17, later the same day)
- **Keep-fresh sync:** `app/components/TeramindAutoSync.tsx`, mounted in `app.tsx` next to
  `AccessAutoSync`. Pulls *yesterday → today* through `useTeramindPull` with trigger `'auto'`, at most
  every `teramind_sync_every_minutes` (Rules & Config, default 15, minimum 5). It must only ever run
  for a **super user**, in a **visible tab**, **one pull at a time** (`if (!isSuper) return;`,
  `document.hidden`, module-level `inFlight`). Managers never trigger a pull.
  `loadTeramindPullLog` returns only the five newest `auto` rows so they cannot push manual /
  backfill / capture rows (which "already covered" checks read) out of the list.
- **Attendance → Today** (`/attendance/today`, `app/pages/attendance/AttendanceToday.tsx`, logic in
  the pure lib `app/lib/teramindToday.ts`, data from the viewer-scoped `loadTeramindDayPunches`):
  an **unofficial live board** — status, entry, minutes late, last activity, active time — for one
  day. The official attendance record is still what payroll captures.
  - Every time on the page is **US Eastern**; "today" is `easternDate(Date.now())`, "now" is
    `easternMinutes(Date.now())`, both from `teramindTime.ts`. No `toLocaleTimeString`.
  - The page does **not** read sick forms, PTO or permissions yet, so a scheduled person with no
    records is shown as **No Records** (amber), never "late" or "absent". Do not re-introduce an
    accusing label until the page attaches the reason (form / PTO / permission / holiday).
  - It never calls Teramind and never writes anything.
```

## Acceptance

1. Only `AGENTS.md` changed, and only by the appended block.
