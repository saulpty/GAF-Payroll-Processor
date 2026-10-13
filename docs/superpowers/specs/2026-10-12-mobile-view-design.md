# Phone view for the whole app: design (2026-10-12, revision 2)

**Status: FINAL DRAFT.** Saul approved the direction on 2026-10-12 (sections at the bottom with
Payroll and Admin under More; charts hidden on a phone; release after stage 1). Revision 2 folds in
an independent design review (Impeccable `adapt` + `critique`, summarised at the end). Nothing has
been built or sent to UI Bakery.

- Evidence: `docs/findings/2026-10-12-mobile-baseline.md`
- Plan: `docs/superpowers/plans/2026-10-12-mobile-view.md`
- Look and rules for phone screens: `docs/DESIGN-SYSTEM.md`, section "Phone"
- Mockup: https://claude.ai/artifact/REqmwzDbgqWauuHu4NCJLN
  (source `docs/assets/2026-10-12-mobile-baseline/phone-view-mockup.html`; example names)

## In plain words

Today the app is built for a wide computer screen. On a phone you cannot change section, the
filters cover a third of the screen, tables scroll sideways in a small box, and the employee panel
is cut off.

The fix comes in four steps of growing size:

0. **A one-file fix that restores section switching** (the worst problem), shippable on its own.
1. **Make everything reachable and touchable** (6 small changes): a phone frame with the sections at
   the bottom, filters behind one button, pop-ups that fit the screen. Payroll and Admin keep
   their computer layout and you slide around them.
2. **Make the daily pages read well** (6 changes): Attendance → Today, the employee panel, PTO,
   Contracts and Disciplinary show one compact row per employee instead of a wide table.
3. **The rest of Attendance** (List, Activity, Reports), only if managers ask for it.

On a computer with a mouse the app looks and works as it does now. That is checked after every change.

## Decisions

| # | Question | Answer |
|---|---|---|
| 1 | Who opens this on a phone? | Managers checking their team (default). Payroll and Admin only need to be usable. |
| 2 | Sections at the bottom, Payroll and Admin under More? | **Yes (Saul, 2026-10-12)**, provided step 0 shows the bottom of the screen is reliable. If not, the sections stay as a sliding row in the top bar. |
| 3 | Hide the three charts in the employee panel on a phone? | **Yes (Saul, 2026-10-12).** |
| 4 | Keep every write action on a phone? | Yes (default). Nothing removed. |
| 5 | Which phones matter? | iPhone Safari and Android Chrome (default), checked on real devices at each release. |
| 6 | Release after stage 1? | **Yes (Saul, 2026-10-12).** |
| 7 | A phone held sideways? | Gets the phone layout (default; see "The one switch"). |

## Approach

One app, one address, one set of pages. No separate mobile site: every feature would be built and
fixed twice. Pages get a phone layout only where people actually look on a phone; everything else
is made reachable and left alone.

## Rules that hold for every change

1. **A desktop with a mouse is unchanged.** Screenshot compared after every prompt. The one
   intended exception: clicking an ⓘ also shows its text.
