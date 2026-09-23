import { action } from '@uibakery/data';

function upsertAccessGroupManager() {
  return action('upsertAccessGroupManager', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO access_group_managers (group_id, user_id, rank)
      SELECT {{params.group_id}}::bigint, {{params.user_id}}::bigint, COALESCE({{params.rank}}::smallint, 1)
      WHERE public.assert_super({{ user.email }}::text)
      ON CONFLICT (group_id, user_id) DO UPDATE SET rank = EXCLUDED.rank;
    `,
  });
}

export default upsertAccessGroupManager;
