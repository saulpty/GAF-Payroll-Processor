import { action } from '@uibakery/data';

// Restores one soft-deleted disciplinary action (Tim and Saul only) by clearing the three deletion
// columns. Closure columns are left untouched.
function updateDisciplinaryActionRestored() {
  return action('updateDisciplinaryActionRestored', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      UPDATE disciplinary_actions
      SET deleted_at    = NULL,
          deleted_by    = NULL,
          deletion_note = NULL
      WHERE id = {{params.id}}::bigint
        AND EXISTS (SELECT 1 FROM disciplinary_admins a WHERE a.email = lower(btrim({{ user.email }})))
      RETURNING id, ref;
    `,
  });
}

export default updateDisciplinaryActionRestored;
