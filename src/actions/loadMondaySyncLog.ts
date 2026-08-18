import { action } from '@uibakery/data';

function loadMondaySyncLog() {
  return action('loadMondaySyncLog', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT board_key, last_synced_at, item_count, matched_count, unmatched_count, last_error
      FROM monday_sync_log
      ORDER BY board_key;
    `,
  });
}

export default loadMondaySyncLog;
