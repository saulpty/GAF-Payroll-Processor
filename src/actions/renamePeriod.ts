import { action } from '@uibakery/data';

function renamePeriod() {
  return action('renamePeriod', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE periods         SET period_name = {{params.newName}} WHERE period_name = {{params.oldName}};
      UPDATE payroll_entries SET period_name = {{params.newName}} WHERE period_name = {{params.oldName}};
      UPDATE run_snapshots   SET period_name = {{params.newName}} WHERE period_name = {{params.oldName}};
      UPDATE hrk_exports     SET period_name = {{params.newName}} WHERE period_name = {{params.oldName}};
    `,
  });
}

export default renamePeriod;
