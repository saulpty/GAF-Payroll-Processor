import { action } from '@uibakery/data';

function restorePayrollEntry() {
  return action('restorePayrollEntry', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE payroll_entries
      SET deleted_at = NULL, deleted_by = NULL
      WHERE id = {{params.id}}::bigint;
    `,
  });
}

export default restorePayrollEntry;
