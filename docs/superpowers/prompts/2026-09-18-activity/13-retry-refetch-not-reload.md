# 13 — Activity: Retry must refetch, not reload the page (bug from prompt 12)

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

## Files that may change

- `src/app/pages/attendance/activity/useActivityData.ts`
- `src/app/pages/attendance/activity/AttendanceActivity.tsx`

No other file may be touched. Both stay under 15 KB.

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

## Acceptance (check on /dev)

1. Only the two files changed; neither contains `location.reload`.
2. The tab loads as before. (The error path cannot be forced from the UI — explain in your summary
   how `retry` is wired and how the single automatic retry is guarded against looping.)
