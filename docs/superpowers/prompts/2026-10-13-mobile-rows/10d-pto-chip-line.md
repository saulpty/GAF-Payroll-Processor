# Phone view, rows 3d: PTO Tracker, the chip line keeps its height

**Copy the edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only this file may change:** `src/app/pages/pto/PtoTable.tsx`. **No other file may be touched.**
No migration, no action file.

Rules:
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Follow the Phone section of `src/DESIGN.md`.

## Why

On a phone the line with `43 Employees`, `To Review` and `Not Yet` sits in a column whose height
is fixed, next to a list that does not shrink. The line slides sideways, and a box that slides is
allowed to shrink to nothing, so it is squeezed to 12 px and its chips are cut in half
(measured on /dev: 12 px tall with 23 px of content).

## `src/app/pages/pto/PtoTable.tsx` — one edit, nothing else

Replace

```tsx
      <div className="flex flex-wrap items-center gap-2 px-6 pb-3 phone:flex-nowrap phone:overflow-x-auto phone:whitespace-nowrap phone:px-4">
```

with

```tsx
      <div className="flex flex-wrap items-center gap-2 px-6 pb-3 phone:flex-nowrap phone:overflow-x-auto phone:whitespace-nowrap phone:px-4 phone:shrink-0">
```

## Acceptance — visible facts

1. On a phone, PTO Tracker: the chips `43 Employees`, `To Review`, `Not Yet` show at their full
   height above the first employee, and the line still slides sideways.
2. On a computer nothing changes.

When done, reply with a one-line summary per file.
