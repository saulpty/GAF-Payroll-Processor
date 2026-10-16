import { action } from '@uibakery/data';

function updateEmployeeRoleManager() {
  return action('updateEmployeeRoleManager', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE employees
         SET role    = {{params.role}},
             manager = {{params.manager}},
             country = COALESCE(NULLIF({{params.country}}, ''), country)
       WHERE id = {{params.id}}::bigint
         AND public.assert_super({{ user.email }}::text);
    `,
  });
}

export default updateEmployeeRoleManager;
