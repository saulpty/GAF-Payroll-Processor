import { action } from '@uibakery/data';

// Who is filing: the signed-in UI Bakery user (never a typed value), and whether
// they are in disciplinary_admins (admins may file for every current employee).
// Always returns exactly one row.
function loadCurrentFiler() {
  return action('loadCurrentFiler', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      WITH me AS (
        SELECT lower(btrim(coalesce({{ user.email }}::text, ''))) AS email
      )
      SELECT me.email,
             (a.email IS NOT NULL) AS is_admin,
             a.name                AS admin_name
        FROM me
        LEFT JOIN disciplinary_admins a ON a.email = me.email;
    `,
  });
}

export default loadCurrentFiler;
