// Permissions & Requests board sync. No React, no hooks.
import {
  pullAllItems, colText, parseDateRange, parseDate, batchUpsert,
  requireKeys, SyncDeps, SyncResult,
} from './mondaySync';

const KEYS = [
  'monday_board_permissions',
  'monday_col_requests_email',
  'monday_col_requests_manager_email',
  'monday_col_requests_request_type',
  'monday_col_requests_permission_type',
  'monday_col_requests_date_range',
  'monday_col_requests_return_date',
  'monday_col_requests_start_datetime',
  'monday_col_requests_end_datetime',
  'monday_col_requests_total_days',
  'monday_col_requests_hours_approved',
  'monday_col_requests_reason',
  'monday_col_requests_details',
  'monday_col_requests_submitted',
] as const;

export async function syncRequests(deps: SyncDeps): Promise<SyncResult> {
  const check = requireKeys(deps.cfg, KEYS);
  if (!check.ok) throw new Error('Missing config: ' + check.missing.join(', '));
  const k = check.map;

  const items = await pullAllItems(
    k.monday_board_permissions,
    [k.monday_col_requests_email, k.monday_col_requests_manager_email,
     k.monday_col_requests_request_type, k.monday_col_requests_permission_type,
     k.monday_col_requests_date_range, k.monday_col_requests_return_date,
     k.monday_col_requests_start_datetime, k.monday_col_requests_end_datetime,
     k.monday_col_requests_total_days, k.monday_col_requests_hours_approved,
     k.monday_col_requests_reason, k.monday_col_requests_details,
     k.monday_col_requests_submitted],
    deps.pull,
  );

  let unmatched = 0;
  const rows: Record<string, unknown>[] = [];
  const seenIds: string[] = [];

  for (const item of items) {
    seenIds.push(item.id);
    const email    = colText(item, k.monday_col_requests_email).toLowerCase();
    const empId    = deps.resolve(item.name, email || null);
    if (!empId) unmatched++;

    const range    = parseDateRange(item, k.monday_col_requests_date_range);
    const totalTxt = colText(item, k.monday_col_requests_total_days);
    const hoursTxt = colText(item, k.monday_col_requests_hours_approved);

    rows.push({
      monday_item_id:       item.id,
      employee_id:          empId !== null ? String(empId) : '',
      employee_name_raw:    item.name,
      employee_email_raw:   email,
      manager_email_raw:    colText(item, k.monday_col_requests_manager_email),
      board_group:          item.group?.title ?? '',
      request_type:         colText(item, k.monday_col_requests_request_type),
      permission_type:      colText(item, k.monday_col_requests_permission_type),
      start_date:           range.from,
      end_date:             range.to,
      return_date:          parseDate(item, k.monday_col_requests_return_date),
      start_datetime:       colText(item, k.monday_col_requests_start_datetime),
      end_datetime:         colText(item, k.monday_col_requests_end_datetime),
      total_days_requested: totalTxt ? String(Number(totalTxt)) : '',
      hours_approved:       hoursTxt ? String(Number(hoursTxt)) : '',
      reason:               colText(item, k.monday_col_requests_reason),
      details:              colText(item, k.monday_col_requests_details),
      submitted_at:         colText(item, k.monday_col_requests_submitted),
      raw:                  item,
    });
  }

  await batchUpsert(rows, seenIds, deps.upsert, deps.markDeleted);
  return { items: items.length, matched: items.length - unmatched, unmatched };
}
