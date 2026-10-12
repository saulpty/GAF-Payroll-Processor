# Phone view for the whole app: design (2026-10-12)

**Status: DRAFT, waiting for Saul's review.** Nothing in this document has been built or sent to
UI Bakery. Evidence: `docs/findings/2026-10-12-mobile-baseline.md`. Plan:
`docs/superpowers/plans/2026-10-12-mobile-view.md`.

**Mockup (today vs proposed, eight phone screens):** https://claude.ai/artifact/REqmwzDbgqWauuHu4NCJLN
(source: `docs/assets/2026-10-12-mobile-baseline/phone-view-mockup.html`; example names and numbers).

## In plain words

Today the app is built for a wide computer screen. On a phone you cannot even change section, the
filters cover a third of the screen, tables scroll sideways in a small box, and the employee panel
is cut off.

The proposal, in two stages:

1. **Make everything reachable (3 changes).** A phone-sized frame around the app: a bar of sections
   at the bottom of the screen for your thumb, a slim top bar, and filters tucked behind one
   "Filters" button. Payroll and Admin stay exactly as they look on a computer and you slide around
   them with your finger. After this stage nothing is broken on a phone.
2. **Make the pages managers use daily read well (9 changes).** Attendance, PTO, Contracts and
   Disciplinary show each employee as a card instead of a wide table row. Tap a card for the detail.

On a computer the app looks and works exactly as it does now. That is checked after every change.

## What Saul asked for, and what I assumed

Said: the app looks horrible on mobile; there should be a way to view it on mobile; plan all of it;
execute nothing.

Assumed (each is a question at the end, with the default I will use if there is no answer):

- A1. The people on phones are mostly **managers** checking their team, so Attendance, PTO,
  Contracts and Disciplinary get real phone layouts. Payroll and Admin are desk work for one or two
  super users, so they only need to be *usable*, not redesigned.
- A2. "Phone" means a screen narrower than 768 px. Tablets and narrow desktop windows from 768 px
  up keep today's layout.
- A3. Nothing is removed on a phone. Every button that exists on a computer is still there.
- A4. One app, one address. No separate mobile site.

## Approaches considered

| | Approach | For | Against |
|---|---|---|---|
| A | **Separate mobile screens** (own routes) | Free hand in design | Every feature built and fixed twice; two sets of loaders to keep scoped to the viewer; doubles the change loop forever |
| B | **Squeeze only**: fix the frame, let every table scroll sideways | Cheap, covers 100% | Tables stay unreadable; the employee's name scrolls away; "usable" but still poor |
| C | **Same pages, phone layout where it matters** (recommended) | One codebase; cards only where people actually look on a phone; payroll files untouched | Each manager page needs its own card layout (9 prompts) |

**Recommendation: C, delivered as B first.** Stage 1 is approach B and can be released on its own.
Stage 2 upgrades the manager pages one at a time, each releasable.

## Rules that hold for every change

1. **Desktop is unchanged.** At 768 px and wider, every page renders the same as before.
   Each prompt's acceptance includes a desktop screenshot compared with the one taken before it.
