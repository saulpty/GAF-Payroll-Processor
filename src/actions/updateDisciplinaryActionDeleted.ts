import { action } from '@uibakery/data';

// Soft-deletes one disciplinary action (Tim and Saul only: disciplinary_admins, checked in the database).
// The row stays; Restore clears these three columns. The `deleted_at IS NULL`
// guard stops a second click overwriting the first deletion's author or reason.
function updateDisciplinaryActionDeleted() {
  return action('updateDisciplinaryActionDeleted', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      UPDATE disciplinary_actions
      SET deleted_at    = NOW(),
          deleted_by    = lower(btrim({{ user.email }})),
          deletion_note = {{params.note}}
      WHERE id = {{params.id}}::bigint
        AND deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM disciplinary_admins a WHERE a.email = lower(btrim({{ user.email }})))
      RETURNING id, ref, deleted_at::text AS deleted_at, deleted_by, deletion_note;
    `,
  });
}

export default updateDisciplinaryActionDeleted;
