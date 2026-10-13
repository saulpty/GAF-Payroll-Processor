# Phone view, touch floor 1: text boxes, the employee panel, floating pieces

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today: tapping a text box zooms the whole page in; the employee panel on Attendance is
at least 520 px wide, so its left 145 px (and the start of the person's name) is off the screen;
the small messages at the bottom left ("Committed 3 rows to green · Undo") and the dark
"N Selected" bar would sit on top of the bottom section
bar; and a dropdown's list can run past the right edge and closes itself the moment the keyboard
opens. This prompt fixes those five things and nothing else.

**Only these files may change.** Six edited: `src/index.css`,
`src/app/pages/attendance/AttendancePanel.tsx`, `src/app/components/ds/Toast.tsx`,
`src/app/components/ds/BulkBar.tsx`, `src/app/components/ds/Combobox.tsx`,
`src/app/components/ds/comboboxFilter.ts`. **No other file may be touched.** No migration, no
action file.

Rules:
- Only these files may change: the six listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.

Already in the app from earlier prompts. **Use them; do not create, edit or redefine them:**
- `src/app/lib/useIsPhone.ts` exports the hook `useIsPhone(): boolean` (a named export).
- `src/tailwind.config.js` has a screen named `phone`, so a class written `phone:px-4` applies
  only on a phone-sized screen. Do not replace any `phone:` class below with `sm:`, `md:` or
  `max-md:`.
- On a phone a 56 px section bar sits at the bottom of the screen, and Payroll and Admin pages
  are wrapped in an element with the class `desktop-canvas`.

If `src/app/lib/useIsPhone.ts` does not exist, stop and say so. Do not write it.

## 1. `src/index.css`: one addition at the very end, nothing else

Every existing line of this file stays exactly as it is, byte for byte: the `@tailwind` lines,
every variable (including the nine `--status-…` colours), every rule and every comment. Do not
reorder, reformat or re-indent anything. Add the block below **after the last line of the file**
(the `}` that closes the `.topnav-dark` rule), with one blank line before it:

```css
/* Touch screens (phones and tablets), 2026-10-13. A computer with a mouse never matches
   (pointer: coarse), so nothing in this block reaches it. */
@media (pointer: coarse) {
  /* Text boxes at 16px: below that, a phone zooms the whole page in when one is tapped.
     Not inside .desktop-canvas: Payroll and Admin on a phone keep their computer sizing.
     Each :not(...) makes the selector more specific than a single Tailwind class
     (text-sm, text-xs, text-[12px] ...), so this wins without !important. */
  input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not(.desktop-canvas *),
  select:not(.desktop-canvas *),
  textarea:not(.desktop-canvas *) {
    font-size: 16px;
  }

  /* Add the class "tap" to anything tappable that is drawn smaller than 44 x 44. */
  .tap {
    min-width: 44px;
    min-height: 44px;
  }

  /* Reaching the end of a list must not drag whatever is behind it, or start the browser's
     pull-down reload: the page scroller, pop-ups and sheets, and open dropdown lists. */
  html,
  body,
  main,
  [role="dialog"],
  [role="listbox"] {
    overscroll-behavior: contain;
  }
}
```

Nothing may be added outside that one `@media (pointer: coarse) { … }` block. Do not add
`!important` anywhere in it.

## 2. `src/app/pages/attendance/AttendancePanel.tsx`: six edits, nothing else

**2a.** Directly after the line `import { useGlobalFilters } from '@/app/context/GlobalFilterContext';` add:

```tsx
import { useIsPhone } from '@/app/lib/useIsPhone';
```

**2b.** Inside `AttendancePanel`, directly after the line `  const { dateFrom, dateTo } = useGlobalFilters();` add:

```tsx
  const isPhone = useIsPhone();
```

It must stay there, above the line `if (!stats && resolvedId === null) return null;` (a hook may
not come after an early return).

**2c.** Replace

```tsx
        className="fixed top-0 right-0 bottom-0 bg-white z-50 overflow-y-auto shadow-2xl flex flex-col"
        style={{
          width: 'clamp(520px, 55vw, 900px)',
```

with

```tsx
        className="fixed top-0 right-0 bottom-0 bg-white z-50 overflow-y-auto shadow-2xl flex flex-col phone:overscroll-contain"
        style={{
          width: isPhone ? '100%' : 'clamp(520px, 55vw, 900px)',
```

The `animation: 'slideInRight …'` line directly below stays exactly as it is.

**2d.** Replace

```tsx
        <div className="sticky top-0 bg-white border-b border-border px-7 py-5 flex items-start justify-between z-10">
```

with

```tsx
        <div className="sticky top-0 bg-white border-b border-border px-7 py-5 flex items-start justify-between z-10 phone:px-4">
```

**2e.** Replace

```tsx
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-border transition-colors shrink-0 ml-4"
```

with

```tsx
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-border transition-colors shrink-0 ml-4 phone:w-11 phone:h-11"
```

**2f.** Replace

```tsx
        <div className="p-7 flex flex-col gap-6">
```

with

```tsx
        <div className="p-7 flex flex-col gap-6 phone:p-4">
```

Everything inside the panel (`AttendancePanelKpis`, `AttendancePanelBody`, `AttendancePanelDays`,
the overlay, the `Initials` circle, the hooks) stays exactly as it is.

## 3. `src/app/components/ds/Toast.tsx`: four edits, class strings only

**3a.** Replace

```tsx
      <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex w-80 flex-col gap-2">
```

with

```tsx
      <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex w-80 flex-col gap-2 phone:bottom-[144px] phone:left-3 phone:right-3 phone:w-auto phone:max-w-sm">
```

(144 px = the 56 px section bar, a 16 px gap, the "N Selected" bar from section 4, and a 12 px
gap, so a message never covers that bar's buttons.)

**3b.** Replace

```tsx
      className={`pointer-events-auto flex items-start gap-2 rounded-md border bg-white px-3 py-2 text-[12px] shadow-lg ${
```

with

```tsx
      className={`pointer-events-auto flex items-start gap-2 rounded-md border bg-white px-3 py-2 text-[12px] shadow-lg phone:items-center ${
```

**3c.** Replace

```tsx
          className="font-medium text-warm-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
```

with

```tsx
          className="font-medium text-warm-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring phone:min-h-11 phone:px-2"
```

**3d.** Replace

```tsx
        className="rounded p-0.5 text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
```

with

```tsx
        className="rounded p-0.5 text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring phone:inline-flex phone:min-h-11 phone:min-w-11 phone:items-center phone:justify-center"
```

The timers, the two live regions (`role="alert"` and `role="status"`), the hover and focus pause
and everything else in the file stay exactly as they are.

## 4. `src/app/components/ds/BulkBar.tsx`: four edits, class strings only

`position: fixed` is measured from the screen, not from the page. So on a phone, where Action
Required is a computer-sized page that slides sideways, this bar stays put on the screen while
the page slides under it. The classes below pin it 12 px inside both screen edges and above the
section bar.

**4a.** In `BulkBar`, replace

```tsx
      className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-[12px] text-white shadow-xl"
```

with

```tsx
      className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-[12px] text-white shadow-xl phone:bottom-[72px] phone:left-3 phone:right-3 phone:mx-auto phone:max-w-md phone:translate-x-0 phone:flex-wrap phone:justify-center phone:rounded-2xl"
```

**4b.** In `BulkBar` (the Clear button), replace

```tsx
        className="rounded-full px-2 py-1 font-medium text-white/80 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
```

with

```tsx
        className="rounded-full px-2 py-1 font-medium text-white/80 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring phone:min-h-11 phone:px-3"
```

**4c.** In `BulkPrimaryButton`, replace

```tsx
      className="rounded-full bg-warm px-3 py-1 font-semibold text-warm-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring disabled:opacity-50"
```

with

```tsx
      className="rounded-full bg-warm px-3 py-1 font-semibold text-warm-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring disabled:opacity-50 phone:min-h-11 phone:px-4"
```

**4d.** In `BulkButton`, replace

```tsx
      className="rounded-full border border-white/25 px-3 py-1 text-white/90 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring disabled:opacity-50"
```

with

```tsx
      className="rounded-full border border-white/25 px-3 py-1 text-white/90 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring disabled:opacity-50 phone:min-h-11 phone:px-4"
```

`if (count < 2) return null;` and everything else stay exactly as they are.

## 5. `src/app/components/ds/comboboxFilter.ts`: one addition at the end, nothing else

`filterOptions` and `nextIndex` stay exactly as they are. After the closing `}` of `nextIndex`
(the last line of the file) add a blank line and then:

```ts
/**
 * Keeps a floating list inside the screen's left and right edges: never wider than the
 * screen less a margin each side, never past either edge. A list that already fits is
 * returned unchanged.
 */
export function clampPopup(
  left: number,
  width: number,
  viewportWidth: number,
  margin = 8,
): { left: number; width: number } {
  const w = Math.min(width, Math.max(0, viewportWidth - margin * 2));
  const l = Math.max(margin, Math.min(left, viewportWidth - margin - w));
  return { left: l, width: w };
}
```

This file must stay free of imports.

## 6. `src/app/components/ds/Combobox.tsx`: four edits, nothing else

On a computer every line below behaves exactly as today, because `isPhone` is false there.

**6a.** Replace

```tsx
import { filterOptions, nextIndex } from '@/app/components/ds/comboboxFilter';
```

with

```tsx
import { clampPopup, filterOptions, nextIndex } from '@/app/components/ds/comboboxFilter';
import { useIsPhone } from '@/app/lib/useIsPhone';
```

**6b.** Directly after the line `  const searchable = options.length > 7;` add:

```tsx
  const isPhone = useIsPhone();
```

**6c.** Replace

```tsx
    setPos({
      position: 'fixed', left: r.left, width: Math.max(r.width, 180), zIndex: 60, maxHeight: room,
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
  }, [open]);
```

with

```tsx
    // On a phone the list is kept inside the screen's left and right edges.
    const want = { left: r.left, width: Math.max(r.width, 180) };
    const box = isPhone ? clampPopup(want.left, want.width, window.innerWidth) : want;
    setPos({
      position: 'fixed', left: box.left, width: box.width, zIndex: 60, maxHeight: room,
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
  }, [open, isPhone]);
```

**6d.** Replace

```tsx
    const onScroll = (e: Event) => { if (!inside(e.target)) setOpen(false); };
    const onResize = () => setOpen(false);
```

with

```tsx
    // On a phone the on-screen keyboard pans the whole page and changes the window's height.
    // Neither may close the list: only a scroll of the page area or a table, or a change of
    // width (turning the phone), does.
    const openWidth = window.innerWidth;
    const pagePan = (t: EventTarget | null) => t === document || t === document.documentElement || t === document.body;
    const onScroll = (e: Event) => { if (!inside(e.target) && !(isPhone && pagePan(e.target))) setOpen(false); };
    const onResize = () => { if (!isPhone || window.innerWidth !== openWidth) setOpen(false); };
```

and, in the same `useEffect`, replace

```tsx
      window.removeEventListener('resize', onResize);
    };
  }, [open]);
```

with

```tsx
      window.removeEventListener('resize', onResize);
    };
  }, [open, isPhone]);
```

The three `addEventListener` lines, the three `removeEventListener` lines, `onDocPointer`, the
third `useEffect` (the one that ends with the `eslint-disable-next-line` comment and
`}, [open]);`), `createPortal`, and every class string in this file stay exactly as they are.

## Acceptance — visible facts

On a phone-sized screen (375 × 667):
1. Attendance → Today, tap an employee: the panel covers the whole screen. Its left edge, the
   initials circle and the start of the person's name are visible, with a 16 px margin each side.
   The round close button is 44 px and closes the panel.
2. Payroll → Action Required, tick two rows: the dark "2 Selected" bar appears above the bottom
   section bar, fully inside the screen, with its three parts readable (the count, "Commit 2 to
   Green", "Clear") and each button at least 44 px tall. Sliding the page sideways does not move
   the bar. Tap Clear; commit nothing.
3. On Action Required, change one row's Event **without committing**, then choose another period:
   the message "Discarded 1 unsaved row when the period changed." appears above the place the
   "N Selected" bar uses, inside both screen edges, and its × is at least 44 px. (This saves
   nothing. Do not commit a row just to see a message.)
4. On Action Required, slide the page so a dropdown near the right edge is visible and open it:
   the whole list is inside the screen, 8 px or more from the right edge.
5. No console errors on load or after each tap.

On a real phone only (a narrowed computer window cannot show these):
6. Tapping a text box on Attendance, PTO, Contracts or Disciplinary (the employee search box, a
   date box, a text box inside a pop-up) does not zoom the page in.
7. Opening a dropdown that has a Search box (more than 7 options), then tapping Search so the
   keyboard opens: the list stays open and typing filters it.
8. Pulling down at the top of a list, and pulling past the end of the employee panel, does not
   reload the page or drag the page behind.
9. Text boxes on Payroll and Admin pages keep their small computer size.

On a computer nothing changes (1440 wide, mouse):
10. The employee panel is the same width as before (about 55% of the window, never under 520 px)
    with the same padding and the same 32 px close button.
11. A message appears bottom-left, 320 px wide; the "N Selected" bar is a centred pill at
    the bottom. Both exactly as before.
12. A dropdown list opens under its field at the same position and width as before, closes when
    the page or the table scrolls, and closes when the window is resized.
13. Text boxes are the same size as before on every page.

When done, reply with a one-line summary per file.
