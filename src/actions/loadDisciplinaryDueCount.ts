import { action } from '@uibakery/data';

function loadDisciplinaryDueCount() {
  return action('loadDisciplinaryDueCount', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      SELECT COUNT(*)::int AS count
      FROM disciplinary_actions
      WHERE closed_at IS NULL
        AND revaluation_date IS NOT NULL
        AND revaluation_date <= ({{params.asOf}}::date + 30);
    `,
  });
}

export default loadDisciplinaryDueCount;
