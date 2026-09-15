import { action } from '@uibakery/data';

function loadUnassignedEmployees() {
  return action('loadUnassignedEmployees', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT e.id AS employee_id, e.display_name, e.teramind_email, COALESCE(e.manager, '') AS monday_manager
        FROM employees e
       WHERE e.active = true
         AND COALESCE(e.excluded_from_payroll, false) = false
         AND NOT EXISTS (SELECT 1 FROM access_group_members m WHERE m.employee_id = e.id)
       ORDER BY e.display_name;
    `,
  });
}

export default loadUnassignedEmployees;
