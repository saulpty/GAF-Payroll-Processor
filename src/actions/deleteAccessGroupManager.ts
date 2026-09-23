import { action } from '@uibakery/data';

function deleteAccessGroupManager() {
  return action('deleteAccessGroupManager', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      DELETE FROM access_group_managers
       WHERE group_id = {{params.group_id}}::bigint AND user_id = {{params.user_id}}::bigint
         AND public.assert_super({{ user.email }}::text);
    `,
  });
}

export default deleteAccessGroupManager;
