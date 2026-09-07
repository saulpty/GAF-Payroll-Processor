import { action } from '@uibakery/data';

// Closes one disciplinary action. The `closed_at IS NULL` guard makes this
// idempotent: a second click cannot overwrite the first closure's author or note.
function updateDisciplinaryActionClosed() {
  return action('updateDisciplinaryActionClosed', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      UPDATE disciplinary_actions
      SET closed_at    = NOW(),
          closed_by    = {{params.closedBy}},
          closure_note = {{params.note}}
      WHERE id = {{params.id}}::bigint
        AND closed_at IS NULL
      RETURNING id, ref, closed_at::text AS closed_at, closed_by, closure_note;
    `,
  });
}

export default updateDisciplinaryActionClosed;
