import { action } from '@uibakery/data';

function updateEmployeeFlag() {
  return action('updateEmployeeFlag', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE employees SET
        is_grace_list         = {{params.is_grace_list}}::boolean,
        is_macbook_swap       = {{params.is_macbook_swap}}::boolean,
        excluded_from_payroll = {{params.excluded_from_payroll}}::boolean,
        active                = {{params.active}}::boolean
      WHERE id = {{params.id}}::bigint;
    `,
  });
}

export default updateEmployeeFlag;
