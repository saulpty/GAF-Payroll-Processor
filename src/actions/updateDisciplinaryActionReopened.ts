import { action } from '@uibakery/data';

// Reopens one disciplinary action by clearing all three closure columns.
// Closure is the only write this app performs against the disciplinary
// database, so a misclick must be reversible.
function updateDisciplinaryActionReopened() {
  return action('updateDisciplinaryActionReopened', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      UPDATE disciplinary_actions
      SET closed_at    = NULL,
          closed_by    = NULL,
          closure_note = NULL
      WHERE id = {{params.id}}::bigint
      RETURNING id, ref;
    `,
  });
}

export default updateDisciplinaryActionReopened;
