import { useLoadAction } from '@uibakery/data';
import getMondayEmployeesAction from '@/actions/getMondayEmployees';
import getMondayOnboardingAction from '@/actions/getMondayOnboarding';

interface ColValue { id: string; text: string; }
interface MondayItem { name: string; group?: { id: string }; column_values?: ColValue[]; }
interface BoardPage { items_page: { items: MondayItem[] }; }
interface GqlResult { data?: { boards?: BoardPage[] }; }

export interface ManagerInfo {
  name: string;
  email: string;
  reports: string[];
  position: string;
}

function colVal(item: MondayItem, id: string): string {
  return item.column_values?.find(c => c.id === id)?.text?.trim() ?? '';
}

// Same rules as the GAF Panama HR Hub:
// - an employee is active only when their row is in the "Current Employees" group;
// - every manager slot counts, in priority order: Manager, Manager 2, Manager 3, Manager 4;
// - a manager is identified by email (lower-cased); a slot with a name but no email falls back to the name.
const CURRENT_GROUP_ID = 'topics';
const MANAGER_SLOTS: [string, string][] = [
  ['text_mkzj84w1', 'text_mkzj8b73'],
  ['text_mm785e8r', 'text_mm15y2vw'],
  ['text_mm786kge', 'text_mm78fxpg'],
  ['text_mm78whj1', 'text_mm78hgkr'],
];

export function useMondayAutofill() {
  const [employeesResult, employeesLoading] = useLoadAction(getMondayEmployeesAction, [], {});
  const [onboardingResult, onboardingLoading] = useLoadAction(getMondayOnboardingAction, [], {});

  const directoryItems: MondayItem[] =
    ((employeesResult as GqlResult)?.data?.boards?.[0]?.items_page?.items) ?? [];
  const onboardingItems: MondayItem[] =
    ((onboardingResult as GqlResult)?.data?.boards?.[0]?.items_page?.items) ?? [];

  const currentItems = directoryItems.filter(i => i.group?.id === CURRENT_GROUP_ID && i.name?.trim());

  // ── Managers from all four slots, keyed by email (name only when the slot has no email) ──
  const byKey = new Map<string, ManagerInfo>();
  for (const item of currentItems) {
    const employeeName = item.name.trim();
    for (const [nameCol, emailCol] of MANAGER_SLOTS) {
      const name = colVal(item, nameCol);
      const email = colVal(item, emailCol).toLowerCase();
      if (!name && !email) continue;
      const key = email || `name:${name.toLowerCase()}`;
      const m = byKey.get(key) ?? { name: name || email, email, reports: [], position: '' };
      if (!m.reports.includes(employeeName)) m.reports.push(employeeName);
      byKey.set(key, m);
    }
  }

  // The form looks managers up by display name: merge entries that share a name
  // (email-keyed entries first, so the email is kept).
  const managerMap = new Map<string, ManagerInfo>();
  const entries = [...byKey.entries()].sort(([a], [b]) =>
    Number(a.startsWith('name:')) - Number(b.startsWith('name:')));
  for (const [, m] of entries) {
    const existing = managerMap.get(m.name);
    if (!existing) { managerMap.set(m.name, { ...m, reports: [...m.reports] }); continue; }
    if (!existing.email && m.email) existing.email = m.email;
    for (const r of m.reports) if (!existing.reports.includes(r)) existing.reports.push(r);
  }

  // ── Job title map: from Onboarding board (column `text`) ──
  const employeePositionMap = new Map<string, string>();
  for (const item of onboardingItems) {
    const pos = colVal(item, 'text');
    if (item.name && pos) employeePositionMap.set(item.name.trim(), pos);
  }

  // ── Branch map: current employees only ──
  const employeeBranchMap = new Map<string, string>();
  for (const item of currentItems) {
    const branch = colVal(item, 'color_mkpt5gk4');
    if (branch) employeeBranchMap.set(item.name.trim(), branch);
  }

  // ── Full current employee list ──
  const allEmployees: string[] = [...new Set(currentItems.map(i => i.name.trim()))].sort();

  const managers: string[] = Array.from(managerMap.keys()).sort();
  const loading = employeesLoading || onboardingLoading;

  return { managerMap, employeePositionMap, employeeBranchMap, allEmployees, managers, loading };
}
