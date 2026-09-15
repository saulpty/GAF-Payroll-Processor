# Design — Roles and manager-scoped access (roadmap G)

Approved by Saul 2026-09-15. Execution sequence and budget rules are part of the design.


Branch: `claude/rbac-planning-7ff552` (worktree `payroll-bugs-discovery-05458c`). Date: 2026-09-15.

## Context

Saul wants two kinds of user in GAF Panama HR Hub:

- **Super user** (Saul, Tim, anyone Saul adds): sees and edits the whole app.
- **Manager**: sees everything **except the Payroll and Admin tabs**, and only the
  employees attached to them. A manager can also be marked *all employees*
  ("super manager": full roster, still no Payroll/Admin).

Employees are attached to managers through **groups** ("departments"): each group
has a primary manager plus optional secondary/tertiary managers, and a list of
employees. The first groups come from the Monday directory (manager name +
manager email); everything after that is edited by hand in Admin. The tech team
then takes the list of emails + roles and sets up SSO in UI Bakery, so managers
never "log in" to the app — they arrive with their SSO email and the app shows
only what is theirs.

This was always roadmap item **G**. About 12 loaders already accept an optional
`manager` name filter (a dropdown, not a boundary). Nothing in the app reads the
signed-in user today. Decisions Saul made in this session:

| Question | Decision |
|---|---|
| Manager edits | Allowed on their pages **except PTO** (no Record / Edit / Withdraw / Restore / Add). Closing a disciplinary case stays allowed. |
| Close-case button | Companion fix: it is small and hidden at the bottom of the case viewer. Move it to the **top** and make it prominent. |
| New hire from Monday sync | **Auto-add** to the group whose primary manager matches the row's Manager Email (fallback: manager name). Never removes anyone. |
| Unknown SSO email | Full-screen **"No access — contact Saul"**, nothing loads. |
| Seed source | Board `8592460836`, Manager name `text_mkzj84w1` (already `monday_col_directory_manager`), Manager Email `text_mkzj8b73` (**new** key `monday_col_directory_manager_email`). Other managers added manually. |
| Admin placement | New Admin link **Access** (`/admin/access`) with **Users** and **Groups** tabs. |
| Manager landing page | `/attendance` (Employee 360 later). |

Identity is keyed on **email, always lower-cased** (Monday has `arelis.a@` and
`Arelis.A@` for the same person). Names are labels only.

## Budget rules for execution (Saul's ask: save tokens, run on Opus High)

- **This plan is the spec.** A fresh session reads this file, `CLAUDE.md`, and
  only the files named by the prompt it is about to send. No re-exploration; the
  two exploration reports that produced this plan are already folded in below.
- **Every prompt is written once to its file and pasted.** No drafting in chat.
- **Verify by DOM reads, not screenshots**: `read_page` / `javascript_tool` inside
  the `/dev` iframe; one screenshot per round as proof for Saul.
- **Batch mechanical work** (the 12 admin CRUD actions are one prompt). Keep
  judgment-heavy work (probe result, scoping clause, seed planner) in their own
  small prompts.
- **Opus on High is enough** for every step: no step needs deep reasoning once
  this plan exists. The two places that need care are reading the probe result
  (prompt 00) and the `accessSeed` tests; both are spelled out here.
- Sync with `node tools/sync-export.mjs` from PowerShell; never `cat` the export.

## Design

### 1. Data model — migration `src/migrations/1782002000_access_roles.sql`

