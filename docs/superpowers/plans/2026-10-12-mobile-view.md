# Phone view: plan (2026-10-12)

**Status: DRAFT. Nothing executed.** Design: `docs/superpowers/specs/2026-10-12-mobile-view-design.md`.
Evidence: `docs/findings/2026-10-12-mobile-baseline.md`. Mockup: https://claude.ai/artifact/REqmwzDbgqWauuHu4NCJLN

Twelve prompts in two stages, plus a step 0 that changes nothing. One prompt = one full change
loop (`docs/CHANGE-LOOP.md`). Each prompt file is written and committed just before it is sent,
against the code as it is *that day*: the files below may have moved since 2026-10-12.

Folder for the prompts: `docs/superpowers/prompts/<date>-mobile/NN-<slug>.md`.

## Before any prompt

- **Saul reviews the spec and answers its six questions** (or accepts the defaults).
- The parallel work that was running on 2026-10-12 is finished, exported, synced and committed, so
  the baseline is clean. Then `git merge --ff-only` this branch's documents into `main`.
- Re-read every file a prompt names before writing that prompt. Sizes below are from 2026-10-12.

## Rules every prompt repeats, word for word

- "Only these files may change: … No other file may be touched. No action file, no migration."
- "Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`."
- "At 768 px and wider, nothing may look or behave differently."
- "Every file stays under 15 KB."
- "Never `window.location.reload()`: the app lives in a frame and a reload 404s."

## Checks after every prompt

1. `git status --short`: only the named files.
2. `node --test "tests/*.test.ts"`: all pass (baseline 718 on 2026-10-12, plus the new ones).
3. `/dev`, hard refresh, **phone size 375 × 812**: the acceptance list of that prompt, screenshot.
4. `/dev`, **desktop 1440 wide**: same page, screenshot, compared with the "before" taken at the
   start of that prompt. Any difference not listed in the prompt = revert in UIB and re-prompt.
5. Console: no errors on load or after each tap.
6. Commit: what changed, what was checked, both screenshots named.

How to get phone size without disturbing anything: in the `/dev` tab, narrow the app's frame
(`document.querySelector('iframe').style.width = '375px'`), or use the browser tool's phone preset.
Moving between pages without a reload: `history.pushState` + a `popstate` event inside the frame
(a reload resets the width).

---

## Step 0. Look at it on a real phone (no change, 15 minutes, needs Saul)

Open the **live** address on a phone, signed in. Three things to learn, each changes a detail of
prompt M1:

| Question | If yes |
|---|---|
| Does UI Bakery add its own bar or menu around the app on a phone? | The phone frame must fit inside it; measure the room left |
| Is the bottom of the app hidden behind the browser's bar? | Use `h-dvh` instead of `h-screen` on a phone |
| Does tapping a text box zoom the page? | Confirms the 16 px rule (expected: yes) |

Also: save the four "before" screenshots from a real phone next to the ones in
`docs/assets/2026-10-12-mobile-baseline/`.

---

## Stage 1. Everything reachable (3 prompts → release point A)

### M1. The phone frame: bottom section bar, slim top bar

**New:** `src/app/lib/useIsMobile.ts`, `src/app/lib/mobileNav.ts`,
`src/app/components/mobile/BottomNav.tsx`, `src/app/components/mobile/MobileSheet.tsx`.
**Edited:** `src/app/app.tsx` (4.5 KB), `src/app/TopNav.tsx` (10.1 KB),
`src/app/components/RefreshButton.tsx` (1.6 KB), `src/AGENTS.md`.

- `useIsMobile.ts`: `isMobileWidth(w)` and `useIsMobile()` (`matchMedia('(max-width: 767px)')`).
- `mobileNav.ts`: `mobileNavItems(isSuper)` → `{ bar, more }`. Manager: bar = Attendance, PTO,
  Contracts, Disciplinary; more = empty. Super: same bar plus More = Payroll, Admin.
- `BottomNav.tsx`: rendered by `app.tsx` after `<main>`, inside `RefreshBoundary`, only on a phone.
  Section icon, short name, section colour, the three count badges (the count loaders move to a
  small shared hook so `TopNav` and `BottomNav` do not each run them; if that pushes `TopNav` near
  its limit, the hook goes in `src/app/lib/useNavBadges.ts`, a fifth new file to add to the list).
