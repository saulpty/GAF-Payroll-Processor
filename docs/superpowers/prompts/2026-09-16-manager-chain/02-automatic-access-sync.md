# 02 — Access groups follow Monday automatically (no button to remember)

## Files that may change

- `src/app/lib/accessSeed.ts` — replace the whole file
- `src/app/pages/admin/access/syncAccessFromMonday.ts` — NEW
- `src/app/pages/admin/access/useAccessSync.ts` — NEW
- `src/app/components/AccessAutoSync.tsx` — NEW
- `src/app/pages/admin/access/BuildFromMonday.tsx` — replace the whole file
- `src/app/pages/admin/access/seedFromMonday.ts` — DELETE
- `src/app/pages/admin/access/useGroupPlacement.ts` — DELETE
- `src/app/pages/admin/employees/MondayTab.tsx` — the access-group lines only (section 6)
- `src/app/app.tsx` — one import and one element (section 7)
- `src/app/pages/admin/access/GroupsTab.tsx` — one string (section 8)
- `src/migrations/1782002200_access_more_super_users.sql` (new) — create and apply (section 9)

No other file may be touched. No action changes.

## Why

Saul does not want to press a button to keep access in step with Monday. The Panama Employee
Directory is the source of truth: Manager (rank 1), Manager 2, Manager 3, Manager 4 — one access
group per ordered list of manager emails.

New behaviour:
- When the app opens (after the access gate lets the viewer in), it checks Monday in the
  background **at most once every 30 minutes** (the last run is stored in `monday_sync_log`
  under `board_key = 'access_groups'`).
- The check computes a **diff** and applies only the changes: add or remove placements, create
  groups for new manager lists, delete groups no longer on Monday, add missing manager users,
  and give managers (never super users) their Monday name. If nothing changed on Monday, it
  writes nothing to the access tables.
- Safety: if Monday returns nobody who can be placed (empty or failed pull), nothing is removed.
  An employee whose Monday row has a problem (a manager name with no email) keeps their current group.
- Admin > Access > Groups shows "Follows Monday automatically · last checked …" and a
  **Check Monday now** button. The directory **Sync now** also runs it.

Write every file below **exactly as given, character for character**. Tests are pinned to this API.

## 1. `src/app/lib/accessSeed.ts` — NO imports

