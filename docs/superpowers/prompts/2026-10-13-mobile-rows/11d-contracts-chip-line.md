# Phone view, rows 4d: Contracts, the chip line keeps its height

**Copy the edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only this file may change:** `src/app/pages/contracts/ContractsChips.tsx`. **No other file may be
touched.** No migration, no action file.

Rules:
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Follow the Phone section of `src/DESIGN.md`.

## Why

On a phone the chip line (`43 Employees`, `Milestone in 14 Days`, …) sits in a column of fixed
height next to a list that does not shrink. A line that slides sideways is allowed to shrink, so it
is squeezed (measured on /dev: 24 px tall with 36 px of content) and its chips are cut off. The
same fix was made for PTO in prompt 10d.

## `src/app/pages/contracts/ContractsChips.tsx` — one edit, nothing else

Replace

```tsx
    <div className="flex flex-wrap items-center gap-2 px-6 pb-3 no-scrollbar phone:flex-nowrap phone:overflow-x-auto phone:px-4 phone:-mt-3 phone:pt-3">
```

with

```tsx
    <div className="flex flex-wrap items-center gap-2 px-6 pb-3 no-scrollbar phone:flex-nowrap phone:overflow-x-auto phone:px-4 phone:-mt-3 phone:pt-3 phone:shrink-0">
```

## Acceptance — visible facts

1. On a phone, Contracts: the chips show at their full height above the first employee, and the
   line still slides sideways and still filters when a chip is tapped.
2. On a computer nothing changes.

When done, reply with a one-line summary per file.
