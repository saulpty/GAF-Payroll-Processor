import { action } from '@uibakery/data';

// Soft-deletes one disciplinary action (super users only, enforced in the UI).
// The row stays; Restore clears these three columns. The `deleted_at IS NULL`
// guard stops a second click overwriting the first deletion's author or reason.
function updateDisciplinaryActionDeleted() {
  return action('updateDisciplinaryActionDeleted', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      UPDATE disciplinary_actions
      SET deleted_at    = NOW(),
          deleted_by    = {{params.deletedBy}},
          deletion_note = {{params.note}}
      WHERE id = {{params.id}}::bigint
        AND deleted_at IS NULL
      RETURNING id, ref, deleted_at::text AS deleted_at, deleted_by, deletion_note;
    `,
  });
}

export default updateDisciplinaryActionDeleted;
