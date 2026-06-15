import { action } from '@uibakery/data';

function loadAllEmployees() {
  return action('loadAllEmployees', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT e.id, e.display_name, e.teramind_email, e.company_domain,
             e.is_grace_list, e.is_macbook_swap, e.excluded_from_payroll, e.active,
             e.start_date::text AS start_date, e.end_date::text AS end_date, e.notes,
             s.schedule_name, s.id AS schedule_id
      FROM employees e
      LEFT JOIN schedules s ON s.id = e.schedule_id
      ORDER BY e.display_name;
    `,
  });
}

export default loadAllEmployees;
