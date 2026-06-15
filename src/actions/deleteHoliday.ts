import { action } from '@uibakery/data';

function deleteHoliday() {
  return action('deleteHoliday', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `DELETE FROM holidays WHERE id = {{params.id}}::bigint;`,
  });
}

export default deleteHoliday;