```sql
CREATE TABLE IF NOT EXISTS app_users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,                 -- stored lower-cased
  display_name  TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL CHECK (role IN ('super_user','manager')),
  all_employees BOOLEAN NOT NULL DEFAULT false,       -- "super manager"
  active        BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS access_groups (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS access_group_members (
  group_id BIGINT NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, employee_id)
);
CREATE TABLE IF NOT EXISTS access_group_managers (
  group_id BIGINT NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
  user_id  BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  rank     SMALLINT NOT NULL DEFAULT 1,               -- 1 primary, 2 secondary, 3 …
  PRIMARY KEY (group_id, user_id)
);
-- Who may see whom. One row per (viewer email, employee id).
CREATE OR REPLACE VIEW v_employee_access AS
  SELECT u.email, e.id AS employee_id
    FROM app_users u CROSS JOIN employees e
   WHERE u.active AND (u.role = 'super_user' OR u.all_employees)
  UNION
  SELECT u.email, m.employee_id
    FROM app_users u
    JOIN access_group_managers gm ON gm.user_id = u.id
    JOIN access_group_members  m  ON m.group_id = gm.group_id
   WHERE u.active AND u.role = 'manager';
-- Resolves the effective viewer. A super user may "view as" someone else;
-- anyone else is always themselves. Lower-cases both inputs.
CREATE OR REPLACE FUNCTION access_viewer(real_email TEXT, view_as TEXT) RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN COALESCE(view_as,'') <> '' AND EXISTS (
           SELECT 1 FROM app_users WHERE email = lower(real_email) AND role = 'super_user' AND active)
         THEN lower(view_as) ELSE lower(real_email) END
$$;
INSERT INTO app_users (email, display_name, role) VALUES
  ('saul.f@vitasyahc.com', 'Saul Fallembaum', 'super_user'),
  ('tim.m@vitasyahc.com',  'Timothy Moore',   'super_user')
ON CONFLICT (email) DO NOTHING;
INSERT INTO classification_config (key, value, label, description, value_type, category) VALUES
  ('monday_col_directory_manager_email', 'text_mkzj8b73', 'Directory: Manager Email column',
   'Panama Employee Directory column holding the manager''s email. Used by Access → Groups → Build from Monday and by the directory sync auto-add.', 'text', 'monday_columns')
ON CONFLICT (key) DO NOTHING;
```

No time or date values are touched anywhere in this feature.

### 2. The scope clause (the "wiring job")

`VIEWER` below means one of two expressions, decided by prompt 00:

- Server-side identity available: `access_viewer({{user.email}}, {{params.viewAs}})`
- Otherwise: `access_viewer({{params.viewerEmail}}, {{params.viewAs}})` (React passes it; UI-level enforcement only — say so to Saul).

Every scoped loader gets exactly one added line:

```sql
AND e.id IN (SELECT employee_id FROM v_employee_access WHERE email = VIEWER)
```

`loadAttendanceDaily` reads `v_attendance_daily` (email-keyed, no `employees` join) and instead gets:

```sql
AND email IN (SELECT e.teramind_email FROM employees e
              JOIN v_employee_access a ON a.employee_id = e.id WHERE a.email = VIEWER)
```

Super users pass the clause too (the view contains every employee for them), so no branching. Existing `{{params.manager}}` name filters stay as conveniences.

**Loaders to scope and their call sites** (verified by grep):

| Action | Joins `employees e`? | Call sites |
|---|---|---|
| `loadAttendanceEmployees` | yes | `FilterBar.tsx:73`, `Attendance.tsx:54`, `attendance/AttendanceReport.tsx:57` |
| `loadAttendanceDaily` | no (view, by email) | `Attendance.tsx:49` |
| `loadAttendanceReportDays` | yes | `AttendanceReport.tsx:45` |
| `loadMondayRequestsRange`, `loadMondayAttendanceFormsRange` | LEFT JOIN e (employee_id not null) | `AttendanceReport.tsx:49,53` |
| `loadPtoBalancesInputs` | yes | `pto/PtoTable.tsx:62` |
| `loadPtoEmployeeDetail` | yes | `pto/PtoBreakdown.tsx:47` |
| `loadPtoReviewCount` | yes | `TopNav.tsx:151` (currently `manager: null`) |
| `loadPendingPtoRequests` | yes | (no live call site found; scope anyway, cheap) |
| `loadContractMilestones` | yes | `contracts/ContractsTable.tsx:59` |
| `loadContractsExpiringCount` | yes | `TopNav.tsx:146` |
| `loadDisciplinaryActions` | **other database** (`SAUL Disciplinary Action Forms DB`, name-only rows) | `disciplinary/DisciplinaryTable.tsx:71` → filter in React: keep a row only if its resolved employee id is in `loadVisibleEmployeeIds`; "not on roster" rows shown to super users only |
| `loadDisciplinaryDueCount` | other database, count only | `TopNav.tsx:149` → badge hidden for non-super |
| `loadAllEmployees` | yes | Admin Roster, `RecordApprovalDialog` (hidden for managers), `DisciplinaryTable.tsx:77` (resolver needs full list) → **left unscoped**; risk noted below |

