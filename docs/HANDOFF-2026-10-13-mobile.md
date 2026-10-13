# Handoff 2026-10-13: phone view, stage 1 on /dev (not released)

`main` = see `git log -1`. Tests **810/810**. Design: `superpowers/specs/2026-10-12-mobile-view-design.md`.
Plan: `superpowers/plans/2026-10-12-mobile-view.md`. Prompts: `superpowers/prompts/2026-10-13-mobile/00–06`.
Screenshots: `docs/assets/2026-10-13-mobile-m0/`, `docs/assets/2026-10-13-mobile-m1/`.
Also sent today from another session's branch: `prompts/2026-10-13-activity-polish/10` (Activity row
shows the comparison's figures; Lilian Barría 8:54 AM, 18 / 18).

## On /dev, NOT released (waiting on Saul: the real-phone check, then his go-ahead)

| Prompt | What a phone now gets |
|---|---|
| 00 | The section row has room again (it was 0 px wide) |
| 01 | The "is this a phone?" switch (`phone:` classes, `useIsPhone`), 48 px top bar, nav counts loaded once |
| 02 | Section bar at the bottom (Attendance, Disciplinary, Contracts, PTO, and More → Payroll, Admin for super users); amber View As strip |
| 03 | The white bar is one 44 px line (was 177–257): tabs, or the filters in use, plus a Filters button and sheet |
| 04 | Payroll and Admin keep their computer layout and slide; page headers wrap; ⓘ opens on tap (on a computer too) |
| 05 | Text boxes 16 px on touch screens; employee panel full width (was cut off); toasts and the bulk bar clear the bottom bar |
| 06 | Pop-ups have a margin, fit the screen and scroll inside; PTO, Contracts and Disciplinary scroll as one page |

Exports 02-06 were compared with the prompt applied by script: all 31 files byte-identical.
Exports 00 and 01 changed only the files and lines their prompts named. No do-not-touch file changed. On a computer (1680 px) each page was re-checked after its prompt.

## Before releasing

1. **Real phone, on /dev** (`docs/superpowers/prompts/2026-10-13-mobile/STEP-0-real-phone.md`). The one that
   matters: is the section bar at the bottom fully visible above the browser's own bar, upright and
   sideways? If not, the fix is a small prompt that puts the sections back in the top row on a phone.
2. Only a touch device can show: no zoom when tapping a text box; the keyboard not closing a
   dropdown; pull-down not reloading the page; Save reachable in Record PTO with the keyboard open.
3. Saul's go-ahead for the release itself.

## Checked on /dev (frame narrowed to 375 × 667, and 1680 wide)

- Section bar: 56 px, in normal flow; tapping a section opens it; More lists Payroll and Admin.
- A real manager (View As Arelis Acosta): four sections, no More, no Disciplinary count, strip + Stop.
- Attendance → List reached without opening Filters: period chosen, 43 rows.
- Filters sheet on Activity: switch Dates → Periods inside it (stays open), Done, reopen: still Periods.
- Rules & Config on a phone: slides to the Config Key column and the Edit/Delete buttons.
- Process Payroll is not remounted when the screen size flips (same page element survives).
- Employee panel: x = 0, 375 px wide, 44 px close button. Add PTO Manually: 343 px wide with a
  16 px margin, one column, Cancel and Add reachable (cancelled; nothing saved).
- PTO / Contracts / Disciplinary: the table box is released and `main` scrolls the whole page.

## Known and accepted

- Column headings no longer stay pinned on a phone on PTO, Contracts, Disciplinary (the page scrolls
  as one). Stage 2 replaces those tables with rows.
- On a phone, moving between a manager section and Payroll/Admin rebuilds the filter bar, so
  Attendance's Periods | Dates switch returns to the page's usual choice.
- Attendance → List, Activity and Reports still show wide tables that slide sideways (stage 3).
  Activity's two tables still scroll inside a 70vh box.
- HRK Summary's header buttons stack at the left inside the 1024 px page on a phone.
- Filter controls in the sheet measure 42–44 px tall; the info-mark hit area is 28 px.

## Found on the way, not part of this work

- **Attendance → List shows the wrong range when reached from another page.** Fresh load of
  `/contracts` → Attendance → List: the bar says `Q2-Oct-2026, 10-11 → 10-13` but the cards read
  `526 of 854 Expected` (about 30 days). A direct load of `/attendance/list` reads `62 of 76`.
  Same on the **live** app at desktop width, so it predates today. Flagged as its own task.
- Test `TW10` (prompt 10) matched an unrelated line (`trend.before.avgActiveMin`); anchored with `\b`.

## Lessons for the next prompts

- Small exact edits came back byte-identical on all five prompts compared, even when UIB compacted
  its context mid-prompt (02, 06). Keep comparing each export against the prompt applied by script:
  `scratchpad/agent-integration/apply.mjs <prompt.md> <copy-of-repo>`; it also dry-runs anchors (`--dry`).
- UIB honours `tailwind.config.js` (the 48 px bar proved it), so `phone:` classes are safe.
- Starting View As reloads the app frame: a script that spans it dies with "target navigated".
- Long `wait` batches (100 s) dropped the browser connection once; 40 s batches did not.
- A narrowed `/dev` frame does not switch on `(pointer: coarse)` rules.

## Next

Stage 2 (rows instead of tables): M6 Today, M7 employee panel, then PTO, Contracts, Disciplinary.
Prompts are not written yet; they build on `MobileSheet` and the `phone:` classes that now exist.
