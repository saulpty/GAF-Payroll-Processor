import { action } from '@uibakery/data';

function upsertAppUser() {
  return action('upsertAppUser', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      WITH upd AS (
        UPDATE app_users
           SET email = lower(btrim({{params.email}}::text)),
               display_name = btrim(COALESCE({{params.display_name}}::text, '')),
               role = {{params.role}}::text,
               all_employees = COALESCE({{params.all_employees}}::boolean, false),
               active = COALESCE({{params.active}}::boolean, true),
               notes = {{params.notes}}::text,
               updated_at = now()
         WHERE id = {{params.id}}::bigint
        RETURNING id
      )
      INSERT INTO app_users (email, display_name, role, all_employees, active, notes)
      SELECT lower(btrim({{params.email}}::text)), btrim(COALESCE({{params.display_name}}::text, '')), {{params.role}}::text,
             COALESCE({{params.all_employees}}::boolean, false), COALESCE({{params.active}}::boolean, true), {{params.notes}}::text
       WHERE NOT EXISTS (SELECT 1 FROM upd)
      ON CONFLICT (email) DO UPDATE
         SET display_name = EXCLUDED.display_name, role = EXCLUDED.role,
             all_employees = EXCLUDED.all_employees, active = EXCLUDED.active,
             notes = EXCLUDED.notes, updated_at = now();
    `,
  });
}

export default upsertAppUser;