2. **Payroll is untouched.** `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
   `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts` and `src/components/ui/*`
   are never named in a prompt.
3. **No loader, action or migration changes.** This is layout only. No SQL, no new queries, so the
   viewer-scoping rule and the three recurring bugs in `CLAUDE.md` are not in play. A prompt that
   finds it needs data must stop and say so.
4. **Files stay under 15 KB.** Card layouts go in new files next to the table they mirror.
5. **Tokens, not hex.** New pieces follow `docs/DESIGN-SYSTEM.md` (Warm variant, section colours,
   Excel status fills, Title Case).
6. **One switch.** A page decides "phone or not" in exactly one way (below), so the two layouts
   cannot drift.

## The one switch: how a page knows it is on a phone

- New `src/app/lib/useIsMobile.ts`: `isMobileWidth(w)` (pure, `w < 768`) and the hook
  `useIsMobile()` built on `window.matchMedia('(max-width: 767px)')` with a change listener. The
  app runs in a frame, and `matchMedia` there reports the frame's width, which is what we want.
- **Styling only** (spacing, wrapping, hiding a label): Tailwind `md:` classes.
- **Different structure** (cards instead of a table, a sheet instead of a side panel): the hook, so
  only one of the two is ever rendered. This matters: rendering both and hiding one would run
  every row's data hooks twice.

## The frame on a phone

Top to bottom, all normal page flow (nothing pinned with `position: fixed`, so the phone keyboard
and the surrounding UI Bakery frame cannot knock it out of place):

| Row | Height | Contents |
|---|---|---|
| Top bar (navy) | 48 px | Logo · the current section's name with its colour mark · Refresh (icon only, 40 px target) · person icon |
| View As strip (amber) | 32 px, only while viewing as someone | "Viewing As Maria Lopez · Stop". Never hidden: it must be impossible to forget you are viewing as someone else |
| Page tabs | 44 px, only in sections with pages (Attendance, Payroll, Admin) | Same tabs as today, scrolling sideways, with a fade on the right edge when more are off-screen |
| Search row | 48 px, only on pages with filters | Employee search (full width) · **Filters** button with a count of filters in use |
| Page | the rest | Scrolls |
| Section bar (white) | 56 px | One button per section, icon above a short name, each in its section colour; the orange count badges move here |

**Sections in the bottom bar.** A manager has four sections and sees four buttons: Attendance, PTO,
Contracts, Disciplinary. A super user sees those four plus **More**, which opens a sheet with
Payroll and Admin (marked "Best on a computer"). The split lives in one small pure function,
`mobileNavItems(isSuper)` in `src/app/lib/mobileNav.ts`, with a test.

**Person icon.** Tapping it opens a small sheet: name, role, email. (On desktop the email is a
mouse-over.)

**Filters sheet.** The Filters button opens a sheet from the bottom holding the same controls
`FilterBar` shows today for that page, stacked one per line at full width, with Clear Filters and
Done. It is the *same* `FilterBar` component told to stack, not a copy, so the rules about which
page shows which filter stay in `filterRoutes.ts` only.

**Height.** The outer frame keeps `h-screen`. On a real phone this must be checked (plan step 0):
if the browser's bars hide the bottom section bar, the frame switches to `h-dvh`.

Before and after, measured on Attendance → Today at 375 × 815: chrome above and below the page
goes from 233 px with no way to change section, to 196 px with every section one tap away.

## Shared pieces (new, in `src/app/components/mobile/`)

| File | Job |
|---|---|
| `BottomNav.tsx` | The section bar above. Reads `SECTIONS` and the same three count badges as `TopNav`. |
| `MobileSheet.tsx` | One sheet component for everything that slides up: filters, More, person, employee panel, case file. Full width, up to the full height, own scroll, 44 px close button, closes on Esc and on tapping the dimmed backdrop, title bar stays put while the body scrolls. Does **not** use or modify `components/ui/dialog.tsx`. |
| `MobileCard.tsx` | The card every list uses: a title line (name), a right-hand slot (status chip), up to three lines of facts, optional chevron. One look across all four sections. |
| `MobileFilters.tsx` | The search row and the Filters button + sheet. |
| `DesktopCanvas.tsx` | See "Payroll and Admin". |

Small edits to existing shared pieces, all phone-only in effect:

- `PageHeader.tsx`: wraps on a phone; buttons drop under the subtitle instead of pushing the page wide.
- `InfoTip.tsx`: a tap shows the explanation in a small bubble (the mouse-over stays). This is the
  only change a desktop user could notice: clicking an ⓘ now also shows its text.
- Existing dialogs (Record PTO, Close Case, Delete, Thresholds): each caller passes extra classes so
  that on a phone the dialog has a side margin, never grows taller than the screen, and scrolls
  inside. Two-column form grids become one column. `ui/dialog.tsx` itself is not edited; it already
  merges the caller's classes.
- Text boxes are 16 px on a phone so the browser does not zoom when you tap one.
- Anything you tap is at least 40 px tall on a phone.
- `ds/BulkBar.tsx` and `ds/Combobox.tsx`: kept inside the screen's edges (used by Action Required).
- `AccessGate.tsx`: a side margin so the "no access" card does not touch the edges.

## Payroll and Admin: a computer-sized page you slide around

Squeezing these pages to phone width breaks three of them *inside do-not-touch files*
(findings, "From reading the code"). So on a phone they are not squeezed. `DesktopCanvas` wraps the
page in a box at least 1024 px wide; the page lays out exactly as on a computer and the existing
scroll area lets you slide around it. A one-line note sits above it the first time: "Built for a
computer. Slide sideways to see everything."

- Applied in `app.tsx` around the five Payroll routes and in `AdminLayout.tsx` around the Admin pages.
- The phone frame (bottom bar, tabs, Filters sheet) still applies, so you can get in, look
  something up, and get out.
- Not a goal: running a payroll on a phone.

## The manager pages

For each: what the card shows, what a tap does, what moves. "Hidden on a phone" always means
"still on the computer".

### Attendance → Today

- Header: Live pill and "Data as of 4:45 PM" on one line; the day picker on the next.
- Tiles: three across, equal width, same numbers and colours.
- **Card per employee:** name + status pill · the Why chip and the shift (`9AM–5PM`) · Entry time,
  how late, active time. Day-off people stay dimmed at the bottom.
- Tap a card → the employee panel (below).
- The status pill's meaning, today a mouse-over, is shown in the panel's first line.

### The employee panel (opens from Today, List and Activity)

- A full-screen sheet instead of a 520 px side panel: name, role, date range, close button.
- The four headline numbers, then the seven small ones three across.
- **Day by Day as cards:** date + payroll status · late · why · entry → exit · active.
- The arrival chart and the two ring charts are **hidden on a phone**: their labels are placed at
  fixed pixel positions that only line up at desktop width, and every number in them is already in
  the tiles and the day list.

### Attendance → List

- The ten summary cards stay two across (they already are).
- **Card per employee:** name + Good / Fair / At Risk · on-time bar and % · Late, Unreported,
  Absent counts · the Reporting pill. Tap → panel.
- Sorting moves from the column headers to one "Sort By" box: Name, % On-Time, Unreported, Absent.
- The table's fixed-height scroll box is not used on a phone; the page scrolls as one.

### Attendance → Activity

- The four totals two across; Thresholds button (super users) under them.
- **Needs a Look** as cards: name · date · active time · short by · why. Tap → that person's panel.
- **By Employee** cards: name · average active with its bar · days with work · needs-a-look count.
  Tap → panel (which already lists their days, so the fold-out table is not needed on a phone).
- **By Day** cards: name · date · entry → exit · active · why. Export CSV stays.

### Attendance → Reports

- Cards view (the default): day tiles **two across** instead of one narrow column; the per-employee
  totals wrap onto their own line.
- Tap a day tile → a small sheet with the full verdict, the form and its reason, and the flag
  texts. Today these exist only as mouse-overs, so on a phone they are currently unreadable.
- Table view becomes a list of day cards with the same verdict filter chips (one scrolling line).

### PTO Tracker

- Header: "As Of" date, Export and Add Manually wrap under the subtitle.
- **Coming Up** stays as it is (it already swipes sideways); only its loading placeholder is fixed.
- **Card per employee:** name + title · **Available** large (red when negative) · Accrued and
  Taken · FH Left, Paid PTO, WFH, Birthday as small labelled numbers · super users: the Review pill.
- Tap → the card opens to show that person's requests as cards: type · dates · days · returning ·
  status. The FH Left breakdown (a mouse-over today) is written out here.
- Super users also see "What Payroll Says", the evidence, and Record / Edit / Withdraw / Restore.
- The Record dialog scrolls and its side-by-side boxes stack.

### Contracts

- The five summary chips sit on one line that scrolls sideways; tapping one still filters.
- **Card per employee:** name + position · the Contract End pill · **the next milestone only**
  ("6 Months · Thu Nov 12 · in 31 days") · tenure, start date, state.
- Tap → the card opens to show all five milestones and the explanations that are mouse-overs today
  (when a milestone was reached, what "Pending Review" means, a differing board start date).

### Disciplinary

- Header: New Disciplinary Action as a full-width button; the status filters (All, Open, Overdue,
  Closed, admins: Deleted) on one scrolling line; counts and Export under them.
- **Card per employee:** name, role · branch · the status chip ("Review Overdue 12 d") · highest
  level chip · number of actions · latest date and the **full** scenario (cut off today even on
  desktop).
- Tap → a full-screen sheet, the case file: one card per action (date · level · scenario · status).
  Tap an action → its facts, stacked; Download PDF; Close Case / Reopen; for admins Edit and Delete.
- The edit form is one column. Close and Delete dialogs scroll. "Reopen" becomes a proper button;
  it is a small text link today and too easy to miss or mis-tap.

## What is deliberately not in this design

- No new data, filters, or features. No offline use, no notifications, no "install as an app".
- No dark mode. No landscape-specific layouts (landscape gets the phone layout if under 768 px wide,
  otherwise desktop).
- No redesign of Payroll or Admin for phones.
- No change to the second app (the Disciplinary Actions Form).
- Swipe gestures. Everything is a tap.

## How each change is proven

1. **Tests first**, in `tests/`, failing until the export lands (the project's habit):
   pure tests for `isMobileWidth` and `mobileNavItems`; static guards per prompt (for example: the
   side panel no longer has an unconditional 520 px minimum; every new file is under 15 KB; no
   do-not-touch file changed; `RB1` in `refreshButton.test.ts` still passes).
2. **`git status --short`** shows only the files the prompt named.
3. **The page, at two sizes**, on `/dev` after a hard refresh: phone (375 × 812) and desktop
   (1440 wide). Screenshots of both go in the commit message's evidence and in the handoff.
   Phone checks per page: nothing slides sideways except where designed; every button reachable;
   open and close every sheet and dialog; no console errors.
4. **A real phone** at each release point (Saul or a manager): Safari on iPhone and Chrome on
   Android if both are in use.

## Risks

| Risk | What limits it |
|---|---|
| A phone change leaks into desktop | The single switch; desktop screenshot compared after every prompt |
| UI Bakery's AI "tidies" other files | Every prompt lists its files and forbids the rest; step 6 of the loop catches it |
| The live address frames the app differently on a phone than `/dev` does | Plan step 0, before any prompt |
| A file crosses 15 KB (`FilterBar` 12.9, `DisciplinaryTable` 13.5, `RecordApprovalDialog` 13.5, `MondayTab` 14.9) | Those files get the smallest possible edit; new layout goes in new files; a size guard test |
| Phone keyboard covers a dialog's Save button | Dialogs scroll inside; checked on a real phone |
| Conflicts with whatever is being built in parallel right now | This branch holds documents only. Before the first prompt: re-read the files it names, because they may have changed |

## Questions for Saul (the default applies if unanswered)

1. **Who opens this on a phone?** Default: managers checking their team; Payroll and Admin only
   need to be usable.
2. **Sections at the bottom of the screen, with Payroll and Admin under "More"?** Default: yes. The
   alternative is a menu button top-left.
3. **Hide the three charts in the employee panel on a phone?** Default: yes.
4. **Keep every write action on a phone** (Record PTO, Close Case, edit a disciplinary action)?
   Default: yes, nothing removed.
5. **Which phones matter?** Default: iPhone Safari and Android Chrome, checked by you at each release.
6. **Release after stage 1, or wait for the manager pages?** Default: release after stage 1 (it
   fixes "cannot change section"), then again after Today + the panel, then at the end.
