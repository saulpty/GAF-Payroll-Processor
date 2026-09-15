# 03 — Know who is signed in; block unknown people; hide Payroll and Admin from managers

## Files that may change

- `src/app/lib/access.ts` (new)
- `src/app/context/ViewerContext.tsx` (new)
- `src/app/components/AccessGate.tsx` (new)
- `src/app/components/RequireSuper.tsx` (new)
- `src/app/app.tsx`
- `src/app/TopNav.tsx`

No other file may be touched. Do not create, delete, rename or reformat
anything else. Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`,
`ActionRequired.tsx`, `AdminLookups.tsx`, `classificationEngine.ts`, or anything
under `src/components/ui/`.

## Why

The previous round created `app_users` and `loadCurrentViewer`, which returns
one row for the signed-in person (via `{{ user.email }}`), or for the email a
super user is "viewing as". Now the app uses it:

- A person not on the list (or inactive) sees a **No access** screen and nothing
  else loads.
- A **super user** sees the app exactly as today.
- A **manager** does not see the Payroll or Admin sections, cannot reach their
  pages by URL, and lands on `/attendance`.
- A super user can "view as" someone else to check what they see. The value
  lives in `sessionStorage` under `gaf_view_as`. A later round adds a button for
  it; for now it is set by hand for testing.

Data scoping (managers seeing only their employees) is a later round. This round
changes navigation only.

## 1. `src/app/lib/access.ts` — pure, NO imports at all

Tests load this file directly with Node, so it must not import anything.

```ts
export const SUPER_ONLY_PREFIXES = [
  '/process', '/action-required', '/payroll-master', '/hrk-summary', '/period-log', '/admin',
] as const;

export type ViewerRow = {
  real_email: string | null;
  email: string | null;
  id: number | string | null;
  display_name: string | null;
  role: string | null;
  all_employees: boolean | null;
  active: boolean | null;
};

export type AccessUser = {
  email: string; display_name: string; role: string; all_employees: boolean; active: boolean;
};