```ts
/** One slot from the directory: Manager, Manager 2, Manager 3, Manager 4 (in that order). */
export type ManagerSlot = { name: string; email: string };
export type DirectoryPerson = { name: string; email: string; managers: ManagerSlot[] };

export type AppUserRow = { id: string; email: string; display_name: string; role: string };
/** managerEmails = the group's managers ordered by rank */
export type CurrentGroup = { id: string; name: string; managerEmails: string[]; memberIds: string[] };
export type SyncCurrent = { users: AppUserRow[]; groups: CurrentGroup[] };

export type PlannedGroup = { key: string; name: string; managers: { email: string; rank: number }[] };

export type SyncPlan = {
  usersToAdd: { email: string; display_name: string }[];
  usersToRename: { id: string; display_name: string }[];
  groupsToDelete: { id: string; name: string }[];
  groupsToCreate: PlannedGroup[];
  /** groupId is an existing group id, or '' for a group created by this plan (look it up by key) */
  membersToAdd: { key: string; groupId: string; employeeId: string }[];
  membersToRemove: { groupId: string; employeeId: string }[];
  placed: number;
  skipped: { name: string; reason: string }[];
};

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
const NOT_ON_ROSTER = 'not on the app roster';

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

/**
 * Monday is the source of truth. Returns the changes that make the access groups match the
 * directory: one group per ordered manager list. Employees skipped for a data problem on
 * Monday (e.g. a manager with no email) keep whatever group they are in today. When nobody
 * can be placed at all (empty or failed pull), nothing is removed.
 */
export function planAccessSync(
  people: DirectoryPerson[],
  resolveEmployeeId: (p: DirectoryPerson) => string | null,
  current: SyncCurrent,
): SyncPlan {
  const plan: SyncPlan = { usersToAdd: [], usersToRename: [], groupsToDelete: [], groupsToCreate: [],
    membersToAdd: [], membersToRemove: [], placed: 0, skipped: [] };

  const desired = new Map<string, { chain: ManagerSlot[]; members: Set<string> }>();
  const placedIds = new Set<string>();
  const keep = new Set<string>(); // skipped for a Monday data problem: leave their memberships alone
  const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name));
  for (const p of sorted) {
    const empId = resolveEmployeeId(p);
    if (empId === null) { plan.skipped.push({ name: p.name, reason: NOT_ON_ROSTER }); continue; }
    const id = String(empId);
    if (placedIds.has(id)) continue;
    const mc = managerChain(p.managers);
    if ('reason' in mc) { plan.skipped.push({ name: p.name, reason: mc.reason }); keep.add(id); continue; }
    const key = chainKey(mc.chain.map(m => m.email));
    if (!desired.has(key)) desired.set(key, { chain: mc.chain, members: new Set() });
    desired.get(key)!.members.add(id);
    placedIds.add(id);
  }
  plan.placed = placedIds.size;
  if (desired.size === 0) return plan;

  // Users: add missing managers; managers (not super users) take their Monday name.
  const usersByEmail = new Map(current.users.map(u => [norm(u.email), u]));
  const mondayName = new Map<string, string>();
  for (const d of desired.values()) for (const m of d.chain) if (m.name && !mondayName.has(m.email)) mondayName.set(m.email, m.name);
  for (const d of desired.values()) {
    for (const m of d.chain) {
      if (usersByEmail.has(m.email) || plan.usersToAdd.some(u => u.email === m.email)) continue;
      plan.usersToAdd.push({ email: m.email, display_name: mondayName.get(m.email) || m.email });
    }
  }
  for (const [email, u] of usersByEmail) {
    const name = mondayName.get(email);
    if (name && u.role === 'manager' && u.display_name.trim() !== name) plan.usersToRename.push({ id: String(u.id), display_name: name });
  }

  // Groups: match by ordered manager emails.
  const matched = new Map<string, CurrentGroup>();
  const keptNames = new Set<string>();
  for (const g of current.groups) {
    const key = chainKey(g.managerEmails);
    const members = g.memberIds.map(String);
    if (desired.has(key) && !matched.has(key)) {
      matched.set(key, g);
      keptNames.add(g.name.trim().toLowerCase());
      const want = desired.get(key)!.members;
      for (const e of members) if (!want.has(e) && !keep.has(e)) plan.membersToRemove.push({ groupId: String(g.id), employeeId: e });
      for (const e of want) if (!members.includes(e)) plan.membersToAdd.push({ key, groupId: String(g.id), employeeId: e });
    } else if (members.some(e => keep.has(e))) {
      keptNames.add(g.name.trim().toLowerCase());
      for (const e of members) if (!keep.has(e)) plan.membersToRemove.push({ groupId: String(g.id), employeeId: e });
    } else {
      plan.groupsToDelete.push({ id: String(g.id), name: g.name });
    }
  }

  for (const [key, d] of desired) {
    if (matched.has(key)) continue;
    const base = d.chain.map(m => mondayName.get(m.email) || m.email).join(' · ');
    let name = base;
    for (let n = 2; keptNames.has(name.toLowerCase()); n++) name = `${base} (${n})`;
    keptNames.add(name.toLowerCase());
    plan.groupsToCreate.push({ key, name, managers: d.chain.map((m, i) => ({ email: m.email, rank: i + 1 })) });
    for (const e of d.members) plan.membersToAdd.push({ key, groupId: '', employeeId: e });
  }
  return plan;
}

/** How many changes a plan makes (0 = already in sync). */
export function changeCount(p: SyncPlan): number {
  return p.usersToAdd.length + p.usersToRename.length + p.groupsToDelete.length + p.groupsToCreate.length
    + p.membersToAdd.length + p.membersToRemove.length;
}
```

## 2. `src/app/pages/admin/access/syncAccessFromMonday.ts` (new)

