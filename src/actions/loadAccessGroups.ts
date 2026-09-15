import { action } from '@uibakery/data';

function loadAccessGroups() {
  return action('loadAccessGroups', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT g.id, g.name, COALESCE(g.notes, '') AS notes,
             (SELECT count(*)::int FROM access_group_members m WHERE m.group_id = g.id) AS member_count,
             COALESCE((
               SELECT json_agg(json_build_object('user_id', u.id, 'email', u.email,
                                                 'display_name', u.display_name, 'rank', gm.rank)
                               ORDER BY gm.rank, u.display_name)
                 FROM access_group_managers gm JOIN app_users u ON u.id = gm.user_id
                WHERE gm.group_id = g.id), '[]'::json) AS managers
        FROM access_groups g
       ORDER BY g.name;
    `,
  });
}

export default loadAccessGroups;
