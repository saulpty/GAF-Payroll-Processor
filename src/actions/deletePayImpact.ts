import { action } from '@uibakery/data';

function deletePayImpact() {
  return action('deletePayImpact', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `DELETE FROM pay_impacts WHERE id = {{params.id}}::bigint;`,
  });
}

export default deletePayImpact;
