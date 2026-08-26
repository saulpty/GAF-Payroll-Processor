import { action } from '@uibakery/data';

function loadCommittedEntries() {
  return action('loadCommittedEntries', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT pe.id, pe.period_name, e.display_name AS employee_name, pe.work_date,
             pe.event_type_1, pe.pay_impact_1, pe.event_type_2, pe.pay_impact_2,
             pe.documentation, pe.notes, pe.auto_notes,
             pe.initial_status, pe.status_current, pe.discount_total_minutes,
             pe.updated_at
      FROM payroll_entries pe
      JOIN employees e ON e.id = pe.employee_id
      WHERE pe.period_name = {{params.periodName}}
        AND pe.initial_status IN ('RED','YELLOW')
        AND pe.payroll_ready = 'YES'
        AND pe.deleted_at IS NULL
      ORDER BY pe.updated_at DESC, e.display_name, pe.work_date;
    `,
  });
}

export default loadCommittedEntries;
