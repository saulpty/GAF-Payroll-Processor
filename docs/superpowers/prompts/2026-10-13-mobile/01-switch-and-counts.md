# Phone: the one "is this a phone?" switch, and the three nav counts loaded once

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

Plan step M1a (`docs/superpowers/plans/2026-10-12-mobile-view.md`). Groundwork for the phone
layout. Almost nothing visible changes: on a phone the navy top bar becomes 48 px tall instead of
56 and the Refresh control becomes a bare icon with a finger-sized touch area. Two things are set up:

- **One switch for "phone-sized screen".** The same media query is written in two places and
  must stay identical: a Tailwind screen named `phone` (for classes such as `phone:hidden`) and a
  hook `useIsPhone()` (for code that renders something different). The query is
  `(max-width: 767px), (max-height: 500px) and (pointer: coarse)`: a narrow screen, or a phone
  held sideways. A computer with a mouse never matches.
- **The three orange counts in the top bar are loaded in one place.** They move, unchanged, out of
  `TopNav` into a hook `useNavBadges()`, which a new small `Shell` component in `app.tsx` calls
  once and hands to `TopNav` as a prop. A second bar is coming for phones; this way the three
  count queries still run once, not twice.

This prompt assumes the previous prompt in this folder (`00-sections-reachable.md`) has been
applied: `TopNav.tsx` and `RefreshButton.tsx` contain `hidden md:inline` four times in total.

**Only these files may change.** Two new: `src/app/lib/useIsPhone.ts`,
`src/app/lib/useNavBadges.ts`. Five edited: `src/tailwind.config.js`, `src/app/app.tsx`,
`src/app/TopNav.tsx`, `src/app/components/RefreshButton.tsx`, `src/AGENTS.md`.
**No other file may be touched.** No migration, no action file.

Rules that hold for every prompt in this folder:

- Only these files may change: the seven listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.

About the second rule: `useNavBadges.ts` **imports** `toLocalYMD` from
`@/app/lib/classificationEngine`, exactly as `TopNav.tsx` does today. That file is not opened or
edited. The three count actions (`loadContractsExpiringCount`, `loadDisciplinaryDueCount`,
`loadPtoReviewCount`) are only imported from a different file; they are not edited.

`useLoadAction` parameters are passed **flat**, exactly as written below: `{ viewAs }`,
`{ asOf }`, `{ today: asOf, manager: null, viewAs }`. Never wrap them in `{ params: { … } }`.

Every class this prompt adds starts with `phone:`. A class without that prefix would change the
computer view: add none.

## 1. New file `src/app/lib/useIsPhone.ts` — the whole file

```ts
import { useEffect, useState } from 'react';

// The one "is this a phone-sized screen?" switch (layout only). The same string is the `phone`
// screen in src/tailwind.config.js; tests/mobileShell.test.ts fails if the two ever differ.
// A narrow screen, or a phone held sideways (wide but short, and touch). A computer never matches.
export const PHONE_QUERY = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)';

function matchesPhone(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(PHONE_QUERY).matches;
}

/** True on a phone-sized screen. Right on the very first render, so the computer layout never flashes first. */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState<boolean>(matchesPhone);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(PHONE_QUERY);
    const onChange = () => setIsPhone(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isPhone;
}
```

## 2. New file `src/app/lib/useNavBadges.ts` — the whole file

