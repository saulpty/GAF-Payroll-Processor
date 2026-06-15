import { action } from '@uibakery/data';

function loadEmployees() {
  return action('loadEmployees', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT e.id, e.display_name, e.teramind_email, e.company_domain,
             e.is_grace_list, e.is_macbook_swap, e.excluded_from_payroll, e.active,
             s.schedule_name, s.dst_start, s.dst_end, s.standard_start, s.standard_end, s.grace_minutes
      FROM employees e
      LEFT JOIN schedules s ON s.id = e.schedule_id
      WHERE e.active = TRUE AND e.excluded_from_payroll = FALSE
      ORDER BY e.display_name;
    `,
  });
}

export default loadEmployees;
