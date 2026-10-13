# Phone view: plan (2026-10-12, revision 2)

**Status: EXECUTED 2026-10-13.** M0–M5 released; M6–M14 on /dev. See `docs/HANDOFF-2026-10-13-mobile-rows.md`. Design:
`docs/superpowers/specs/2026-10-12-mobile-view-design.md` (revision 2, after the design review).
Evidence: `docs/findings/2026-10-12-mobile-baseline.md`.
Mockup: https://claude.ai/artifact/REqmwzDbgqWauuHu4NCJLN

One prompt = one full change loop (`docs/CHANGE-LOOP.md`). Each prompt file is written and
committed just before it is sent, against the code as it is *that day*. Sizes below are from
2026-10-12. Folder: `docs/superpowers/prompts/<date>-mobile/NN-<slug>.md`.

| Stage | Prompts | What you get | Ships alone |
|---|---|---|---|
| — | **M0** | Sections can be changed on a phone again | yes, any time |
| 0 | none | Facts from a real phone | n/a |
| 1 | **M1a, M1b, M2, M3, M4, M5** | Phone frame, filters, Payroll/Admin slide, pop-ups fit | **release A** |
| 2 | **M6, M7** | Today and the employee panel as rows | **release B** |
| 2 | **M8, M9, M10, M11** | PTO, Contracts, Disciplinary | each page; **release C** |
| 3 | M12, M13, M14 | Attendance List, Activity, Reports | only if asked for |

A loop is about 30–60 minutes. Stage 1 is one long session; stage 2 is about two.

## Before any prompt

- The parallel work from 2026-10-12 is exported, synced and committed; `git status` clean. Then
  `git merge --ff-only` this branch's documents into `main` and push.
- Re-read every file a prompt names before writing that prompt.

## Rules every prompt repeats, word for word

- "Only these files may change: … No other file may be touched. No action file, no migration."
- "Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`."
- "With a mouse on a screen 768 px or wider, nothing may look or behave differently."
- "Every file stays under 15 KB."
- "Never `window.location.reload()` and never `history.pushState` / `replaceState`."
- From M6 on: "Follow the Phone section of `src/DESIGN.md`."

## Checks after every prompt

1. `git status --short`: only the named files.
2. `node --test "tests/*.test.ts"`: all pass (718 on 2026-10-12, plus the new ones).
3. `/dev`, hard refresh, three sizes: **375 × 667**, **667 × 375** (sideways), **1440 wide**.
   The computer screenshot is compared with the one taken before the prompt.
4. Console: no errors on load or after each tap.
5. Commit: what changed, what was checked, the screenshots named.

Phone size without disturbing anyone: in a `/dev` tab of your own, narrow the app's frame
(`iframe.style.width = '375px'; iframe.style.height = '667px'`). Move between pages by clicking
inside the app, not by reloading (a reload resets the size). Touch-only rules
(`pointer: coarse`) do not switch on this way: check those with the browser's device mode or on a
real phone.

---

## M0. Sections reachable again (2 files, ships on its own)

**Edited:** `src/app/TopNav.tsx` (10.1 KB), `src/app/components/RefreshButton.tsx` (1.6 KB).

Below 768 px: hide the "GAF Panama / HR Hub" words (already hidden below 640), the word
"Refresh" (icon stays, `aria-label` unchanged) and the name and role text in the name pill (icon
stays). Nothing else. The section row is already `flex-1 min-w-0 overflow-x-auto`; it was at
0 px only because its neighbours would not shrink.

Keep `<RefreshButton />` directly before `{isViewingAs ? (` (test `RB1`).

**Test first** (`tests/mobileShell.test.ts`): `RB1`–`RB4` still pass; both files under 15 KB.
**Phone:** the six sections (four for a manager) are visible or reachable by sliding the navy
bar; tapping each changes section; the View As pill still shows the person's name and still stops.
**Computer:** identical.

## Step 0. A real phone (no change; needs Saul for 15 minutes)

