# Phone: Payroll and Admin stay computer-sized and slide; page headers wrap; the ⓘ opens on a tap

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

Plan step M3 (`docs/superpowers/plans/2026-10-12-mobile-view.md`). Three small things, all so that
every page can be reached and read on a phone:

- **Payroll and Admin are not redesigned for a phone.** Squeezed to phone width they break. So on
  a phone each of those pages is laid out in a box at least 1024 px wide, exactly as on a
  computer, and the person slides around it with a finger. The pages themselves are **not
  edited**: they are wrapped from outside, in `app.tsx` and `AdminLayout.tsx`.
- **Page headers wrap on a phone.** The buttons on the right of a page header (PTO's As Of,
  Export, Add Manually) drop under the description instead of pushing the page wider.
- **The ⓘ shows its text when clicked or tapped.** Today it only answers to a mouse hovering over
  it, and a touch screen has no hover.

This prompt relies on two things earlier prompts in this folder created; do not create or change
them: `src/app/lib/useIsPhone.ts` (exports `useIsPhone(): boolean`) and the `phone:` Tailwind
screen in `src/tailwind.config.js`.

**Only these files may change.** One new: `src/app/components/mobile/DesktopCanvas.tsx`. Five
edited: `src/app/app.tsx`, `src/app/pages/admin/AdminLayout.tsx`,
`src/app/components/PageHeader.tsx`, `src/app/components/InfoTip.tsx`,
`src/app/components/AccessGate.tsx`. **No other file may be touched.** No migration, no action file.

Rules that hold for every prompt in this folder:

- Only these files may change: the six listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.

