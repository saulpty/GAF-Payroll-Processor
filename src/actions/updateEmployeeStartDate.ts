import { action } from '@uibakery/data';

function updateEmployeeStartDate() {
  return action('updateEmployeeStartDate', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE employees
      SET start_date = {{params.start_date}}::date
      WHERE display_name = {{params.display_name}};
    `,
  });
}

export default updateEmployeeStartDate;
