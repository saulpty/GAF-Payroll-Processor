import { useMutateAction } from '@uibakery/data';
import updatePayrollEntryAction from '@/actions/updatePayrollEntry';
import updatePunchTimesAction from '@/actions/updatePunchTimes';
import { computeDerivedFields } from '@/app/lib/classificationEngine';
import { computePunchMinutes } from '@/app/lib/punchMinutes';
import type { CommittedRow, EditState, EntryRow } from './arTypes';

/** Row save and revert, split out of ActionRequired.tsx (AR-1). Same two actions, same order. */
export function useArSave(getEdit: (row: EntryRow) => EditState) {
  const [updateEntry] = useMutateAction(updatePayrollEntryAction);
  const [updateTimes] = useMutateAction(updatePunchTimesAction);

  // Save a single row. Returns the derived status plus the row as saved (what a
  // revert/Undo needs); null when the row was refused.
  const saveRow = async (row: EntryRow): Promise<{ status: string; saved: CommittedRow } | null> => {
    const edit = getEdit(row);
    // Minutes are recomputed from the row's punches on every commit, so a row
    // whose stored minutes are stale is corrected by any commit.
    const mins = computePunchMinutes({
      entry_time: edit.entry_time, exit_time: edit.exit_time,
      scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
    });
    if (!mins) return null;
    const derived = computeDerivedFields({
      event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
      event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
      late_minutes: mins.late_minutes, late_after_grace: mins.late_after_grace,
      early_leave_minutes: mins.early_leave_minutes, initial_status: row.initial_status,
    });
    await updateTimes({
      id: row.id,
      entry_time: edit.entry_time || null, exit_time: edit.exit_time || null,
      late_minutes: mins.late_minutes, late_after_grace: mins.late_after_grace, early_leave_minutes: mins.early_leave_minutes,
    });
    await updateEntry({
      id: row.id,
      event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
      event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
      documentation: edit.documentation, notes: edit.notes,
      discount_total_minutes: derived.discount_total_minutes,
      payroll_ready: derived.payroll_ready, status_current: derived.status_current,
    });
    return {
      status: derived.status_current,
      saved: {
        id: row.id, period_name: row.period_name, employee_name: row.employee_name, work_date: row.work_date,
        event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
        event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
        documentation: edit.documentation, notes: edit.notes, auto_notes: row.auto_notes,
        initial_status: row.initial_status, status_current: derived.status_current,
        discount_total_minutes: derived.discount_total_minutes, updated_at: '',
      },
    };
  };

  // Put a committed row back to its initial status (payroll_ready NO)
  const revertRow = async (r: CommittedRow): Promise<void> => {
    await updateEntry({
      id: r.id,
      event_type_1: r.event_type_1,
      pay_impact_1: r.pay_impact_1,
      event_type_2: r.event_type_2,
      pay_impact_2: r.pay_impact_2,
      documentation: r.documentation,
      notes: r.notes,
      discount_total_minutes: r.discount_total_minutes,
      payroll_ready: 'NO',
      status_current: r.initial_status,
    });
  };

  return { saveRow, revertRow };
}
