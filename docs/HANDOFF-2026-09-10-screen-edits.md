# Handoff — 2026-09-10, screen edits (Contracts, Attendance, Payroll)

Saul's per-screen list, built on `/dev` in eleven prompts and merged to `main`.
**Not released yet** — Saul releases. Spec:
`docs/superpowers/specs/2026-09-10-screen-edits-design.md`. Prompts:
`docs/superpowers/prompts/2026-09-10-screen-edits/`.

## What changed (all verified on `/dev`)

**Contracts**
1. Renewal now comes from the Onboarding board's status column
   (`monday_col_onboarding_renewal` = `color_mktdvagn`, seeded by migration
   `1782001000`): **Passed → green *Renewed*, Failed → red *Not renewed*,
   anything else after the end date → amber *Pending review*.** A future end
   keeps the countdown and adds *renewed* / *not renewed* once decided. Live:
   33 Renewed (all 33 ended rows are Passed on the board), 12 still running.
   The Contracts sync now pulls the column; run it from Admin → Employees →
   Monday after changing a status on the board.
2. The 30d/60d/90d buttons are gone.
3. The ⓘ tooltips actually show now (see Lessons) — on Contracts, PTO and
   Disciplinary alike.
4. The nav badge "N contracts ending within 30 days" already existed; it reads
   nothing today because the earliest end is Dec 8, 2026.

**Attendance**
5. Two tabs, **List · Reports**, List first and default. Dashboard and Trends
   are deleted (pages, nav, filter config, `computeTrends`).
6. Every List header has a ⓘ tooltip.
7. Viewer → Recent Activity dates read `Monday, August 24, 2026`
   (`fmtDayLong`, no Date object).
8. The filter bar's 30/60/90 and From/To are replaced by a **Periods**
   multi-select of processed payroll periods, newest first, defaulting to the
   newest (today `Q2-Aug-2026`). Selecting several widens the window from the
   earliest start to the latest end. `/process` keeps its From/To.

**Payroll**
9. Dashboard removed (page + two actions). Nav order: Payroll Master ·
   Process · Action Required · HRK Summary · Period Log. The app opens on
   Payroll Master.
10. **Action Required** with *All periods* lists everything: 11 RED rows (=
    the RED chip), YELLOW 18, committed 1157, with a Period column. The tab
    badge (29) is RED + YELLOW across all periods; the chips split them.
11. **Payroll Master** with *All periods* loads 4,874 rows over 10 pages of
    500, with a Period column.

## Tests

**247 passing** (245 → 247): D5 `fmtDayLong`, T7 `renewalState`. L3 ratchet
tightened twice (attendanceStats 3 → 1, AttendancePanel removed).

## Still to do

- **Brand:** done — the nav reads *GAF Panama / HR Hub* (prompt 12) and the
  UIB project is renamed *GAF Panama HR Hub* (Settings → Name, saved 17:01;
  export zips are now `GAF Panama HR Hub (N).zip`). **Still open: the logo.**
  UIB's app Settings has an *App icon* field, and the nav logomark is an inline
  SVG in `TopNav.tsx`. Needs the heart logo saved as a file
  (`docs/assets/app-logo.png`); Saul pasted it in chat only.
- Across periods, Payroll Master and Action Required sort by period **name**
  (`ORDER BY period_name DESC` in the actions — alphabetical, so Q2-May sorts
  before Q2-Mar). Fix when it matters: order by `periods.start_date`.
- `Q1-Sep-2026` is not processed yet, so the Attendance picker tops out at
  Q2-Aug-2026 — by design.

## Things that went wrong on the way

- The builder tab had been open across Saul's 11:23 release, so the first
  round "succeeded" and saved nothing (LESSONS: *A builder tab left open
  across a release cannot save*). Reload from their version, re-send.
- UIB's AI stream dropped on nine of eleven rounds. The
  `ubk-message-connection-restore` button re-attaches; re-sending or reloading
  loses work (LESSONS).
- Prompt 07 once wrote `FilterBar.tsx` "with compressed identifiers"; UIB
  caught it itself and rewrote the file before finishing.
