import { action } from '@uibakery/data';

// Restores one soft-deleted disciplinary action by clearing the three deletion
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
      RETURNING id, ref;
    `,
  });
}

export default updateDisciplinaryActionRestored;
