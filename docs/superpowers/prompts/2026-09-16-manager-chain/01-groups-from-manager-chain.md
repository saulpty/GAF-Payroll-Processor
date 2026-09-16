# 01 — Access groups from the ordered manager list (Manager, Manager 2, 3, 4)

## Files that may change

- `src/migrations/1782002100_access_manager_chain_config.sql` (new) — create and apply
- `src/app/lib/accessSeed.ts` — replace the whole file
- `src/app/pages/admin/access/seedFromMonday.ts` — replace the whole file
- `src/app/pages/admin/access/BuildFromMonday.tsx` — replace the whole file
- `src/app/pages/admin/access/useGroupPlacement.ts` — one line (section 5)
- `src/app/pages/admin/access/GroupsTab.tsx` — one string (section 6)

No other file may be touched. Do not change any action. Do not touch `MondayTab.tsx`.

## Why

Saul now keeps up to four managers per employee on the Panama Employee Directory, in
priority order: **Manager** (direct report, rank 1), **Manager 2** (rank 2), **Manager 3**
(rank 3), **Manager 4** (rank 4). Each has a name column and an email column. The manager's
**email is their identity**; names are labels only.

New rule for groups: **employees with the same ordered list of manager emails share one
group**, and that group's managers are ranked 1..n in that order. Example: everyone whose
list is Arelis Acosta → Lily Beasly → Chaya Lichy → Shari Jurado is one group named
`Arelis Acosta · Lily Beasly · Chaya Lichy · Shari Jurado`.

"Build from Monday" becomes **Rebuild from Monday**: it deletes every group (members and
manager links cascade) and rebuilds them from the directory. Users (`app_users`) are never
deleted or changed; missing manager users are added. The directory **Sync now** keeps using
`mode: 'newOnly'`: it only places employees who are in no group, reusing a group with the
same ordered list or creating one.

Column ids were measured on 2026-09-16 in Monday's API playground (board 8592460836). The
board has **two** columns titled "Manager 4" and two titled "Manager 4 Email"; only
`text_mm78whj1` / `text_mm78hgkr` hold data (8 rows). `text_mm78rm06` / `text_mm78sxm1` are
empty and must NOT be used.

## 1. Migration `src/migrations/1782002100_access_manager_chain_config.sql`

Create this file with exactly this SQL, then apply it.

```sql
-- Access roles: Manager 2/3/4 name + email columns on the Panama Employee Directory.
-- Measured 2026-09-16 (API playground). Inserts config rows only.
-- Rollback: DELETE FROM classification_config WHERE key IN ('monday_col_directory_manager2',
--   'monday_col_directory_manager2_email','monday_col_directory_manager3','monday_col_directory_manager3_email',
--   'monday_col_directory_manager4','monday_col_directory_manager4_email');
INSERT INTO classification_config (key, value, label, description, value_type, category) VALUES
  ('monday_col_directory_manager2', 'text_mm785e8r', 'Directory: Manager 2 column',
   'Panama Employee Directory: second manager (name). Rank 2 in Admin > Access groups.', 'text', 'monday_columns'),
  ('monday_col_directory_manager2_email', 'text_mm15y2vw', 'Directory: Manager 2 Email column',
   'Panama Employee Directory: second manager email. Rank 2 in Admin > Access groups.', 'text', 'monday_columns'),
  ('monday_col_directory_manager3', 'text_mm786kge', 'Directory: Manager 3 column',
   'Panama Employee Directory: third manager (name). Rank 3 in Admin > Access groups.', 'text', 'monday_columns'),
  ('monday_col_directory_manager3_email', 'text_mm78fxpg', 'Directory: Manager 3 Email column',
   'Panama Employee Directory: third manager email. Rank 3 in Admin > Access groups.', 'text', 'monday_columns'),
  ('monday_col_directory_manager4', 'text_mm78whj1', 'Directory: Manager 4 column',
   'Panama Employee Directory: fourth manager (name). The board has two "Manager 4" columns; this is the one with data.', 'text', 'monday_columns'),
  ('monday_col_directory_manager4_email', 'text_mm78hgkr', 'Directory: Manager 4 Email column',
   'Panama Employee Directory: fourth manager email. The board has two "Manager 4 Email" columns; this is the one with data.', 'text', 'monday_columns')
ON CONFLICT (key) DO NOTHING;
```

