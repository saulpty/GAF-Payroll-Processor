import { action } from '@uibakery/data';

function loadVisibleEmployeeIds() {
  return action('loadVisibleEmployeeIds', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT a.employee_id
        FROM v_employee_access a
       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text)
       ORDER BY a.employee_id;
    `,
  });
}

export default loadVisibleEmployeeIds;
