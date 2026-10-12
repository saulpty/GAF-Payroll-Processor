# Three texts still say "15 minutes" — the refresh is now every 5

**Three one-line text edits. Copy them exactly. Change nothing else in either file: no logic, no
class names, no other wording.**

**Only these two files may change:** `src/app/pages/attendance/AttendanceToday.tsx`,
`src/app/pages/attendance/activity/AttendanceActivity.tsx`. No other file may be touched.

Saul (2026-10-12): the background refresh moved from 15 to 5 minutes (migration
`1782016000_sync_every_5_minutes`), so the on-screen wording must match.

## 1. `src/app/pages/attendance/AttendanceToday.tsx` — two edits

**1a.** Replace

```tsx
        <InfoTip text="Teramind data syncs every 15 minutes. The time shown is the latest sync received." />
```

with

```tsx
        <InfoTip text="Teramind data syncs every 5 minutes. The time shown is the latest sync received." />
```

**1b.** Replace

```tsx
          Data as of {dataAsOf} · updates every 15 minutes · times in US Eastern
```

with

```tsx
          Data as of {dataAsOf} · updates every 5 minutes · times in US Eastern
```

Do **not** change the stale-data notice (`nowMin - dataAsOfMin > 25`) or anything else.

## 2. `src/app/pages/attendance/activity/AttendanceActivity.tsx` — one edit

Replace

```tsx
              Data Updates Every 15 Minutes · Times In US Eastern
```

with

```tsx
              Data Updates Every 5 Minutes · Times In US Eastern
```

Do **not** touch `TodayRow.tsx` or `TodayTiles.tsx`: their "in the last 15 minutes" is the
Working / Away rule, not the refresh interval.

## Acceptance — visible facts
1. Attendance → Today, the grey line next to the green **Live** pill reads
   `Data as of <time> · updates every 5 minutes · times in US Eastern`.
2. Attendance → Activity, the footer reads `Data Updates Every 5 Minutes · Times In US Eastern`.

When done, reply with a one-line summary per file.
