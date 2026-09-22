import { action } from '@uibakery/data';

// Pull history for the Teramind admin tab. Automatic keep-fresh pulls happen every few minutes, so
// only the five most recent of them are returned — otherwise they would push the manual, backfill
// and capture rows (which "already covered" checks depend on) out of the list.
// `manager` is accepted for the house rule that every load* takes one; it is not used.
function loadTeramindPullLog() {
  return action('loadTeramindPullLog', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        id,
        date_from,
        date_to,
        pulled_at,
        to_char(pulled_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS pulled_ymd,
        pulled_by,
        trigger,
        agent_count,
        row_count,
        saved_count,
        truncated,
        error,
        source
      FROM teramind_pull_log
      WHERE trigger <> 'auto'
         OR id IN (SELECT id FROM teramind_pull_log WHERE trigger = 'auto' ORDER BY pulled_at DESC LIMIT 5)
      ORDER BY pulled_at DESC
      LIMIT 150;
    `,
  });
}

export default loadTeramindPullLog;
