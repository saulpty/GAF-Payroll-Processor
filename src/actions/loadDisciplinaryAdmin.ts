import { action } from '@uibakery/data';

// Is the signed-in person a disciplinary admin (Tim or Saul)? The list is the
// disciplinary_admins table in the form app's database. {{ user.email }} is
// filled in by UI Bakery on the server, so the browser cannot claim to be
// someone else. The UI uses this only to show or hide buttons; the real lock is
// the same EXISTS inside every edit, delete and restore statement.
function loadDisciplinaryAdmin() {
  return action('loadDisciplinaryAdmin', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      SELECT EXISTS (
               SELECT 1 FROM disciplinary_admins a
               WHERE a.email = lower(btrim({{ user.email }}))
             ) AS is_admin;
    `,
  });
}

export default loadDisciplinaryAdmin;
