# 13 — Activity: Retry must refetch, not reload the page (bug from prompt 12)

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

## Files that may change

- `src/app/pages/attendance/activity/useActivityData.ts`
- `src/app/pages/attendance/activity/AttendanceActivity.tsx`
- `src/app/components/MondayAutoSync.tsx`, `src/app/components/TeramindAutoSync.tsx`,
  `src/app/components/AccessAutoSync.tsx` — the one-line change in "Startup burst" below

No other file may be touched. All stay under 15 KB.

## What is wrong

Prompt 12 (my wording) had the **Retry** button call `window.location.reload()`. The app runs inside
UI Bakery's frame, whose own URL is not routable, so a reload lands on UI Bakery's
"404 — Page not found" screen. Seen on staging 2026-09-18. There must be no `location.reload`,
`location.href =` or `location.assign` anywhere in these two files.

## The fix

- In `useActivityData.ts`: every `useLoadAction` call returns its refetch function as the **fourth**
  tuple element (the hook already captures `reloadConfig` that way). Capture it for **all** the
  loaders the hook uses and return one function `retry: () => void` that calls every refetch.
  Keep `reloadConfig` as it is.
- One transient failure should not blank the tab: inside the hook, when `error` becomes true,
  automatically call `retry()` **once** after 1.5 seconds (guard with a `useRef` counter that resets
  when `dateFrom` / `dateTo` change or when a load succeeds) and keep reporting `loading: true`
  during that automatic retry, so the user sees the loading state rather than the red box. Only if
  the second attempt also fails does `error` surface.
- In `AttendanceActivity.tsx`: the **Retry** button calls `retry()` from the hook. Text stays
  "Couldn't Load Activity Data. It Usually Works On Retry."

## Startup burst (measured on staging 2026-09-18)

Five in-app visits to Activity: 9 of 9 queries succeed every time. The 500s only appear on a **full
page load**, when the viewer/access queries, the three background syncs and the page's own loaders
all hit the database in the same second. In each of the three auto-sync components the effect ends
with `maybeSync(); const timer = setInterval(maybeSync, 60_000);`. Replace the immediate
`maybeSync();` with a delayed first run — `const first = setTimeout(maybeSync, 20_000);` — and clear
it in the cleanup next to `clearInterval(timer)`. Nothing else in those three files changes (same
gates, same interval, same claim logic).

## Acceptance (check on /dev)

1. Only the two files changed; neither contains `location.reload`.
2. The tab loads as before. (The error path cannot be forced from the UI — explain in your summary
   how `retry` is wired and how the single automatic retry is guarded against looping.)
