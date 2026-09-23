import { action } from '@uibakery/data';

function deleteAccessGroup() {
  return action('deleteAccessGroup', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      DELETE FROM access_groups WHERE id = {{params.id}}::bigint AND public.assert_super({{ user.email }}::text);
    `,
  });
}

export default deleteAccessGroup;