Because `loadAttendanceEmployees` is scoped, the FilterBar's Manager and Role dropdowns automatically shrink to the viewer's employees — no FilterBar logic change beyond passing the viewer param.

### 3. New actions (one per file, flat params, `{{params.x}}` never inside quotes)

Viewer: `loadCurrentViewer` (`SELECT id,email,display_name,role,all_employees,active FROM app_users WHERE email = VIEWER`), `loadVisibleEmployeeIds` (`SELECT employee_id FROM v_employee_access WHERE email = VIEWER`).

Admin CRUD: `loadAppUsers`, `upsertAppUser` (ON CONFLICT (email) DO UPDATE; email lower-cased in SQL), `deleteAppUser`, `loadAccessGroups` (groups + `json_agg` of managers with rank + member count), `loadAccessGroupMembers` (`{{params.groupId}}` → employees), `loadUnassignedEmployees` (active, not excluded, in no group), `upsertAccessGroup`, `deleteAccessGroup`, `upsertAccessGroupMember` (ON CONFLICT DO NOTHING), `deleteAccessGroupMember`, `upsertAccessGroupManager` (ON CONFLICT DO UPDATE rank), `deleteAccessGroupManager`.

The seed and the sync auto-add reuse these upserts; the planner only emits rows that do not exist, so nothing edited is ever overwritten.

### 4. Pure modules (no imports, so `node --test` loads them directly)

`src/app/lib/access.ts`:
```ts
export const SUPER_ONLY_PREFIXES = ['/process','/action-required','/payroll-master','/hrk-summary','/period-log','/admin'];
export function normalizeEmail(s: string | null | undefined): string;      // trim + lower
export function canSeePath(isSuper: boolean, path: string): boolean;
export function canSeeSection(isSuper: boolean, sectionId: string): boolean; // payroll, admin → super only
export function homeFor(isSuper: boolean): string;                            // '/payroll-master' | '/attendance'
export function roleLabel(u: {role: string; all_employees: boolean}): string; // 'Super user' | 'Manager (all employees)' | 'Manager'
export function techTeamList(users: AppUser[]): string;                       // 'email\tname\trole' lines, active only
```

`src/app/lib/accessSeed.ts` — `planAccessSeed(items, existing, mode)`:
- `items`: `{ name, email, manager, managerEmail, isCurrent }[]` from the directory board (current group only).
- `existing`: `{ users: {id,email}[], groups: {id,name,primaryEmail}[], members: {groupId,employeeId}[], employeesByEmail: Record<email, id> }`.
- `mode: 'seed' | 'newOnly'`. Returns `{ users, groups, members, managers, skipped }` to insert. Group name = manager display name; a manager without an email goes to `skipped` with a reason. `newOnly` adds memberships only for employees currently in no group and creates no users/groups. Match by lower-cased email first, then by normalised name.

### 5. React

- `src/app/context/ViewerContext.tsx` — `ViewerProvider` + `useViewer()` → `{ status: 'loading'|'blocked'|'ready', email, name, isSuper, allEmployees, viewAs, setViewAs }`. Real email comes from whatever prompt 00 found. `viewAs` (super only) is kept in `sessionStorage` and passed as `viewAs` to every scoped loader, so Saul can check any manager's view.
- `src/app/components/AccessGate.tsx` — spinner while loading; blocked page ("No access. Contact Saul — saul.f@vitasyahc.com") when no active row; children otherwise. Pages therefore never mount before the email is known.
- `src/app/components/RequireSuper.tsx` — wraps every payroll and admin route; non-super → `<Navigate to="/attendance" replace />`.
- `app.tsx` — provider + gate inside `GlobalFilterProvider`; `/` redirect and payroll/admin routes use the two components above.
- `TopNav.tsx` (11.8 KB → ~12.5 KB, stays under 15) — `SECTIONS.filter(s => canSeeSection(isSuper, s.id))`; brand click → `homeFor`; a small "Viewing as …" chip with an ✕ when `viewAs` is set; disciplinary badge only for super; pass viewer params to the counts.
- PTO write controls hidden for non-super: `PtoTracker.tsx` (Add manually), `pto/PtoRow.tsx` (Record), `pto/PtoSubRow.tsx` (Record / Edit / Withdraw / Restore). Hide, never remove code.
- `disciplinary/ActionDetail.tsx` — Close case button moved to the top of the detail panel, `size="default"`, solid variant.

