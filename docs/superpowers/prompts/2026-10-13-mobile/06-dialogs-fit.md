# Phone view M5: pop-ups fit the screen, and tables stop being a scroll box inside the page

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone, four pop-ups (Record PTO, Close Case, Delete Disciplinary Action, Activity Thresholds)
must leave a 16px margin on each side, never be taller than the screen, and scroll inside
themselves. The two side-by-side pairs inside Record PTO become one column. The tables on PTO,
Contracts and Disciplinary stop being a small scroll box inside the page: the whole page scrolls
with one finger instead.

This prompt **only adds class names that start with `phone:`** to nine existing `className="…"`
strings. `phone:` is the Tailwind screen that already exists in `src/tailwind.config.js`
(`screens: { phone: { raw: … } }`). Do not define it, do not change it. No class is removed, no
class is reordered, no line is added or removed, no logic changes.

**Only these files may change.** Eight edited, none new:
`src/app/pages/pto/RecordApprovalDialog.tsx`, `src/app/pages/pto/RecordDialogPayrollPanel.tsx`,
`src/app/pages/disciplinary/CloseCaseDialog.tsx`, `src/app/pages/disciplinary/DeleteActionDialog.tsx`,
`src/app/pages/attendance/activity/ActivityThresholds.tsx`, `src/app/pages/pto/PtoTable.tsx`,
`src/app/pages/contracts/ContractsTable.tsx`, `src/app/pages/disciplinary/DisciplinaryTable.tsx`.
**No other file may be touched.** No action file, no migration.

Rules:
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.

Also: `src/components/ui/dialog.tsx`, `src/app/components/DataTable.tsx`,
`src/app/pages/pto/RecordDialogManualFields.tsx`, `src/tailwind.config.js` and `src/index.css` are
**not** edited. Do not add a `className` to any element that has none today (`<DialogFooter>`,
`<Button>` and the rest stay exactly as they are). Do not use `sm:`, `md:` or any other breakpoint.

**About the two height classes.** Each pop-up gets `phone:max-h-[calc(100vh-2rem)]` followed by
`phone:[max-height:calc(100dvh_-_2rem)]`. Both are needed and they are written differently on
purpose: the first is the fallback for a browser that does not understand `dvh`; the second is
written as an arbitrary property (square brackets around `max-height:…`, underscores for spaces)
so that `tailwind-merge` keeps both. Do **not** "tidy" the second one into
`phone:max-h-[calc(100dvh-2rem)]` — `tailwind-merge` would then silently throw the first away.
Keep them in this order.

## 1. `src/app/pages/pto/RecordApprovalDialog.tsx` — two edits, nothing else

This file is 13,477 bytes and must stay under 15,000. Change only the two class strings below.

**1a.** Replace

```tsx
      <DialogContent className="max-w-lg">
```

with

```tsx
      <DialogContent className="max-w-lg phone:w-[calc(100%-2rem)] phone:max-h-[calc(100vh-2rem)] phone:[max-height:calc(100dvh_-_2rem)] phone:overflow-y-auto">
```

**1b.** Directly under the comment `{/* Dates */}`, replace

```tsx
          <div className="grid grid-cols-2 gap-3">
```

with

```tsx
          <div className="grid grid-cols-2 phone:grid-cols-1 gap-3">
```

(This is the only `grid grid-cols-2 gap-3` in the file: the Leave on / Return on pair.)

## 2. `src/app/pages/pto/RecordDialogPayrollPanel.tsx` — one edit, nothing else

Directly above the comment `{/* Left: requested */}`, replace

```tsx
    <div className="grid grid-cols-2 gap-3">
```

with

```tsx
    <div className="grid grid-cols-2 phone:grid-cols-1 gap-3">
```

(This is the only `grid grid-cols-2 gap-3` in the file: the "Requested on Monday" and
"In payroll" boxes.)

## 3. `src/app/pages/disciplinary/CloseCaseDialog.tsx` — one edit, nothing else

Replace

```tsx
      <DialogContent className="max-w-md">
```

with

```tsx
      <DialogContent className="max-w-md phone:w-[calc(100%-2rem)] phone:max-h-[calc(100vh-2rem)] phone:[max-height:calc(100dvh_-_2rem)] phone:overflow-y-auto">
```

## 4. `src/app/pages/disciplinary/DeleteActionDialog.tsx` — one edit, nothing else

