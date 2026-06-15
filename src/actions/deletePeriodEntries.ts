import { action } from '@uibakery/data';

function deletePeriodEntries() {
  return action('deletePeriodEntries', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `DELETE FROM payroll_entries WHERE period_name = {{params.periodName}};`,
  });
}

export default deletePeriodEntries;
