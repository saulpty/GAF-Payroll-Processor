import { action } from '@uibakery/data';

function upsertPayrollEntries() {
  return action('upsertPayrollEntries', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO payroll_entries (
        period_name, employee_id, work_date, entry_time, exit_time,
        scheduled_start, grace_until, scheduled_end,
        late_minutes, late_after_grace, early_leave_minutes, discount_total_minutes,
        payroll_ready, event_type_1, pay_impact_1, event_type_2, pay_impact_2,
        documentation, notes, auto_notes, initial_status, status_current, updated_at
      ) VALUES (
        {{params.period_name}}, {{params.employee_id}}, {{params.work_date}},
        {{params.entry_time}}, {{params.exit_time}},
        {{params.scheduled_start}}, {{params.grace_until}}, {{params.scheduled_end}},
        {{params.late_minutes}}::int, {{params.late_after_grace}}::int,
        {{params.early_leave_minutes}}::int, {{params.discount_total_minutes}}::int,
        {{params.payroll_ready}}, {{params.event_type_1}}, {{params.pay_impact_1}},
        {{params.event_type_2}}, {{params.pay_impact_2}},
        {{params.documentation}}, {{params.notes}}, {{params.auto_notes}},
        {{params.initial_status}}, {{params.status_current}}, NOW()
      )
      ON CONFLICT (period_name, employee_id, work_date)
      DO UPDATE SET
        entry_time = EXCLUDED.entry_time,
        exit_time = EXCLUDED.exit_time,
        scheduled_start = EXCLUDED.scheduled_start,
        grace_until = EXCLUDED.grace_until,
        scheduled_end = EXCLUDED.scheduled_end,
        late_minutes = EXCLUDED.late_minutes,
        late_after_grace = EXCLUDED.late_after_grace,
        early_leave_minutes = EXCLUDED.early_leave_minutes,
        discount_total_minutes = EXCLUDED.discount_total_minutes,
        payroll_ready = EXCLUDED.payroll_ready,
        event_type_1 = EXCLUDED.event_type_1,
        pay_impact_1 = EXCLUDED.pay_impact_1,
        event_type_2 = EXCLUDED.event_type_2,
        pay_impact_2 = EXCLUDED.pay_impact_2,
        documentation = EXCLUDED.documentation,
        notes = EXCLUDED.notes,
        auto_notes = EXCLUDED.auto_notes,
        initial_status = EXCLUDED.initial_status,
        status_current = EXCLUDED.status_current,
        updated_at = NOW();
    `,
  });
}

export default upsertPayrollEntries;