On the **live** address, signed in, iPhone Safari and Android Chrome if both are used:

| Check | Decides |
|---|---|
| Open Contracts and scroll to the last employee. Is the last row fully visible above the browser's bar, upright and sideways? | Whether the bottom bar is built (M1b) or the sections stay in the top row |
| Is there any UI Bakery bar or menu around the app? | How much room the frame has |
| Pull down at the top of a list. Does the whole page reload? | Confirms `overscroll-behavior` in M4 |
| Tap a text box. Does the page zoom in? | Confirms the 16 px rule in M4 |
| Open the employee panel, press the phone's Back. Where do you land? | What sheets must tolerate; written into LESSONS |
| Leave the tab for a few minutes and come back. Does it reload, and where to? | Known frame behaviour; written down |

Save real-phone "before" screenshots beside the ones in `docs/assets/2026-10-12-mobile-baseline/`.

---

## Stage 1. Everything reachable and touchable

### M1a. The switch and the counts (no visible change except a 48 px top bar on a phone)

**New:** `src/app/lib/useIsPhone.ts`, `src/app/lib/useNavBadges.ts`.
**Edited:** `src/tailwind.config.js`, `src/app/app.tsx` (4.5 KB), `src/app/TopNav.tsx`, `src/AGENTS.md`.

- `useIsPhone.ts`: exports `PHONE_QUERY = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)'`
  and `useIsPhone()`, whose first value comes from `window.matchMedia(PHONE_QUERY).matches` inside
  the `useState` initialiser, with a `change` listener.
- `tailwind.config.js`: under `theme.extend.screens`, `phone: { raw: '<the same string>' }`.
- `useNavBadges.ts`: the three count loaders and the PTO reload effect, moved out of `TopNav`
  unchanged (same actions, same flat parameters, same `viewAs`). Called **once**, in a small
  `Shell` component in `app.tsx`, and passed to `TopNav` as a prop.
- `TopNav.tsx`: takes `badges`; `phone:h-12`. M0's `md:` classes become `phone:` classes.
- `AGENTS.md`: a short "Phone layout" note naming the switch and the two rules (layout by
  `phone`, touch comfort by `pointer: coarse`).

**Tests first:** the string in `tailwind.config.js` equals `PHONE_QUERY`; `useNavBadges.ts` still
passes `viewAs` to the two scoped counts (no new action, so `accessGuards` needs no new entry);
`TopNav.tsx` no longer imports the three count actions; size guard.
**Phone:** top bar is 48 px tall (**this proves UI Bakery honours the Tailwind change**; if it is
still 56, stop and switch to the `data-phone` fallback in the spec). Badges show the same numbers.
**Computer:** identical; the network tab shows three count queries on load, not six.

### M1b. The phone frame

**New:** `src/app/lib/mobileNav.ts`, `src/app/components/mobile/MobileSheet.tsx`,
`src/app/components/mobile/BottomNav.tsx`.
**Edited:** `src/app/app.tsx`, `src/app/TopNav.tsx`.

- `mobileNav.ts`: `mobileNavItems(isSuper)` → `{ bar, more }`, in `SECTIONS` order.
- `MobileSheet.tsx`: built on `Dialog` / `DialogContent` from `@/components/ui/dialog` with
  override classes (bottom-anchored, full width, `max-h` of the frame, inner scroll, 44 px close,
  radius `lg`). Props: `open`, `onClose`, `title`, `size: 'partial' | 'full'`.
- `BottomNav.tsx`: after `<main>` inside `Shell`, phone only. Icon, short name in `color.ink`,
  badges from the prop, More → `MobileSheet`.
- `TopNav.tsx` on a phone: the section row is not rendered; the current section's name is;
  View As becomes the amber strip under the bar.
- **If step 0 said the bottom is unreliable:** skip `BottomNav`; keep M0's sliding row; More is
  not needed. Everything after M1b is unaffected.

