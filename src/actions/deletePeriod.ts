import { action } from '@uibakery/data';

function deletePeriod() {
  return action('deletePeriod', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `DELETE FROM periods WHERE period_name = {{params.periodName}} AND public.assert_super({{ user.email }}::text);`,
  });
}

export default deletePeriod;
