import { action } from '@uibakery/data';

function loadPayrollMaster() {
  return action('loadPayrollMaster', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT pe.id, pe.period_name, e.display_name AS employee_name, pe.work_date,
             pe.entry_time, pe.exit_time, pe.scheduled_start, pe.grace_until, pe.scheduled_end,
             pe.late_minutes, pe.late_after_grace, pe.early_leave_minutes, pe.discount_total_minutes,
             pe.payroll_ready, pe.event_type_1, pe.pay_impact_1, pe.event_type_2, pe.pay_impact_2,
             pe.documentation, pe.notes, pe.auto_notes, pe.initial_status, pe.status_current
      FROM payroll_entries pe
      JOIN employees e ON e.id = pe.employee_id
      WHERE
        pe.deleted_at IS NULL
        AND (COALESCE({{params.periodName}}, '') = '' OR pe.period_name = {{params.periodName}})
        AND (COALESCE({{params.employeeName}}, '') = '' OR e.display_name ILIKE {{ '%' + params.employeeName + '%' }})
        AND (COALESCE({{params.status}}, '') = '' OR pe.status_current = {{params.status}})
      ORDER BY pe.period_name DESC, e.display_name, pe.work_date
      LIMIT 500 OFFSET {{params.offset}}::int;
    `,
  });
}

export default loadPayrollMaster;
