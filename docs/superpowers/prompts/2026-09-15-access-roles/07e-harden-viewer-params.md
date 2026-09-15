# 07e — Harden: typed signed-in email everywhere, and a clean reload when "view as" changes

## Files that may change

Actions — only the `{{ user.email }}` occurrences:
- `src/actions/deleteAppUser.ts`
- `src/actions/loadAttendanceDaily.ts`
- `src/actions/loadAttendanceEmployees.ts`
- `src/actions/loadAttendanceReportDays.ts`
- `src/actions/loadContractMilestones.ts`
- `src/actions/loadContractsExpiringCount.ts`
- `src/actions/loadCurrentViewer.ts`
- `src/actions/loadMondayAttendanceFormsRange.ts`
- `src/actions/loadMondayRequestsRange.ts`
- `src/actions/loadPendingPtoRequests.ts`
- `src/actions/loadPtoBalancesInputs.ts`
- `src/actions/loadPtoEmployeeDetail.ts`
- `src/actions/loadPtoReviewCount.ts`
- `src/actions/loadVisibleEmployeeIds.ts`

Components:
- `src/app/context/ViewerContext.tsx` — `setViewAs` only
- `src/app/components/AccessGate.tsx` — the Retry button only

No other file may be touched. Do not touch `loadWhoAmI.ts`. Do not change any
other SQL, any filter logic, or any date handling.

## What happens today on `/dev`

- On a **fresh page load** everything works: a super user sees all 45 employees;
  viewing as `marcela.g@vitasyahc.com` shows exactly her 10.
- After **"Stop viewing as"** (or "View as") is clicked **inside the page**, the
  next calls fail. The console shows
  `Can't execute loadCurrentViewer action: Unknown error`, the gate shows
  "Couldn't check your access", and **Retry keeps failing**. PTO Tracker and
  Contracts then also show "Couldn't load …". A full browser reload fixes it.

Two hardening changes, both cheap:

1. In the earlier fix (prompt 02b) an "Unknown error" went away once every
   parameter carried an explicit type. `{{ user.email }}` is still untyped
   everywhere. Give it `::text` in every action above.
2. "View as" is a super-user checking tool. Switching identity should start the
   app from scratch instead of re-running dozens of loaders in place.

## 1. Actions

In each listed action file, replace **every** `{{ user.email }}` with
`{{ user.email }}::text`. That is the only change in these files. For example
`access_viewer({{ user.email }}, {{params.viewAs}}::text)` becomes
`access_viewer({{ user.email }}::text, {{params.viewAs}}::text)`, and
`lower(btrim({{ user.email }}))` becomes `lower(btrim({{ user.email }}::text))`.

## 2. `src/app/context/ViewerContext.tsx`

In `setViewAs`, after the `sessionStorage` write/remove and `setViewAsState(v);`,
add:

```ts
    window.location.reload();
```

Keep the `try/catch` around storage exactly as it is. Nothing else changes.

## 3. `src/app/components/AccessGate.tsx`

The Retry button's `onClick={reload}` becomes
`onClick={() => window.location.reload()}`. If `reload` is then unused in the
destructuring, remove only `reload` from that destructuring.

## Acceptance

1. Lint clean.
2. Report how many `{{ user.email }}::text` occurrences exist across `src/actions/`
   after the change (there were 20 `{{ user.email }}` occurrences in these 14
   files) and confirm no bare `{{ user.email }}` remains in them.
3. Then confirm every identifier used in the two components is imported.

Do not build anything else.