**Tests first:** `mobileNavItems(false)` = four items in desktop order, no More;
`mobileNavItems(true)` adds More = payroll, admin; `MobileSheet.tsx` imports `ui/dialog` and that
file is unchanged; size guard; `RB1`–`RB4`.
**Phone:** every section one tap away from every page; manager (View As) sees four buttons, no
More, no Disciplinary badge; super user sees More with both; View As strip always visible; Refresh
works; with a keyboard, Tab stays inside an open sheet and Esc closes it.
**Computer:** identical, no bottom bar.

### M2. Row 2: tabs and the Filters sheet

**New:** `src/app/components/mobile/MobileFilters.tsx`.
**Edited:** `src/app/SectionBar.tsx` (3.9 KB), `src/app/FilterBar.tsx` (**12.9 KB**),
`src/app/components/PeriodMultiSelect.tsx` (4.1 KB), `src/app/components/EmployeeSearchInput.tsx`
(3.7 KB), `src/app/components/AttendanceRangeControls.tsx` (5.6 KB).

- `SectionBar.tsx` on a phone, manager sections: one 44 px line. Left: tabs (sliding, right-edge
  fade), or the active filters as chips when the section has no tabs. Right: `MobileFilters`.
  Payroll and Admin routes on a phone: today's bar, forced onto one sliding line.
- `MobileFilters.tsx`: the Filters button (dot when `hasVisibleFilter` is true) and a
  `MobileSheet` that is **always mounted** and holds `<FilterBar stacked />`, with Done.
- `FilterBar.tsx`: one optional prop, `stacked`: root becomes a column, controls full width.
  Class strings only; every loader and effect stays where it is. If it cannot stay under 15 KB,
  stop: first send a separate no-visible-change prompt that moves the Red/Yellow and
  All/Green/Yellow/Red buttons into `src/app/components/StatusTabs.tsx`.
- `PeriodMultiSelect`: a `inline` prop that renders the list in place instead of floating.
  `EmployeeSearchInput`: no suggestion list on a phone. `AttendanceRangeControls`: full-width
  boxes when stacked.

**Tests first:** `filterRoutes.ts` unchanged; `FilterBar.tsx` under 15 KB; existing
`clearFilters`, `periodPicker`, `attendancePeriods` tests pass.
**Phone:** **open Attendance → List cold, without opening Filters: the current period's rows
show** (proves `FilterBar` is alive while hidden); Reports tab reachable by sliding; choose a Title
→ dot on the button, page filtered, chip visible on PTO; Clear Filters empties; Periods/Dates
switch, period list and date pickers work inside the sheet.
**Computer:** the white bar identical on all twelve routes that have filters.

### M3. Computer-sized Payroll and Admin; headers wrap; ⓘ on tap

**New:** `src/app/components/mobile/DesktopCanvas.tsx`.
**Edited:** `src/app/app.tsx`, `src/app/pages/admin/AdminLayout.tsx` (0.2 KB),
`src/app/components/PageHeader.tsx` (0.7 KB), `src/app/components/InfoTip.tsx` (0.3 KB),
`src/app/components/AccessGate.tsx` (2.0 KB).

- `DesktopCanvas`: on a phone, `h-full min-w-[1024px]` around its children; otherwise just the
  children. Around the five Payroll route elements (inside `RequireSuper`) and around `<Outlet />`.
- `PageHeader`: wraps on a phone. `AccessGate`: side margin.
- `InfoTip`: click or tap toggles a small bubble with the text; closes on a tap elsewhere;
  `title` kept. Works at every width (tablets have no mouse either).

**Phone:** Payroll Master, Action Required, Process, HRK Summary, Period Log and the six Admin
pages look like the computer and slide both ways; Notes reachable on Payroll Master; Edit and
Delete reachable on Rules & Config; the name-matching step of Process shows the unmatched name;
PTO's header buttons sit under the subtitle and the page no longer slides sideways.
**Computer:** identical, except an ⓘ now also opens on click.

### M4. Touch floor 1: text boxes, the panel, floating pieces

