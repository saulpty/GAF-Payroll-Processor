// GAF Attendance board sync. No React, no hooks.
import {
  pullAllItems, colText, parseDate, batchUpsert,
  requireKeys, SyncDeps, SyncResult,
} from './mondaySync';

const KEYS = [
  'monday_board_attendance',
  'monday_col_attendance_email',
  'monday_col_attendance_date',
  'monday_col_attendance_type',
  'monday_col_attendance_reason',
  'monday_col_attendance_details',
  'monday_col_attendance_eta',
] as const;

export async function syncAttendanceForms(deps: SyncDeps): Promise<SyncResult> {
  const check = requireKeys(deps.cfg, KEYS);
  if (!check.ok) throw new Error('Missing config: ' + check.missing.join(', '));
  const k = check.map;

  const items = await pullAllItems(
    k.monday_board_attendance,
    [k.monday_col_attendance_email, k.monday_col_attendance_date,
     k.monday_col_attendance_type, k.monday_col_attendance_reason,
     k.monday_col_attendance_details, k.monday_col_attendance_eta],
    deps.pull,
  );

  let unmatched = 0;
  const rows: Record<string, unknown>[] = [];
  const seenIds: string[] = [];

  for (const item of items) {
    seenIds.push(item.id);
    const email = colText(item, k.monday_col_attendance_email).toLowerCase();
    const empId = deps.resolve(item.name, email || null);
    if (!empId) unmatched++;

    const formDate = parseDate(item, k.monday_col_attendance_date);
    // submitted_at: use date text as-is (may include time on some Monday column types)
    const submittedAt = colText(item, k.monday_col_attendance_date);

    rows.push({
      monday_item_id:    item.id,
      employee_id:       empId !== null ? String(empId) : '',
      employee_name_raw: item.name,
      employee_email_raw: email,
      board_group:       item.group?.title ?? '',
      form_type:         colText(item, k.monday_col_attendance_type),
      reason:            colText(item, k.monday_col_attendance_reason),
      details:           colText(item, k.monday_col_attendance_details),
      eta:               colText(item, k.monday_col_attendance_eta),
      form_date:         formDate,
      submitted_at:      submittedAt,
      raw:               item,
    });
  }

  await batchUpsert(rows, seenIds, deps.upsert, deps.markDeleted);
  return { items: items.length, matched: items.length - unmatched, unmatched };
}