Write the next three files **exactly as given, character for character**. Do not redesign,
rename, reorder or simplify. The planner has tests pinned to this exact API.

## 2. `src/app/lib/accessSeed.ts` — NO imports

```ts
/** One slot from the directory: Manager, Manager 2, Manager 3, Manager 4 (in that order). */
export type ManagerSlot = { name: string; email: string };
export type DirectoryPerson = { name: string; email: string; managers: ManagerSlot[] };

export type SeedExisting = {
  users: { email: string }[];
  /** managerEmails = the group's managers ordered by rank */
  groups: { id: string; name: string; managerEmails: string[] }[];
  /** every employee id already in any group */
  groupedEmployeeIds: string[];
};

export type PlannedGroup = { key: string; name: string; managers: { email: string; rank: number }[] };

export type SeedPlan = {
  users: { email: string; display_name: string }[];
  groups: PlannedGroup[];
  /** groupId is an existing group id, or '' for a group created by this plan (look it up by key) */
  members: { employeeId: string; key: string; groupId: string }[];
  alreadyGrouped: number;
  skipped: { name: string; reason: string }[];
};

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** The group key for an ordered list of manager emails: "a@x > b@x". */
export function chainKey(emails: string[]): string {
  return emails.map(norm).filter(Boolean).join(' > ');
}

/** Ordered, lower-cased, de-duplicated managers; or a reason when a slot has a name but no email. */
export function managerChain(slots: ManagerSlot[]): { chain: ManagerSlot[] } | { reason: string } {
  const chain: ManagerSlot[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < slots.length; i++) {
    const email = norm(slots[i].email);
    const name = (slots[i].name ?? '').trim();
    if (!email) {
      if (name) return { reason: `${i === 0 ? 'Manager' : `Manager ${i + 1}`} "${name}" has no email on Monday` };
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    chain.push({ name, email });
  }
  return chain.length ? { chain } : { reason: 'no manager on Monday' };
}

export function planAccessSeed(
  people: DirectoryPerson[],
  resolveEmployeeId: (p: DirectoryPerson) => string | null,
  existing: SeedExisting,
): SeedPlan {
  const plan: SeedPlan = { users: [], groups: [], members: [], alreadyGrouped: 0, skipped: [] };
  const userEmails = new Set(existing.users.map(u => norm(u.email)));
  const groupByKey = new Map<string, string>();
  for (const g of existing.groups) {
    const k = chainKey(g.managerEmails);
    if (k && !groupByKey.has(k)) groupByKey.set(k, String(g.id));
  }
  const groupNames = new Set(existing.groups.map(g => g.name.trim().toLowerCase()));
  const grouped = new Set(existing.groupedEmployeeIds.map(String));
  const plannedKeys = new Set<string>();
  const plannedMembers = new Set<string>();

  const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name));
  for (const p of sorted) {
    const empId = resolveEmployeeId(p);
    if (empId === null) { plan.skipped.push({ name: p.name, reason: 'not on the app roster' }); continue; }
    const id = String(empId);
    if (grouped.has(id) || plannedMembers.has(id)) { plan.alreadyGrouped++; continue; }

    const mc = managerChain(p.managers);
    if ('reason' in mc) { plan.skipped.push({ name: p.name, reason: mc.reason }); continue; }
    const key = chainKey(mc.chain.map(m => m.email));

    const groupId = groupByKey.get(key) ?? '';
    if (!groupId && !plannedKeys.has(key)) {
      const base = mc.chain.map(m => m.name || m.email).join(' · ');
      let name = base;
      for (let n = 2; groupNames.has(name.toLowerCase()); n++) name = `${base} (${n})`;
      groupNames.add(name.toLowerCase());
      plan.groups.push({ key, name, managers: mc.chain.map((m, i) => ({ email: m.email, rank: i + 1 })) });
      plannedKeys.add(key);
    }
    for (const m of mc.chain) {
      if (!userEmails.has(m.email)) {
        plan.users.push({ email: m.email, display_name: m.name || m.email });
        userEmails.add(m.email);
      }
    }
    plan.members.push({ employeeId: id, key, groupId });
    plannedMembers.add(id);
  }
  return plan;
}
```

