# Phone view prompts: stage 1 (prepared 2026-10-13, not sent)

Design: `docs/superpowers/specs/2026-10-12-mobile-view-design.md`.
Plan: `docs/superpowers/plans/2026-10-12-mobile-view.md`.

**Nothing here has been sent to UI Bakery.** These were written against `main` at `204c348` (this branch at `55f1d6a`, which is what `baseline.json` records).
Before sending any prompt, run `node tools/check-baseline.mjs docs/superpowers/prompts/2026-10-13-mobile/baseline.json`:
it lists every file a prompt edits that has changed since. A changed file means that prompt's
"replace this text" anchors must be re-checked against the new code first.

| File | Plan step | Sends after |
|---|---|---|
| `00-sections-reachable.md` | M0 | any time |
| `01-switch-and-counts.md` | M1a | 00 |
| `02-phone-frame.md` | M1b | 01, and step 0 (real phone) |
| `03-tabs-and-filters.md` | M2 | 02 |
| `04-desktop-canvas.md` | M3 | 02 |
| `05-touch-floor.md` | M4 | 02 |
| `06-dialogs-fit.md` | M5 | 01 |

Each prompt's tests wait in `tests/` **inside this folder**. When a prompt is about to be sent, move
its test file to the repository's `tests/` folder and commit both (it fails until the export lands,
which is the project's habit). They are kept here until then so the suite stays green.

## Shared contract (every prompt in this folder relies on these exact names)

**The switch.**
- `src/app/lib/useIsPhone.ts` exports
  `PHONE_QUERY = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)'` and
  `useIsPhone(): boolean` (first value read from `window.matchMedia(PHONE_QUERY).matches` inside the
  `useState` initialiser; a `change` listener keeps it current).
- `src/tailwind.config.js` gains, under `theme.extend`, `screens: { phone: { raw: '<the same string>' } }`.
  Phone-only styling is written `phone:<class>`. Never `md:`/`sm:` for the phone switch after prompt 01.
- Touch comfort is separate: `@media (pointer: coarse)` rules in `src/index.css` (prompt 05).

**Frame sizes on a phone.** Top bar `h-12` (48). Row 2 `h-11` (44). Bottom section bar `h-14` (56).
Minimum hit area 44 × 44 (`min-h-11 min-w-11`).

**`src/app/lib/useNavBadges.ts`** exports `type NavBadges = { contracts: number; disciplinary: number; pto: number }`
and `useNavBadges(): NavBadges`. Called once, in `Shell` in `app.tsx`; `TopNav` and `BottomNav` take
`badges: NavBadges` as a prop.

**`src/app/lib/mobileNav.ts`** (pure, no imports) exports
`mobileNavItems(isSuper: boolean): { bar: string[]; more: string[] }` using section ids in desktop
order: `attendance`, `disciplinary`, `contracts`, `pto`; super users also get `more: ['payroll', 'admin']`.
It also exports `navBadge(id, badges, isSuper)`, the one rule for which count a section shows
(a manager never sees the Disciplinary count); both bars use it.

**`src/app/components/mobile/MobileSheet.tsx`** default export, props:
`{ open: boolean; onClose: () => void; title: string; subtitle?: string; size?: 'partial' | 'full'; keepMounted?: boolean; children: ReactNode }`.
Built on `Dialog` / `DialogContent` / `DialogTitle` from `@/components/ui/dialog` (used, never edited).
`keepMounted`: while closed, the children are still rendered, inside a `hidden` wrapper, so their
effects and loaders keep running.

**`src/app/components/mobile/BottomNav.tsx`** default export, props `{ badges: NavBadges }`.

**`src/app/components/mobile/DesktopCanvas.tsx`** default export, props `{ children: ReactNode }`.
It **always** renders one `<div>` around its children, so the page inside is never remounted when
the screen size flips (Process Payroll keeps an unsaved run in page state). On a phone the div is
`desktop-canvas h-full min-w-[1024px]`; otherwise it is `desktop-canvas contents`
(`display: contents`: no box, so the computer layout is unchanged). The `desktop-canvas` class is
present at every size so the touch rule in `index.css` (16 px text boxes) leaves Payroll and Admin
alone on tablets too. `SectionBar`'s Payroll/Admin bar carries the same class (prompt 03, edit 2d),
so its Period and search boxes are left alone as well.

