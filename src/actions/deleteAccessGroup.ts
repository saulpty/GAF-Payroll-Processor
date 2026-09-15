import { action } from '@uibakery/data';

function deleteAccessGroup() {
  return action('deleteAccessGroup', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      DELETE FROM access_groups WHERE id = {{params.id}}::bigint;
    `,
  });
}

export default deleteAccessGroup;