## 3. `src/app/pages/admin/access/seedFromMonday.ts`

```ts
import { requireKeys, pullAllItems, colText } from '@/app/pages/admin/employees/mondaySync';
import type { PullFn } from '@/app/pages/admin/employees/mondaySync';
import { planAccessSeed } from '@/app/lib/accessSeed';
import type { SeedExisting, SeedPlan } from '@/app/lib/accessSeed';

/** Manager slots in priority order: [name key, email key]. Manager (no number) is the direct manager. */
export const MANAGER_SLOT_KEYS = [
  ['monday_col_directory_manager', 'monday_col_directory_manager_email'],
  ['monday_col_directory_manager2', 'monday_col_directory_manager2_email'],
  ['monday_col_directory_manager3', 'monday_col_directory_manager3_email'],
  ['monday_col_directory_manager4', 'monday_col_directory_manager4_email'],
] as const;

const KEYS = [
  'monday_board_directory', 'monday_col_directory_email', 'monday_group_directory_current',
  ...MANAGER_SLOT_KEYS.flat(),
] as const;

type Row = Record<string, unknown>;
const rowsOf = (r: unknown): Row[] => (Array.isArray(r) ? r : ((r as { data?: unknown })?.data as Row[]) ?? []);
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

export type SeedDeps = {
  cfg: Record<string, string>;
  pull: PullFn;
  resolve: (name: string | null | undefined, email: string | null | undefined) => number | null;
  /** rebuild: delete every group first, then build all groups from Monday. newOnly: place only employees in no group. */
  mode: 'rebuild' | 'newOnly';
  fetchEmployees?: () => Promise<unknown>; // loadAllEmployees, fresh
  fetchUsers: () => Promise<unknown>;
  fetchGroups: () => Promise<unknown>;
  fetchMembers: () => Promise<unknown>;
  deleteGroup?: (p: Row) => Promise<unknown>; // required for rebuild
  upsertUser: (p: Row) => Promise<unknown>;
  upsertGroup: (p: Row) => Promise<unknown>;
  upsertManager: (p: Row) => Promise<unknown>;
  upsertMember: (p: Row) => Promise<unknown>;
};

export type SeedResult = {
  groupsRemoved: number; usersAdded: number; groupsAdded: number; membersAdded: number;
  alreadyGrouped: number; skipped: SeedPlan['skipped'];
};

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
      managerEmails: [...managersOf(r)].sort((a, b) => Number(a.rank) - Number(b.rank)).map(x => norm(x.email)),
    })),
    groupedEmployeeIds: members.map(r => String(r.employee_id)),
  };
  const userIdByEmail = new Map(users.map(r => [norm(r.email), String(r.id)]));
  const groupIdByName = new Map(groups.map(r => [String(r.name ?? '').trim().toLowerCase(), String(r.id)]));
  return { groups, existing, userIdByEmail, groupIdByName };
}

export async function seedFromMonday(deps: SeedDeps): Promise<SeedResult> {
  const check = requireKeys(deps.cfg, KEYS);
  if (!check.ok) throw new Error('Missing config: ' + check.missing.join(', '));
  const k = check.map as Record<string, string>;

  const items = await pullAllItems(
    k.monday_board_directory,
    [k.monday_col_directory_email, ...MANAGER_SLOT_KEYS.flat().map(key => k[key])],
    deps.pull,
  );
  const people = items
    .filter(it => it.group?.id === k.monday_group_directory_current)
    .map(it => ({
      name: it.name,
      email: norm(colText(it, k.monday_col_directory_email)),
      managers: MANAGER_SLOT_KEYS.map(([nameKey, emailKey]) => ({
        name: colText(it, k[nameKey]), email: norm(colText(it, k[emailKey])),
      })),
    }));

  const freshByEmail = new Map<string, string>();
  if (deps.fetchEmployees) {
    for (const r of rowsOf(await deps.fetchEmployees())) {
      const e = norm(r.teramind_email);
      if (e) freshByEmail.set(e, String(r.id));
    }
  }

  let groupsRemoved = 0;
  let before = await readExisting(deps);
  if (deps.mode === 'rebuild') {
    if (!deps.deleteGroup) throw new Error('Rebuild needs deleteGroup');
    for (const g of before.groups) { await deps.deleteGroup({ id: String(g.id) }); groupsRemoved++; }
    before = await readExisting(deps);
  }

  const plan = planAccessSeed(people, p => {
    const byEmail = p.email ? freshByEmail.get(p.email) : undefined;
    if (byEmail) return byEmail;
    const id = deps.resolve(p.name, p.email || null);
    return id === null ? null : String(id);
  }, before.existing);

  for (const u of plan.users) {
    await deps.upsertUser({ id: null, email: u.email, display_name: u.display_name, role: 'manager',
      all_employees: false, active: true, notes: 'Added from the Monday directory' });
  }
  for (const g of plan.groups) {
    await deps.upsertGroup({ id: null, name: g.name, notes: 'Built from the Monday directory' });
  }

  const after = (plan.users.length || plan.groups.length) ? await readExisting(deps) : before;
  const newGroupIdByKey = new Map<string, string>();
  for (const g of plan.groups) {
    const gid = after.groupIdByName.get(g.name.trim().toLowerCase());
    if (!gid) continue;
    for (const m of g.managers) {
      const uid = after.userIdByEmail.get(m.email);
      if (uid) await deps.upsertManager({ group_id: gid, user_id: uid, rank: m.rank });
    }
    newGroupIdByKey.set(g.key, gid);
  }

  let membersAdded = 0;
  for (const m of plan.members) {
    const gid = m.groupId || newGroupIdByKey.get(m.key) || '';
    if (!gid) continue;
    await deps.upsertMember({ group_id: gid, employee_id: m.employeeId });
    membersAdded++;
  }

  return { groupsRemoved, usersAdded: plan.users.length, groupsAdded: newGroupIdByKey.size, membersAdded,
    alreadyGrouped: plan.alreadyGrouped, skipped: plan.skipped };
}
```

