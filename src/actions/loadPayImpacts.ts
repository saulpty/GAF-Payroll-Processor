import { action } from '@uibakery/data';

function loadPayImpacts() {
  return action('loadPayImpacts', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `SELECT id, name FROM pay_impacts ORDER BY id;`,
  });
}

export default loadPayImpacts;
