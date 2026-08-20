// Directory board sync — moved from MondayTab to keep that file small.
// Pure async function, no React, no hooks.
import {
  pullAllItems, colText, parseDate, batchUpsert, requireKeys, SyncDeps, SyncResult, MondayItem,
} from './mondaySync';

const DIR_KEYS = [
  'monday_board_directory',
  'monday_col_directory_email',
  'monday_col_directory_role',
  'monday_col_directory_manager',
  'monday_col_directory_active',
  'monday_group_directory_current',
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

type ResolvedItem = {
  item: MondayItem;
  empId: number;
  email: string;
  role: string;
  manager: string;
};

/** Pick the single best item for each employee when the board has duplicate rows.
 *  Priority: (1) row is in the current-employees group, (2) highest numeric item id. */
function deduplicateByEmployee(
  resolved: ResolvedItem[],
  currentGroupId: string,
): { winners: ResolvedItem[]; duplicatesCollapsed: number } {
  const byEmp = new Map<number, ResolvedItem[]>();
  for (const r of resolved) {
    const bucket = byEmp.get(r.empId) ?? [];
    bucket.push(r);
    byEmp.set(r.empId, bucket);
  }

  const winners: ResolvedItem[] = [];
  let duplicatesCollapsed = 0;

  for (const bucket of byEmp.values()) {
    if (bucket.length === 1) {
      winners.push(bucket[0]);
      continue;
    }
    duplicatesCollapsed += bucket.length - 1;
    // Prefer the current-group row; among ties prefer the highest item id.
    const sorted = [...bucket].sort((a, b) => {
      const aIsCurrent = a.item.group?.id === currentGroupId ? 1 : 0;
      const bIsCurrent = b.item.group?.id === currentGroupId ? 1 : 0;
      if (bIsCurrent !== aIsCurrent) return bIsCurrent - aIsCurrent;
      return Number(BigInt(b.item.id) - BigInt(a.item.id) > 0n ? 1 : -1);
    });
    winners.push(sorted[0]);
  }

  return { winners, duplicatesCollapsed };
}

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
  // newCandidates keyed by lower-cased email for dedup; value tracks the preferred item
  const candidateMap = new Map<string, { name: string; email: string; role: string; manager: string; isCurrent: boolean }>();

  // ── Step 1: resolve every item to an employee id ──────────────────────────
  const resolved: ResolvedItem[] = [];
  for (const item of items) {
    const email   = colText(item, dk.monday_col_directory_email).toLowerCase();
    const role    = colText(item, dk.monday_col_directory_role);
    const manager = colText(item, dk.monday_col_directory_manager);
    const empId   = deps.resolve(item.name, email || null);

    if (empId !== null) {
      resolved.push({ item, empId, email, role, manager });
    } else {
      const isCurrent = item.group?.id === dk.monday_group_directory_current;
      // Only Current Employees may be offered for creation. Someone in Past
      // employees is a former employee: creating them would add an ex-employee
      // to the active roster.
      if (email && !emailSet.has(email) && isCurrent) {
        if (!candidateMap.has(email)) {
          candidateMap.set(email, { name: item.name, email, role, manager, isCurrent });
        }
      }
      unmatchedCount++;
    }
  }
  const newCandidates = Array.from(candidateMap.values()).map(({ name, email, role, manager }) => ({ name, email, role, manager }));

  // ── Step 2: collapse duplicate rows per employee ───────────────────────────
  const { winners, duplicatesCollapsed } = deduplicateByEmployee(resolved, dk.monday_group_directory_current);

  // ── Step 3: write each winner ──────────────────────────────────────────────
  for (const { item, empId, role, manager } of winners) {
    const emp = empById.get(empId);
    if (!emp) continue;

    // Active = row is in the current-employees group (not the Status column).
    const mondayActive = item.group?.id === dk.monday_group_directory_current;

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
  }

  // ── Step 4: offer new employees for creation ───────────────────────────────
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

  // ── Step 5: start dates from onboarding board ─────────────────────────────
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

  // ── Step 6: summary ───────────────────────────────────────────────────────
  const dupPart = duplicatesCollapsed > 0
    ? ` · ${duplicatesCollapsed} duplicate row${duplicatesCollapsed === 1 ? '' : 's'} collapsed`
    : '';
  const matched = items.length - unmatchedCount;
  deps.onSummary(
    `${updatedCount} updated · ${createdCount} created · ${startDatesSet} start dates set${dupPart} · ${unmatchedCount} unmatched`,
  );
  return { items: items.length, matched, unmatched: unmatchedCount };
}