### 6. Admin pages (each file < 15 KB)

- `pages/admin/AdminAccessHub.tsx` — copy of `AdminEmployeesHub.tsx` pattern; tabs `users` | `groups`.
- `pages/admin/access/UsersTab.tsx` — table (name, email, role select, all-employees checkbox, active, notes), inline add, delete with confirm, **Copy list for tech team** (uses `techTeamList`), **View as** button per row (super only; sets `viewAs`).
- `pages/admin/access/GroupsTab.tsx` — "Add group", **Build from Monday** (with result summary), red strip *Active employees in no group* (from `loadUnassignedEmployees`), one `GroupCard` per group.
- `pages/admin/access/GroupCard.tsx` — editable name, managers with rank (add from `app_users`, remove, change rank), members (add from employees, remove), delete group.
- `pages/admin/access/seedFromMonday.ts` — async, no React; `requireKeys` + `pullAllItems` + `colText` from `admin/employees/mondaySync.ts`; filters to `monday_group_directory_current`; calls `planAccessSeed(..., 'seed')`; executes via the upsert actions passed in as deps.
- Sync auto-add: `admin/employees/syncDirectory.ts` step 3b — if the manager-email key is configured, run `planAccessSeed(..., 'newOnly')` for the winners and apply memberships; `MondayTab.tsx` supplies the extra deps. Missing key → skip silently (never block the sync).

### 7. Tests (hand-written under `tests/`, baseline 274)

- `tests/access.test.ts` AX1–AX6: `normalizeEmail`, `canSeePath` (every super-only prefix, `/admin/access`, `/attendance/reports`), `homeFor`, `roleLabel`, `techTeamList` excludes inactive and is tab-separated.
- `tests/accessSeed.test.ts` AS1–AS8: one group per manager email; email casing collapses; employee with no manager email → skipped with reason; `newOnly` never emits users/groups and only unassigned employees; name fallback when email missing on the row but the group exists; nothing existing is re-emitted.
- `tests/accessGuards.test.ts` G1–G4 (structural, `lessonGuards` style): G1 every payroll/admin route element in `app.tsx` is wrapped in `RequireSuper`; G2 every action in the scoped list above contains `v_employee_access`; G3 every file under `pages/admin/access/` plus `AdminAccessHub.tsx`, `TopNav.tsx` is < 15 360 bytes; G4 `PtoSubRow.tsx` and `PtoRow.tsx` reference `isSuper`.
- Existing L1 (no `{ params:` wrapper) covers the new call sites.

## Execution sequence (one UIB round each; files under `docs/superpowers/prompts/2026-09-15-access-roles/`)

First, after approval: write the spec `docs/superpowers/specs/2026-09-15-access-roles-design.md` (this design, sections 1–7) and commit. Then:

