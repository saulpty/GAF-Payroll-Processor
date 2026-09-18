import { action } from '@uibakery/data';

function claimSyncRun() {
  return action('claimSyncRun', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO sync_log (kind, ran_by, created, updated, error)
      SELECT {{params.kind}}::text, {{params.ranBy}}::text, 0, 0, 'running'
      WHERE NOT EXISTS (
        SELECT 1 FROM sync_log
        WHERE kind = {{params.kind}}::text
          AND ran_at > NOW() - ({{params.intervalMinutes}}::int * INTERVAL '1 minute')
      )
      RETURNING id;
    `,
  });
}

export default claimSyncRun;