```ts
import { requireKeys, pullAllItems, colText } from '@/app/pages/admin/employees/mondaySync';
import type { PullFn } from '@/app/pages/admin/employees/mondaySync';
import { planAccessSync, changeCount } from '@/app/lib/accessSeed';
import type { SyncCurrent, SyncPlan } from '@/app/lib/accessSeed';

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
export const rowsOf = (r: unknown): Row[] => (Array.isArray(r) ? r : ((r as { data?: unknown })?.data as Row[]) ?? []);
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

export type AccessSyncDeps = {
  cfg: Record<string, string>;
  pull: PullFn;
  resolve: (name: string | null | undefined, email: string | null | undefined) => number | null;
  employees: Row[]; // loadAllEmployees rows
  fetchUsers: () => Promise<unknown>;
  fetchGroups: () => Promise<unknown>;
  fetchMembers: () => Promise<unknown>;
  upsertUser: (p: Row) => Promise<unknown>;
  upsertGroup: (p: Row) => Promise<unknown>;
  deleteGroup: (p: Row) => Promise<unknown>;
  upsertManager: (p: Row) => Promise<unknown>;
  upsertMember: (p: Row) => Promise<unknown>;
  deleteMember: (p: Row) => Promise<unknown>;
};

export type AccessSyncResult = { changes: number; placed: number; skipped: SyncPlan['skipped']; summary: string };

function managersOf(g: Row): { email: string; rank: number }[] {
  const m = g.managers;
  const arr = typeof m === 'string' ? JSON.parse(m) : m;
  return Array.isArray(arr) ? arr : [];
}

async function readCurrent(deps: AccessSyncDeps) {
  const [u, g, m] = await Promise.all([deps.fetchUsers(), deps.fetchGroups(), deps.fetchMembers()]);
  const users = rowsOf(u), groups = rowsOf(g), members = rowsOf(m);
  const current: SyncCurrent = {
    users: users.map(r => ({ id: String(r.id), email: norm(r.email), display_name: String(r.display_name ?? ''), role: String(r.role ?? '') })),
    groups: groups.map(r => ({
      id: String(r.id), name: String(r.name ?? ''),
      managerEmails: [...managersOf(r)].sort((a, b) => Number(a.rank) - Number(b.rank)).map(x => norm(x.email)),
      memberIds: members.filter(x => String(x.group_id) === String(r.id)).map(x => String(x.employee_id)),
    })),
  };
  return { users, current };
}

export async function syncAccessFromMonday(deps: AccessSyncDeps): Promise<AccessSyncResult> {
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

  const idByEmail = new Map<string, string>();
  for (const r of deps.employees) {
    const e = norm(r.teramind_email);
    if (e) idByEmail.set(e, String(r.id));
  }

  const before = await readCurrent(deps);
  const plan = planAccessSync(people, p => {
    const byEmail = p.email ? idByEmail.get(p.email) : undefined;
    if (byEmail) return byEmail;
    const id = deps.resolve(p.name, p.email || null);
    return id === null ? null : String(id);
  }, before.current);

  const changes = changeCount(plan);
  const summary = changes === 0
    ? `access groups up to date (${plan.placed} employees)`
    : `access groups updated: ${plan.groupsToCreate.length} groups added, ${plan.groupsToDelete.length} removed, `
      + `${plan.membersToAdd.length} placements added, ${plan.membersToRemove.length} removed, `
      + `${plan.usersToAdd.length} manager users added, ${plan.usersToRename.length} renamed`;
  if (changes === 0) return { changes, placed: plan.placed, skipped: plan.skipped, summary };

  const userRow = new Map(before.users.map(r => [String(r.id), r]));
  for (const u of plan.usersToAdd) {
    await deps.upsertUser({ id: null, email: u.email, display_name: u.display_name, role: 'manager',
      all_employees: false, active: true, notes: 'Added from the Monday directory' });
  }
  for (const u of plan.usersToRename) {
    const r = userRow.get(u.id);
    if (!r) continue;
    await deps.upsertUser({ id: u.id, email: String(r.email), display_name: u.display_name, role: String(r.role),
      all_employees: Boolean(r.all_employees), active: Boolean(r.active), notes: String(r.notes ?? '') });
  }
  for (const g of plan.groupsToDelete) await deps.deleteGroup({ id: g.id });
  for (const m of plan.membersToRemove) await deps.deleteMember({ group_id: m.groupId, employee_id: m.employeeId });
  for (const g of plan.groupsToCreate) await deps.upsertGroup({ id: null, name: g.name, notes: 'Built from the Monday directory' });

  const after = (plan.usersToAdd.length || plan.groupsToCreate.length) ? await readCurrent(deps) : before;
  const userIdByEmail = new Map(after.current.users.map(u => [u.email, u.id]));
  const groupIdByName = new Map(after.current.groups.map(g => [g.name.trim().toLowerCase(), g.id]));
  const newGroupIdByKey = new Map<string, string>();
  for (const g of plan.groupsToCreate) {
    const gid = groupIdByName.get(g.name.trim().toLowerCase());
    if (!gid) continue;
    for (const m of g.managers) {
      const uid = userIdByEmail.get(m.email);
      if (uid) await deps.upsertManager({ group_id: gid, user_id: uid, rank: m.rank });
    }
    newGroupIdByKey.set(g.key, gid);
  }
  for (const m of plan.membersToAdd) {
    const gid = m.groupId || newGroupIdByKey.get(m.key) || '';
    if (gid) await deps.upsertMember({ group_id: gid, employee_id: m.employeeId });
  }

  return { changes, placed: plan.placed, skipped: plan.skipped, summary };
}
```

