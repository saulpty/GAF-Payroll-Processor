import { action } from '@uibakery/data';

function loadActionRequired() {
  return action('loadActionRequired', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT pe.id, pe.period_name, e.display_name AS employee_name, pe.work_date,
             pe.entry_time, pe.exit_time, pe.scheduled_start, pe.grace_until, pe.scheduled_end,
             pe.late_minutes, pe.late_after_grace, pe.early_leave_minutes, pe.discount_total_minutes,
             pe.payroll_ready, pe.event_type_1, pe.pay_impact_1, pe.event_type_2, pe.pay_impact_2,
             pe.documentation, pe.notes, pe.auto_notes, pe.initial_status, pe.status_current
      FROM payroll_entries pe
      JOIN employees e ON e.id = pe.employee_id
      WHERE pe.period_name = {{params.periodName}}
        AND pe.initial_status IN ('RED','YELLOW')
        AND pe.payroll_ready = 'NO'
        AND pe.deleted_at IS NULL
      ORDER BY
        CASE pe.initial_status WHEN 'RED' THEN 1 WHEN 'YELLOW' THEN 2 ELSE 3 END,
        e.display_name, pe.work_date;
    `,
  });
}

export default loadActionRequired;