```ts
import { useEffect, useRef } from 'react';
import { useLoadAction } from '@uibakery/data';
import loadContractsExpiringCountAction from '@/actions/loadContractsExpiringCount';
import loadDisciplinaryDueCountAction from '@/actions/loadDisciplinaryDueCount';
import loadPtoReviewCountAction from '@/actions/loadPtoReviewCount';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';

export type NavBadges = { contracts: number; disciplinary: number; pto: number };

/** The three orange nav counts. Call it ONCE, in Shell (app.tsx), and pass the result to the bars. */
export function useNavBadges(): NavBadges {
  const { ptoVersion } = useGlobalFilters();
  const { viewAs } = useViewer();

  const [expiringData]    = useLoadAction(loadContractsExpiringCountAction, [] as { count: number }[], { viewAs });
  const expiringCount     = (expiringData as { count: number }[])[0]?.count ?? 0;
  const asOf              = toLocalYMD(new Date());
  const [dueData]         = useLoadAction(loadDisciplinaryDueCountAction, [] as { count: number }[], { asOf });
  const dueCount          = (dueData as { count: number }[])[0]?.count ?? 0;
  const [reviewData, , , reloadReview] = useLoadAction(loadPtoReviewCountAction, [] as { count: number }[], { today: asOf, manager: null, viewAs });
  const reviewCount       = (reviewData as { count: number }[])[0]?.count ?? 0;

  // Reload PTO review count whenever a PTO record is written anywhere in the app
  const ptoVersionRef = useRef(ptoVersion);
  useEffect(() => {
    if (ptoVersionRef.current !== ptoVersion) {
      ptoVersionRef.current = ptoVersion;
      reloadReview();
    }
  }, [ptoVersion, reloadReview]);

  return { contracts: expiringCount, disciplinary: dueCount, pto: reviewCount };
}
```

## 3. `src/tailwind.config.js` — one edit, nothing else

**3a.** Directly after the line

```js
    extend: {
```

add

```js
      screens: {
        phone: { raw: '(max-width: 767px), (max-height: 500px) and (pointer: coarse)' },
      },
```

It goes **inside** `theme.extend`, above `fontFamily`. Do not add a `screens` key directly under
`theme` (that would delete `sm`, `md`, `lg`, `xl`, `2xl`), and do not change
`theme.container.screens`. Nothing else in the file changes.

## 4. `src/app/app.tsx` — four edits, nothing else

**4a.** Directly after the line

```tsx
import SectionBar from '@/app/SectionBar';
```

add

```tsx
import { useNavBadges } from '@/app/lib/useNavBadges';
```

**4b.** Directly above the line

```tsx
function App() {
```

add (with one blank line between it and `function App() {`)

```tsx
// The frame inside the refresh boundary. The three nav counts are loaded here, once, and handed
// to the bars as a prop: loading them inside each bar would run every count query twice.
function Shell({ children }: { children: ReactNode }) {
  const badges = useNavBadges();
  return (
    <>
      <TopNav badges={badges} />
      <SectionBar />
      <main className="flex-1 overflow-auto">{children}</main>
    </>
  );
}
```

**4c.** Inside `App`, replace

```tsx
              <TopNav />
              <SectionBar />
              <main className="flex-1 overflow-auto">
```

with

```tsx
              <Shell>
```

**4d.** Inside `App`, replace

```tsx
              </main>
            </RefreshBoundary>
```

with

```tsx
              </Shell>
            </RefreshBoundary>
```

`<Routes>` and every `<Route …>` line stay exactly where they are, with the same indentation: do
not re-indent them and do not move them into `Shell`. `RefreshBoundary` (with
`<div key={refreshVersion}`) is not changed. `<AccessAutoSync />`, `<TeramindAutoSync />` and
`<MondayAutoSync />` stay directly above `<RefreshBoundary>`. No import line for a page or for
`RequireSuper` changes.

## 5. `src/app/TopNav.tsx` — eight edits, nothing else

**5a.** Replace

```tsx
import { useEffect, useRef } from 'react';
import { useLoadAction } from '@uibakery/data';
import loadContractsExpiringCountAction from '@/actions/loadContractsExpiringCount';
import loadDisciplinaryDueCountAction from '@/actions/loadDisciplinaryDueCount';
import loadPtoReviewCountAction from '@/actions/loadPtoReviewCount';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import BrandLogo from '@/app/components/BrandLogo';
```

with

```tsx
import type { NavBadges } from '@/app/lib/useNavBadges';
import BrandLogo from '@/app/components/BrandLogo';
```

