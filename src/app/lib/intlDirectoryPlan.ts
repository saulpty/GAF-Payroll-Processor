// International Employee Directory: what to change, decided without any I/O.
// Matches by email ONLY (never by name, so it can never pick up a Panama employee) and never
// touches an employee whose country is the payroll country. Only `import type` here.
import type { MondayItem } from '@/app/pages/admin/employees/mondaySync';

export type IntlCols = { email: string; currentGroup: string; role: string; country: string; manager: string };

export type IntlEmp = {
  id: number; teramind_email: string; active: boolean;
  is_grace_list: boolean; excluded_from_payroll: boolean;
  role: string; manager: string; country?: string | null;
};

export type IntlNew = { name: string; email: string; role: string; manager: string; country: string };

export type IntlPlan = {
  details: { id: number; role: string | null; manager: string | null; country: string }[];
  flags: { id: number; is_grace_list: boolean; excluded_from_payroll: boolean; active: boolean }[];
  toCreate: IntlNew[];
  held: number;     // new people not created because more than MAX_NEW arrived at once
  skipped: number;  // board rows whose email belongs to a payroll-country employee
};

export const MAX_NEW = 3;
export const DEFAULT_COUNTRY = 'International';

const text = (it: MondayItem, col: string) =>
  col ? (it.column_values.find(c => c.id === col)?.text ?? '').trim() : '';

export function planIntlDirectory(items: MondayItem[], emps: IntlEmp[], cols: IntlCols, payrollCountry: string): IntlPlan {
  const plan: IntlPlan = { details: [], flags: [], toCreate: [], held: 0, skipped: 0 };
  const byEmail = new Map(emps.map(e => [e.teramind_email.trim().toLowerCase(), e]));
  const seen = new Set<string>();
  const fresh: IntlNew[] = [];

  for (const it of items) {
    const email = text(it, cols.email).toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const isCurrent = it.group?.id === cols.currentGroup;
    const role = text(it, cols.role);
    const manager = text(it, cols.manager);
    const country = text(it, cols.country) || DEFAULT_COUNTRY;
    const emp = byEmail.get(email);

    if (!emp) {
      if (isCurrent) fresh.push({ name: it.name.trim(), email, role, manager, country });
      continue;
    }
    if ((emp.country || 'Panama') === payrollCountry) { plan.skipped++; continue; }

    if (role !== (emp.role || '') || manager !== (emp.manager || '') || country !== emp.country) {
      plan.details.push({ id: emp.id, role: role || null, manager: manager || null, country });
    }
    if (isCurrent !== emp.active) {
      plan.flags.push({ id: emp.id, is_grace_list: emp.is_grace_list,
        excluded_from_payroll: emp.excluded_from_payroll, active: isCurrent });
    }
  }

  if (fresh.length > MAX_NEW) plan.held = fresh.length;
  else plan.toCreate = fresh;
  return plan;
}
