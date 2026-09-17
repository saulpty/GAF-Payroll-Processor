import { action } from '@uibakery/data';

function loadTeramindPullLog() {
  return action('loadTeramindPullLog', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        id,
        date_from,
        date_to,
        pulled_at,
        pulled_by,
        trigger,
        agent_count,
        row_count,
        saved_count,
        truncated,
        error,
        source
      FROM teramind_pull_log
      ORDER BY pulled_at DESC
      LIMIT 100;
    `,
  });
}

export default loadTeramindPullLog;