The one intended exception to the third rule: clicking an ⓘ now also shows its text in a small
dark bubble (hovering still shows the browser's own tooltip, as today).

`ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`, `PeriodLog.tsx`, `HrkSummary.tsx`
and every Admin page are only **imported and wrapped** here. Do not open them to change anything.
`DataTable.tsx`, `AttendanceTable.tsx`, `TodayTable.tsx`, `TodayTiles.tsx` and
`AttendanceToday.tsx` use `<InfoTip text="…" />`; its props do not change, so none of them changes.

## 1. New file `src/app/components/mobile/DesktopCanvas.tsx` — the whole file

```tsx
import type { ReactNode } from 'react';
import { useIsPhone } from '@/app/lib/useIsPhone';

// Payroll and Admin are not redesigned for a phone. On a phone this lays the page out in a box at
// least 1024 px wide, exactly as on a computer, and the scroll area around it (<main>, or
// AdminLayout's own) lets the person slide to the rest. h-full keeps the height chain the pages
// rely on for their inner scroll areas.
//
// The desktop-canvas class is on the div at EVERY size and has no styles of its own: index.css
// uses it to leave Payroll and Admin out of its touch-screen rules, on tablets as well as phones.
//
// The div is ALWAYS rendered, never swapped for bare children: Process Payroll keeps an unsaved
// run in page state, and a wrapper that appears and disappears when the screen size flips would
// remount the page and lose it. On a computer the div is display: contents, which makes no box,
// so the page lays out against <main> (or AdminLayout's div) exactly as before.
export default function DesktopCanvas({ children }: { children: ReactNode }) {
  const isPhone = useIsPhone();
  return <div className={isPhone ? 'desktop-canvas h-full min-w-[1024px]' : 'desktop-canvas contents'}>{children}</div>;
}
```

Notes on this file:

- There must be exactly one `return`, and it must always return the `<div>`. Do not add an early
  `return <>{children}</>` or `return children` for the computer case, however tidy it looks.
- The `desktop-canvas` class must be in **both** branches of the class name. It has no CSS of its
  own; do not add any for it in this prompt.
- Why `contents` is safe on a computer: an element with `display: contents` generates no box of
  its own, so each page's `h-full` still resolves against `<main>` (Payroll) or against
  AdminLayout's `h-full overflow-auto` div (Admin), exactly as today. Neither of those two parents
  styles its direct children (no `space-y-*`, `divide-*`, `>` selector, `first:` or `last:`), so
  the extra element disturbs nothing.

## 2. `src/app/app.tsx` — six edits, nothing else

Each of the five route lines stays on **one line**. No other route changes: `/admin`, `/contracts`,
`/disciplinary`, `/pto`, `/attendance/*` and `/` stay exactly as they are.

**2a.** Directly after the line `import RequireSuper, { HomeRedirect } from '@/app/components/RequireSuper';` add:

```tsx
import DesktopCanvas from '@/app/components/mobile/DesktopCanvas';
```

**2b.** Replace

```tsx
<Route path="/process" element={<RequireSuper><ProcessPayroll /></RequireSuper>} />
```

with

```tsx
<Route path="/process" element={<RequireSuper><DesktopCanvas><ProcessPayroll /></DesktopCanvas></RequireSuper>} />
```

**2c.** Replace

```tsx
<Route path="/action-required" element={<RequireSuper><ActionRequired /></RequireSuper>} />
```

with

```tsx
<Route path="/action-required" element={<RequireSuper><DesktopCanvas><ActionRequired /></DesktopCanvas></RequireSuper>} />
```

**2d.** Replace

```tsx
<Route path="/payroll-master" element={<RequireSuper><PayrollMaster /></RequireSuper>} />
```

with

```tsx
<Route path="/payroll-master" element={<RequireSuper><DesktopCanvas><PayrollMaster /></DesktopCanvas></RequireSuper>} />
```

**2e.** Replace

```tsx
<Route path="/period-log" element={<RequireSuper><PeriodLog /></RequireSuper>} />
```

with

```tsx
<Route path="/period-log" element={<RequireSuper><DesktopCanvas><PeriodLog /></DesktopCanvas></RequireSuper>} />
```

**2f.** Replace

```tsx
<Route path="/hrk-summary" element={<RequireSuper><HrkSummary /></RequireSuper>} />
```

with

```tsx
<Route path="/hrk-summary" element={<RequireSuper><DesktopCanvas><HrkSummary /></DesktopCanvas></RequireSuper>} />
```

`<DesktopCanvas>` goes **inside** `<RequireSuper>`, never around it. Keep each line's indentation.

## 3. `src/app/pages/admin/AdminLayout.tsx` — the whole file becomes

```tsx
import { Outlet } from 'react-router-dom';
import DesktopCanvas from '@/app/components/mobile/DesktopCanvas';

export default function AdminLayout() {
  return (
    <div className="h-full overflow-auto">
      <DesktopCanvas>
        <Outlet />
      </DesktopCanvas>
    </div>
  );
}
```

The outer `<div className="h-full overflow-auto">` is unchanged: it is the area that slides.

## 4. `src/app/components/PageHeader.tsx` — two edits, nothing else

Class names only. The `<h1 className="sr-only">` line and the subtitle line stay exactly as they are.

**4a.** Replace

```tsx
    <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-3">
```

with

```tsx
    <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-3 phone:flex-col phone:items-stretch phone:gap-2">
```

**4b.** Replace

```tsx
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
```

with

```tsx
      {actions && <div className="flex items-center gap-2 shrink-0 phone:flex-wrap">{actions}</div>}
```

Known and accepted: HRK Summary also uses this header, and on a phone it sits inside the 1024 px
box. There its three buttons will sit under the description, at the left, instead of at the right.
Nothing is lost; do not add anything to prevent it.

## 5. `src/app/components/InfoTip.tsx` — the whole file becomes

```tsx
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

const BUBBLE_WIDTH = 240; // the bubble's max width, in px (max-w-[240px] below)
const EDGE = 8;           // room kept between the bubble and the edge of the screen, in px

// Hovering still shows the browser's own tooltip (title). A click or a tap also opens a small
// bubble with the same text, because a touch screen has no hover. The bubble is drawn on
// document.body with position: fixed, so a scrolling table cannot cut it off; it closes on a
// click or tap anywhere else, on Esc, and as soon as anything scrolls or the window resizes.
// This stays a <span>, never a <button>: DataTable puts it inside the header's sort <button>, and
// a button inside a button is invalid. stopPropagation keeps the click from also sorting.
export default function InfoTip({ text }: { text: string }) {
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (tipRef.current?.contains(t) || bubbleRef.current?.contains(t))) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  function toggle() {
    if (open) { setPos(null); return; }
    const r = tipRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(EDGE, Math.min(r.left - EDGE, window.innerWidth - BUBBLE_WIDTH - EDGE));
    // Under the icon; above it when the icon is near the bottom of the screen.
    setPos(r.bottom + 120 > window.innerHeight
      ? { left, bottom: window.innerHeight - r.top + 6 }
      : { left, top: r.bottom + 6 });
  }

  // Also runs for a click on the open bubble (React passes it up through the portal): it closes.
  function onClick(e: ReactMouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    toggle();
  }

  return (
    <span
      ref={tipRef}
      role="button"
      tabIndex={0}
      title={open ? undefined : text}
      aria-label={text}
      aria-expanded={open}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className="relative inline-flex align-[-1px] ml-1 cursor-help [@media(pointer:coarse)]:before:absolute [@media(pointer:coarse)]:before:-inset-2 [@media(pointer:coarse)]:before:content-['']"
    >
      <Info className="w-3 h-3 text-slate-400" aria-hidden="true" />
      {open && createPortal(
        <span
          ref={bubbleRef}
          role="tooltip"
          style={pos ?? undefined}
          className="fixed z-[60] block w-max max-w-[240px] cursor-default whitespace-normal rounded-md bg-slate-900 px-2.5 py-1.5 text-left text-[12px] font-normal normal-case leading-snug tracking-normal text-white shadow-lg"
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}
```

The component's props stay `{ text: string }`. Do not change any file that uses it.

## 6. `src/app/components/AccessGate.tsx` — one edit, nothing else

Replace

```tsx
    <div className="flex items-center justify-center min-h-screen bg-background">
```

with

```tsx
    <div className="flex items-center justify-center min-h-screen bg-background phone:px-4">
```

## Acceptance — visible facts

On a phone (375 × 667, and sideways 667 × 375), signed in as a super user:

1. **Payroll Master, Action Required, Process, HRK Summary and Period Log** each look like the
   computer version (same columns, same buttons, nothing squeezed or stacked) and slide both ways
   with a finger: sideways to reach the right-hand part, up and down for the rows. The one
   difference: on HRK Summary the header buttons sit under the description, at the left.
2. On **Payroll Master**, sliding right reaches the **Notes** column; the table's own rows still
   scroll up and down inside the page.
3. The six **Admin** pages (Employees, Access, Schedules, Holidays, DST Calendar, Rules & Config)
   look like the computer version and slide both ways.
4. On **Rules & Config**, sliding right reaches **Edit** and **Delete** on a row.
5. On **Process**, the name-matching step shows the unmatched name in full.
6. The bars around the page (the navy top bar, the white bar under it, the section bar) stay
   phone-sized and do not slide with the page.
7. On **Contracts**, tapping the ⓘ beside a column name shows its text in a small dark bubble next
   to it, fully inside the screen, and the table is **not** re-sorted. Tapping the column name
   itself still sorts. Tapping anywhere else, or scrolling, closes the bubble. Tapping a second ⓘ
   closes the first and opens the second.
8. On **Attendance → Today**, tapping the ⓘ beside "Live" and the ⓘ on a count tile each show
   their text.
9. On **PTO Tracker**, the header buttons (As Of, Export, Add Manually) sit under the line
   "Accrual, requests and floating holidays.", not beside it.
10. The "Checking access…" card that shows while the app loads does not touch the screen's edges.

On a computer nothing changes (1440 wide, with a mouse):

11. Every page looks exactly as before. Payroll Master, Process and Admin → Rules & Config fill
    the window as before, with no new sideways scrollbar.
12. Hovering an ⓘ still shows the browser's tooltip. **New, and the only intended change:**
    clicking an ⓘ shows the same text in a small dark bubble; clicking elsewhere, pressing Esc or
    scrolling closes it.
13. On Contracts, clicking the ⓘ in a column header does not sort the table; clicking the column
    name sorts exactly as before.
14. On a computer, on Payroll → Process, drag the window narrower than 768 px and back: the step
    you were on is still there.
15. No console errors on load, after each tap, or after each click.

When done, reply with a one-line summary per file.
