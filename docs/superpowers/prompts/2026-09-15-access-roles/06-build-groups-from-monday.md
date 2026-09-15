# 06 — Build groups from the Monday directory

## Files that may change

- `src/app/lib/accessSeed.ts` (new)
- `src/app/pages/admin/access/seedFromMonday.ts` (new)
- `src/app/pages/admin/access/BuildFromMonday.tsx` (new)
- `src/app/pages/admin/access/GroupsTab.tsx` — one import, one element, one empty-state sentence

No other file may be touched. In particular do NOT edit `mondaySync.ts`,
`syncDirectory.ts`, `MondayTab.tsx`, `mondayResolve.ts` or `classificationEngine.ts`
(importing from them is fine).

## Why

The Panama Employee Directory board already says who manages whom: column
`monday_col_directory_manager` (name) and the new key
`monday_col_directory_manager_email` (email). Saul wants one click that turns
that into the starting groups:

- one **manager user** per distinct manager email (role `manager`),
- one **group** per manager, with that manager as **primary** (rank 1),
- each **current** employee added to their manager's group.

It **only adds**. It never renames, re-ranks, moves or removes anything that
already exists, so Saul's hand edits survive every click. Secondary and
tertiary managers are added by hand afterwards.

Only rows in the Current Employees group count
(`item.group?.id === cfg.monday_group_directory_current`). Emails are compared
lower-cased.

## 1. `src/app/lib/accessSeed.ts` — pure, NO imports at all

Node loads this file directly in tests, so it must not import anything (not
even types from other files). Write it exactly like this:

```ts
export type DirectoryPerson = { name: string; email: string; manager: string; managerEmail: string };

export type SeedExisting = {
  users: { email: string }[];
  /** primaryEmail = email of the rank-1 manager, '' when the group has none */
  groups: { id: string; name: string; primaryEmail: string }[];
  /** every employee id already in any group */
  groupedEmployeeIds: string[];
};

export type SeedPlan = {
  users: { email: string; display_name: string }[];
  groups: { name: string; managerEmail: string }[];
  /** groupId is an existing group id, or '' for a group created by this plan (look it up by managerEmail) */
  members: { employeeId: string; managerEmail: string; groupId: string }[];
  alreadyGrouped: number;
  skipped: { name: string; reason: string }[];
};

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

export function planAccessSeed(
  people: DirectoryPerson[],
  resolveEmployeeId: (p: DirectoryPerson) => string | null,
  existing: SeedExisting,
  mode: 'seed' | 'newOnly',
): SeedPlan {
  const plan: SeedPlan = { users: [], groups: [], members: [], alreadyGrouped: 0, skipped: [] };
  const userEmails = new Set(existing.users.map(u => norm(u.email)));
  const groupByPrimary = new Map<string, string>();
  for (const g of existing.groups) {
    const e = norm(g.primaryEmail);
    if (e && !groupByPrimary.has(e)) groupByPrimary.set(e, String(g.id));
  }
  const groupNames = new Set(existing.groups.map(g => g.name.trim().toLowerCase()));
  const grouped = new Set(existing.groupedEmployeeIds.map(String));
  const plannedGroups = new Set<string>();
  const plannedMembers = new Set<string>();

  const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name));
  for (const p of sorted) {
    const empId = resolveEmployeeId(p);
    if (empId === null) { plan.skipped.push({ name: p.name, reason: 'not on the app roster' }); continue; }
    const id = String(empId);
    if (grouped.has(id) || plannedMembers.has(id)) { plan.alreadyGrouped++; continue; }

    const mgrEmail = norm(p.managerEmail);
    if (!mgrEmail) {
      plan.skipped.push({
        name: p.name,
        reason: p.manager.trim() ? `manager "${p.manager.trim()}" has no email on Monday` : 'no manager on Monday',
      });
      continue;
    }

    let groupId = groupByPrimary.get(mgrEmail) ?? '';
    if (!groupId) {
      if (mode === 'newOnly') {
        plan.skipped.push({ name: p.name, reason: `no group whose primary manager is ${mgrEmail}` });
        continue;
      }
      if (!plannedGroups.has(mgrEmail)) {
        const base = p.manager.trim() || mgrEmail;
        const name = groupNames.has(base.toLowerCase()) ? `${base} (${mgrEmail})` : base;
        groupNames.add(name.toLowerCase());
        plan.groups.push({ name, managerEmail: mgrEmail });
        plannedGroups.add(mgrEmail);
        if (!userEmails.has(mgrEmail)) {
          plan.users.push({ email: mgrEmail, display_name: p.manager.trim() || mgrEmail });
          userEmails.add(mgrEmail);
        }
      }
    }
    plan.members.push({ employeeId: id, managerEmail: mgrEmail, groupId });
    plannedMembers.add(id);
  }
  return plan;
}
```

