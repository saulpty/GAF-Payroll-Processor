import { action } from '@uibakery/data';

function loadSyncLog() {
  return action('loadSyncLog', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT id, kind, ran_at, ran_by, created, updated, error
      FROM sync_log
      ORDER BY ran_at DESC
      LIMIT 200;
    `,
  });
}

export default loadSyncLog;