Replace

```tsx
      <DialogContent className="max-w-md">
```

with

```tsx
      <DialogContent className="max-w-md phone:w-[calc(100%-2rem)] phone:max-h-[calc(100vh-2rem)] phone:[max-height:calc(100dvh_-_2rem)] phone:overflow-y-auto">
```

## 5. `src/app/pages/attendance/activity/ActivityThresholds.tsx` — one edit, nothing else

Replace

```tsx
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
```

with

```tsx
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto phone:w-[calc(100%-2rem)] phone:max-h-[calc(100vh-2rem)] phone:[max-height:calc(100dvh_-_2rem)]">
```

`max-w-md`, `max-h-[85vh]` and `overflow-y-auto` stay, first, exactly as they are. (This pop-up
already scrolls inside, so it gets no `phone:overflow-y-auto`.)

## 6. `src/app/pages/pto/PtoTable.tsx` — one edit, nothing else

On the `<DataTable …>` element, replace

```tsx
          className="mx-6 mb-6 max-h-[calc(100vh-260px)]"
```

with

```tsx
          className="mx-6 mb-6 max-h-[calc(100vh-260px)] phone:max-h-none phone:shrink-0"
```

## 7. `src/app/pages/contracts/ContractsTable.tsx` — one edit, nothing else

On the `<DataTable …>` element, replace

```tsx
        className="mx-6 mb-6 max-h-[calc(100vh-300px)]"
```

with

```tsx
        className="mx-6 mb-6 max-h-[calc(100vh-300px)] phone:max-h-none phone:shrink-0"
```

## 8. `src/app/pages/disciplinary/DisciplinaryTable.tsx` — one edit, nothing else

This file is 13,523 bytes and must stay under 15,000. Change only the class string below.

On the `<DataTable …>` element, replace

```tsx
      className="mx-6 mb-6 max-h-[calc(100vh-240px)]"
```

with

```tsx
      className="mx-6 mb-6 max-h-[calc(100vh-240px)] phone:max-h-none phone:shrink-0"
```

In sections 6–8 both new classes are needed. `phone:max-h-none` removes the height limit;
`phone:shrink-0` stops the table from being squeezed back into the space left on the screen
(it sits inside a column of fixed height). The `stickyHeader` line above each `className` stays.

## Acceptance — visible facts

On a phone (or the browser's phone preview, 390 × 844). **Cancel every pop-up; save nothing.**
1. PTO (super user) → expand an employee → **Record** on a request: the pop-up has a visible gap
   on the left and right edge of the screen, is not taller than the screen, and its contents
   scroll inside it. "Requested on Monday" sits above "In payroll" (one column), and "Leave on"
   sits above "Return on". Scrolling to the bottom shows **Cancel** and the Record button.
   Press **Cancel**.
2. PTO (super user) → **Add Manually**: same margin and scrolling; **Cancel** and
   **Add approval** can be reached. Press **Cancel**.
3. Disciplinary → open a case → **Close Case**: same margin; **Cancel** and **Close Case** are
   visible. Press **Cancel**.
4. Disciplinary → **Delete** on an action (Tim or Saul only): same margin; **Cancel** and
   **Delete** are visible. Press **Cancel**.
5. Attendance → Activity → **Thresholds**: same margin; the seven fields scroll inside the pop-up;
   **Cancel** and **Save** can be reached at the bottom. Press **Cancel**.
6. On PTO, on Contracts and on Disciplinary, one finger anywhere on the list scrolls the **whole
   page** from the page title to the last row. There is no second, smaller area that scrolls up
   and down on its own. A wide table still slides sideways. The column headings scroll away with
   the page (they no longer stay pinned on a phone).
7. Phone turned sideways: each pop-up still fits the height of the screen and scrolls inside.
8. **Real phone only:** in Record PTO, tap "GAF comments" so the keyboard opens. The Record /
   Save button can still be reached by scrolling inside the pop-up. Press **Cancel**.

On a computer nothing changes (mouse, window 768 px or wider):
9. The four pop-ups look exactly as before: same width, centred, the two pairs in Record PTO side
   by side.
10. The three tables are the same boxes as before, each scrolls inside itself, and the column
    headings stay pinned while it scrolls.
11. No console errors on PTO, Contracts, Disciplinary or Attendance → Activity.

When done, reply with a one-line summary per file.