## 2. `src/app/pages/admin/access/seedFromMonday.ts` — async, no React

```ts
import { requireKeys, pullAllItems, colText } from '@/app/pages/admin/employees/mondaySync';
import type { PullFn } from '@/app/pages/admin/employees/mondaySync';
import { planAccessSeed } from '@/app/lib/accessSeed';
import type { SeedExisting, SeedPlan } from '@/app/lib/accessSeed';

const KEYS = [
  'monday_board_directory', 'monday_col_directory_email', 'monday_col_directory_manager',
  'monday_col_directory_manager_email', 'monday_group_directory_current',
] as const;

type Row = Record<string, unknown>;
const rowsOf = (r: unknown): Row[] => (Array.isArray(r) ? r : ((r as { data?: unknown })?.data as Row[]) ?? []);
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

export type SeedDeps = {
  cfg: Record<string, string>;
  pull: PullFn;
  resolve: (name: string | null | undefined, email: string | null | undefined) => number | null;
  mode: 'seed' | 'newOnly';
  fetchUsers: () => Promise<unknown>;     // loadAppUsers
  fetchGroups: () => Promise<unknown>;    // loadAccessGroups
  fetchMembers: () => Promise<unknown>;   // loadAccessGroupMembers
  upsertUser: (p: Row) => Promise<unknown>;
  upsertGroup: (p: Row) => Promise<unknown>;
  upsertManager: (p: Row) => Promise<unknown>;
  upsertMember: (p: Row) => Promise<unknown>;
};

export type SeedResult = { usersAdded: number; groupsAdded: number; membersAdded: number; alreadyGrouped: number; skipped: SeedPlan['skipped'] };

function managersOf(g: Row): { email: string; rank: number }[] {
  const m = g.managers;
  const arr = typeof m === 'string' ? JSON.parse(m) : m;
  return Array.isArray(arr) ? arr : [];
}

async function readExisting(deps: SeedDeps) {
  const [u, g, m] = await Promise.all([deps.fetchUsers(), deps.fetchGroups(), deps.fetchMembers()]);
  const users = rowsOf(u), groups = rowsOf(g), members = rowsOf(m);
  const existing: SeedExisting = {
    users: users.map(r => ({ email: norm(r.email) })),
    groups: groups.map(r => ({
      id: String(r.id), name: String(r.name ?? ''),
      primaryEmail: norm(managersOf(r).find(x => Number(x.rank) === 1)?.email),
    })),
    groupedEmployeeIds: members.map(r => String(r.employee_id)),
  };
  const userIdByEmail = new Map(users.map(r => [norm(r.email), String(r.id)]));
  const groupIdByName = new Map(groups.map(r => [String(r.name ?? '').trim().toLowerCase(), String(r.id)]));
  return { existing, userIdByEmail, groupIdByName };
}

export async function seedFromMonday(deps: SeedDeps): Promise<SeedResult> {
  const check = requireKeys(deps.cfg, KEYS);
  if (!check.ok) throw new Error('Missing config: ' + check.missing.join(', '));
  const k = check.map;

  const items = await pullAllItems(
    k.monday_board_directory,
    [k.monday_col_directory_email, k.monday_col_directory_manager, k.monday_col_directory_manager_email],
    deps.pull,
  );
  const people = items
    .filter(it => it.group?.id === k.monday_group_directory_current)
    .map(it => ({
      name: it.name,
      email: norm(colText(it, k.monday_col_directory_email)),
      manager: colText(it, k.monday_col_directory_manager),
      managerEmail: norm(colText(it, k.monday_col_directory_manager_email)),
    }));

  const before = await readExisting(deps);
  const plan = planAccessSeed(people, p => {
    const id = deps.resolve(p.name, p.email || null);
    return id === null ? null : String(id);
  }, before.existing, deps.mode);

  for (const u of plan.users) {
    await deps.upsertUser({ id: null, email: u.email, display_name: u.display_name, role: 'manager',
      all_employees: false, active: true, notes: 'Added from the Monday directory' });
  }
  for (const g of plan.groups) {
    await deps.upsertGroup({ id: null, name: g.name, notes: 'Built from the Monday directory' });
  }

  const after = (plan.users.length || plan.groups.length) ? await readExisting(deps) : before;
  const newGroupIdByEmail = new Map<string, string>();
  for (const g of plan.groups) {
    const gid = after.groupIdByName.get(g.name.trim().toLowerCase());
    const uid = after.userIdByEmail.get(g.managerEmail);
    if (!gid || !uid) continue;
    await deps.upsertManager({ group_id: gid, user_id: uid, rank: 1 });
    newGroupIdByEmail.set(g.managerEmail, gid);
  }

  let membersAdded = 0;
  for (const m of plan.members) {
    const gid = m.groupId || newGroupIdByEmail.get(m.managerEmail) || '';
    if (!gid) continue;
    await deps.upsertMember({ group_id: gid, employee_id: m.employeeId });
    membersAdded++;
  }

  return { usersAdded: plan.users.length, groupsAdded: newGroupIdByEmail.size, membersAdded,
    alreadyGrouped: plan.alreadyGrouped, skipped: plan.skipped };
}
```