## 3. `src/app/pages/admin/access/useAccessSync.ts` (new)

```ts
import { useCallback } from 'react';
import { useMutateAction } from '@uibakery/data';
import pullMondayBoardAction from '@/actions/pullMondayBoard';
import loadClassificationConfigAction from '@/actions/loadClassificationConfig';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import loadNameAliasesAction from '@/actions/loadNameAliases';
import loadMondaySyncLogAction from '@/actions/loadMondaySyncLog';
import upsertMondaySyncLogAction from '@/actions/upsertMondaySyncLog';
import loadAppUsersAction from '@/actions/loadAppUsers';
import loadAccessGroupsAction from '@/actions/loadAccessGroups';
import loadAccessGroupMembersAction from '@/actions/loadAccessGroupMembers';
import upsertAppUserAction from '@/actions/upsertAppUser';
import upsertAccessGroupAction from '@/actions/upsertAccessGroup';
import deleteAccessGroupAction from '@/actions/deleteAccessGroup';
import upsertAccessGroupManagerAction from '@/actions/upsertAccessGroupManager';
import upsertAccessGroupMemberAction from '@/actions/upsertAccessGroupMember';
import deleteAccessGroupMemberAction from '@/actions/deleteAccessGroupMember';
import { buildResolver } from '@/app/lib/mondayResolve';
import { normalizeName } from '@/app/lib/classificationEngine';
import { syncAccessFromMonday, rowsOf } from './syncAccessFromMonday';
import type { AccessSyncResult } from './syncAccessFromMonday';

/** Access groups follow Monday on their own: at most once per this many minutes, on app open. */
export const ACCESS_SYNC_EVERY_MINUTES = 30;
export const ACCESS_SYNC_LOG_KEY = 'access_groups';

type ResolverEmps = Parameters<typeof buildResolver>[0];
type ResolverAliases = Parameters<typeof buildResolver>[1];

let inFlight: Promise<AccessSyncResult | null> | null = null;

/** Returns sync(force). force=false skips when the last run is newer than ACCESS_SYNC_EVERY_MINUTES. */
export function useAccessSync() {
  const [pull]          = useMutateAction(pullMondayBoardAction);
  const [fetchConfig]   = useMutateAction(loadClassificationConfigAction);
  const [fetchEmps]     = useMutateAction(loadAllEmployeesAction);
  const [fetchAliases]  = useMutateAction(loadNameAliasesAction);
  const [fetchLog]      = useMutateAction(loadMondaySyncLogAction);
  const [writeLog]      = useMutateAction(upsertMondaySyncLogAction);
  const [fetchUsers]    = useMutateAction(loadAppUsersAction);
  const [fetchGroups]   = useMutateAction(loadAccessGroupsAction);
  const [fetchMembers]  = useMutateAction(loadAccessGroupMembersAction);
  const [upsertUser]    = useMutateAction(upsertAppUserAction);
  const [upsertGroup]   = useMutateAction(upsertAccessGroupAction);
  const [deleteGroup]   = useMutateAction(deleteAccessGroupAction);
  const [upsertManager] = useMutateAction(upsertAccessGroupManagerAction);
  const [upsertMember]  = useMutateAction(upsertAccessGroupMemberAction);
  const [deleteMember]  = useMutateAction(deleteAccessGroupMemberAction);

  return useCallback((force: boolean): Promise<AccessSyncResult | null> => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      if (!force) {
        const last = rowsOf(await fetchLog({})).find(r => r.board_key === ACCESS_SYNC_LOG_KEY);
        const at = last?.last_synced_at ? Date.parse(String(last.last_synced_at)) : NaN;
        if (!Number.isNaN(at) && Date.now() - at < ACCESS_SYNC_EVERY_MINUTES * 60_000) return null;
      }
      const [cfgRows, empRows, aliasRows] = await Promise.all([fetchConfig({}), fetchEmps({}), fetchAliases({})]);
      const cfg = Object.fromEntries(rowsOf(cfgRows).map(r => [String(r.key), String(r.value ?? '')]));
      const employees = rowsOf(empRows);
      const resolve = buildResolver(employees as unknown as ResolverEmps, rowsOf(aliasRows) as unknown as ResolverAliases, normalizeName);
      try {
        const r = await syncAccessFromMonday({
          cfg, pull: p => pull(p), resolve, employees,
          fetchUsers: () => fetchUsers({}), fetchGroups: () => fetchGroups({}), fetchMembers: () => fetchMembers({}),
          upsertUser, upsertGroup, deleteGroup, upsertManager, upsertMember, deleteMember,
        });
        await writeLog({ board_key: ACCESS_SYNC_LOG_KEY, item_count: r.placed, matched_count: r.changes,
          unmatched_count: r.skipped.length, last_error: null });
        return r;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await writeLog({ board_key: ACCESS_SYNC_LOG_KEY, item_count: 0, matched_count: 0, unmatched_count: 0, last_error: msg })
          .catch(() => undefined);
        throw e;
      }
    })().finally(() => { inFlight = null; });
    return inFlight;
  }, [pull, fetchConfig, fetchEmps, fetchAliases, fetchLog, writeLog, fetchUsers, fetchGroups, fetchMembers,
      upsertUser, upsertGroup, deleteGroup, upsertManager, upsertMember, deleteMember]);
}
```