- `TopNav.tsx` on a phone: 48 px tall; the section row is hidden (`hidden md:flex`); the current
  section's name shows instead; the name pill shows only its icon and opens a `MobileSheet` with
  name, role, email; while viewing as someone, an amber strip under the bar with Stop.
- `RefreshButton.tsx`: the word "Refresh" hidden on a phone, 40 px target, `aria-label` unchanged.
- **Keep** `<RefreshButton />` directly before `{isViewingAs ? (` in `TopNav.tsx`: test `RB1`
  matches on that. **Keep** `<div key={refreshVersion}` and `<MondayAutoSync />` directly before
  `<RefreshBoundary>`: test `RB3`.

**Tests first** (`tests/mobileShell.test.ts`): `isMobileWidth(767)` true, `(768)` false;
`mobileNavItems(false)` has four bar items and no More; `mobileNavItems(true)` puts `payroll` and
`admin` under More and nowhere else; `app.tsx` renders `BottomNav` inside `RefreshBoundary`;
`TopNav.tsx` section row carries `hidden md:flex`; every new file under 15 KB; `RB1`–`RB4` still pass.

**Phone acceptance:** a bar of sections at the bottom on every page; tapping each goes to that
section's home; badges show the same numbers as desktop; as a manager (View As) there is no More
and no Payroll/Admin; as a super user More lists both; the amber View As strip shows and Stop
works; Refresh still spins and reloads the data; Process Payroll is not remounted by Refresh.
**Desktop acceptance:** top bar pixel-identical; no bottom bar.

### M2. Tabs and filters on a phone

**New:** `src/app/components/mobile/MobileFilters.tsx`.
**Edited:** `src/app/SectionBar.tsx` (3.9 KB), `src/app/FilterBar.tsx` (**12.9 KB, 2 KB of room**),
`src/app/components/PeriodMultiSelect.tsx` (4.1 KB), `src/app/components/EmployeeSearchInput.tsx`
(3.7 KB), `src/app/components/AttendanceRangeControls.tsx` (5.6 KB).

- `SectionBar.tsx` on a phone: no section name (the top bar has it); the tabs on one scrolling line
  with a right-edge fade; under it `MobileFilters` in place of the inline `FilterBar`. A page with
  no tabs and no filters shows no white bar at all.
