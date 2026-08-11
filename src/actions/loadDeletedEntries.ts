import { action } from '@uibakery/data';

function loadDeletedEntries() {
  return action('loadDeletedEntries', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT pe.id, pe.period_name, e.display_name AS employee_name, pe.work_date,
             pe.entry_time, pe.exit_time, pe.scheduled_start, pe.scheduled_end,
             pe.late_minutes, pe.early_leave_minutes, pe.discount_total_minutes,
             pe.event_type_1, pe.pay_impact_1, pe.event_type_2, pe.pay_impact_2,
             pe.status_current, pe.deleted_at, pe.deleted_by
      FROM payroll_entries pe
      JOIN employees e ON e.id = pe.employee_id
      WHERE pe.deleted_at IS NOT NULL
        AND (COALESCE({{params.periodName}}, '') = '' OR pe.period_name = {{params.periodName}})
      ORDER BY pe.deleted_at DESC;
    `,
  });
}

export default loadDeletedEntries;
