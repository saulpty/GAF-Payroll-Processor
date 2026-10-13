# Phone: the frame (sections in a bar at the bottom, the current section named at the top)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Send only after the real-phone check (plan, Step 0) confirmed the bottom of the screen is
visible. If it is not, do not send this prompt.** (In that case the sections stay as the sliding
row in the top bar, which already works.)

Plan step M1b (`docs/superpowers/plans/2026-10-12-mobile-view.md`). On a phone-sized screen:

- **A white bar at the bottom holds the sections**, one tap away from every page, in the same
  order as on the computer: Attendance, Disciplinary, Contracts, PTO. Each is an icon over a
  short name in the section's own dark colour, with the same orange counts as the top bar.
- **Super users also get "More"**, which opens a sheet from the bottom listing Payroll and Admin,
  each with the note "Best on a computer".
- **The navy top bar no longer shows the row of sections.** It shows the name of the section the
  person is in, with a small square in that section's colour.
- **While viewing as someone**, an amber strip directly under the top bar reads
  "Viewing As <name>" with a **Stop** button. The name is never hidden.

Nothing in this frame uses `position: fixed`: the bars are ordinary rows of the page's column.
Only the sheet (a dialog) floats.

This prompt assumes `00-sections-reachable.md` and `01-switch-and-counts.md` from this folder
have been applied. It uses, and does not change: `useIsPhone()` from `src/app/lib/useIsPhone.ts`,
`NavBadges` from `src/app/lib/useNavBadges.ts`, the `phone:` Tailwind screen, and `Dialog`,
`DialogContent`, `DialogTitle`, `DialogClose` from `src/components/ui/dialog.tsx`.

**Only these files may change.** Three new: `src/app/lib/mobileNav.ts`,
`src/app/components/mobile/MobileSheet.tsx`, `src/app/components/mobile/BottomNav.tsx`. Two
edited: `src/app/app.tsx`, `src/app/TopNav.tsx`. **No other file may be touched.** No migration,
no action file.

Rules that hold for every prompt in this folder:

- Only these files may change: the five listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.

About the second rule: `MobileSheet.tsx` **imports** from `@/components/ui/dialog`. That file is
used as it is; do not open it to change anything, and do not import `@radix-ui/react-dialog`
directly.

No new loader: `BottomNav` gets the counts as the `badges` prop and never calls `useLoadAction`
or `useNavBadges`.

## 1. New file `src/app/lib/mobileNav.ts` — the whole file

```ts
// Rules for the phone's section bar. Pure: no imports, so tests/mobileShell.test.ts runs it directly.

/** Section ids for the phone, in the computer's order. `bar` = the bottom bar; `more` = under More. */
export function mobileNavItems(isSuper: boolean): { bar: string[]; more: string[] } {
  return {
    bar: ['attendance', 'disciplinary', 'contracts', 'pto'],
    more: isSuper ? ['payroll', 'admin'] : [],
  };
}

/** The orange count on a section, or null for none. One rule for the top bar and the bottom bar. */
export function navBadge(
  id: string,
  badges: { contracts: number; disciplinary: number; pto: number },
  isSuper: boolean,
): { count: number; label: string } | null {
  // A manager never sees the Disciplinary count.
  if (!isSuper && id === 'disciplinary') return null;
  if (id === 'contracts' && badges.contracts > 0) {
    return {
      count: badges.contracts,
      label: `${badges.contracts} contract${badges.contracts === 1 ? '' : 's'} ending within 30 days`,
    };
  }
  if (id === 'disciplinary' && badges.disciplinary > 0) {
    return {
      count: badges.disciplinary,
      label: `${badges.disciplinary} disciplinary re-evaluation${badges.disciplinary === 1 ? '' : 's'} due`,
    };
  }
  if (id === 'pto' && badges.pto > 0) {
    return {
      count: badges.pto,
      label: `${badges.pto} PTO request${badges.pto === 1 ? '' : 's'} ready to record`,
    };
  }
  return null;
}
```

