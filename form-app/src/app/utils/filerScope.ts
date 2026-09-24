// Which employees the signed-in filer may file a disciplinary action for.
// PURE: no React, no imports. The HR Hub's git repo unit-tests this file by path
// with node, so keep it plain TypeScript (no enum, no namespace, no path aliases).

export interface FilerManager {
  name: string;               // manager display name from the Monday slot ('' allowed)
  email: string;              // manager email from the slot ('' when the slot has none)
  reports: readonly string[]; // current employees who list this manager in any slot
}

export interface FilerScopeInput {
  email: string;                     // signed-in user's email (loadCurrentFiler.email)
  isAdmin: boolean;                  // loadCurrentFiler.is_admin
  adminName: string | null;          // loadCurrentFiler.admin_name
  managers: readonly FilerManager[]; // one entry per manager email (useMondayAutofill().managerEntries)
  allEmployees: readonly string[];   // every current employee (Current Employees group)
}

export interface FilerScope {
  employees: string[]; // sorted, de-duplicated names the filer may choose
  filerName: string;   // shown on the banner and saved as manager_name
  matched: boolean;    // true when the email matched at least one Monday manager slot
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function sortedUnique(names: Iterable<string>): string[] {
  const set = new Set<string>();
  for (const n of names) {
    const t = (n ?? '').trim();
    if (t) set.add(t);
  }
  return Array.from(set).sort();
}

export function employeesForFiler(input: FilerScopeInput): FilerScope {
  const email = norm(input.email);
  // A blank login never matches a slot that has no email.
  const mine = email ? input.managers.filter(m => norm(m.email) === email) : [];
  const matched = mine.length > 0;
  const mondayName = mine
    .map(m => (m.name ?? '').trim())
    .find(n => n !== '' && norm(n) !== email) ?? '';
  const filerName = mondayName || (input.adminName ?? '').trim() || email;
  const employees = !email
    ? []
    : input.isAdmin
      ? sortedUnique(input.allEmployees)
      : sortedUnique(mine.flatMap(m => m.reports));
  return { employees, filerName, matched };
}
