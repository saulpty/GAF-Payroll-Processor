// Employee Onboarding board sync (contracts). No React, no hooks.
import {
  pullAllItems, colText, parseDate, batchUpsert,
  requireKeys, SyncDeps, SyncResult,
} from './mondaySync';

const KEYS = [
  'monday_board_onboarding',
  'monday_col_onboarding_position',
  'monday_col_onboarding_state',
  'monday_col_onboarding_manager',
  'monday_col_onboarding_start_date',
  'monday_col_onboarding_contract_end',
] as const;

export async function syncContracts(deps: SyncDeps): Promise<SyncResult> {
  const check = requireKeys(deps.cfg, KEYS);
  if (!check.ok) throw new Error('Missing config: ' + check.missing.join(', '));
  const k = check.map;

  const items = await pullAllItems(
    k.monday_board_onboarding,
    [k.monday_col_onboarding_position, k.monday_col_onboarding_state,
     k.monday_col_onboarding_manager, k.monday_col_onboarding_start_date,
     k.monday_col_onboarding_contract_end],
    deps.pull,
  );

  let unmatched = 0;
  const rows: Record<string, unknown>[] = [];
  const seenIds: string[] = [];

  for (const item of items) {
    seenIds.push(item.id);
    // Contracts board has no email column — resolve by name only
    const empId = deps.resolve(item.name, null);
    if (!empId) unmatched++;

    rows.push({
      monday_item_id:    item.id,
      employee_id:       empId !== null ? String(empId) : '',
      employee_name_raw: item.name,
      employee_email_raw: '',
      board_group:       item.group?.title ?? '',
      position:          colText(item, k.monday_col_onboarding_position),
      state:             colText(item, k.monday_col_onboarding_state),
      manager_raw:       colText(item, k.monday_col_onboarding_manager),
      start_date:        parseDate(item, k.monday_col_onboarding_start_date),
      contract_end_date: parseDate(item, k.monday_col_onboarding_contract_end),
      raw:               item,
    });
  }

  await batchUpsert(rows, seenIds, deps.upsert, deps.markDeleted);
  return { items: items.length, matched: items.length - unmatched, unmatched };
}
