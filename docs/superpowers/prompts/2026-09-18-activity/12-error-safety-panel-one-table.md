# 12 — A failed load must never look like an accusation; the panel gets ONE day table

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`. Never create a
top-level folder named `src`.**

## Files that may change

- `src/app/pages/attendance/activity/useActivityData.ts` — edit 1
- `src/app/pages/attendance/activity/AttendanceActivity.tsx` — edit 1
- `src/app/pages/attendance/AttendancePanel.tsx` — edits 1 and 2
- `src/app/pages/attendance/AttendancePanelBody.tsx` — edit 2 (remove one section)
- `src/app/pages/attendance/AttendancePanelDays.tsx` — edit 2

No other file may be touched. Every file stays under 15 KB.

## Edit 1 — when a loader fails, show the error and NOTHING else (bug, seen 2026-09-18)

While the draft was redeploying, `loadTeramindActivityDays` returned 500. The Activity tab showed
the red error line **and still rendered everything below it**: `0 Days With Work`, `350 Needs A
Look`, and a table listing every employee as `No Records · Short By 6h 30m · No Reports Yet`.
A database hiccup must never read as "nobody worked".

- In `useActivityData.ts`: make `error` true when **any** of the loaders it uses reports an error
  (today it only looks at `errTm || errDays`; capture the third tuple element of every
  `useLoadAction` call and OR them). When `error` is true, return empty `days` / `byEmployee` and
  `totals` with `avgActiveMin: null` and zeros — do not run `buildActivityDays` on partial data.
- In `AttendanceActivity.tsx`: when `error` is true render only the red box with this text:
  "Couldn't Load Activity Data. It Usually Works On Retry." and a **Retry** button that reloads the
  page data (simplest honest way: `window.location.reload()`). Do not render the KPI tiles, the
  Thresholds button, Needs A Look, or either table while `error` is true.
- In `AttendancePanel.tsx`: the panel also calls `useActivityData`. When its `error` is true, the
  activity KPI tiles and the day table are replaced by one muted line "Couldn't Load Activity Data
  For This Range." — never rows of dashes or `No Reports Yet`.

## Edit 2 — "Recent Activity" and "Day By Day" are the same list twice: merge them

The owner's note: the two sections overlap; keep one, mixed sensibly.

- **Remove** the `Recent Activity` section from `AttendancePanelBody.tsx` (the table headed
  Date · Entry · Exit · Status · Min Late, and `recentRows` if nothing else uses it). The KPIs, the
  arrival chart and the donuts stay exactly as they are.
- `AttendancePanelDays.tsx` becomes the single table, titled **Day By Day**, newest first, columns:
  **Date · Entry · Exit · Active · Status · Late · Why · Source**.
  - Date `Wed Sep 17` (`fmtDayShort`); Entry / Exit from `shownFirstMin` / `shownLastMin`
    (`fmtClock`, `—` when null, `+1d` on Exit when `crossesMidnight`); Active via `fmtDuration`.
  - **Status** and **Late** come from the official attendance row for that date when one exists:
    pass `stats.rows` (the `AttendanceRow[]` the removed section used — it has `date`, `status`,
    `minutes_late`) into `AttendancePanelDays` as an optional prop `attendanceRows`, index it by
    `String(date).slice(0, 10)`, and show the same status chip colours the removed table used
    (move `STATUS_COLORS` if needed). No official row for a date → Status `—`, Late `—`.
  - Why: the reason chip plus the amber **Needs A Look** / gray **Long Break** chips (unchanged from
    prompt 08). Source: `SourceBadge` (unchanged). Flagged rows keep their amber background.
- Order inside the panel is now: header → activity KPI tiles → attendance KPIs → arrival chart →
  donuts → **Day By Day**.

## Acceptance (check on /dev)

1. Only the five files changed; all under 15 KB.
2. Open any employee panel: there is no "Recent Activity" heading; Day By Day has the eight columns
   and, for a captured day, shows Status `On Time` / `Late - Reported` etc. and the late minutes.
3. (Cannot be forced from the UI — reason it through in your summary.) With `error` true the
   Activity tab shows only the red box and Retry; no tiles, no Needs A Look, no table.
