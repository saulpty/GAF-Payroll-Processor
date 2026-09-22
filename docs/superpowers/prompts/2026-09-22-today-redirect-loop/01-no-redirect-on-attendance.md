# 01 — Stop the redirect loop when opening Attendance

**Only these six files may change. No other file may be touched.**

- `src/app/pages/Attendance.tsx`
- `src/app/FilterBar.tsx`
- `src/app/TopNav.tsx`
- `src/app/lib/access.ts`
- `src/app/components/RequireSuper.tsx`
- `src/app/pages/admin/access/UsersTab.tsx`

Do not create files. Do not touch any action, migration or lib. Do not reformat anything you are
not asked to change.

## The bug (measured on prod, 2026-09-22)

Clicking **Attendance** in the top nav goes to `/attendance`, whose route immediately renders
`<Navigate to="/attendance/today" replace />`. The UI Bakery workbench mirrors the app's URL and,
~40 ms after our `replaceState`, writes its own remembered URL (`/attendance`) back and fires a
`popstate`. React Router re-renders `/attendance`, our `<Navigate>` runs again, and the two fight:

```
push     /attendance            (nav click)
replace  /attendance/today      (our <Navigate>)
replace  /attendance            (workbench chunk-4WD2D6MM.js)  → popstate → repeat
```

Measured: ~450 history operations and ~250 database requests in about two seconds, after which the
app settles on `/attendance` and renders the **List** tab with no tab highlighted. That is the
flash, the "messed up" page and the slow load; only a hard refresh clears it.

The fix is to stop redirecting. `/attendance` should simply *render* Today, and every link that
means "Attendance" should point at `/attendance/today` directly.

## 1. `src/app/pages/Attendance.tsx`

Delete the redirect line and make Today the default tab.

Remove `Navigate` from the react-router-dom import (keep `useLocation`):

```ts
import { useLocation } from 'react-router-dom';
```

Replace `tabFromPath` with:

```ts
function tabFromPath(pathname: string): Tab {
  if (pathname.includes('/reports'))  return 'reports';
  if (pathname.includes('/activity')) return 'activity';
  if (pathname.includes('/list'))     return 'list';
  return 'today';
}
```

Delete this line entirely:

```ts
  if (pathname === '/attendance') return <Navigate to="/attendance/today" replace />;
```

Nothing else in the file changes. `/attendance` and `/attendance/today` now both render
`<AttendanceToday />`; `/attendance/list` still renders the list.

## 2. `src/app/FilterBar.tsx`

The filter bar is keyed by path, so `/attendance` must now carry Today's controls and the list
needs its own key. In `ROUTE_CONFIG`, replace the two attendance lines

```ts
  '/attendance/today':      { employee: true, role: true, manager: true },
  '/attendance':            { periods: true, dateRange: true, employee: true, role: true, manager: true },
```

with

```ts
  '/attendance/today':      { employee: true, role: true, manager: true },
  '/attendance/list':       { periods: true, dateRange: true, employee: true, role: true, manager: true },
  '/attendance':            { employee: true, role: true, manager: true },
```

and in `ATTENDANCE_SWITCH_ROUTES` change the key `'/attendance'` to `'/attendance/list'`:

```ts
const ATTENDANCE_SWITCH_ROUTES: Record<string, 'periods' | 'dates'> = {
  '/attendance/list':      'periods',
  '/attendance/reports':   'periods',
  '/attendance/activity':  'dates',
};
```

Leave `getConfig` and everything else exactly as it is.

## 3. `src/app/TopNav.tsx`

In the `attendance` section object, change only the `home` field:

```ts
    home: '/attendance/today',
```

Leave `paths: ['/attendance']` and the four `links` untouched — the section must still highlight on
every `/attendance/*` page.

## 4. `src/app/lib/access.ts`

```ts
export function homeFor(isSuper: boolean): string {
  return isSuper ? '/payroll-master' : '/attendance/today';
}
```

## 5. `src/app/components/RequireSuper.tsx`

The redirect for a non-super user must point at the real page, not the redirecting one:

```tsx
  return isSuper ? <>{children}</> : <Navigate to="/attendance/today" replace />;
```

## 6. `src/app/pages/admin/access/UsersTab.tsx`

In the "See the app as this person" button, change `navigate('/attendance')` to
`navigate('/attendance/today')`. Nothing else on that line or in the file changes.

## How I will check it

- Clicking Attendance from Payroll Master lands on `/attendance/today` in one step, the Today tab is
  highlighted, and the URL stops changing.
- The filter bar on Today shows Employee / Manager / Role (no Periods–Dates switch); List and
  Reports still show the Periods | Dates switch with their existing defaults.
- The old `/attendance` URL still opens Today.
