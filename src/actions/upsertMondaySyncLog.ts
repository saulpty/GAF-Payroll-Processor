import { action } from '@uibakery/data';

function upsertMondaySyncLog() {
  return action('upsertMondaySyncLog', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO monday_sync_log (board_key, last_synced_at, item_count, matched_count, unmatched_count, last_error)
      VALUES (
        {{params.board_key}},
        NOW(),
        {{params.item_count}},
        {{params.matched_count}},
        {{params.unmatched_count}},
        {{params.last_error}}
      )
      ON CONFLICT (board_key) DO UPDATE SET
        last_synced_at   = EXCLUDED.last_synced_at,
        item_count       = EXCLUDED.item_count,
        matched_count    = EXCLUDED.matched_count,
        unmatched_count  = EXCLUDED.unmatched_count,
        last_error       = EXCLUDED.last_error;
    `,
  });
}

export default upsertMondaySyncLog;