## 2. New file `src/app/components/mobile/MobileSheet.tsx` — the whole file

```tsx
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** 'partial' hugs the bottom and is as tall as its content; 'full' takes the screen's height. */
  size?: 'partial' | 'full';
  /** Keep the children alive while the sheet is closed (their effects and loaders keep running). */
  keepMounted?: boolean;
  children: ReactNode;
};

const BODY = 'flex-1 min-h-0 overflow-y-auto overscroll-contain';

// keepMounted: the children are rendered ONCE, into `host`, a DOM node this component owns.
// While the sheet is closed the node is parked in a hidden <div>; while it is open the node is
// moved into the sheet's body. Moving a DOM node does not remount anything, so the children keep
// their state and their effects do not run again each time the sheet opens or closes.
function SheetBody({ host, parkRef }: { host: HTMLElement; parkRef: RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const slot = ref.current;
    if (!slot) return;
    slot.appendChild(host);
    return () => {
      const park = parkRef.current;
      if (park) park.appendChild(host);
      else host.remove();
    };
  }, [host, parkRef]);
  return <div ref={ref} className={BODY} />;
}

/** The one slide-up surface on a phone. Built on the app's dialog: focus, Esc and scroll lock come from it. */
export default function MobileSheet({
  open, onClose, title, subtitle, size = 'partial', keepMounted = false, children,
}: Props) {
  const subtitleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const parkRef = useRef<HTMLDivElement>(null);
  const [host] = useState<HTMLDivElement | null>(() =>
    typeof document === 'undefined' ? null : document.createElement('div'));
  const kept = keepMounted && host !== null;

  // First placement: park the node unless the sheet's body has already taken it.
  useLayoutEffect(() => {
    if (kept && host && !host.parentNode && parkRef.current) parkRef.current.appendChild(host);
  }, [kept, host]);

  return (
    <>
      {kept && host && (
        <>
          <div ref={parkRef} hidden />
          {createPortal(children, host)}
        </>
      )}
      <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
        <DialogContent
          ref={contentRef}
          aria-describedby={subtitle ? subtitleId : undefined}
          // Kept children are not this dialog's React children, so the dialog would read a tap on
          // them as a tap outside and close. A tap that lands inside the sheet never closes it.
          onInteractOutside={e => {
            const target = (e.detail?.originalEvent?.target ?? e.target) as Node | null;
            if (target && contentRef.current?.contains(target)) e.preventDefault();
          }}
          className={cn(
            'left-0 top-auto bottom-0 translate-x-0 translate-y-0 max-w-none rounded-none rounded-t-lg p-0',
            'flex flex-col overflow-hidden [&>button:last-child]:hidden',
            size === 'full' ? 'h-[calc(100%-2rem)]' : 'max-h-[85%]',
          )}
        >
          <div className="shrink-0 min-h-14 flex items-center gap-2 pl-4 pr-1 border-b border-border">
            <div className="flex-1 min-w-0 py-2">
              <DialogTitle className="text-[16px] font-semibold text-foreground">{title}</DialogTitle>
              {subtitle && (
                <p id={subtitleId} className="text-[13px] text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <DialogClose
              aria-label="Close"
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </DialogClose>
          </div>
          {kept && host
            ? <SheetBody host={host} parkRef={parkRef} />
            : <div className={BODY}>{children}</div>}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

Notes on this file, so nothing in it is "tidied":

- `[&>button:last-child]:hidden` hides the small 16 px close button that `DialogContent` always
  adds as its last child; the 44 px `DialogClose` in the title bar replaces it.
- The position classes (`left-0 top-auto bottom-0 translate-x-0 translate-y-0 …`) override the
  dialog's centred position, so the sheet is full width and sits on the bottom edge.
- `keepMounted` must stay exactly as written (one `createPortal(children, host)`, the hidden
  parking `<div>`, `SheetBody`). Do not replace it with rendering `{children}` in two places:
  that would remount the children every time the sheet opens or closes.

## 3. New file `src/app/components/mobile/BottomNav.tsx` — the whole file

```tsx
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SECTIONS, getActiveSection } from '@/app/TopNav';
import { useViewer } from '@/app/context/ViewerContext';
import { mobileNavItems, navBadge } from '@/app/lib/mobileNav';
import type { NavBadges } from '@/app/lib/useNavBadges';
import MobileSheet from '@/app/components/mobile/MobileSheet';

