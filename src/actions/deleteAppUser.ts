import { action } from '@uibakery/data';

function deleteAppUser() {
  return action('deleteAppUser', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      DELETE FROM app_users u
       WHERE u.id = {{params.id}}::bigint
         AND u.email <> lower(btrim({{ user.email }}::text))
         AND NOT (u.role = 'super_user'
                  AND (SELECT count(*) FROM app_users WHERE role = 'super_user' AND active) <= 1)
         AND public.assert_super({{ user.email }}::text);
    `,
  });
}

export default deleteAppUser;