| # | Prompt | Files it may touch | Proof on `/dev` |
|---|---|---|---|
| 00 | **Probe** (read-only Q + one throwaway action). Ask UIB's AI: does `{{user.email}}` resolve inside a SQL action in this vibe project? What does `@uibakery/data` export for the current user? Create `src/actions/loadWhoAmI.ts` = `SELECT {{user.email}} AS email` | `loadWhoAmI.ts` only | Run it in UIB; a real email comes back or it errors. Record the answer in `docs/findings/2026-09-15-uib-identity-probe.md`. Fixes `VIEWER`. |
| 01 | Migration + `loadCurrentViewer` + `loadVisibleEmployeeIds` | 3 files | DB tab shows `app_users` with 2 rows; `loadCurrentViewer` returns Saul |
| 02 | 12 admin CRUD actions (mechanical) | 12 action files | lint clean; each runs in UIB |
| 03 | `access.ts`, `ViewerContext`, `AccessGate`, `RequireSuper`, `app.tsx`, `TopNav.tsx` | 6 files | As Saul: app identical to before. Temporarily set `viewAs` to a fake email via the console → blocked page appears; clear → back. |
| 04 | `AdminAccessHub` + `UsersTab` + route + Admin link | 4 files (+ `app.tsx`, `TopNav.tsx`) | Users tab lists Saul and Tim; add/edit/delete works; Copy button yields tab-separated text |
| 05 | `GroupsTab` + `GroupCard` | 2 files | Add a group, attach a manager and an employee by hand |
| 06 | `accessSeed.ts` + `seedFromMonday.ts` + Build button wiring | 3 files | Click Build: summary shows N users / N groups / N members; groups match the Manager column; re-click adds 0 |
| 07 | Scope attendance loaders + call sites | 5 actions, `FilterBar.tsx`, `Attendance.tsx`, `AttendanceReport.tsx` | View as a manager: List and Reports show only that group; Manager dropdown shows only their name |
| 08 | Scope PTO + contracts loaders + call sites | 6 actions, `PtoTable.tsx`, `PtoBreakdown.tsx`, `ContractsTable.tsx`, `TopNav.tsx` | View as manager: PTO and Contracts scoped; badges scoped |
| 09 | Hide PTO write controls for non-super | `PtoTracker.tsx`, `PtoRow.tsx`, `PtoSubRow.tsx` | View as manager: no Record/Edit/Withdraw/Restore/Add; as Saul: unchanged |
| 10 | Disciplinary scope in React | `DisciplinaryTable.tsx` | View as manager: only their employees' cases |
| 11 | Close-case button to top, prominent | `ActionDetail.tsx` | Button visible at top of the viewer without scrolling |
| 12 | Sync auto-add | `syncDirectory.ts`, `MondayTab.tsx` | Sync now: summary line includes "N added to groups"; an unassigned test employee lands in the right group |

After each round: sync → `git status --short` shows only the allowed files → `node --test "tests/*.test.ts"` → browser check → commit. Tests for AX/AS/G land right after rounds 03 and 06 (they need the exported modules).

Wrap-up: update `src/AGENTS.md` (schema: four tables + view + function; file map: Access pages; the scope-clause rule for every future `load*`), `CLAUDE.md` non-negotiables (every scoped loader carries the clause), `docs/HANDOFF-2026-09-15.md`, and hand Saul `docs/access/tech-team-list-2026-09-15.md` (the Copy-button output) for UIB SSO setup. Merge `--ff-only` into `main`, push. Saul releases.

## Risks and how the plan handles them

- **Identity is unverified** (only an old AI-written spec claims `{{user.role}}` exists). Prompt 00 settles it before anything else. If only client-side identity exists, enforcement is UI-level; the plan still ships but Saul is told plainly.
- **`loadAllEmployees` stays unscoped** because the Disciplinary resolver and Admin need the full roster. A manager on Disciplinary downloads names/emails of everyone even though rows are filtered. Acceptable for internal SSO users; noted in the handoff.
- **Manager emails on Monday are inconsistently cased and may be blank.** Everything lower-cases; blanks go to the seed's `skipped` list, shown in the Build summary, and Saul fixes them by hand in Groups.
- **The directory sync once wrote the wrong column into `employees.manager`.** The new key is seeded from the verified column map (`docs/findings/2026-08-18-monday-column-map.md`), and the seed only *adds*, so a wrong column produces an obviously wrong group list, not silent overwrites.
- **Untouchable files stay untouched.** No prompt names `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or `src/components/ui/*`. Hiding tabs happens in `TopNav.tsx` and `app.tsx` only.
- **UIB prunes imports / adds unimported hooks.** Every prompt ends with "confirm every identifier used in each file is imported", and every round loads the page.
- **A new `load*` written later without the clause would leak.** Guard G2 plus the `CLAUDE.md` rule catch it.
