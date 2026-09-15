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
