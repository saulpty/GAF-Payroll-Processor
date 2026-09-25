import { computePunchMinutes } from '@/app/lib/punchMinutes';
import { computeDiscount } from '@/app/lib/classificationEngine';
import { discountLabel } from './arLogic';
import type { EditState, EntryRow } from './arTypes';

/**
 * Live Late / Early and what a commit would deduct right now, with the exact maths
 * the save uses. Shared by the row and the commit confirmation (AR-12), so the two
 * can never disagree.
 */
export function rowDiscount(row: EntryRow, edit: EditState) {
  // Always recompute from the punches, exactly as the save does (stored minutes can be stale).
  const live = computePunchMinutes({
    entry_time: edit.entry_time, exit_time: edit.exit_time,
    scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
  });
  const late = live ? live.late_minutes : row.late_minutes;
  const early = live ? live.early_leave_minutes : row.early_leave_minutes;
  const minutes = computeDiscount({
    event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
    event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
    late_minutes: late, late_after_grace: live ? live.late_after_grace : row.late_after_grace,
    early_leave_minutes: early,
  });
  // "Paid" only once every chosen event also has its impact (the pay decision is made).
  const decided = !!(edit.event_type_1 || edit.event_type_2) && (!edit.event_type_1 || !!edit.pay_impact_1) && (!edit.event_type_2 || !!edit.pay_impact_2);
  return { late, early, minutes, discount: discountLabel(minutes, decided) };
}
