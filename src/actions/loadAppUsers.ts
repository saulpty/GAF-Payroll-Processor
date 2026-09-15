import { action } from '@uibakery/data';

function loadAppUsers() {
  return action('loadAppUsers', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT u.id, u.email, u.display_name, u.role, u.all_employees, u.active,
             COALESCE(u.notes, '') AS notes,
             (SELECT count(*)::int FROM access_group_managers gm WHERE gm.user_id = u.id) AS group_count
        FROM app_users u
       ORDER BY (u.role = 'super_user') DESC, u.display_name, u.email;
    `,
  });
}

export default loadAppUsers;
