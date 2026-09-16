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
