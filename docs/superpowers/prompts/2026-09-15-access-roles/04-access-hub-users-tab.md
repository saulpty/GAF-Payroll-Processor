# 04 — Admin > Access, with the Users tab

## Files that may change

- `src/app/pages/admin/AdminAccessHub.tsx` (new)
- `src/app/pages/admin/access/UsersTab.tsx` (new)
- `src/app/pages/admin/access/UserForm.tsx` (new — only if `UsersTab.tsx` would exceed 12 KB without it)
- `src/app/app.tsx` — one route
- `src/app/TopNav.tsx` — one admin link and one icon import

No other file may be touched. Do not create, delete, rename or reformat
anything else. Never touch `AdminLookups.tsx` or anything under `src/components/ui/`.

## Why

Saul needs a place to manage who can open the app. Every person is one row in
`app_users`: a **super user** sees everything; a **manager** sees only the
employees in their groups, or every employee if **All employees** is ticked.
The tech team sets up SSO from a list Saul copies off this page.

Groups come in the next round. This round builds the hub and the Users tab.

## 1. `src/app/pages/admin/AdminAccessHub.tsx`

Copy the structure of `src/app/pages/admin/AdminEmployeesHub.tsx` exactly
(query-param tab strip, same classes). Differences:

- `type Tab = 'users' | 'groups';` tabs: `users` label "Users" icon `UserCog`;
  `groups` label "Groups" icon `Users` (both from `lucide-react`). Default `users`.
- Header title **Access**; subtitle "Who can open the app, and which employees
  each manager sees".
- Content: `{tab === 'users' && <UsersTab />}` and, for now,
  `{tab === 'groups' && <div className="p-6 text-sm text-slate-500">Groups are added in the next update.</div>}`.

## 2. `src/app/pages/admin/access/UsersTab.tsx`

Follow the look of `src/app/pages/admin/employees/RosterTab.tsx` (search box,
inline add/edit card, table). Actions (params flat, never `{ params: … }`):

```tsx
const [rows, loading, error, reload] = useLoadAction(loadAppUsersAction, [] as UserRow[]);
const [upsertUser, saving] = useMutateAction(upsertAppUserAction);
const [deleteUser]         = useMutateAction(deleteAppUserAction);
const { realEmail, setViewAs } = useViewer();
const navigate = useNavigate();
```

`UserRow = { id: number | string; email: string; display_name: string; role: 'super_user' | 'manager'; all_employees: boolean; active: boolean; notes: string; group_count: number }`.

Imports: `loadAppUsers`, `upsertAppUser`, `deleteAppUser` from `@/actions/…`;
`useViewer` from `@/app/context/ViewerContext`; `roleLabel`, `techTeamList`,
`normalizeEmail` from `@/app/lib/access`.

**Toolbar** (left to right): search input (filters name or email, case-insensitive);
a summary "{n} users · {s} super users · {m} managers"; **Add user** button;
**Copy list for tech team** button.

- Copy: `navigator.clipboard.writeText(techTeamList(rows))`. On success the button
  reads "Copied {active count}" for 2 seconds. If the clipboard call throws, show
  the same text in a read-only `<textarea>` under the toolbar (6 rows, monospace,
  select-all on focus) with a small "Copy it from here" note and a close ✕.

**Add / edit card** (shown above the table when adding or editing):

- Email (required; show "Enter a valid email" if it has no `@`). Saved lower-cased.
- Name.
- Role: select with **Super user** (`super_user`) and **Manager** (`manager`).
- **All employees** checkbox, enabled only when role is Manager. Help text:
  "Sees every employee, still no Payroll or Admin." When role is Super user, save
  `all_employees: false`.
- **Active** checkbox (default on). Help text: "Inactive people see the No access screen."
- Notes (single line).
- Save calls
  `upsertUser({ id: editing?.id ?? null, email: normalizeEmail(email), display_name: name.trim(), role, all_employees, active, notes: notes.trim() || null })`,
  then `await reload()` and closes the card. Cancel closes without saving. On
  error show the message in red inside the card and keep it open.

**Table** columns: Name · Email · Role · Groups · Active · Notes · (actions).

- Role: a small pill with `roleLabel(row)` — super user `bg-slate-800 text-white`,
  manager with all employees `bg-blue-100 text-blue-800`, manager `bg-emerald-100 text-emerald-800`.
- Groups: `group_count` (show "—" for super users).
- Active: green "Active" or grey "Inactive" pill.
- The signed-in person's own row (`normalizeEmail(row.email) === realEmail`) shows a
  small grey "you" tag after the name.
- Actions (icon buttons with `title`): **Edit** (`Pencil`); **View as** (`Eye`,
  title "See the app as this person") — hidden on your own row and on inactive
  rows; it calls `setViewAs(row.email)` then `navigate('/attendance')`;
  **Remove** (`Trash2`) — hidden on your own row; `window.confirm(\`Remove ${row.display_name || row.email} from the access list?\`)`,
  then `await deleteUser({ id: row.id })`, `await reload()`; if the row is still
  in the reloaded list show a red note above the table: "Could not remove — the
  last active super user cannot be removed."
- Sort as returned by the action. Loading: a spinner row. Error: red text with a Retry button.

Keep `UsersTab.tsx` under 12 KB; if it would be larger, move the add/edit card
into `access/UserForm.tsx` (props in, `onSaved`/`onCancel` out).

## 3. `src/app/app.tsx`

Import `AdminAccessHub` from `@/app/pages/admin/AdminAccessHub` and add, inside
the existing `/admin` route, after the `employees` child:

```tsx
<Route path="access" element={<AdminAccessHub />} />
```

The `/admin` parent is already wrapped in `RequireSuper`; do not add another.

## 4. `src/app/TopNav.tsx`

Add `KeyRound` to the `lucide-react` import, and in the `admin` section's `links`
array add, right after the Employees link:

```ts
{ to: '/admin/access',         label: 'Access',              icon: KeyRound },
```

Change nothing else in the file.

## Acceptance

1. Lint clean. Report the byte size of every new or changed file.
2. On `/dev`, Admin shows **Employees · Access · Schedules · …**; Access opens on
   Users and lists Saul and Tim as Super user, Saul's row tagged "you".
3. Then confirm every identifier used in each file is imported — in particular
   `useNavigate`, `useViewer`, `useLoadAction`, `useMutateAction`, `UserCog`,
   `Users`, `Eye`, `Pencil`, `Trash2`, `KeyRound`.

Do not build anything else. Do not offer to build the Groups tab.
