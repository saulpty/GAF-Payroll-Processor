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