**5b.** Replace

```tsx
export default function TopNav() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { ptoVersion } = useGlobalFilters();
  const { isSuper, isViewingAs, name, email, setViewAs, viewAs } = useViewer();
  const visibleSections = SECTIONS.filter(s => canSeeSection(isSuper, s.id));

  const [expiringData]    = useLoadAction(loadContractsExpiringCountAction, [] as { count: number }[], { viewAs });
  const expiringCount     = (expiringData as { count: number }[])[0]?.count ?? 0;
  const asOf              = toLocalYMD(new Date());
  const [dueData]         = useLoadAction(loadDisciplinaryDueCountAction, [] as { count: number }[], { asOf });
  const dueCount          = (dueData as { count: number }[])[0]?.count ?? 0;
  const [reviewData, , , reloadReview] = useLoadAction(loadPtoReviewCountAction, [] as { count: number }[], { today: asOf, manager: null, viewAs });
  const reviewCount       = (reviewData as { count: number }[])[0]?.count ?? 0;

  // Reload PTO review count whenever a PTO record is written anywhere in the app
  const ptoVersionRef = useRef(ptoVersion);
  useEffect(() => {
    if (ptoVersionRef.current !== ptoVersion) {
      ptoVersionRef.current = ptoVersion;
      reloadReview();
    }
  }, [ptoVersion, reloadReview]);
```

with

```tsx
export default function TopNav({ badges }: { badges: NavBadges }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { isSuper, isViewingAs, name, email, setViewAs } = useViewer();
  const visibleSections = SECTIONS.filter(s => canSeeSection(isSuper, s.id));

  // The three counts are loaded once, in Shell (app.tsx), by the useNavBadges hook.
  const expiringCount = badges.contracts;
  const dueCount      = badges.disciplinary;
  const reviewCount   = badges.pto;
```

The function `sectionBadge` directly below stays exactly as it is, including its first line
`if (!isSuper && id === 'disciplinary') return null;`.

**5c.** Replace

```tsx
    <header className="topnav-dark shrink-0 h-14 bg-[var(--topnav)] text-[var(--topnav-foreground)] shadow-sm flex items-center px-4 gap-0 z-40 overflow-hidden">
```

with

```tsx
    <header className="topnav-dark shrink-0 h-14 bg-[var(--topnav)] text-[var(--topnav-foreground)] shadow-sm flex items-center px-4 gap-0 z-40 overflow-hidden phone:h-12">
```

**5d.** Replace

```tsx
      <nav aria-label="Sections" className="flex items-center h-14 flex-1 min-w-0 overflow-x-auto no-scrollbar">
```

with

```tsx
      <nav aria-label="Sections" className="flex items-center h-14 flex-1 min-w-0 overflow-x-auto no-scrollbar phone:h-12">
```

**5e.** Replace

```tsx
                'flex items-center gap-2 px-3 h-14 border-b-[3px] text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 select-none focus:outline-none',
```

with

```tsx
                'flex items-center gap-2 px-3 h-14 border-b-[3px] text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 select-none focus:outline-none phone:h-12',
```

**5f.** Replace

```tsx
          <span><span className="hidden md:inline">Viewing As </span>{name || email}</span>
```

with

```tsx
          <span><span className="phone:hidden">Viewing As </span>{name || email}</span>
```

**5g.** Replace

```tsx
          <span className="hidden md:inline">{name || email}</span>
```

with

```tsx
          <span className="phone:hidden">{name || email}</span>
```

**5h.** Replace

```tsx
          <span className="hidden md:inline text-slate-300">· {isSuper ? 'Super User' : 'Manager'}</span>
```

with

```tsx
          <span className="text-slate-300 phone:hidden">· {isSuper ? 'Super User' : 'Manager'}</span>
```

After these edits `TopNav.tsx` no longer contains `useLoadAction`, `useEffect`, `useRef`,
`useGlobalFilters`, `toLocalYMD`, `md:` or any `@/actions/` import. `<RefreshButton />` stays
directly above the line `{isViewingAs ? (`. `SECTIONS`, `getActiveSection` and `BADGE` are not
changed.

