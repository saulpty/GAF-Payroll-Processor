import { action } from '@uibakery/data';

function loadEventTypes() {
  return action('loadEventTypes', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `SELECT id, name FROM event_types ORDER BY id;`,
  });
}

export default loadEventTypes;