## 3. `src/app/pages/admin/access/BuildFromMonday.tsx`

Props: `{ onDone: () => void | Promise<void> }`. Wiring, copying how
`src/app/pages/admin/employees/MondayTab.tsx` builds `cfg` and the resolver
(params flat, never `{ params: … }`):

```tsx
const [configRaw]  = useLoadAction(loadClassificationConfigAction, [] as { key: string; value: string }[]);
const [empsRaw]    = useLoadAction(loadAllEmployeesAction, [] as EmpRow[]);
const [aliasesRaw] = useLoadAction(loadNameAliasesAction, [] as AliasRow[]);
const [callMondayBoard] = useMutateAction(pullMondayBoardAction);
const [fetchUsers]   = useMutateAction(loadAppUsersAction);
const [fetchGroups]  = useMutateAction(loadAccessGroupsAction);
const [fetchMembers] = useMutateAction(loadAccessGroupMembersAction);
const [upsertUser]    = useMutateAction(upsertAppUserAction);
const [upsertGroup]   = useMutateAction(upsertAccessGroupAction);
const [upsertManager] = useMutateAction(upsertAccessGroupManagerAction);
const [upsertMember]  = useMutateAction(upsertAccessGroupMemberAction);
const cfg = useMemo(() => Object.fromEntries((configRaw as { key: string; value: string }[]).map(r => [r.key, r.value])), [configRaw]);
const resolver = useMemo(() => buildResolver(empsRaw as EmpRow[], aliasesRaw as AliasRow[], normalizeName), [empsRaw, aliasesRaw]);
```

Use the same `EmpRow` / `AliasRow` shapes and the same `buildResolver` and
`normalizeName` imports as `MondayTab.tsx`.

UI:
- A `Button` (outline, small) with `RefreshCw` icon: **Build from Monday**.
- Click → `window.confirm('Read the Panama Employee Directory and add any missing manager users, one group per manager, and each current employee to their manager\'s group? Nothing that already exists is changed or removed.')`.
- While running: spinner and "Reading Monday…", button disabled.
- Calls `seedFromMonday({ cfg, pull: p => callMondayBoard(p), resolve: resolver, mode: 'seed', fetchUsers: () => fetchUsers({}), fetchGroups: () => fetchGroups({}), fetchMembers: () => fetchMembers({}), upsertUser, upsertGroup, upsertManager, upsertMember })`, then `await onDone()`.
- Result: a blue card under the toolbar, closable with `X`: "{usersAdded} manager users added · {groupsAdded} groups created · {membersAdded} employees placed · {alreadyGrouped} already in a group". If `skipped.length`, a collapsible list "{n} skipped" showing "name — reason".
- Error: red card with the message.

## 4. `src/app/pages/admin/access/GroupsTab.tsx`

- Import `BuildFromMonday` from `./BuildFromMonday`.
- In the toolbar, just before **Add group**, render `<BuildFromMonday onDone={reloadAll} />`.
- Empty-state text becomes: "No groups yet. Click Build from Monday, or add one by hand."

Change nothing else.

## Acceptance

1. Lint clean. Report the byte size of each new or changed file.
2. Then confirm every identifier used in each file is imported — every action,
   `useMemo`, `useState`, `buildResolver`, `normalizeName`, `RefreshCw`, `X`,
   `Loader2`, `Button`, `seedFromMonday`, `planAccessSeed`, `requireKeys`,
   `pullAllItems`, `colText`.
3. Do **not** click Build from Monday yourself. Saul's side runs it.

Do not build anything else. Do not offer to build the next step.