## 4. `src/app/pages/admin/access/BuildFromMonday.tsx`

```tsx
import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { RefreshCw, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import loadClassificationConfigAction from '@/actions/loadClassificationConfig';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import loadNameAliasesAction from '@/actions/loadNameAliases';
import pullMondayBoardAction from '@/actions/pullMondayBoard';
import loadAppUsersAction from '@/actions/loadAppUsers';
import loadAccessGroupsAction from '@/actions/loadAccessGroups';
import loadAccessGroupMembersAction from '@/actions/loadAccessGroupMembers';
import deleteAccessGroupAction from '@/actions/deleteAccessGroup';
import upsertAppUserAction from '@/actions/upsertAppUser';
import upsertAccessGroupAction from '@/actions/upsertAccessGroup';
import upsertAccessGroupManagerAction from '@/actions/upsertAccessGroupManager';
import upsertAccessGroupMemberAction from '@/actions/upsertAccessGroupMember';
import { buildResolver } from '@/app/lib/mondayResolve';
import { normalizeName } from '@/app/lib/classificationEngine';
import { seedFromMonday } from './seedFromMonday';
import type { SeedResult } from './seedFromMonday';

type ResolverEmps = Parameters<typeof buildResolver>[0];
type ResolverAliases = Parameters<typeof buildResolver>[1];

export default function BuildFromMonday({ onDone }: { onDone: () => void | Promise<void> }) {
  const [configRaw]  = useLoadAction(loadClassificationConfigAction, [] as { key: string; value: string }[]);
  const [empsRaw]    = useLoadAction(loadAllEmployeesAction, []);
  const [aliasesRaw] = useLoadAction(loadNameAliasesAction, []);
  const [callMondayBoard] = useMutateAction(pullMondayBoardAction);
  const [fetchEmps]     = useMutateAction(loadAllEmployeesAction);
  const [fetchUsers]    = useMutateAction(loadAppUsersAction);
  const [fetchGroups]   = useMutateAction(loadAccessGroupsAction);
  const [fetchMembers]  = useMutateAction(loadAccessGroupMembersAction);
  const [deleteGroup]   = useMutateAction(deleteAccessGroupAction);
  const [upsertUser]    = useMutateAction(upsertAppUserAction);
  const [upsertGroup]   = useMutateAction(upsertAccessGroupAction);
  const [upsertManager] = useMutateAction(upsertAccessGroupManagerAction);
  const [upsertMember]  = useMutateAction(upsertAccessGroupMemberAction);

  const cfg = useMemo(
    () => Object.fromEntries((configRaw as { key: string; value: string }[]).map(r => [r.key, r.value])),
    [configRaw],
  );
  const resolver = useMemo(
    () => buildResolver(empsRaw as ResolverEmps, aliasesRaw as ResolverAliases, normalizeName),
    [empsRaw, aliasesRaw],
  );

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const run = async () => {
    if (!window.confirm(
      'Rebuild every access group from the Panama Employee Directory?\n\n' +
      'All current groups are deleted and rebuilt: one group per ordered manager list ' +
      '(Manager, Manager 2, Manager 3, Manager 4). Hand-made groups and hand-added managers are removed. ' +
      'Users are kept as they are; missing manager users are added.',
    )) return;
    setRunning(true); setError(null); setResult(null); setShowSkipped(false);
    try {
      const r = await seedFromMonday({
        cfg, pull: p => callMondayBoard(p), resolve: resolver, mode: 'rebuild',
        fetchEmployees: () => fetchEmps({}),
        fetchUsers: () => fetchUsers({}), fetchGroups: () => fetchGroups({}), fetchMembers: () => fetchMembers({}),
        deleteGroup, upsertUser, upsertGroup, upsertManager, upsertMember,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      await onDone();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="outline" onClick={run} disabled={running}>
        {running
          ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Rebuilding from Monday…</>
          : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Rebuild from Monday</>}
      </Button>
      {result && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-900">
          <div className="flex items-start justify-between gap-3">
            <span>
              {result.groupsRemoved} old groups removed · {result.groupsAdded} groups built · {result.usersAdded} manager users added · {result.membersAdded} employees placed
            </span>
            <button type="button" onClick={() => setResult(null)} title="Close" className="text-blue-700 hover:text-blue-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {result.skipped.length > 0 && (
            <div className="mt-1">
              <button type="button" onClick={() => setShowSkipped(s => !s)} className="underline underline-offset-2">
                {result.skipped.length} skipped
              </button>
              {showSkipped && (
                <ul className="mt-1 space-y-0.5">
                  {result.skipped.map((s, i) => <li key={i}>{s.name} — {s.reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{error}</div>
      )}
    </div>
  );
}
```

## 5. `src/app/pages/admin/access/useGroupPlacement.ts`

Replace only this line:

```ts
    if (!cfg.monday_col_directory_manager_email) return null;
```

with:

```ts
    if (!cfg.monday_col_directory_manager_email || !cfg.monday_col_directory_manager4_email) return null;
```

Everything else stays (it already passes `mode: 'newOnly'`).

## 6. `src/app/pages/admin/access/GroupsTab.tsx`

Replace the string `'No groups yet. Click Build from Monday, or add one by hand.'` with
`'No groups yet. Click Rebuild from Monday, or add one by hand.'`. Nothing else changes.

## Acceptance

1. The migration applied without error, and `SELECT key, value FROM classification_config WHERE key LIKE 'monday_col_directory_manager%' ORDER BY key` returns 8 rows.
2. Lint clean.
3. Confirm `accessSeed.ts` has no imports and exports `chainKey`, `managerChain`, `planAccessSeed`.
4. Confirm every identifier used in `seedFromMonday.ts`, `BuildFromMonday.tsx` and `useGroupPlacement.ts` is imported.
5. Do NOT click Rebuild from Monday. Saul's reviewer runs it.

Do not build anything else.
