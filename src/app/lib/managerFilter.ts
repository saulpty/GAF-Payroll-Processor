/** The Manager filter follows the access groups (Admin > Access), which follow Monday:
 *  `manager` = direct manager (rank 1), `managers` = every manager name, "|"-separated, by rank. */
export type ManagedEmployee = { manager?: string | null; managers?: string | null };

export function managerNamesOf(e: ManagedEmployee): string[] {
  const all = String(e.managers ?? '').split('|').map(s => s.trim()).filter(Boolean);
  if (all.length) return [...new Set(all)];
  const direct = String(e.manager ?? '').trim();
  return direct ? [direct] : [];
}

export function managerOptions(emps: ManagedEmployee[]): string[] {
  return [...new Set(emps.flatMap(managerNamesOf))].sort((a, b) => a.localeCompare(b));
}

export function matchesManager(e: ManagedEmployee, selected: string | null | undefined): boolean {
  const s = String(selected ?? '').trim();
  return !s || managerNamesOf(e).includes(s);
}
