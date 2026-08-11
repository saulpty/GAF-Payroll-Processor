import { action } from '@uibakery/data';

function softDeletePayrollEntry() {
  return action('softDeletePayrollEntry', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE payroll_entries
      SET deleted_at = NOW(), deleted_by = {{params.deletedBy}}
      WHERE id = {{params.id}}::bigint;
    `,
  });
}

export default softDeletePayrollEntry;