// Short names for the bar. A section that is not listed keeps its own label.
const SHORT_LABEL: Record<string, string> = { pto: 'PTO' };

// One button of the bar: at least 44 x 44 px to the finger, 12px text.
const ITEM = 'flex-1 min-w-11 min-h-11 flex flex-col items-center justify-center gap-1 border-t-[3px] text-[12px] leading-none select-none';
// The top bar's orange badge with navy ink, at the phone's 12px minimum.
const COUNT = 'absolute -top-1.5 left-3 bg-warm text-warm-ink text-[12px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center leading-none';

/** The phone's section bar: the last row of the frame, under the page. Rendered by Shell (app.tsx) on a phone only. */
export default function BottomNav({ badges }: { badges: NavBadges }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSuper } = useViewer();
  const [moreOpen, setMoreOpen] = useState(false);

  // SECTIONS order is the computer's order; filtering it keeps that order.
  const items = mobileNavItems(isSuper);
  const bar = SECTIONS.filter(s => items.bar.includes(s.id));
  const more = SECTIONS.filter(s => items.more.includes(s.id));
  const active = getActiveSection(location.pathname);
  const moreActive = more.some(s => s.id === active);

  return (
    <>
      <nav aria-label="Sections" className="shrink-0 h-14 flex items-stretch bg-white border-t border-slate-200 z-30">
        {bar.map(s => {
          const isActive = active === s.id;
          const b = navBadge(s.id, badges, isSuper);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => navigate(s.home)}
              aria-current={isActive ? 'page' : undefined}
              style={{ color: s.color.ink, borderTopColor: isActive ? s.color.accent : 'transparent' }}
              className={cn(ITEM, isActive ? 'font-bold bg-slate-50' : 'font-medium')}
            >
              <span className="relative flex">
                <s.icon className="w-5 h-5" aria-hidden="true" />
                {b && (
                  <span className={COUNT} aria-label={b.label}>
                    {b.count > 99 ? '99+' : b.count}
                  </span>
                )}
              </span>
              <span>{SHORT_LABEL[s.id] ?? s.label}</span>
            </button>
          );
        })}
        {more.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              ITEM, 'text-slate-600',
              moreActive ? 'font-bold bg-slate-50 border-slate-500' : 'font-medium border-transparent',
            )}
          >
            <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
            <span>More</span>
          </button>
        )}
      </nav>

      <MobileSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        {more.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => { setMoreOpen(false); navigate(s.home); }}
            aria-current={active === s.id ? 'page' : undefined}
            className="w-full min-h-14 px-4 py-2 flex items-center gap-3 text-left border-b border-border last:border-b-0 active:bg-slate-50"
          >
            <s.icon className="w-5 h-5 shrink-0" style={{ color: s.color.ink }} aria-hidden="true" />
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold" style={{ color: s.color.ink }}>{s.label}</span>
              <span className="block text-[12px] text-muted-foreground">Best on a computer</span>
            </span>
            <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
          </button>
        ))}
      </MobileSheet>
    </>
  );
}
```

## 4. `src/app/app.tsx` — two edits, nothing else

**4a.** Directly after the line

```tsx
import { useNavBadges } from '@/app/lib/useNavBadges';
```

add

```tsx
import { useIsPhone } from '@/app/lib/useIsPhone';
import BottomNav from '@/app/components/mobile/BottomNav';
```

**4b.** In `Shell`, replace

```tsx
  const badges = useNavBadges();
  return (
    <>
      <TopNav badges={badges} />
      <SectionBar />
      <main className="flex-1 overflow-auto">{children}</main>
    </>
```

with

```tsx
  const badges = useNavBadges();
  const isPhone = useIsPhone();
  return (
    <>
      <TopNav badges={badges} />
      <SectionBar />
      <main className="flex-1 overflow-auto">{children}</main>
      {isPhone && <BottomNav badges={badges} />}
    </>
```

`<TopNav badges={badges} />` and `<SectionBar />` stay on consecutive lines. `useNavBadges()` is
still called exactly once. Nothing inside `App` changes: no `<Route …>` line, no import of a page.

## 5. `src/app/TopNav.tsx` — eight edits, nothing else

**5a.** Directly after the line

```tsx
import type { NavBadges } from '@/app/lib/useNavBadges';
```

add

```tsx
import { useIsPhone } from '@/app/lib/useIsPhone';
import { navBadge } from '@/app/lib/mobileNav';
```

**5b.** The badge rule moves to `navBadge` in `mobileNav.ts` (same rule, same words), so both bars
share it. Replace

```tsx
  // The three counts are loaded once, in Shell (app.tsx), by the useNavBadges hook.
  const expiringCount = badges.contracts;
  const dueCount      = badges.disciplinary;
  const reviewCount   = badges.pto;

  function sectionBadge(id: string): { count: number; label: string } | null {
    if (!isSuper && id === 'disciplinary') return null;
    if (id === 'contracts' && expiringCount > 0) {
      return {
        count: expiringCount,
        label: `${expiringCount} contract${expiringCount === 1 ? '' : 's'} ending within 30 days`,
      };
    }
    if (id === 'disciplinary' && dueCount > 0) {
      return {
        count: dueCount,
        label: `${dueCount} disciplinary re-evaluation${dueCount === 1 ? '' : 's'} due`,
      };
    }
    if (id === 'pto' && reviewCount > 0) {
      return {
        count: reviewCount,
        label: `${reviewCount} PTO request${reviewCount === 1 ? '' : 's'} ready to record`,
      };
    }
    return null;
  }

  const activeSection = getActiveSection(location.pathname);
```

with

```tsx
  // On a phone the sections live in the bottom bar (BottomNav); this bar names the current one.
  const isPhone = useIsPhone();
  const activeSection = getActiveSection(location.pathname);
  const current = SECTIONS.find(s => s.id === activeSection) ?? null;
```

**5c.** Replace

```tsx
                const b = 'badge' in s && s.badge ? sectionBadge(s.id) : null;
```

with

```tsx
                const b = 'badge' in s && s.badge ? navBadge(s.id, badges, isSuper) : null;
```

**5d.** `TopNav` now returns two things (the bar, and on a phone the View As strip), so they are
wrapped in a fragment. Replace

```tsx
  return (
    <header className="topnav-dark shrink-0 h-14 bg-[var(--topnav)] text-[var(--topnav-foreground)] shadow-sm flex items-center px-4 gap-0 z-40 overflow-hidden phone:h-12">
```

with

```tsx
  return (
    <>
    <header className="topnav-dark shrink-0 h-14 bg-[var(--topnav)] text-[var(--topnav-foreground)] shadow-sm flex items-center px-4 gap-0 z-40 overflow-hidden phone:h-12">
```

Do not re-indent the lines inside `<header>`.

**5e.** Replace

```tsx
      <nav aria-label="Sections" className="flex items-center h-14 flex-1 min-w-0 overflow-x-auto no-scrollbar phone:h-12">
```

with

```tsx
      {isPhone ? (
        <div className="flex-1 min-w-0 flex items-center gap-2 text-[14px] font-semibold text-white">
          {current && (
            <>
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: current.color.icon }} aria-hidden="true" />
              <span className="truncate">{current.label}</span>
            </>
          )}
        </div>
      ) : (
      <nav aria-label="Sections" className="flex items-center h-14 flex-1 min-w-0 overflow-x-auto no-scrollbar phone:h-12">
```

The comment line `{/* Sections: each keeps its colour; … */}` stays where it is, directly above
`{isPhone ? (`. Everything between `<nav …>` and `</nav>` stays exactly as it is, with the same
indentation.

**5f.** Replace

```tsx
      </nav>

      <RefreshButton />
```

with

```tsx
      </nav>
      )}

      <RefreshButton />
```

**5g.** On a phone the amber pill gives way to the strip of edit 5h. Replace

```tsx
          className="ml-3 shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200"
```

with

```tsx
          className="ml-3 shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 phone:hidden"
```

**5h.** Replace

```tsx
      )}
    </header>
  );
}
```

with

```tsx
      )}
    </header>
    {/* Phone, viewing as someone: a full-width strip under the bar. The name is never hidden. */}
    {isViewingAs && isPhone && (
      <div className="shrink-0 min-h-11 flex items-center gap-2 pl-4 bg-amber-100 text-amber-800 border-b border-amber-300 text-[13px] font-medium z-40">
        <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0 py-1 break-words">Viewing As {name || email}</span>
        <button
          type="button"
          onClick={() => setViewAs('')}
          aria-label="Stop viewing as this person"
          className="shrink-0 min-h-11 min-w-11 px-4 flex items-center justify-center font-semibold underline underline-offset-2"
        >
          Stop
        </button>
      </div>
    )}
    </>
  );
}
```

After these edits: `<RefreshButton />` is still directly above the line `{isViewingAs ? (`;
`SECTIONS`, `getActiveSection` and `BADGE` are unchanged and still exported; the lines
`style={isActive ? { borderBottomColor: s.color.icon } : undefined}` and
`<s.icon className="w-4 h-4" style={{ color: s.color.icon }} />` are unchanged; `TopNav.tsx`
contains no `sectionBadge`, `expiringCount`, `dueCount` or `reviewCount`.

## Acceptance — visible facts

On a phone (the app's frame 375 × 667, then sideways at 667 × 375 on a touch device):

1. A white bar, 56 px tall, is the last row of the screen on every page. A manager (or a super
   user viewing as a manager) sees four buttons in this order: **Attendance, Disciplinary,
   Contracts, PTO**. A super user sees the same four and then **More**.
2. Each button is an icon over its name in the section's own colour. The section the person is in
   has a coloured line along its top, bold text and a light grey background.
3. Tapping a button opens that section from any page.
4. The orange counts on Contracts and PTO show the same numbers as the computer's top bar. A super
   user also sees the Disciplinary count; **a manager never sees a count on Disciplinary**.
5. Super user: tapping **More** slides up a sheet titled "More" listing **Payroll** and **Admin**,
   each with "Best on a computer" under it. Tapping one opens it and closes the sheet. The X
   (44 px) closes the sheet; so does tapping the dark area above it. With a keyboard, Tab stays
   inside the open sheet and Esc closes it.
6. The navy top bar (48 px) shows the logo, then the current section's name with a small coloured
   square, then the Refresh icon, then the person icon. It no longer shows the row of sections.
7. While viewing as someone, an amber strip directly under the top bar reads
   **Viewing As <the person's name>** with **Stop** on the right; tapping Stop ends it. The amber
   pill is not in the top bar.
8. The bottom bar scrolls with nothing: only the page between the bars scrolls. The last row of a
   long list (Contracts) can be scrolled fully into view above the bottom bar.
9. Refresh still works (the icon spins, the page's data reloads).

On a computer nothing changes:

10. At 1440 px wide there is no bottom bar and no amber strip; the top bar shows the row of
    sections with their counts, the **Refresh** pill and the name pill (or the amber
    **Viewing As <name>** pill), exactly as before.
11. No console errors on load, after each tap, or after opening and closing More.

When done, reply with a one-line summary per file.
