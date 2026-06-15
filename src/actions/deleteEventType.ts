import { action } from '@uibakery/data';

function deleteEventType() {
  return action('deleteEventType', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `DELETE FROM event_types WHERE id = {{params.id}}::bigint;`,
  });
}

export default deleteEventType;