## 4. `src/app/components/AccessAutoSync.tsx` (new)

```tsx
import { useEffect } from 'react';
import { useAccessSync } from '@/app/pages/admin/access/useAccessSync';

/** Keeps access groups in step with the Monday directory. Runs once per app open, at most every 30 minutes. Renders nothing. */
export default function AccessAutoSync() {
  const sync = useAccessSync();
  useEffect(() => {
    sync(false).catch(e => console.warn('Access groups sync from Monday failed:', e));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
```

## 5. `src/app/pages/admin/access/BuildFromMonday.tsx` — replace

```tsx
import { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { RefreshCw, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import loadMondaySyncLogAction from '@/actions/loadMondaySyncLog';
import { useAccessSync, ACCESS_SYNC_LOG_KEY, ACCESS_SYNC_EVERY_MINUTES } from './useAccessSync';
import type { AccessSyncResult } from './syncAccessFromMonday';

type LogRow = { board_key: string; last_synced_at: string | null; last_error: string | null };

/** Access groups follow Monday automatically; this shows when they last did and lets Saul check right now. */
export default function BuildFromMonday({ onDone }: { onDone: () => void | Promise<void> }) {
  const [logRaw, , , reloadLog] = useLoadAction(loadMondaySyncLogAction, [] as LogRow[]);
  const sync = useAccessSync();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AccessSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const log = (logRaw as LogRow[]).find(r => r.board_key === ACCESS_SYNC_LOG_KEY);
  const lastAt = log?.last_synced_at ? new Date(log.last_synced_at).toLocaleString() : 'never';

  const run = async () => {
    setRunning(true); setError(null); setResult(null); setShowSkipped(false);
    try {
      setResult(await sync(true));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      await reloadLog();
      await onDone();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-slate-500">
          Follows Monday automatically (every {ACCESS_SYNC_EVERY_MINUTES} min) · last checked {lastAt}
        </span>
        <Button size="sm" variant="outline" onClick={run} disabled={running}>
          {running
            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Checking Monday…</>
            : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Check Monday now</>}
        </Button>
      </div>
      {log?.last_error && !result && !error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">Last check failed: {log.last_error}</div>
      )}
      {result && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-900">
          <div className="flex items-start justify-between gap-3">
            <span>{result.summary}</span>
            <button type="button" onClick={() => setResult(null)} title="Close" className="text-blue-700 hover:text-blue-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {result.skipped.length > 0 && (
            <div className="mt-1">
              <button type="button" onClick={() => setShowSkipped(s => !s)} className="underline underline-offset-2">
                {result.skipped.length} not placed — fix on Monday
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

Then delete `src/app/pages/admin/access/seedFromMonday.ts` and
`src/app/pages/admin/access/useGroupPlacement.ts` (nothing else imports them after section 6).

## 6. `src/app/pages/admin/employees/MondayTab.tsx` — access-group lines only

- Replace `import { useGroupPlacement } from '@/app/pages/admin/access/useGroupPlacement';`
  with `import { useAccessSync } from '@/app/pages/admin/access/useAccessSync';`
- Replace `const placeInGroups = useGroupPlacement();` with `const syncAccess = useAccessSync();`
- In `onSyncDirectory`, replace the whole `try { … } catch (e) { … }` block that calls
  `placeInGroups` with:

```ts
    try {
      const access = await syncAccess(true);
      if (access) setDirSummary(s => `${s ?? ''} · ${access.summary}`);
    } catch (e) {
      setDirSummary(s => `${s ?? ''} · access groups sync failed: ${e instanceof Error ? e.message : String(e)}`);
    }
