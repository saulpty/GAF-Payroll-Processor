# Phone view prompts: stage 1 (prepared 2026-10-13, not sent)

Design: `docs/superpowers/specs/2026-10-12-mobile-view-design.md`.
Plan: `docs/superpowers/plans/2026-10-12-mobile-view.md`.

**Nothing here has been sent to UI Bakery.** These were written against `main` at `204c348`.
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
alone on tablets too.

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
