import { action } from '@uibakery/data';

function deletePeriodSnapshots() {
  return action('deletePeriodSnapshots', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `DELETE FROM run_snapshots WHERE period_name = {{params.periodName}} AND public.assert_super({{ user.email }}::text);`,
  });
}

export default deletePeriodSnapshots;
