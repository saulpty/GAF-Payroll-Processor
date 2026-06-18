import { action } from '@uibakery/data';

function updateEmployeeRoleManager() {
  return action('updateEmployeeRoleManager', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE employees
         SET role    = {{params.role}},
             manager = {{params.manager}}
       WHERE id = {{params.id}}::bigint;
    `,
  });
}

export default updateEmployeeRoleManager;