2. **Payroll is untouched.** `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
   `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts` and `src/components/ui/*`
   are never named in a prompt. (`ui/dialog.tsx` may be *used*; it is never *edited*.)
3. **No loader, action or migration changes.** Layout only. A prompt that finds it needs data stops.
4. **Files stay under 15 KB.** Phone layouts go in new files next to the table they mirror.
5. **Tokens, not hex**, and the "Phone" section of `docs/DESIGN-SYSTEM.md` for every phone screen.
6. **Same order, same names as the computer.** Sections appear in the same order everywhere:
   Attendance, Disciplinary, Contracts, PTO Tracker (then Payroll and Admin for super users).

## The one switch: phone or not

Two separate questions, answered separately:

- **Is this a phone-sized screen?** (decides layout). One media query, written once:
  `(max-width: 767px), (max-height: 500px) and (pointer: coarse)`. The second half catches a
  phone held sideways, which is wider than 768 px but only about 350 px tall.
  - In styles: a Tailwind screen named `phone` in `src/tailwind.config.js` (`phone:hidden`, …).
  - In code: `useIsPhone()` in `src/app/lib/useIsPhone.ts`, reading the same query, set from
    `matchMedia` in the very first render so the computer layout never flashes first.
  - A test asserts the two strings are identical.
  - Styling-only differences use the `phone:` class. A different structure (rows instead of a
    table, a sheet instead of a side panel) uses the hook, so only one of the two is ever
    rendered and no row's data hooks run twice.
- **Is this a touch screen?** (decides touch comfort, at any width, so tablets get it too).
  `@media (pointer: coarse)` in `src/index.css`: text boxes at 16 px (stops the phone zooming in),
  tappable things at least 44 px, ⓘ shows its text on tap. A computer with a mouse never matches.

## The frame on a phone

Normal page flow, top to bottom. Nothing in the frame uses `position: fixed`.

| Row | Height | Contents |
|---|---|---|
| Top bar (navy) | 48 | Logo · current section name with its colour mark · Refresh (icon, 44 px) · person icon |
| View As strip (amber) | 44, only while viewing as someone | "Viewing As Maria Lopez · Stop". Never hidden |
| Row 2 (white) | 44, always one line | Left: the section's tabs, sliding sideways. In sections without tabs: the filters in use, as small chips ("Title: Intake 1"), or nothing. Right, pinned: **Filters** button (44 × 44) with a dot when any filter is on |
| Page | the rest | Scrolls. Page headers (Today's Live line and day picker, PTO's As Of) scroll away with it |
| Section bar (white) | 56 | One button per section: icon over a short name in the section's dark "ink" colour; orange count badges |

Fixed chrome: **148 px** (192 while viewing as someone: the 44 px strip is extra) (was 233 on Today with no way to change section; first draft said 196
but missed Today's own pinned header, which made it about 288).

- **Bottom bar contents:** `mobileNavItems(isSuper)` in `src/app/lib/mobileNav.ts`. Manager:
  Attendance, Disciplinary, Contracts, PTO. Super user: the same four plus **More** → Payroll,
  Admin ("Best on a computer"). Badges follow today's rules exactly (a manager sees no
  Disciplinary badge).
- **Counts load once.** The three badge counts move into `useNavBadges()` called once in
  `app.tsx` and handed to both bars. Calling them from each bar would double the queries.
- **Filters sheet.** The same `FilterBar`, told to stack one control per line, employee search
  first. **It stays mounted the whole time** and the sheet only shows or hides it: `FilterBar`
  also picks the default period and resets the Periods/Dates mode, so unmounting it would leave
  Attendance → List with no period and an empty page. The period list opens inline in the sheet.
  The search box's suggestion list is off on a phone (typing already filters the page).
- **Payroll and Admin routes** keep the computer's white bar (tabs and filters on one sliding
  line). No Filters sheet there.
- **If the bottom of the screen is unreliable** (step 0): no bottom bar. The sections stay as the
  sliding row in the top bar that step M0 restores. Nothing else in this design changes.

## Shared pieces (new, in `src/app/components/mobile/`)

| File | Job |
|---|---|
| `BottomNav.tsx` | The section bar. |
| `MobileSheet.tsx` | The one slide-up surface: More, Filters, employee panel, case file. **Built on the existing `ui/dialog`** (used, not edited) with its own classes, so focus, Esc, screen-reader behaviour and scroll lock come from the library, not from new code. Full width; `partial` (hugs the bottom) or `full` height; title bar stays, body scrolls; 44 px close button. |
| `MobileRow.tsx` | The row every phone list uses. See DESIGN-SYSTEM "Phone". A real button when it opens something. |
| `MobileFilters.tsx` | Row 2's right side and the Filters sheet. |
| `DesktopCanvas.tsx` | See "Payroll and Admin". |

**At most two layers** ever sit on top of a page: a sheet, and one dialog over it.

**Opening detail, one rule:** a row with a down-chevron opens in place and is for reading only. A
row with a right-chevron opens a full sheet, used when the detail is long or has buttons.

**Back button.** Sheets do not add browser history (the UI Bakery frame rewrites history; see
`docs/LESSONS.md`). What the phone's Back does with a sheet open is checked in step 0 and written
down; the close button is always there.

**Refresh** remounts the page, so it closes an open sheet and returns to the top. Existing
behaviour; accepted.

## Payroll and Admin: a computer-sized page you slide around

Squeezing these pages to phone width breaks three of them inside do-not-touch files (findings).
So on a phone `DesktopCanvas` wraps the page in a box at least 1024 px wide; it lays out exactly
as on a computer and the existing scroll area lets you slide around it. Applied in `app.tsx`
around the five Payroll routes and in `AdminLayout.tsx` around the Admin pages. No note, no
dismiss button: "Best on a computer" under More says it.

Known and accepted: Payroll Master's small "Refreshing…" marker sits over the bottom bar for a
second (it lives in a do-not-touch file). Not a goal: running a payroll on a phone.

## The pages

Everything a mouse-over tells you today is written out where you tap. "Hidden on a phone" means
"still on the computer".

### Attendance → Today
- The Live line and day picker scroll with the page. "Updates every 5 minutes · times in US
  Eastern" moves into the ⓘ.
- The nine count tiles become **one sliding line of counts** (40 px): `42 Scheduled · 37 Working ·
  2 Away · 3 Late`.
- **Row per employee:** name + status pill; under it the Why chip when there is one, otherwise
  the shift; then entry time and how late. People who need attention are already listed first
  (existing order), so "who is not in" is the first screen.
- Tap (right-chevron) → the employee panel.

### The employee panel (from Today, List, Activity)
- A full sheet: name, role, shift, date range; the meaning of the status in one line.
- The four headline numbers; then **Day by Day** as rows (date + payroll status · late · why ·
  in → out); then the seven smaller numbers.
- The arrival chart and two ring charts are hidden on a phone (decision 3).

### PTO Tracker
- Header buttons (As Of, Export, Add Manually) wrap under the subtitle and scroll away.
- Coming Up stays (it already slides); its loading placeholder is fixed.
- **Row per employee:** name + title; **Available** as the one large number (red when negative);
  Accrued and Taken beside it. Super users: the Review pill.
- Manager: tap (down-chevron) → opens in place: FH Left (with its breakdown written out), Paid
  PTO, WFH, Birthday, and the requests (type · dates · days · returning · status).
- Super user: tap (right-chevron) → a sheet with the same, plus What Payroll Says, the evidence,
  and Record / Edit / Withdraw / Restore. The Record dialog scrolls; its side-by-side boxes stack.

### Contracts
- The five summary chips on one sliding line; tapping still filters.
- **Row per employee:** name + position; the Contract End pill; **the next milestone only**
  ("6 Months · Mon Oct 19 · in 7 days").
- Tap (down-chevron) → all five milestones, tenure, start date, state, and the explanations.

### Disciplinary
- Header: New Disciplinary Action full width; status filters on one sliding line; counts and Export.
- **Row per employee:** name, role · branch; status chip; highest-level chip; number of actions.
  **No scenario text on the list**: a disciplinary narrative should not be readable over a
  shoulder. It is inside the file.
- Tap (right-chevron) → the case file as a full sheet: one row per action; an action opens **in
  place** (not a third layer) to show the full scenario, the facts stacked, Download PDF, Close
  Case / Reopen, and for admins Edit and Delete.
- Close Case is an ordinary button; only Delete is red. Reopen becomes a proper button.
- The edit form is one column.

### Attendance → List, Activity, Reports (stage 3, on request)
Until then they work at the "reachable" level: right frame, table slides sideways.
- **List:** row per employee (name + Good/Fair/At Risk · % on time · Late/Unreported/Absent);
  one "Sort By" box; sorting logic shared with the table.
- **Activity:** Needs a Look, By Employee and By Day as rows; tap → panel.
- **Reports:** the day-tile view only, two tiles across; tap a tile → a sheet with the full
  verdict, form and flags. No second phone rendering of the table view.

## States every phone list must have

- **Loading:** grey placeholder rows at the real row height (never a blank page).
- **Nothing found:** one line that names the active filter ("No employees match Title: Intake 1").
- **Error:** the existing message and Retry button, full width.
- **Long names** wrap to a second line; the status pill stays at the right. Never cut off with "…".
- Day-off and inactive rows use the muted text colour, not see-through text.

## What is deliberately not in this design

No new data, filters or features (tapping a count to filter the list is a good later idea, not
part of this). No offline use, notifications, "install as an app", dark mode or swipe gestures.
No redesign of Payroll or Admin for phones. No change to the Disciplinary Actions Form app. No
person sheet (the name is a mouse-over today; on a phone the icon alone is shown).

## How each change is proven

1. **Tests first**, failing until the export lands: pure tests (`isPhoneQuery` strings identical,
   `mobileNavItems`, sort helper), a size guard on every new or edited file, and the existing
   `RB1`–`RB4` Refresh guards. No tests that only check for a class name.
2. **`git status --short`** shows only the files the prompt named.
3. **The page at three sizes** on `/dev` after a hard refresh: phone upright (375 × 667 — a small
   phone on purpose), phone sideways (667 × 375), computer (1440 wide). Every sheet and dialog
   opened and closed; no console errors.
4. **Real phones** at each release: iPhone Safari and Android Chrome, upright and sideways,
   with the keyboard open in one dialog, and one PDF download.

## Risks

| Risk | What limits it |
|---|---|
| The bottom of the app is cut off on a real phone (the frame is inside UI Bakery's frame, so the app cannot fix this itself) | Step 0 tests it before the bottom bar is built; the top-row fallback is designed in; M0 already restores section switching |
| A phone change leaks into the computer view | One switch; computer screenshot after every prompt |
| `tailwind.config.js` edits are ignored by UI Bakery's build | M1a's first acceptance line; fallback is a `data-phone` attribute on the frame, same hook |
| `FilterBar` (12.9 KB), `DisciplinaryTable` (13.5), `RecordApprovalDialog` (13.5), `AttendanceToday` (12.0) near 15 KB | Smallest possible edits; a size test; `FilterBar` gets a no-visible-change split first if needed |
| Filters stop working because `FilterBar` was unmounted | It is never unmounted; acceptance line "open List cold, without opening Filters: this period's rows show" |
| Pull-down at the top of a list reloads the whole host page | `overscroll-behavior: contain` on the page and sheets (M4) |
| Conflicts with work happening in parallel | This branch holds documents only; each prompt is written against the code of the day |

## What the design review changed (2026-10-12)

Two independent passes: a design-director review and a mechanical check of the mockup.

| Finding | Change |
|---|---|
| The worst problem can be fixed in one file today | New step **M0** |
| The bottom bar is the most fragile spot inside a hosted frame; the planned `h-dvh` fallback cannot work there | Step 0 tests it first; top-row fallback written in |
| Real chrome on Today was about 288 px, not 196 | Row 2 is one line, page headers scroll, tiles become one line: **148 px** |
| Unmounting `FilterBar` inside a sheet would silently empty Attendance → List | Always mounted; cold-open acceptance line |
| "Nothing broken after stage 1" was false: the panel, dialogs, toasts and 16 px inputs came later | New **M4 touch floor** inside stage 1 |
| Width-only switch misses sideways phones and tablets | Two switches: screen size (with a sideways rule) and touch |
| A hand-written sheet would need its own focus and screen-reader handling | `MobileSheet` is built on the existing dialog |
| Gapped cards abandon "this app is a spreadsheet"; 43 of them is a long scroll | Flat rows with hairlines, about 60 px |
| Section order differed from the computer; active labels used colours too faint on white (3.2:1) | Same order; the darker "ink" colours |
| Tap targets in the mockup were 28–37 px | 44 px, as a rule in the design system |
| Disciplinary scenario text on the list is readable over a shoulder | Level and status only on the list |
| M1 was too big; some pieces were over-built | M1 split in two; person sheet, the canvas note, the second Reports view and the Payroll/Admin filter sheet are cut; List/Activity/Reports wait for demand |

Flagged, not changed: the Excel yellow pill (`#9C6500` on `#FFEB9C`) measures 4.1:1, a little under
the 4.5:1 minimum the design system says it passes. It is the payroll colour everyone reads, and
it is marked "do not touch". Saul's call, separate from this work.