**Edited:** `src/index.css` (4.7 KB), `src/app/pages/attendance/AttendancePanel.tsx` (5.2 KB),
`src/app/components/ds/Toast.tsx` (3.6 KB), `src/app/components/ds/BulkBar.tsx` (2.1 KB),
`src/app/components/ds/Combobox.tsx` (8.0 KB).

- `index.css`, inside `@media (pointer: coarse)`: `input, select, textarea { font-size: 16px }`
  (not inside `.desktop-canvas`, so Payroll and Admin do not reflow); a `.tap` helper giving a
  44 px minimum hit area. And `overscroll-behavior: contain` on `main` and on sheets. The Excel
  status colours in this file are not touched.
- `AttendancePanel`: on a phone the width is 100% (the `clamp(520px, …)` applies otherwise).
  Its contents are still the desktop ones until M7; they are now all reachable.
- `Toast` and `BulkBar`: sit above the bottom bar on a phone and inside the screen's edges.
- `Combobox`: the list never passes the right edge and does not close when the keyboard opens.

**Tests first:** `AttendancePanel.tsx` does not apply the 520 px minimum unconditionally; the
status-fill variables in `index.css` are byte-identical before and after.
**Phone:** from Today, tap an employee: the panel's left edge and the full name are visible and
it closes. Toast and BulkBar position: checked in the code and by eye on Action Required with two
rows ticked (the bar appears; commit nothing).
**Real phone only:** tapping a text box no longer zooms.

### M5. Touch floor 2: pop-ups fit, no scroll-inside-scroll

**Edited (class strings only):** `src/app/pages/pto/RecordApprovalDialog.tsx` (**13.5 KB**),
`RecordDialogPayrollPanel.tsx` (4.8 KB), `src/app/pages/disciplinary/CloseCaseDialog.tsx` (3.7 KB),
`DeleteActionDialog.tsx` (3.8 KB), `src/app/pages/attendance/activity/ActivityThresholds.tsx`
(5.5 KB), `src/app/pages/pto/PtoTable.tsx` (10.9 KB), `src/app/pages/contracts/ContractsTable.tsx`
(8.2 KB), `src/app/pages/disciplinary/DisciplinaryTable.tsx` (**13.5 KB**).

- Each dialog's `DialogContent` gets phone classes: side margin, never taller than the frame,
  scrolls inside. Two-column grids become one column on a phone.
- The three tables' `max-h-[calc(100vh-…)]` boxes are released on a phone, so the page scrolls as
  one instead of a small box inside it.

**Phone:** Record PTO, Close Case, Delete and Thresholds each open, scroll, and show their
buttons (**cancel every one; save nothing**). On PTO, Contracts and Disciplinary one finger
scrolls the whole page.
**Real phone only:** with the keyboard open in Record PTO, Save can still be reached.

