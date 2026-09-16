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
