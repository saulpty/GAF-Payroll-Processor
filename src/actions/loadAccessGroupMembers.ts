import { action } from '@uibakery/data';

function loadAccessGroupMembers() {
  return action('loadAccessGroupMembers', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT m.group_id, e.id AS employee_id, e.display_name, e.teramind_email, e.active,
             COALESCE(e.manager, '') AS monday_manager
        FROM access_group_members m
        JOIN employees e ON e.id = m.employee_id
       ORDER BY e.display_name;
    `,
  });
}

export default loadAccessGroupMembers;