**`app.tsx` after prompts 01–02** has a `Shell` component (inside `RefreshBoundary`) that calls
`useNavBadges()` and renders `<TopNav badges={badges} />`, `<SectionBar />`, `<main …>`, and on a
phone `<BottomNav badges={badges} />`. The `<Route …>` lines and the import lines for pages and
`RequireSuper` are **not** touched by prompts 00–02, so prompt 04 anchors on them.

## House style for these prompts

Follow `docs/superpowers/prompts/2026-10-12-refresh/02-refresh-button.md` exactly:
- First line after the title: "Copy every edit exactly, character for character. Do not rewrite,
  reformat or "improve" anything else. If your context is compacted mid-task, re-read this prompt
  before writing."
- "**Only these files may change.**" with the full list, then "**No other file may be touched.**
  No migration, no action file."
- New files are given whole, in a code block. Edits are given as exact "Replace … with …" or
  "Directly after the line … add …" pairs, quoting the current text character for character.
- The standing rules from the plan ("Rules every prompt repeats"), word for word.
- "## Acceptance — visible facts", numbered, phone first, then "On a computer nothing changes".
- Last line: "When done, reply with a one-line summary per file."
- Plain words in the prose parts; Saul reads these.

## Send checklist (one prompt at a time, full change loop each)

Before the first one: the other session's work is exported, synced and committed; this branch is
merged into `main`; `node tools/check-baseline.mjs docs/superpowers/prompts/2026-10-13-mobile/baseline.json`
says all files unchanged. Take the "before" screenshots (375 × 667, 667 × 375, 1440 wide).

| Prompt | Just before sending | After the export, besides the usual loop |
|---|---|---|
| 00 | Move `tests/mobileShell.test.ts` to the repo's `tests/`; leave `SENT_THROUGH = 0`. | Phone: the sections slide in the navy bar and can be tapped. |
| 01 | Set `SENT_THROUGH = 1`. In `tests/warmPto.test.ts` test WN3, change `/<TopNav \/>\s*<SectionBar \/>/` to `/<TopNav badges=\{badges\} \/>\s*<SectionBar \/>/`. | **Phone: the navy bar is 48 px tall.** If it is still 56, UI Bakery ignored the Tailwind change: stop, revert in UIB, and switch every later prompt to the `data-phone` fallback in the spec. Network tab: three count queries on load, not six. |
| 02 | Step 0 said the bottom of the screen is visible (otherwise do not send; skip to 03). Set `SENT_THROUGH = 2`. | Phone: section bar at the bottom; manager under View As sees four sections and no Disciplinary count. |
| 03 | Move `tests/mobileFilters.test.ts`. | Phone: open Attendance → List cold without opening Filters: this period's rows show. In the sheet, choose Dates, Done, reopen: still Dates. Tapping inside the sheet does not close it. |
| 04 | Move `tests/mobileCanvas.test.ts`. | Computer: on Process, drag the window under 768 px and back: the step is still there. Phone: Rules & Config's Edit and Delete reachable. |
| 05 | Move `tests/mobileTouch.test.ts`. | Touch rules do not switch on in a narrowed frame: use the browser's device mode. Real phone: no zoom on tapping a text box. |
| 06 | Move `tests/mobileDialogs.test.ts`. | Phone: PTO, Contracts and Disciplinary scroll as one page. Open each dialog and **cancel; save nothing**. |

03–06 can go in any order once 02 (or 01, if 02 is skipped) is in. Release A comes after all seven
and a real-phone pass.

Verified on 2026-10-13 without UI Bakery: all seven applied in order to a scratch copy pass every
test, add no type errors (the same 21 that exist today), and every `phone:` class compiles.
Not verified, and only UI Bakery or a real phone can: that UIB's build honours the Tailwind change,
real rendering, the phone keyboard, iOS zoom, pull-to-refresh.
