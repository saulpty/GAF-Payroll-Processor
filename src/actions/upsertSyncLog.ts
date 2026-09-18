import { action } from '@uibakery/data';

function upsertSyncLog() {
  return action('upsertSyncLog', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE sync_log
      SET created = {{params.created}}::int,
          updated = {{params.updated}}::int,
          error   = {{params.error}}
      WHERE id = {{params.id}}::bigint;
    `,
  });
}

export default upsertSyncLog;