- `MobileFilters.tsx`: employee search at full width (when the page has it) + a Filters button
  showing how many filters are in use (reuses `hasVisibleFilter`'s inputs); the button opens a
  `MobileSheet` holding `<FilterBar stacked />`, Clear Filters, Done.
- `FilterBar.tsx`: one new optional prop, `stacked`. When set, the root is a column and each
  control is full width; the employee search is left out (it is already on the search row).
  **Smallest possible edit**: class strings only, no logic moved. If it cannot stay under 15 KB,
  stop and split the status-tab buttons into their own file first, as a separate prompt.
- `PeriodMultiSelect`, `EmployeeSearchInput`: on a phone the drop-down is as wide as its box and
  never runs off the screen. `AttendanceRangeControls`: From / To / Quick each full width when stacked.
- All of these inputs: 16 px text on a phone.

**Tests first** (`tests/mobileFilters.test.ts`): `FilterBar.tsx` under 15 KB and accepts `stacked`;
`SectionBar.tsx` renders `MobileFilters` and still renders `FilterBar` for desktop; `filterRoutes.ts`
unchanged (the rules stay in one place); existing `clearFilters.test.ts`, `periodPicker.test.ts` pass.

**Phone acceptance:** on Today the white area above the page is at most 92 px (was 177); Reports
tab reachable by sliding the tabs; Filters shows "Filters · 1" after choosing a Title and the page
is filtered; Clear Filters empties them; Periods / Dates switch, period picker and date pickers all
work inside the sheet on Attendance → List; Action Required still shows its Red / Yellow switch
with counts inside the sheet. **Desktop:** the white bar identical on all twelve routes with filters.

### M3. Computer-sized Payroll and Admin; shared touch fixes

**New:** `src/app/components/mobile/DesktopCanvas.tsx`.
**Edited:** `src/app/app.tsx`, `src/app/pages/admin/AdminLayout.tsx` (0.2 KB),
`src/app/components/PageHeader.tsx` (0.7 KB), `src/app/components/InfoTip.tsx` (0.3 KB),
`src/app/components/AccessGate.tsx` (2.0 KB), `src/app/components/ds/BulkBar.tsx` (2.1 KB),
`src/app/components/ds/Combobox.tsx` (8.0 KB).

- `DesktopCanvas`: on a phone, wraps its children in `h-full min-w-[1024px]` and shows the one-line
  "Built for a computer. Slide sideways to see everything." note (dismissed for the session).
  On desktop it renders its children and nothing else.
- `app.tsx`: the five Payroll routes' elements go inside `<DesktopCanvas>` (inside `RequireSuper`).
  `AdminLayout.tsx`: `<Outlet />` goes inside it.
- `PageHeader`: wraps on a phone. `InfoTip`: tap shows the text in a bubble; mouse-over kept.
- `AccessGate`: side margin. `BulkBar`: stays inside the screen. `Combobox`: the list never runs
  past the right edge and does not close itself when the phone keyboard opens.

**Tests first** (`tests/mobileCanvas.test.ts`): each of `/process`, `/action-required`,
`/payroll-master`, `/hrk-summary`, `/period-log` is wrapped; `AdminLayout` wraps the outlet;
`DesktopCanvas.tsx` renders only its children when not on a phone. (That no do-not-touch file
changed is proven by the `git status` check in the loop, not by a test.)

**Phone acceptance:** Payroll Master, Action Required, Process, HRK Summary, Period Log and all six
Admin pages look like the computer version and slide in both directions; on Payroll Master you can
reach the Notes column; on Rules & Config you can reach Edit and Delete; an ⓘ shows its text when
tapped; PTO's header buttons sit under the subtitle and the page no longer slides sideways.
**Desktop:** all pages identical; clicking an ⓘ now also shows its bubble (the one intended change).

**→ Release point A.** Real-phone check by Saul. After this, nothing is broken on a phone.

---

## Stage 2. Manager pages as cards (9 prompts)

Every prompt here follows one pattern: a new `…Cards.tsx` file renders the same rows the table
renders, from the same data the table already has; the page shows cards when `useIsMobile()` is
true and the table otherwise. No loader is touched.

### M4. `MobileCard` + Attendance → Today

**New:** `components/mobile/MobileCard.tsx`, `pages/attendance/TodayCards.tsx`.
**Edited:** `pages/attendance/AttendanceToday.tsx` (**12.0 KB**), `TodayTiles.tsx` (3.7 KB).
Cards: name + status pill · Why chip · shift · Entry · Late · Active. Tiles three across. The row
click in `TodayTable.tsx` works by position in the list and is **not** changed; cards call the same
"open panel" with the employee directly.
**Phone:** 43 cards for 43 employees; counts on the tiles equal the desktop tiles; tap opens the panel.

### M5. The employee panel as a full-screen sheet

**New:** `pages/attendance/AttendancePanelDayCards.tsx`.
**Edited:** `AttendancePanel.tsx` (5.2 KB), `AttendancePanelBody.tsx` (7.5 KB),
`AttendanceDonuts.tsx` (5.4 KB), `AttendancePanelDays.tsx` (5.8 KB).
On a phone the panel's width is 100% (the inline `clamp(520px, …)` applies from 768 px up only),
padding 16 px, close button 44 px; the scatter chart and ring charts are not rendered; Day by Day
renders as cards.
**Tests:** the 520 px minimum is not applied unconditionally. **Phone:** opened from Today, List
and Activity; name fully visible; closes with the button; the page behind does not scroll.

**→ Release point B** (the daily "who is in" check works end to end on a phone).

### M6. PTO Tracker

**New:** `pages/pto/PtoCards.tsx`, `pages/pto/PtoRequestCards.tsx`.
**Edited:** `PtoTracker.tsx` (3.9 KB), `PtoTable.tsx` (10.9 KB), `PtoComingUp.tsx` (7.1 KB),
`RecordApprovalDialog.tsx` (**13.5 KB, class strings only**), `RecordDialogPayrollPanel.tsx` (4.8 KB).
Reuses `PtoVerdictCell` and `PtoPayrollCell` unchanged inside the request cards for super users.
**Phone:** Available is the largest number on each card and red when negative; a manager sees no
Record / Edit / Withdraw; a super user can record a pending request with the keyboard open and
still reach Save (**do not save**: cancel, as in the AR plan's "exercise without committing").

### M7. Contracts

**New:** `pages/contracts/ContractCards.tsx`.
**Edited:** `ContractsTable.tsx` (8.2 KB), `ContractsChips.tsx` (2.3 KB).
Card shows `row.next` (the data already has it) as the single "next milestone"; opened card shows
all five via the existing `MilestoneCells` logic and writes out the mouse-over texts.
**Phone:** chips on one sliding line and still filter; order is still "soonest first".

### M8. Disciplinary: list and case file

**New:** `pages/disciplinary/DisciplinaryCards.tsx`, `pages/disciplinary/CaseFileSheet.tsx`.
**Edited:** `Disciplinary.tsx` (6.1 KB), `DisciplinaryTable.tsx` (**13.5 KB, one conditional only**).
**Phone:** the full scenario text is readable; the case file opens as a full-screen sheet; the same
employees and counts as desktop for a manager under View As (scoping untouched: no loader change).

### M9. Disciplinary: reading and acting on one action

**Edited:** `ActionDetail.tsx` (8.7 KB), `EditActionForm.tsx` (8.8 KB), `CloseCaseDialog.tsx`
(3.7 KB), `DeleteActionDialog.tsx` (3.8 KB), `ActionPdfBar.tsx` (3.7 KB).
Facts stacked at full width; edit form one column; Reopen a real button; dialogs scroll.
**Phone:** Download PDF works on a real iPhone and Android (the one thing a narrowed desktop
browser cannot prove); Close Case dialog reachable with the keyboard open (**cancel, do not save**).

### M10. Attendance → List

**New:** `pages/attendance/AttendanceListCards.tsx`.
**Edited:** `pages/Attendance.tsx` (6.5 KB), `AttendanceTable.tsx` (10.8 KB), `AttendanceKpis.tsx` (4.6 KB).
The sort logic moves out of `AttendanceTable.tsx` into a small pure function both layouts use
(`src/app/lib/attendanceSort.ts`, with a test), so cards and table cannot sort differently.
The inline `calc(100vh - 220px)` applies from 768 px up only.

### M11. Attendance → Activity

**New:** `pages/attendance/activity/ActivityCards.tsx`.
**Edited:** `AttendanceActivity.tsx` (7.6 KB), `ActivityNeedsLook.tsx` (5.8 KB),
`ActivityByEmployee.tsx` (9.7 KB), `ActivityByDay.tsx` (6.7 KB), `ActivityThresholds.tsx` (5.5 KB).

### M12. Attendance → Reports

**New:** `pages/attendance/ReportDaySheet.tsx`, `pages/attendance/AttendanceReportCards.tsx`.
**Edited:** `AttendanceReport.tsx` (10.9 KB), `AttendanceReportStrips.tsx` (10.4 KB),
`AttendanceReportTable.tsx` (10.2 KB).

**→ Release point C.** Then, by hand (allowed: `docs/` is hand-written): a "Phone" section in
`docs/DESIGN-SYSTEM.md`, a lesson in `docs/LESSONS.md` for anything that bit, the handoff. One last
small prompt mirrors the Phone section into `src/DESIGN.md` and `src/AGENTS.md`.

---

## Order, size, and what can be dropped

| Stage | Prompts | Rough time (one loop ≈ 30–60 min) | Can ship alone |
|---|---|---|---|
| 0 | none | 15 min with Saul's phone | n/a |
| 1 | M1–M3 | one session | yes: release A |
| 2a | M4–M5 | half a session | yes: release B |
| 2b | M6–M9 | one session | each page on its own |
| 2c | M10–M12 | one session | each page on its own |

M1 → M2 → M3 in that order. M4 before M5. After that, M6–M12 are independent and can be reordered
by what managers ask for first. If time runs out, everything not yet done still works at the
"release A" level: the frame is right and the table slides sideways.

## Things that could change this plan

- Step 0 finds that UI Bakery frames the app differently on a phone → M1's heights change.
- Saul says payroll people do use phones → M3's "computer-sized page" needs a second look for
  Action Required at least.
- Saul prefers a top menu to a bottom bar → `BottomNav` becomes a menu sheet; nothing else moves.
- The parallel work changed `TopNav`, `SectionBar`, `FilterBar` or `app.tsx` → M1/M2 are re-read
  against the new code before their prompts are written (they would be anyway).
