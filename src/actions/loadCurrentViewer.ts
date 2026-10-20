import { action } from '@uibakery/data';

function loadCurrentViewer() {
  return action('loadCurrentViewer', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT lower(btrim({{ user.email }}::text))                  AS real_email,
             v.viewer                                         AS email,
             u.id, u.display_name, u.role, u.all_employees, u.active, u.can_refresh_sync
        FROM (SELECT access_viewer({{ user.email }}::text, {{params.viewAs}}::text) AS viewer) v
        LEFT JOIN app_users u ON u.email = v.viewer;
    `,
  });
}

export default loadCurrentViewer;
