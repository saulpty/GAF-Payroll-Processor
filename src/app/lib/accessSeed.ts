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
