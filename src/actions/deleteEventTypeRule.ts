import { action } from '@uibakery/data';

function deleteEventTypeRule() {
  return action('deleteEventTypeRule', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `DELETE FROM event_type_rules WHERE id = {{params.id}}::bigint;`,
  });
}

export default deleteEventTypeRule;
