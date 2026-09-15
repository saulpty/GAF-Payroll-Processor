# 06b — Correct "Build from Monday": manager EMAIL is the identity. Replace three files verbatim.

## Files that may change

- `src/app/lib/accessSeed.ts` — replace the whole file
- `src/app/pages/admin/access/seedFromMonday.ts` — replace the whole file
- `src/app/pages/admin/access/BuildFromMonday.tsx` — replace the whole file

No other file may be touched. `GroupsTab.tsx` is already correct; leave it.

## Why this round exists

The previous round did not follow its spec. It matched managers **by display
name**, never read the Manager Email column, and never created manager users.
Saul's rule is the opposite: **a manager's email is their identity** (it is
what SSO signs them in with). Names are labels only and are often spelled
differently.

Write the three files below **exactly as given, character for character**. Do
not redesign, rename, reorder or "simplify" anything. The pure planner has
tests pinned to this exact API (`planAccessSeed(people, resolveEmployeeId,
existing, mode)` returning `{ users, groups, members, alreadyGrouped, skipped }`),
and a later round reuses `mode: 'newOnly'`.

## 1. `src/app/lib/accessSeed.ts` — NO imports

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

## 2. `src/app/pages/admin/access/seedFromMonday.ts`

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
  fetchUsers: () => Promise<unknown>;
  fetchGroups: () => Promise<unknown>;
  fetchMembers: () => Promise<unknown>;
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

Keep the **default export** (GroupsTab imports it as default). Params flat.

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
  const [fetchUsers]    = useMutateAction(loadAppUsersAction);
  const [fetchGroups]   = useMutateAction(loadAccessGroupsAction);
  const [fetchMembers]  = useMutateAction(loadAccessGroupMembersAction);
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
    if (!window.confirm("Read the Panama Employee Directory and add any missing manager users, one group per manager email, and each current employee to their manager's group? Nothing that already exists is changed or removed.")) return;
    setRunning(true); setError(null); setResult(null); setShowSkipped(false);
    try {
      const r = await seedFromMonday({
        cfg, pull: p => callMondayBoard(p), resolve: resolver, mode: 'seed',
        fetchUsers: () => fetchUsers({}), fetchGroups: () => fetchGroups({}), fetchMembers: () => fetchMembers({}),
        upsertUser, upsertGroup, upsertManager, upsertMember,
      });
      setResult(r);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="outline" onClick={run} disabled={running}>
        {running
          ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Reading Monday…</>
          : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Build from Monday</>}
      </Button>
      {result && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-900">
          <div className="flex items-start justify-between gap-3">
            <span>
              {result.usersAdded} manager users added · {result.groupsAdded} groups created · {result.membersAdded} employees placed · {result.alreadyGrouped} already in a group
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

## Acceptance

1. Lint clean. If lint reports an error, fix only the reported line and say
   exactly what you changed; do not rewrite logic.
2. Report the byte size of each file.
3. Confirm `planAccessSeed` takes four arguments and reads `managerEmail`.
4. Do **not** click Build from Monday.

Do not build anything else.