**→ Release A.** Real-phone check (step 0's list again, plus rotation). After this, every page
and every pop-up is reachable on a phone.

---

## Stage 2. The daily pages as rows

Pattern for every prompt: a new `…Rows.tsx` renders the same data the table already has; the page
renders rows when `useIsPhone()` is true and the table otherwise. No loader is touched. Each list
has loading, nothing-found and error states (spec, "States").

### M6. `MobileRow` + Attendance → Today

**New:** `src/app/components/mobile/MobileRow.tsx`, `src/app/pages/attendance/TodayRows.tsx`.
**Edited:** `src/app/pages/attendance/AttendanceToday.tsx` (**12.0 KB**), `TodayTiles.tsx`
(3.7 KB), `src/DESIGN.md` (the Phone section copied from `docs/DESIGN-SYSTEM.md`).

Header scrolls with the page on a phone; tiles render as one sliding line of counts; rows per
spec. `TodayTable.tsx`'s click-by-position is **not** changed; rows open the panel with the
employee directly.
**Phone (375 × 667):** at least four employees visible without scrolling; the counts equal the
computer's tiles; people needing attention come first; a long name wraps and the pill stays right.

### M7. The employee panel as a sheet

**New:** `src/app/pages/attendance/AttendancePanelDayRows.tsx`.
**Edited:** `AttendancePanel.tsx`, `AttendancePanelBody.tsx` (7.5 KB), `AttendanceDonuts.tsx`
(5.4 KB), `AttendancePanelDays.tsx` (5.8 KB).

On a phone the panel renders inside `MobileSheet` (`full`); charts not rendered; Day by Day as
rows above the seven small numbers.
**Phone:** opened from Today, List and Activity; closes with the button and Esc; the page behind
does not move.

**→ Release B.**

### M8. PTO Tracker

**New:** `src/app/pages/pto/PtoRows.tsx`, `src/app/pages/pto/PtoRequestRows.tsx`.
**Edited:** `PtoTracker.tsx` (3.9 KB), `PtoTable.tsx`, `PtoComingUp.tsx` (7.1 KB).
`PtoVerdictCell` and `PtoPayrollCell` reused unchanged in the super user's sheet.
**Phone:** Available is the one large number, red when negative; a manager's row opens in place
and has no Record / Edit / Withdraw; a super user's row opens a sheet and can start Record
(**cancel**).

### M9. Contracts

**New:** `src/app/pages/contracts/ContractRows.tsx`.
**Edited:** `ContractsTable.tsx`, `ContractsChips.tsx` (2.3 KB).
Row shows `row.next` (already in the data). **Phone:** chips on one sliding line, 44 px tall to
the finger, still filter; order still "soonest first".

### M10. Disciplinary: list and case file

**New:** `src/app/pages/disciplinary/DisciplinaryRows.tsx`, `CaseFileSheet.tsx`.
**Edited:** `Disciplinary.tsx` (6.1 KB), `DisciplinaryTable.tsx` (one conditional).
**Phone:** no scenario text on the list; the file opens as a full sheet; an action opens in place;
same employees and counts as the computer for a manager under View As.

### M11. Disciplinary: one action

**Edited:** `ActionDetail.tsx` (8.7 KB), `EditActionForm.tsx` (8.8 KB), `ActionPdfBar.tsx` (3.7 KB).
Facts stacked; edit form one column; Reopen a real button; Close Case not red.
**Real phone only:** Download PDF saves or opens the file on iPhone and Android.

**→ Release C.** Then by hand: lessons into `docs/LESSONS.md`, the handoff.

---

## Stage 3. On request only

Until asked for, these three pages stay at the release A level (right frame, table slides).

- **M12 List.** New `AttendanceListRows.tsx`, `src/app/lib/attendanceSort.ts` (the table's sort,
  moved to a pure function both layouts use, with a test). Edited `Attendance.tsx`,
  `AttendanceTable.tsx` (the inline `calc(100vh - 220px)` not applied on a phone).
- **M13 Activity.** New `activity/ActivityRows.tsx`. Edited `AttendanceActivity.tsx`,
  `ActivityNeedsLook.tsx`, `ActivityByEmployee.tsx`, `ActivityByDay.tsx` (their `max-h-[70vh]`
  boxes released on a phone).
- **M14 Reports.** New `ReportDaySheet.tsx`. Edited `AttendanceReport.tsx`,
  `AttendanceReportStrips.tsx` (tiles two across). Phone shows the tile view only.

## Order and dependencies

M0 any time. Step 0 before M1b. M1a → M1b → M2 → M3 → M4 → M5 in order. M6 before M7. M8–M11
independent of each other after M7 (M10 before M11). Stage 3 after release B, in any order.

## What would change this plan

- Step 0: bottom of the screen unreliable → no `BottomNav` (M1b shrinks); everything else stands.
- M1a: Tailwind change ignored → the `data-phone` fallback; class names in later prompts change
  from `phone:x` to `group-data-[phone=true]/app:x`, nothing else.
- Managers use tablets → nothing to do: tablets keep the computer layout and get the touch rules.
- Payroll people want Action Required on a phone → a separate design; not covered here.
