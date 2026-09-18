# 06 — AGENTS.md: the Activity feature and the shared auto-sync

**`AGENTS.md` is the file at the project root that you read before every change.**

## Files that may change

- `AGENTS.md` — **append** the block below at the very end of the file (it continues the existing
  "Teramind saved copy" section). Change nothing else in the file.

No other file may be touched.

## Block to append

```md

### Activity feature and auto-sync (added 2026-09-18)

**Settings** (`classification_config`, category `teramind`, never hardcoded):
`activity_min_active_minutes` (390), `activity_break_minutes` (60),
`activity_break_over_minutes` (30). `minActiveMinutes` scales with shift length:
`shiftMinutes * (390/480)`, not a flat number.

**`loadTeramindActivityDays`** (`src/actions/loadTeramindActivityDays.ts`) — one row per employee per
calendar day, viewer-scoped the same way as every other employee-data loader
(`v_employee_access` / `access_viewer({{ user.email }}::text, {{params.viewAs}}::text)`), filtered to
`source = 'time_record'`, active employees, `excluded_from_payroll = FALSE`. Listed in
`SCOPED_ACTIONS` in `tests/accessGuards.test.ts`. Returns **integers only** — `work_date` and
`last_ymd` as `YYYYMMDD`, `first_min`/`last_min` as minutes since midnight Eastern — never
date-looking text, for the same reason as `loadTeramindPunchDays`: the data layer rewrites
date-looking TEXT into ISO timestamps on the way to the browser.

**`src/app/lib/activityDays.ts`** (pure, `import type` only, zero runtime imports) — the rules:
- Every label is **Title Case** ("On Time", "Sick", "No Reports Yet"), matching the rest of the Hub.
- Why chips are a closed list: `PTO`, `Permission` (with hours when the request has them, e.g.
  `Permission 8–12`), `Sick` (any attendance form maps to `Sick`; other form types map to the form
  type in Title Case), `Holiday · <name>`, `WFH`, `Day Off` (only when NOT scheduled but HAS
  activity), a captured-period payroll label translated to English (`Incapacidad`→`Sick`,
  `Permiso`→`Permission`, `Feriado`→`Holiday`, anything else → Title Case), and `No Reports Yet`
  (amber) when nothing explains an empty scheduled day. No "Time for Time" chip, no "pending" state —
  a request that reached Monday is already treated as approved (see the existing "submitted means
  approved" ruling in BACKLOG #11).
- **A form on a day the person worked is context, not an excuse.** If there's activity, the day is
  worked; the form (e.g. a same-day Tardiness note) is shown as the reason, never as a replacement
  for the hours actually logged.
- **Hand-typed punches count as worked**, even with zero Teramind records — a day is not "no data"
  just because Teramind saw nothing, if a human entered times for it.
- **`shownFirstMin`/`shownLastMin`**: once a period is captured, the panel shows the **official**
  entry/exit that payroll actually used, not the raw Teramind punches, whenever they differ. `edited`
  is true when the official time differs from Teramind by ≥ 1 minute.
- Not scheduled and no activity → no row at all (not hired yet / left → no row either).
- Worked on a day off or during PTO → the reason chip AND the hours both show, never a flag.
- Active time = Σ `duration_s` of the day's records, in minutes, cut not rounded. Breaks =
  (last − first) − active. Avg Active = Σ active on days worked ÷ days worked.
- Needs A Look = a scheduled day, before today, with no reason chip, and (no records, or active time
  under the scaled threshold). **Today is never in Needs A Look.**
- Multi-account people: active time is capped at (last − first); `accounts > 1` renders as a small
  mark, never a separate row.

**Activity tab** (`/attendance/activity`, `src/app/pages/attendance/activity/`, each file kept under
12 KB): `AttendanceActivity.tsx` (shell + KPI strip), `ActivityByEmployee.tsx` (expandable rows, day
detail with its own headers), `ActivityByDay.tsx` (flat table + CSV export), `ActivityNeedsLook.tsx`
(worst 10, `Show All` to expand), `WhyChipBadge.tsx`, `SourceBadge.tsx`, `useActivityData.ts`. Same
guard as the rest of Attendance: no file here may import a Teramind HTTP action or `useTeramindPull`
directly — only the viewer-scoped loaders.

**FilterBar**: `attendanceMode` (`'periods' | 'dates'`) lives in the Attendance filter context, driving
a **Periods \| Dates** switch with quick picks (Today, This Week, Last 14 Days, This Period So Far,
Last Period). Default is Periods on List/Reports, Dates on Activity/Today — but this default is only
applied once; switching it on one Attendance route carries to the others until changed again
(BACKLOG #17). The switch and its date inputs live in `src/app/components/AttendanceRangeControls.tsx`,
split out of `src/app/FilterBar.tsx` to keep both under the 15 KB rule.

**Employee panel split**: `AttendancePanel.tsx` (frame) + `AttendancePanelBody.tsx` +
`AttendancePanelDays.tsx` (Day By Day). Opened with an `employeeId` prop from Today, List, or
Activity — every caller must pass it explicitly; a panel opened without one renders an empty Day By
Day (this was a real bug, fixed 2026-09-18, prompt 05b — grep new callers for the prop).

**Shared sync — `sync_every_minutes` / `sync_log` / `claimSyncRun` / `MondayAutoSync`**:
`src/app/components/MondayAutoSync.tsx` replaces the Teramind-only auto-sync from the previous day
and syncs all four Monday boards (Directory, Requests, Attendance forms, Contracts) plus the
Teramind roster daily, on one shared setting `sync_every_minutes` (Rules & Config, default 15). Same
invariants as before, now enforced by two layers:
- `isSuper` check — managers never trigger a sync.
- `document.hidden` check — only runs in a **visible** tab. (Testing this requires overriding the
  property directly on the document, not backgrounding the window — see `docs/LESSONS.md`.)
- Module-level `inFlight` flag — one pull at a time per tab.
- **New this round:** a DB-level claim, `claimSyncRun` — an `INSERT INTO sync_log ... WHERE NOT
  EXISTS (... ran_at > NOW() - interval)` that only succeeds if nobody else claimed the same `kind`
  within the window, so two browser tabs (or two super users) cannot double-run even though each
  tab's own `inFlight` guard only knows about itself.
Silently creates employees found on Monday with no confirmation dialog (a background process cannot
prompt) — see BACKLOG #16 before relying on this for anything sensitive.

**Payroll Master `'__all__'` rule**: the period dropdown on `/payroll-master` gets one extra option,
**All Periods**, which stores the sentinel `'__all__'`. Every other Attendance/Payroll route treats
`'__all__'` as invalid and collapses it back to `''` (see `FilterBar.tsx:107` and
`PayrollMaster.tsx:133,142`) the moment the viewer navigates away from `/payroll-master`, so no other
page can silently inherit "every period, unfiltered." Payroll Master itself now **opens empty**
("Choose A Period") rather than defaulting to all periods.

**Unchanged**: time conversion still lives only in `src/app/lib/teramindTime.ts` — nothing added by
this feature does its own timezone math; every Activity/Today time is US Eastern via `easternDate`/
`easternMinutes` from that file.
```

## Acceptance

1. Only `AGENTS.md` changed, and only by the appended block.
