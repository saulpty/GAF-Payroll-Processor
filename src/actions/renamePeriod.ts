import { action } from '@uibakery/data';

function renamePeriod() {
  return action('renamePeriod', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE periods         SET period_name = {{params.newName}} WHERE period_name = {{params.oldName}} AND public.assert_super({{ user.email }}::text);
      UPDATE payroll_entries SET period_name = {{params.newName}} WHERE period_name = {{params.oldName}} AND public.assert_super({{ user.email }}::text);
      UPDATE run_snapshots   SET period_name = {{params.newName}} WHERE period_name = {{params.oldName}} AND public.assert_super({{ user.email }}::text);
      UPDATE hrk_exports     SET period_name = {{params.newName}} WHERE period_name = {{params.oldName}} AND public.assert_super({{ user.email }}::text);
    `,
  });
}

export default renamePeriod;