## 6. `src/app/components/RefreshButton.tsx` — one edit, nothing else

**6a.** Replace

```tsx
      className="ml-3 shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 disabled:opacity-70 disabled:cursor-wait"
    >
      <RefreshCw className={cn('w-3.5 h-3.5', busy && 'animate-spin')} />
      <span className="hidden md:inline">{busy ? 'Refreshing…' : 'Refresh'}</span>
```

with

```tsx
      className="ml-3 shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 disabled:opacity-70 disabled:cursor-wait phone:ml-1 phone:h-11 phone:w-11 phone:px-0 phone:justify-center phone:border-transparent phone:bg-transparent"
    >
      <RefreshCw className={cn('w-3.5 h-3.5 phone:w-5 phone:h-5', busy && 'animate-spin')} />
      <span className="phone:hidden">{busy ? 'Refreshing…' : 'Refresh'}</span>
```

On a phone this makes the Refresh control a bare 20 px icon inside a 44 × 44 px touch area. The
`refresh` function, `title`, `aria-label="Refresh data"` and `disabled={busy}` are not changed.

## 7. `src/AGENTS.md` — one addition

**7a.** Directly after the line

```md
(an unsaved payroll run lives in page state). Never `window.location.reload()`.
```

add a blank line and then

```md
**Phone layout (added 2026-10-13)** — two switches, never mixed up. *Phone-sized screen* (decides
layout): one media query, `(max-width: 767px), (max-height: 500px) and (pointer: coarse)`, written
in two places that must stay identical (`tests/mobileShell.test.ts` compares them): the Tailwind
screen `phone` under `theme.extend.screens` in `tailwind.config.js`, for styling-only differences
(`phone:hidden`, `phone:h-12`), and `PHONE_QUERY` / `useIsPhone()` in `src/app/lib/useIsPhone.ts`,
for a different structure, so only one of the two layouts is ever rendered. Never use `sm:` or
`md:` as the phone switch. Because `phone` is a raw screen, Tailwind switches off its `max-*:` and
`min-*:` variants for the whole app: never write `max-md:` or `min-[…]:`. *Touch screen* (decides
touch comfort, at any width): `@media (pointer: coarse)` rules in `src/index.css`. A computer with
a mouse matches neither and must look exactly as before. The three orange nav counts are loaded
once, by `useNavBadges()` (`src/app/lib/useNavBadges.ts`), called in `Shell` in `app.tsx` and
passed to the bars as the `badges` prop: never load them inside a bar.
```

The blank line that already follows the Refresh paragraph stays, so the new paragraph has one
blank line above it and one below it.

## Acceptance — visible facts

On a phone (the app's frame 375 px wide, then turned sideways at 667 × 375 on a touch device):

1. The navy top bar is **48 px** tall (it was 56). This is the proof that the new `phone` screen
   in `tailwind.config.js` is being used. If the bar is still 56 px tall, say so in your reply
   and change nothing else.
2. The Refresh control is the circular-arrows icon alone, with no pill around it; tapping it
   spins the icon and reloads the page's data.
3. The row of sections still slides sideways and every section still opens.
4. The orange counts on Disciplinary, Contracts and PTO Tracker show the same numbers as before.
   Recording a PTO request still updates the PTO Tracker count without a reload.
5. A manager (or a super user viewing as a manager) still sees no count on Disciplinary.

On a computer nothing changes:

6. At 1440 px wide the top bar is 56 px tall and identical to before: sections, counts, the
   **Refresh** pill with its word, the name pill with the name and role.
7. On load, each of the three count queries (`loadContractsExpiringCount`,
   `loadDisciplinaryDueCount`, `loadPtoReviewCount`) runs once, not twice.
8. No console errors on load or after clicking.

When done, reply with a one-line summary per file.