```

- In that `useCallback` dependency list, replace `placeInGroups` with `syncAccess`.

Nothing else in `MondayTab.tsx` changes.

## 7. `src/app/app.tsx`

- Add `import AccessAutoSync from '@/app/components/AccessAutoSync';` next to the `AccessGate` import.
- Inside `<GlobalFilterProvider>`, as the first child (just before the `<div className="flex flex-col h-screen …">`), add `<AccessAutoSync />`.

Nothing else changes. Routes and `RequireSuper` stay exactly as they are.

## 8. `src/app/pages/admin/access/GroupsTab.tsx`

Replace the string `'No groups yet. Click Rebuild from Monday, or add one by hand.'` with
`'No groups yet. Click Check Monday now.'`. Nothing else changes.

## 9. Migration `src/migrations/1782002200_access_more_super_users.sql`

Create this file with exactly this SQL, then apply it. Saul named these six as super users on 2026-09-16.

```sql
-- Access roles: six more super users, named by Saul on 2026-09-16.
-- Rollback: UPDATE app_users SET role = 'manager' WHERE email IN (...) or DELETE the rows.
INSERT INTO app_users (email, display_name, role, all_employees, active, notes) VALUES
  ('jesse@vitasyahc.com',     'Jesse Hoffman',    'super_user', false, true, 'Super user named by Saul 2026-09-16'),
  ('stephanie@vitasyahc.com', 'Stephanie Mullis', 'super_user', false, true, 'Super user named by Saul 2026-09-16'),
  ('matt@vitasyahc.com',      'Matt Sherfield',   'super_user', false, true, 'Super user named by Saul 2026-09-16'),
  ('leibel.m@vitasyahc.com',  'Leibel Mangel',    'super_user', false, true, 'Super user named by Saul 2026-09-16'),
  ('monty@vitasyahc.com',     'Monty Druin',      'super_user', false, true, 'Super user named by Saul 2026-09-16'),
  ('alex.l@vitasyahc.com',    'Alex Levinger',    'super_user', false, true, 'Super user named by Saul 2026-09-16')
ON CONFLICT (email) DO UPDATE SET role = 'super_user', active = true, display_name = EXCLUDED.display_name, updated_at = now();
```

## Acceptance

1. Lint clean. The migration applied, and `SELECT email FROM app_users WHERE role = 'super_user' ORDER BY email` returns 8 rows.
2. `grep -rn "seedFromMonday\|useGroupPlacement\|planAccessSeed" src/` returns nothing.
3. Confirm `accessSeed.ts` has no imports and exports `chainKey`, `managerChain`, `planAccessSync`, `changeCount`.
4. Confirm every identifier used in the four new or replaced component/hook files, `MondayTab.tsx` and `app.tsx` is imported.
5. Do NOT click Check Monday now and do not run the sync. Saul's reviewer verifies it in the browser.

Do not build anything else.
