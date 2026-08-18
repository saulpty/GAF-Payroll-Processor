import { action } from '@uibakery/data';

function loadDirectoryReconciliation() {
  return action('loadDirectoryReconciliation', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT id AS employee_id, display_name, teramind_email, role, manager, active
      FROM employees
      WHERE ({{params.manager}} IS NULL OR {{params.manager}} = '' OR manager = {{params.manager}})
      ORDER BY display_name
    `,
  });
}

export default loadDirectoryReconciliation;
