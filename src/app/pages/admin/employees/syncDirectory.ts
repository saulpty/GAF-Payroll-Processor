// Directory board sync — moved from MondayTab to keep that file small.
// Pure async function, no React, no hooks.
import {
  pullAllItems, colText, parseDate, batchUpsert, requireKeys, SyncDeps, SyncResult,
} from './mondaySync';

const DIR_KEYS = [
  'monday_board_directory',
  'monday_col_directory_email',
  'monday_col_directory_role',
  'monday_col_directory_manager',
  'monday_col_directory_active',
] as const;

const ONBOARD_KEYS = [
  'monday_board_onboarding',
  'monday_col_onboarding_start_date',
] as const;

export type DirectoryDeps = SyncDeps & {
  emps: {
    id: number; display_name: string; teramind_email: string; active: boolean;
    is_grace_list: boolean; is_macbook_swap: boolean; excluded_from_payroll: boolean;
    role: string; manager: string; start_date: string | null;
  }[];
  updateRoleManager: (p: { id: number; role: string | null; manager: string | null }) => Promise<unknown>;
  updateFlag: (p: {
    id: number; is_grace_list: boolean; is_macbook_swap: boolean;
    excluded_from_payroll: boolean; active: boolean;
  }) => Promise<unknown>;
  upsertEmp: (p: Record<string, unknown>) => Promise<unknown>;
  updateStartDate: (p: { display_name: string; start_date: string }) => Promise<unknown>;
  defaultScheduleId: number;
  askCandidates: (c: { name: string; email: string; role: string; manager: string }[]) => Promise<{ name: string; email: string; role: string; manager: string }[]>;
  onSummary: (s: string) => void;
  onItems?: (items: { item_id: string; name: string; email: string; role: string; manager: string; active: string }[]) => void;
};

export async function syncDirectory(deps: DirectoryDeps): Promise<SyncResult> {
  const dirCheck = requireKeys(deps.cfg, DIR_KEYS);
  if (!dirCheck.ok) throw new Error('Missing config: ' + dirCheck.missing.join(', '));
  const dk = dirCheck.map;

  const items = await pullAllItems(
    dk.monday_board_directory,
    [dk.monday_col_directory_email, dk.monday_col_directory_role,
     dk.monday_col_directory_manager, dk.monday_col_directory_active],
    deps.pull,
  );

  if (deps.onItems) {
    deps.onItems(items.map(item => ({
      item_id: item.id,
      name: item.name,
      email: colText(item, dk.monday_col_directory_email),
      role: colText(item, dk.monday_col_directory_role),
      manager: colText(item, dk.monday_col_directory_manager),
      active: colText(item, dk.monday_col_directory_active),
    })));
  }

  let updatedCount = 0;
  let createdCount = 0;
  let startDatesSet = 0;
  let unmatchedCount = 0;

  const empById = new Map(deps.emps.map(e => [e.id, e]));
  const emailSet = new Set(deps.emps.map(e => e.teramind_email.toLowerCase()));
  const newCandidates: { name: string; email: string; role: string; manager: string }[] = [];

  for (const item of items) {
    const email   = colText(item, dk.monday_col_directory_email).toLowerCase();
    const role    = colText(item, dk.monday_col_directory_role);
    const manager = colText(item, dk.monday_col_directory_manager);
    const mondayActive = colText(item, dk.monday_col_directory_active) === 'Active';
    const empId   = deps.resolve(item.name, email || null);

    if (empId !== null) {
      const emp = empById.get(empId);
      if (!emp) continue;
      let changed = false;
      if ((role || '') !== emp.role || (manager || '') !== emp.manager) {
        await deps.updateRoleManager({ id: emp.id, role: role || null, manager: manager || null });
        changed = true;
      }
      if (mondayActive !== emp.active) {
        await deps.updateFlag({
          id: emp.id, is_grace_list: emp.is_grace_list,
          is_macbook_swap: emp.is_macbook_swap,
          excluded_from_payroll: emp.excluded_from_payroll, active: mondayActive,
        });
        changed = true;
      }
      if (changed) updatedCount++;
    } else {
      if (email && !emailSet.has(email)) newCandidates.push({ name: item.name, email, role, manager });
      unmatchedCount++;
    }
  }

  if (newCandidates.length > 0) {
    const selected = await deps.askCandidates(newCandidates);
    for (const c of selected) {
      const domain = c.email.includes('@') ? c.email.split('@')[1] : '';
      await deps.upsertEmp({
        display_name: c.name, teramind_email: c.email, company_domain: domain,
        schedule_id: deps.defaultScheduleId, is_grace_list: false, is_macbook_swap: false,
        excluded_from_payroll: false, active: true,
        notes: 'Added via Monday directory sync', role: c.role || null, manager: c.manager || null,
      });
      createdCount++;
    }
  }

  // Start dates from onboarding board
  const onboardCheck = requireKeys(deps.cfg, ONBOARD_KEYS);
  if (onboardCheck.ok) {
    const ok = onboardCheck.map;
    const oItems = await pullAllItems(ok.monday_board_onboarding, [ok.monday_col_onboarding_start_date], deps.pull);
    for (const oItem of oItems) {
      const dateStr = parseDate(oItem, ok.monday_col_onboarding_start_date);
      if (!dateStr) continue;
      const oEmpId = deps.resolve(oItem.name, null);
      if (oEmpId === null) continue;
      const oEmp = empById.get(oEmpId);
      if (!oEmp || oEmp.start_date) continue;
      await deps.updateStartDate({ display_name: oEmp.display_name, start_date: dateStr });
      startDatesSet++;
    }
  }

  const matched = items.length - unmatchedCount;
  deps.onSummary(`${updatedCount} updated · ${createdCount} created · ${startDatesSet} start dates set · ${unmatchedCount} unmatched`);
  return { items: items.length, matched, unmatched: unmatchedCount };
}
