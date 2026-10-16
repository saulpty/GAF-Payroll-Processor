# Attendance: the "List" tab is called "Punctuality"

**Copy the edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else.**

**Only this file may change:** `src/app/TopNav.tsx`. **No other file may be touched.** The address
stays `/attendance/list`; only the word on the tab changes.

## Why (Saul, 2026-10-16)

The page is a punctuality scorecard ("Punctuality by Employee"); the tab should say so.

## 1. `src/app/TopNav.tsx` — one edit, nothing else

Replace

```tsx
      { to: '/attendance/list',     label: 'List',     icon: Users },
```

with

```tsx
      { to: '/attendance/list',     label: 'Punctuality', icon: Users },
```

## Acceptance

Attendance shows the tabs Today · Activity · Punctuality · Reports; Punctuality opens the same page
the List tab did, on a computer and in the phone's tab row.