export function normalizeEmail(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function isSuperOnlyPath(path: string): boolean {
  return SUPER_ONLY_PREFIXES.some(p => path === p || path.startsWith(p + '/'));
}

export function canSeePath(isSuper: boolean, path: string): boolean {
  return isSuper || !isSuperOnlyPath(path);
}

export function canSeeSection(isSuper: boolean, sectionId: string): boolean {
  return isSuper || (sectionId !== 'payroll' && sectionId !== 'admin');
}

export function homeFor(isSuper: boolean): string {
  return isSuper ? '/payroll-master' : '/attendance';
}

/** 'ready' only for a known, active user. Anything else is 'blocked'. */
export function viewerStatus(row: ViewerRow | null | undefined): 'ready' | 'blocked' {
  if (!row || row.id === null || row.id === undefined || row.id === '') return 'blocked';
  return row.active === true ? 'ready' : 'blocked';
}

export function roleLabel(u: { role: string; all_employees: boolean }): string {
  if (u.role === 'super_user') return 'Super user';
  return u.all_employees ? 'Manager (all employees)' : 'Manager';
}

/** Tab-separated lines for the tech team: email, name, role. Active users only, header first. */
export function techTeamList(users: AccessUser[]): string {
  const lines = users
    .filter(u => u.active)
    .map(u => [normalizeEmail(u.email), u.display_name, roleLabel(u)].join('\t'));
  return ['Email\tName\tRole', ...lines].join('\n');
}
```

## 2. `src/app/context/ViewerContext.tsx`

```tsx
'use client';

import { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react';
import { useLoadAction } from '@uibakery/data';
import loadCurrentViewerAction from '@/actions/loadCurrentViewer';
import { viewerStatus, normalizeEmail } from '@/app/lib/access';
import type { ViewerRow } from '@/app/lib/access';

const VIEW_AS_KEY = 'gaf_view_as';

function readViewAs(): string {
  try { return normalizeEmail(window.sessionStorage.getItem(VIEW_AS_KEY)); } catch { return ''; }
}

export interface Viewer {
  status: 'loading' | 'error' | 'blocked' | 'ready';
  realEmail: string;
  email: string;
  name: string;
  isSuper: boolean;
  allEmployees: boolean;
  viewAs: string;
  isViewingAs: boolean;
  setViewAs: (email: string) => void;
  reload: () => void;
}

const ViewerContext = createContext<Viewer | null>(null);

export function ViewerProvider({ children }: { children: ReactNode }) {
  const [viewAs, setViewAsState] = useState<string>(readViewAs);

  const [rows, loading, error, reload] = useLoadAction(
    loadCurrentViewerAction,
    [] as ViewerRow[],
    { viewAs },
  );

  const setViewAs = useCallback((email: string) => {
    const v = normalizeEmail(email);
    try {
      if (v) window.sessionStorage.setItem(VIEW_AS_KEY, v);
      else window.sessionStorage.removeItem(VIEW_AS_KEY);
    } catch { /* storage unavailable */ }
    setViewAsState(v);
  }, []);

  const value = useMemo<Viewer>(() => {
    const row = (rows as ViewerRow[])[0] ?? null;
    const status: Viewer['status'] =
      loading ? 'loading' : error ? 'error' : viewerStatus(row);
    const realEmail = normalizeEmail(row?.real_email);
    const email = normalizeEmail(row?.email);
    return {
      status,
      realEmail,
      email,
      name: row?.display_name || email,
      isSuper: status === 'ready' && row?.role === 'super_user',
      allEmployees: status === 'ready' && (row?.role === 'super_user' || row?.all_employees === true),
      viewAs,
      isViewingAs: viewAs !== '' && viewAs !== realEmail,
      setViewAs,
      reload,
    };
  }, [rows, loading, error, viewAs, setViewAs, reload]);

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer(): Viewer {
  const v = useContext(ViewerContext);
  if (!v) throw new Error('useViewer must be used inside ViewerProvider');
  return v;
}
```

## 3. `src/app/components/AccessGate.tsx`

Renders children only when the viewer is `ready`. Style it like the app's
other empty states (white card, slate text, centred on a `bg-background`
full-screen area). Use `Loader2` and `ShieldX` from `lucide-react` and `Button`
from `@/components/ui/button`.

- `loading`: centred spinner and the text "Checking access…".
- `error`: "Couldn't check your access." and a **Retry** button calling `reload()`.
- `blocked`:
  - Title **No access**.
  - Text: "Your account ({realEmail}) is not on the GAF Panama HR Hub access list.
    Contact Saul at saul.f@vitasyahc.com to be added."
  - If `isViewingAs`: an extra line "You are viewing as {viewAs}, who is not on
    the list or is inactive." and a **Stop viewing as** button calling
    `setViewAs('')`.
- `ready`: `{children}`.

## 4. `src/app/components/RequireSuper.tsx`

```tsx
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useViewer } from '@/app/context/ViewerContext';
import { homeFor } from '@/app/lib/access';

export default function RequireSuper({ children }: { children: ReactNode }) {
  const { isSuper } = useViewer();
  return isSuper ? <>{children}</> : <Navigate to="/attendance" replace />;
}

export function HomeRedirect() {
  const { isSuper } = useViewer();
  return <Navigate to={homeFor(isSuper)} replace />;
}
```

## 5. `src/app/app.tsx`

- Import `ViewerProvider` from `@/app/context/ViewerContext`, `AccessGate` from
  `@/app/components/AccessGate`, and `RequireSuper, { HomeRedirect }` from
  `@/app/components/RequireSuper`.
- Nesting becomes: `BrowserRouter` > `ViewerProvider` > `AccessGate` >
  `GlobalFilterProvider` > the existing layout `div`. Nothing inside the layout
  may mount before the gate says ready.
- `<Route path="/" …>` element becomes `<HomeRedirect />`.
- Wrap the element of each of these routes in `<RequireSuper>…</RequireSuper>`:
  `/process`, `/action-required`, `/payroll-master`, `/period-log`,
  `/hrk-summary`, and the `/admin` parent route (`<RequireSuper><AdminLayout /></RequireSuper>`).
  The `/admin` child routes stay exactly as they are.
- `/contracts`, `/disciplinary`, `/pto`, `/attendance/*` are not wrapped.

## 6. `src/app/TopNav.tsx` — small, targeted edits only

- Imports: `useViewer` from `@/app/context/ViewerContext`; `canSeeSection`,
  `homeFor` from `@/app/lib/access`; add `Eye` and `X` to the existing
  `lucide-react` import.
- In `TopNav()`: `const { isSuper, isViewingAs, name, email, setViewAs } = useViewer();`
  and `const visibleSections = SECTIONS.filter(s => canSeeSection(isSuper, s.id));`
- The section buttons map over `visibleSections` instead of `SECTIONS`.
  `getActiveSection` and `activeSectionDef` stay unchanged.
- Brand click: `navigate(homeFor(isSuper))` instead of `navigate('/payroll-master')`.
- `sectionBadge`: first line `if (!isSuper) return null;` (managers get scoped
  badges in a later round). Leave the Action Required sub-link badge alone.
- After the sub-links `<nav>` block, as the last child of `<header>`, add:
  ```tsx
  {isViewingAs && (
    <button
      onClick={() => setViewAs('')}
      title="Stop viewing as this person"
      className="ml-auto shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200"
    >
      <Eye className="w-3.5 h-3.5" />
      Viewing as {name || email}
      <X className="w-3.5 h-3.5" />
    </button>
  )}
  ```
- Change nothing else in the file. It must stay under 15 KB.

## Acceptance

1. Lint clean.
2. `/dev/.../attendance` and `/dev/.../payroll-master` look exactly as before for
   Saul (all six sections, badges as before, no amber chip).
3. Report the byte size of `TopNav.tsx` and of each new file.
4. Then confirm every identifier used in each file is imported — in particular
   `useCallback`, `Navigate`, `Eye`, `X`, `Loader2`, `ShieldX`, `Button`.

Do not build anything else. Do not offer to build the next step.
